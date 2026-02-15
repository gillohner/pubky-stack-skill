---
name: pubky-stack
description: >
  Build apps on the Pubky decentralized protocol stack. Use when the user
  mentions Pubky, Pkarr, pubky homeserver, pubky-app-specs, Pubky Ring,
  Pubky Nexus, pubky SDK, pubky-docker, pubky testnet, or asks about
  building decentralized apps with public-key identity. Covers Rust and
  JavaScript SDK usage, authentication flows, data models, indexer patterns,
  app architecture, and Docker-based local stack setup.
---

# Pubky Stack Development

## Overview

Pubky is an open protocol for censorship-resistant web apps where **a user's Ed25519 public key IS their identity**. The stack:

- **Pkarr** — decentralized identity/routing via signed DNS records on the Mainline DHT
- **Homeservers** — personal key-value data stores with HTTP API
- **Pubky SDK** — Rust crate `pubky` + npm `@synonymdev/pubky` (JS/WASM, v0.6.0)
- **Pubky Ring** — mobile key manager (iOS/Android) for auth and session management
- **pubky-app-specs** — standardized data schemas for social app interoperability
- **Pubky Nexus** — indexer/aggregator reading homeservers, serving REST API

For the complete JS SDK API, see `references/sdk-usage.md`.
For data model schemas, see `references/pubky-app-specs.md`.
For authentication flows, see `references/authentication.md`.
For full Docker stack setup, see `references/pubky-docker.md`.

## Architecture

```
User Keypair (Ed25519)
        │
        ▼
   Pubky Ring ─── or ─── In-app keypair / Recovery file
        │
        ▼
   Pubky SDK  (Pubky facade → Signer → Session → Storage)
        │                    pubky:// URIs resolved via Pkarr + DHT
        ▼
   Homeserver(s)  ← key-value store, all data under /pub/ is public
        │
        ▼  (events / polling)
   Indexer (Nexus or custom)  → REST API for aggregated queries
```

### Core SDK Object Model (JS v0.6.0)

```
Pubky (facade)
├── .signer(keypair)        → Signer
│   ├── .signup(hs, invite) → Session
│   ├── .signin()           → Session
│   ├── .signinBlocking()   → Session
│   ├── .approveAuthRequest(url)
│   └── .pkdns.*            → PKDNS publishing
├── .publicStorage           → PublicStorage (read-only, addressed paths)
├── .startAuthFlow(caps, kind, relay?)  → AuthFlow
├── .restoreSession(snapshot)→ Session
├── .getHomeserverOf(pk)    → string | undefined
└── .client                 → Client (raw HTTP)

Session
├── .info.publicKey          → PublicKey
├── .info.capabilities       → string[]
├── .storage                → SessionStorage (read/write, absolute paths)
├── .signout()
└── .export()               → string (snapshot for persistence)
```

### Data Flow

1. User generates Ed25519 keypair. The **public key** (z-base-32) is their permanent identity.
2. `signer.signup(homeserver, invite)` registers on a homeserver → returns `Session`.
3. `Session.storage` provides read/write via cookie-based auth.
4. Apps write JSON to absolute paths: `/pub/<app_namespace>/<path>`.
5. Anyone reads public data via `pubky.publicStorage` using addressed paths: `<userPk>/pub/...`.
6. Indexers watch homeserver events and build queryable indexes.

### Addressing (Critical Distinction)

**SessionStorage** uses **absolute paths** (your own data):
```
/pub/example.com/data.json
```

**PublicStorage** uses **addressed form** (any user's data):
```
<user_pk_z32>/pub/example.com/data.json
```

Both `pubky<pk>/pub/...` and `pubky://<pk>/pub/...` resolve to the same endpoint.

**Convention:** Put app data under a domain-like folder in `/pub/`, e.g., `/pub/my-cool-app/`.

**Everything under `/pub/` is public.** Private data is not yet supported.

## Pkarr (Identity & Routing)

Pkarr lets any Ed25519 public key function as a sovereign TLD:

- User signs a small DNS packet (≤1000 bytes) pointing to their homeserver
- Published to BitTorrent's **Mainline DHT** (~10M nodes, 15+ years proven)
- Anyone resolves the key by querying DHT and verifying the signature
- Records expire after hours; homeservers/relays republish automatically

The SDK resolves addressed paths by looking up Pkarr records → finding the homeserver address → connecting via HTTPS.

## JS SDK Quick Start (v0.6.0)

```bash
npm install @synonymdev/pubky   # Node 20+, ESM and CJS
```

```javascript
import { Pubky, PublicKey, Keypair } from "@synonymdev/pubky";

const pubky = new Pubky();                    // mainnet
// const pubky = Pubky.testnet();             // local testnet

const keypair = Keypair.random();
const signer = pubky.signer(keypair);

// Signup (first time — needs homeserver pk + optional invite code)
const homeserver = PublicKey.from("8pinxxgqs41n4aididenw5apqp1urfmzdztr8jt4abrkdn435ewo");
const session = await signer.signup(homeserver, null);

// Write (session storage — absolute paths)
await session.storage.putJson("/pub/myapp/hello.json", { hello: "world" });

// Read publicly (public storage — addressed paths, no auth)
const pk = session.info.publicKey.z32();
const data = await pubky.publicStorage.getJson(`${pk}/pub/myapp/hello.json`);
```

For the complete API, see `references/sdk-usage.md`.

## Rust SDK

```toml
pubky = "0.5"  # https://crates.io/crates/pubky — check for latest
```

**The Rust SDK API may differ from the JS SDK in naming and structure.** Always verify method signatures at https://docs.rs/pubky. Do not assume the JS examples translate directly to Rust.

## pubky-app-specs (Data Model)

Standardized schemas for social apps, stored under `/pub/pubky.app/`:

| Model | Path | ID Type |
|-------|------|---------|
| Profile | `profile.json` | Single file |
| Post | `posts/<id>` | Timestamp ID |
| Follow | `follows/<user_pk>` | Public key |
| Tag | `tags/<id>` | Hash ID |
| Bookmark | `bookmarks/<id>` | Hash ID |
| File | `files/<id>` | Timestamp ID |
| Feed | `feeds/<id>` | Timestamp ID |

**Packages:** `cargo add pubky-app-specs` (Rust) or build JS WASM from source with `wasm-pack build --target bundler`.

Custom apps use their own namespace (e.g., `/pub/eventky.app/events/<id>`). Many apps also read `/pub/pubky.app/profile.json` for cross-app user identity.

For full field definitions, see `references/pubky-app-specs.md`.

## Authentication

See `references/authentication.md` for all details. Summary of three methods:

1. **Pubky Ring / AuthFlow** (end users) — `pubky.startAuthFlow(caps, kind)` generates a QR/deeplink URL. User approves in Pubky Ring. `flow.awaitApproval()` returns a `Session`.
2. **In-app keypair** (development) — `Keypair.random()`, then `signer.signup()` / `signer.signin()`.
3. **Recovery file / BIP39 phrase** — `Keypair.fromRecoveryFile(bytes, passphrase)` or import 12-word phrase in Pubky Ring.

## Indexers

Homeservers are per-user stores. Cross-user queries need an indexer.

**Pubky Nexus** (official): Watches homeserver events → Neo4j graph + Redis cache → REST API.
- Production: `https://nexus.pubky.app/swagger-ui/`
- API prefix: `/v0` (unstable, breaking changes expected)

Custom indexers: Use the homeserver's `/events-stream` endpoint with `?path=` prefix filtering and per-user cursors for efficient incremental polling. Fallback: poll via `pubky.publicStorage.list()`.

See `references/indexer-patterns.md`.

## App Architecture Patterns

1. **Direct** — SDK only, no backend. Best for simple/personal apps.
2. **Indexer-backed** — Read from Nexus, write via SDK. Best for social apps.
3. **Custom Backend** — Backend uses SDK, frontend talks to your API.

See `references/app-architectures.md`.

## Local Development

### Lightweight (app development)

```bash
# Install and run testnet (homeserver + relay only)
cargo install pubky-testnet
pubky-testnet
```

```javascript
// Point SDK at testnet
const pubky = Pubky.testnet();              // defaults to localhost
// const pubky = Pubky.testnet("custom-host"); // e.g., Docker bridge
```

### Full Stack (pubky-docker)

For running the complete stack including Nexus indexer, Neo4j, Redis, and client apps:

```bash
git clone https://github.com/pubky/pubky-docker.git
cd pubky-docker
cp .env-sample .env
docker compose up -d
```

This gives you: Homeserver (6287), Nexus API (8080), Neo4j (7474), Redis Insight (8001), HTTP relay (15412).

See `references/pubky-docker.md` for full configuration and service details.

## Quick Reference

See `references/repository-reference.md` for all repos, packages, and URLs.

## Important Caveats

- **Active development.** APIs and schemas change. SDK at v0.6.0, pubky-app-specs at v0.4.
- **All `/pub/` data is public.** No private data support yet.
- **Nexus API is `/v0`** — breaking changes expected.
- **Rust SDK may differ from JS SDK** in naming/structure. Verify at docs.rs/pubky.
- **Keypair loss = identity loss.** Always back up via recovery file or BIP39 phrase.
- **Browser cookie partitioning:** Keep SDK client and homeserver on the same origin family. See `references/sdk-usage.md` for details.
- **`publicStorage` does NOT work in the browser.** Cross-user reads silently fail. Proxy public reads through your backend/indexer instead. See `references/sdk-usage.md` Browser Notes.
- **Next.js Turbopack + WASM:** Add `@synonymdev/pubky` to `serverExternalPackages` in next.config.ts. See `references/sdk-usage.md`.
- **Crockford Base32:** The Rust `base32` crate does NOT match JS manual encoding for 64-bit values (bit padding mismatch). Write a custom decoder. See `references/indexer-patterns.md`.
- **Auth capabilities:** Only request permissions for your app's namespace. Reading others' profiles is public and doesn't need auth caps. Over-scoping causes unnecessary Pubky Ring permission prompts.
