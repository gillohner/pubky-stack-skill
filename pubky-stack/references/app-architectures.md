# App Architecture Patterns

## Pattern 1: Client → Homeserver (Direct)

```
┌──────────────┐          ┌──────────────┐
│   Frontend   │◄────────►│  Homeserver   │
│  (SDK calls) │          │              │
└──────────────┘          └──────────────┘
```

Frontend uses the Pubky SDK directly. No backend or indexer.

**Best for:** Personal tools, single-user apps, prototyping.

**Limitations:** Cannot query across multiple users. No feeds, search, or social graph queries.

---

## Pattern 2: Client → Indexer + Homeserver

```
┌──────────────┐  read   ┌──────────────┐
│   Frontend   │────────►│   Indexer     │
│              │         │ (Nexus/custom)│
│              │  write  ├──────────────┤
│              │────────►│  Homeserver   │
│  (SDK calls) │         │  (via SDK)    │
└──────────────┘         └──────────────┘
```

Frontend **reads** from an indexer (REST API) and **writes** directly to homeserver via SDK.

**Best for:** Social apps, feeds, search, cross-user queries. This is the most common pattern.

**Used by:** Pubky App (with Nexus), Eventky (with forked Nexus).

**Implementation notes:**
- Homeserver is the source of truth; indexer is a read-optimized view
- Brief delay between write and indexer update (eventual consistency)
- Use optimistic updates on the client for immediate UI feedback

---

## Pattern 3: Custom Backend

```
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   Frontend   │◄────────►│   Backend    │◄────────►│  Homeserver   │
│              │   your   │              │  SDK     │              │
│              │   API    │  + database  │  calls   │              │
└──────────────┘          └──────────────┘          └──────────────┘
```

Frontend talks only to your custom backend. Backend uses SDK to interact with homeservers.

**Best for:** Complex apps with server-side logic, games, marketplaces, analytics.

---

## Choosing a Pattern

| Consideration | Pattern 1 (Direct) | Pattern 2 (Indexer) | Pattern 3 (Backend) |
|--------------|-------------------|--------------------|--------------------|
| Setup complexity | Low | Medium | High |
| Cross-user queries | No | Yes | Yes |
| Server costs | None | Indexer hosting | Full backend hosting |
| Best starting point | Prototyping | Most apps | Complex apps |

---

## Eventky Architecture (Real Example)

From the Eventky README (https://github.com/gillohner/eventky):

```
Next.js Frontend
  ├── Reads user profiles from Nexus API
  ├── Reads/writes event data via Pubky SDK (@synonymdev/pubky)
  ├── Uses pubky-app-specs (WASM) for data validation
  └── Auth via Pubky Ring deeplinks and in-app keypair management

Forked Nexus (indexer)
  ├── Watches homeservers for event data changes
  ├── Indexes into Neo4j + Redis
  └── Serves REST API for event queries

Local dev stack (via tmux script):
  ├── pubky-testnet (homeserver + relay)
  ├── Docker (Neo4j + Redis + PostgreSQL)
  ├── Nexus (watcher + API)
  └── Next.js dev server
```

**Note:** Eventky defines its own event data models under `/pub/eventky.app/`. It does NOT implement the full pubky.app social spec (posts, follows, tags, etc). It only reads `/pub/pubky.app/profile.json` for user identity display.
