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

### Polling Approach (Conceptual)

Using the JS SDK v0.6.0 `publicStorage.list()` to poll for changes:

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
