# Indexer Patterns

## Why Indexers?

Homeservers are per-user key-value stores. They cannot efficiently answer cross-user queries like "show posts from people I follow" or "what's trending." Indexers aggregate data from multiple homeservers into a queryable database.

---

## Pubky Nexus (Official Indexer)

Source: https://github.com/pubky/pubky-nexus

### Architecture

```
Homeserver(s)
     │ events
     ▼
nexus-watcher ──→ Neo4j (social graph) + Redis (cache/fast queries)
                          │
                    nexus-webapi ──→ REST API (Swagger UI)
```

| Component | Purpose |
|-----------|---------|
| `nexus-watcher` | Subscribes to homeserver events, parses pubky-app-specs data, writes to databases |
| `nexus-webapi` | REST API server, reads from Neo4j/Redis, serves client queries |
| `nexus-common` | Shared library: models, DB connectors, query logic |
| `nexusd` | Orchestrator: runs watcher + API, manages DB migrations and reindexing |

### API Access

- **Production:** `https://nexus.pubky.app/swagger-ui/`
- **Staging:** `https://nexus.staging.pubky.app/swagger-ui/`
- Route prefix: `/v0` (unstable, breaking changes expected)

### Querying Nexus from a Client

Nexus is a plain REST API — no SDK needed:

```javascript
// Fetch a user's info
const res = await fetch(`https://nexus.pubky.app/v0/user/${userPk}`);
const profile = await res.json();

// Fetch a user's posts
const postsRes = await fetch(`https://nexus.pubky.app/v0/user/${userPk}/posts`);
const posts = await postsRes.json();
```

> **Note:** Nexus endpoint paths and response shapes are not documented here because they are `/v0` and change frequently. Always check the Swagger UI for current endpoints.

### Local Development Setup

From the Nexus README:

```bash
git clone https://github.com/pubky/pubky-nexus
cd pubky-nexus

# Start databases
cd docker
cp .env-sample .env
docker compose up -d

# Run Nexus
cargo run -p nexusd

# Or run components separately
cargo run -p nexusd -- watcher
cargo run -p nexusd -- api
```

Local access:
- Swagger UI: `http://localhost:8080/swagger-ui`
- Redis Insight: `http://localhost:8001/redis-stack/browser`
- Neo4j Browser: `http://localhost:7474/browser/`

### Test Data

```bash
cargo run -p nexusd -- db mock   # Load mock data
cargo run -p nexusd -- db clear  # Wipe databases
```

---

## Building a Custom Indexer

When to build your own:
- Your app uses custom data schemas (not pubky-app-specs)
- You need domain-specific queries Nexus doesn't support
- You want a lighter-weight solution or a different database

### General Pattern

```
1. Poll/subscribe to homeserver changes
2. Parse data according to your schemas
3. Store in your database
4. Serve via your API
```

### Efficient Approach: `/events-stream` with Path Filtering

Homeservers expose an `/events-stream` endpoint that supports **per-user cursors** and **path prefix filtering**. This is far more efficient than polling `publicStorage.list()` because:
- You only receive events for your app's namespace (not all user data)
- Cursors let you resume from where you left off (no reprocessing)
- Multiple users on the same homeserver can be batched into a single request

**URL format:**
```
https://<homeserver_pk>/events-stream?path=/pub/myapp/data/&user=<pk1>:<cursor1>&user=<pk2>:<cursor2>
```

- `path=` — filters events to only this path prefix (e.g., `/pub/pubky-canva/pixels/`)
- `user=<pk>` — subscribe to events for this user (no cursor = start from beginning)
- `user=<pk>:<cursor>` — resume from a specific cursor position
- Multiple `user=` params can be combined in one request

**Response format (SSE):**
```
event: PUT
data: pubky://<user_pk>/pub/myapp/data/<id>
data: cursor: 42
data: content_hash: abc123

event: PUT
data: pubky://<user_pk>/pub/myapp/data/<id2>
data: cursor: 43
data: content_hash: def456

```

Events are separated by blank lines. Each event has:
- `event:` — the event type (`PUT`, `DEL`)
- `data:` lines — the pubky URI, cursor value, and content hash

**Rust indexer example (polling pattern):**
```rust
use pubky::{Pubky, PubkyHttpClient};

// Build the events-stream URL with user filters and path prefix
let mut url = format!(
    "https://{}/events-stream?path=/pub/myapp/data/",
    homeserver_pk
);
for (user_pk, cursor) in &users {
    if cursor.is_empty() {
        url.push_str(&format!("&user={}", user_pk));
    } else {
        url.push_str(&format!("&user={}:{}", user_pk, cursor));
    }
}

// Fetch events
let response = pubky.client().request(pubky::Method::GET, &url).send().await?;
let text = response.text().await?;

// Parse SSE events, process each PUT, then persist the cursor per-user
// so the next poll resumes from where you left off
```

**Key design points:**
- Store each user's cursor in your DB alongside their public key
- Group users by homeserver to minimize HTTP requests
- On each poll, only new events since the last cursor are returned
- Parse the `pubky://` URI from each event to extract user PK and resource path
- After processing an event, update that user's stored cursor

### Polling Approach (Alternative — no cursor support)

Using the JS SDK v0.6.0 `publicStorage.list()` to poll for changes. Simpler but less efficient — rescans all entries each time:

```javascript
// CONCEPTUAL — adapt to your needs
import { Pubky } from "@synonymdev/pubky";

const pubky = new Pubky();
const watchedUsers = ["pk1_z32", "pk2_z32", "pk3_z32"]; // users to index

async function pollOnce() {
  for (const userPk of watchedUsers) {
    // List all entries under your app's namespace for this user
    const entries = await pubky.publicStorage.list(
      `${userPk}/pub/eventky.app/events/`,
      null,   // cursor
      false,  // reverse
      100,    // limit
      false   // shallow
    );

    for (const entryUrl of entries) {
      // Fetch the actual data
      const data = await pubky.publicStorage.getJson(entryUrl);
      if (data) {
        // Upsert into your database
        await db.upsertEvent(entryUrl, data);
      }
    }
  }
}

// Poll periodically
setInterval(pollOnce, 30_000); // every 30 seconds
```

> **Note:** The exact return type and format of `publicStorage.list()` should be verified against the SDK's TypeScript types. The conceptual pattern above is correct — `list()` returns entries under a path, which you then `get()` individually.

### Serving Profile Data

Apps commonly display other users' profile names (from `/pub/pubky.app/profile.json`). Since `publicStorage` doesn't work reliably in the browser (see `sdk-usage.md`), **proxy profile reads through your indexer**:

```rust
// Indexer endpoint: GET /api/user/{pk}/profile
async fn get_profile(pubky: &Pubky, public_key: &str) -> Result<serde_json::Value> {
    let uri = format!("pubky://{}/pub/pubky.app/profile.json", public_key);
    let response = pubky.public_storage().get(&uri).await?;
    let bytes = response.bytes().await?;
    Ok(serde_json::from_slice(&bytes)?)
}
```

The frontend then fetches profiles from your indexer API with standard HTTP — no WASM/Pkarr needed client-side. Cache with React Query (`staleTime: 5min`) or similar.

**Auth capabilities note:** Only request capabilities for your own app namespace (e.g., `/pub/myapp/:rw`). Reading other users' public data like `profile.json` does NOT require auth — it goes through `publicStorage` on the server side.

### Crockford Base32 Timestamp IDs

A common pattern for resource IDs is Crockford Base32 encoding of unix microseconds (13 characters for a 64-bit value). **Warning:** The Rust `base32` crate's Crockford implementation does NOT match a typical JS implementation.

The issue: 13 chars × 5 bits = 65 bits, but a u64/i64 is 64 bits. The extra bit is handled differently:
- **JS (manual encoding):** padding zero at the MSB (most significant bit)
- **Rust `base32` crate:** drops the LSB (least significant bit) as padding

This effectively **halves the decoded value** when using the Rust crate, causing timestamp validation to fail.

**Fix:** Write a custom Crockford decoder in Rust that matches the JS encoding:

```rust
fn crockford_decode(s: &str) -> Option<u64> {
    let mut value: u64 = 0;
    for c in s.chars() {
        let digit = match c.to_ascii_uppercase() {
            '0' | 'O' => 0, '1' | 'I' | 'L' => 1,
            '2' => 2, '3' => 3, '4' => 4, '5' => 5, '6' => 6, '7' => 7,
            '8' => 8, '9' => 9, 'A' => 10, 'B' => 11, 'C' => 12,
            'D' => 13, 'E' => 14, 'F' => 15, 'G' => 16, 'H' => 17,
            'J' => 18, 'K' => 19, 'M' => 20, 'N' => 21, 'P' => 22,
            'Q' => 23, 'R' => 24, 'S' => 25, 'T' => 26, 'V' => 27,
            'W' => 28, 'X' => 29, 'Y' => 30, 'Z' => 31,
            _ => return None,
        };
        value = (value << 5) | digit as u64;
    }
    Some(value)
}
```

Do NOT use `base32::decode(Alphabet::Crockford, ...)` for this purpose.

### Design Considerations

**Database choice:**
- **Neo4j** — best for social graph queries (friends-of-friends, recommendations)
- **Redis** — best for caching, counters, fast lookups
- **PostgreSQL** — best for general-purpose relational queries
- **SQLite** — best for simple, single-node deployments

**Scaling:**
- Cache aggressively — most data changes infrequently
- Separate read and write paths
- Consider sharding by user public key

**Data freshness:**
- Polling interval determines staleness (30s–5min typical)
- Nexus aims for real-time ingestion via event subscriptions

**Handling deletions:**
- When a user deletes data, your indexer should detect the absence and remove it
- The `"[DELETED]"` sentinel value in posts/profiles indicates soft deletion
