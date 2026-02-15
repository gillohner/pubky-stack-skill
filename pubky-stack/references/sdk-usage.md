# JS SDK Usage Reference (@synonymdev/pubky v0.6.0)

Source of truth: https://www.npmjs.com/package/@synonymdev/pubky

All code in this file is verified against the official v0.6.0 npm documentation.

---

## Installation

```bash
npm install @synonymdev/pubky
```

- Node v20+ required (undici fetch, WebCrypto)
- ESM and CJS both supported
- TypeScript typings included (generated via tsify)

---

## Initialization

```javascript
import { Pubky, PublicKey, Keypair, AuthFlowKind } from "@synonymdev/pubky";

// Mainnet (default Pkarr relays)
const pubky = new Pubky();

// Local testnet
const pubky = Pubky.testnet();              // defaults to localhost
const pubky = Pubky.testnet("custom-host"); // e.g., Docker bridge
```

**Reuse a single `Pubky` instance** across your app (via context or module singleton). Constructing one per request reinitializes transports unnecessarily.

---

## Keys

```javascript
import { Keypair, PublicKey } from "@synonymdev/pubky";

// Generate random keypair
const keypair = Keypair.random();
const pubkey = keypair.publicKey;

// Two string formats for PublicKey:
pubkey.z32();       // z-base-32 — use for transport, storage, headers, DB, JSON
pubkey.toString();  // "pubky<z32>" — use for display, logs, UI only

// Parse from z-base-32
const parsed = PublicKey.from("8pinxxgqs41n4aididenw5apqp1urfmzdztr8jt4abrkdn435ewo");
```

### Recovery File

```javascript
// Encrypt keypair to recovery file (Uint8Array)
const recoveryFile = keypair.createRecoveryFile("strong passphrase");

// Decrypt back into Keypair
const restored = Keypair.fromRecoveryFile(recoveryFile, "strong passphrase");

// Use recovered key
const signer = pubky.signer(restored);
```

---

## Signer & Session

```javascript
const keypair = Keypair.random();
const signer = pubky.signer(keypair);

// Signup (first time — needs homeserver public key + optional invite code)
const homeserver = PublicKey.from("8pinxxgqs41n4aididenw5apqp1urfmzdztr8jt4abrkdn435ewo");
const session = await signer.signup(homeserver, null); // null = no invite code

// Signin (subsequent — fast, publishes PKDNS in background)
const session = await signer.signin();

// Signin blocking (slower but waits for PKDNS publish to complete)
const session = await signer.signinBlocking();

// Signout (invalidates server session)
await session.signout();
```

### Session Info

```javascript
const userPk = session.info.publicKey.toString(); // "pubky<z32>" (display)
const userZ32 = session.info.publicKey.z32();     // z32 (for storage paths)
const caps = session.info.capabilities;            // string[] of permissions
const storage = session.storage;                   // SessionStorage API
```

### Persist Session Across Browser Reloads

```javascript
// Save snapshot (contains only public metadata, no secrets)
const snapshot = session.export();
localStorage.setItem("pubky-session", snapshot);

// Restore (browser must still have the HTTP-only cookie)
const restored = await pubky.restoreSession(localStorage.getItem("pubky-session"));
```

---

## Storage

### SessionStorage (read/write — your own data, absolute paths)

```javascript
const s = session.storage;

// Write
await s.putJson("/pub/myapp/data.json", { hello: "world" });
await s.putText("/pub/myapp/note.txt", "hello");
await s.putBytes("/pub/myapp/img.bin", new Uint8Array([1, 2, 3]));

// Read
const response = await s.get("/pub/myapp/data.json");     // raw Response (for streaming)
const json = await s.getJson("/pub/myapp/data.json");      // parsed JSON
const text = await s.getText("/pub/myapp/note.txt");       // string
const bytes = await s.getBytes("/pub/myapp/img.bin");      // Uint8Array

// Metadata
const exists = await s.exists("/pub/myapp/data.json");     // boolean
const stats = await s.stats("/pub/myapp/data.json");
// stats: { content_length, content_type, etag, last_modified } | null

// List (trailing slash required)
// list(path, cursor?, reverse?, limit?, shallow?)
const entries = await s.list("/pub/myapp/", null, false, 100, false);

// Delete
await s.delete("/pub/myapp/data.json");
```

### PublicStorage (read-only — any user's data, addressed paths)

```javascript
const pub = pubky.publicStorage;

// userPk must be z32 format for addressed paths
const userPk = session.info.publicKey.z32();

// Read
const response = await pub.get(`${userPk}/pub/myapp/data.json`);     // raw Response
const json = await pub.getJson(`${userPk}/pub/myapp/data.json`);
const text = await pub.getText(`${userPk}/pub/myapp/note.txt`);
const bytes = await pub.getBytes(`${userPk}/pub/myapp/img.bin`);     // Uint8Array

// Metadata
const exists = await pub.exists(`${userPk}/pub/myapp/foo`);          // boolean
const stats = await pub.stats(`${userPk}/pub/myapp/foo`);

// List (trailing slash required)
// list(addr, cursor?, reverse?, limit?, shallow?)
const entries = await pub.list(`${userPk}/pub/myapp/`, null, false, 100, false);
```

### Path Rules

- **SessionStorage:** absolute paths like `"/pub/app/file.txt"`
- **PublicStorage:** addressed paths like `"<user_z32>/pub/app/file.txt"`
- Both `pubky<pk>/pub/...` and `pubky://<pk>/pub/...` are valid for public reads
- **Convention:** put your app's data under a domain-like folder in `/pub/`, e.g., `/pub/my-cool-app/`
- **Trailing slash required** for `list()` calls

---

## AuthFlow (3rd-party login via Pubky Ring)

For apps that want users to authenticate via Pubky Ring QR code or deeplink:

```javascript
import { Pubky, AuthFlowKind } from "@synonymdev/pubky";
const pubky = new Pubky();

// Capabilities: comma-separated path patterns with permissions
const caps = "/pub/my-cool-app/:rw,/pub/another-app/folder/:w";

// Optional relay (defaults to Synonym-hosted: https://httprelay.pubky.app/link/)
const relay = "https://httprelay.pubky.app/link/";

// Start auth flow
const flow = pubky.startAuthFlow(caps, AuthFlowKind.signin(), relay);

// Display flow.authorizationUrl as QR code or clickable link
renderQr(flow.authorizationUrl);

// Block until user approves in Pubky Ring — returns a ready Session
const session = await flow.awaitApproval();
```

**Note on `AuthFlowKind`:** The npm README shows `AuthFlowKind::signin()` (Rust syntax). In JS, this is likely `AuthFlowKind.signin()`. Check the TypeScript types in the package for the exact syntax.

### Validate Capabilities

```javascript
import { validateCapabilities } from "@synonymdev/pubky";

try {
  const caps = validateCapabilities(rawUserInput ?? "");
  // caps is normalized (e.g., actions like :rw ordered consistently)
} catch (error) {
  if (error.name === "InvalidInput") {
    // error.message contains "Invalid capability entries: …"
    surfaceValidationError(error.message);
    return;
  }
  throw error;
}
```

### Approve an Auth Request (Signer Side)

If your app IS the signer (acting as the key manager), not the requesting app:

```javascript
await signer.approveAuthRequest("pubkyauth:///?caps=...&secret=...&relay=...");
```

### Auth Relay Notes

- Default relay: `https://httprelay.pubky.app/link/` (Synonym-hosted)
- If the relay is down, logins won't complete
- For production: run your own relay (MIT, Docker): https://httprelay.io
- The channel is derived as `base64url(hash(secret))`; the token is end-to-end encrypted with the secret and cannot be decrypted by the relay

---

## PKDNS (Pkarr Resolution)

```javascript
// Resolve any user's homeserver
const homeserver = await pubky.getHomeserverOf(PublicKey.from("8pinxxgqs41n4aididenw5apqp1urfmzdztr8jt4abrkdn435ewo"));
// -> string | undefined

// Signer-bound PKDNS operations
const signer = pubky.signer(keypair);
await signer.pkdns.publishHomeserverIfStale();   // republish if missing or stale
await signer.pkdns.publishHomeserverForce();      // force republish now
const hs = await signer.pkdns.getHomeserver();    // resolve own homeserver
```

---

## URL Resolution

```javascript
import { resolvePubky } from "@synonymdev/pubky";

// Convert addressed identifier to transport HTTPS URL
const identifier = "pubkyoperrr8wsbpr3ue9d4qj41ge1kcc6r7fdiy6o3ugjrrhi4y77rdo/pub/pubky.app/posts/0033X02JAN0SG";
const url = resolvePubky(identifier);
// -> "https://_pubky.operrr8wsbpr3ue9d4qj41ge1kcc6r7fdiy6o3ugjrrhi4y77rdo/pub/pubky.app/posts/0033X02JAN0SG"
```

Both `pubky<pk>/…` and `pubky://<pk>/…` resolve to the same HTTPS endpoint.

---

## Raw HTTP Client

```javascript
import { Client, PublicKey, resolvePubky } from "@synonymdev/pubky";

const client = new Client();  // or: pubky.client

const userId = PublicKey.from("pubky<z32>").toString();
const url = resolvePubky(`${userId}/pub/example.com/file.txt`);
const res = await client.fetch(url);
```

---

## Logging

```javascript
import { setLogLevel } from "@synonymdev/pubky";

// Call ONCE at app start, before constructing Pubky
setLogLevel("debug"); // "error" | "warn" | "info" | "debug" | "trace"

// Calling again after initialization will throw
```

---

## Error Handling

All async methods throw a structured `PubkyError`:

```typescript
interface PubkyError extends Error {
  name:
    | "RequestError"          // network/server/validation/JSON
    | "InvalidInput"
    | "AuthenticationError"
    | "PkarrError"
    | "InternalError";
  message: string;
  data?: unknown;             // structured context (e.g., { statusCode: number })
}
```

Example — handle 404:

```javascript
try {
  await pubky.publicStorage.getJson(`${pk}/pub/example.com/missing.json`);
} catch (e) {
  const error = e;
  if (
    error.name === "RequestError" &&
    typeof error.data === "object" &&
    error.data !== null &&
    "statusCode" in error.data &&
    error.data.statusCode === 404
  ) {
    // handle not found
  }
}
```

---

## WASM Memory

`wasm-bindgen` generates `free()` methods on exported classes (`Pubky`, `AuthFlow`, `PublicKey`). JavaScript's GC eventually releases the underlying Rust structs, but calling `free()` drops them immediately. Safe to skip in typical browser/Node apps; useful in long-running workers with many short-lived instances.

---

## Browser Notes

- Keep SDK client and homeserver on the **same origin family** (both local or both remote). Browsers partition cookies by scheme/host — cross-site requests can silently drop session cookies.
- If mixing environments, use a **reverse proxy** so the browser talks to one consistent origin.
- Troubleshooting: open fresh incognito window, clear site data, verify request includes credentials.

### Next.js + Turbopack WASM Fix

The `@synonymdev/pubky` CJS entry uses `readFileSync` to load `pubky_bg.wasm`. This fails in Turbopack's sandbox with `ENOENT`. Fix by adding the package to `serverExternalPackages` in `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ["@synonymdev/pubky"],
  // webpack config for production builds (ignored by Turbopack):
  webpack: (config, { isServer }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({ "@synonymdev/pubky": "commonjs @synonymdev/pubky" });
    }
    return config;
  },
};
```

### `publicStorage` Does NOT Work Reliably in the Browser

**Critical:** `pubky.publicStorage.getJson()` and `.get()` silently fail in the browser — no HTTP request is made. The WASM-based Pkarr resolution does not work from browser context for cross-user public reads.

**Workaround:** Proxy public reads through your backend/indexer. For example, to display other users' profile names, add a server-side endpoint that fetches `pubky://{pk}/pub/pubky.app/profile.json` using the Rust SDK's `pubky.public_storage().get(&uri)`, which works reliably.

**What DOES work in the browser:**
- `session.storage.*` (reads/writes to your own homeserver via authenticated session)
- `pubky.startAuthFlow()` (auth flows via relay)
- `pubky.restoreSession()` (session restoration)

**What does NOT work:**
- `pubky.publicStorage.*` (cross-user reads requiring Pkarr resolution)

---

## Rust SDK

The Rust crate is `pubky` on crates.io. **The Rust API may differ significantly from the JS SDK** in naming, structure, and method signatures. Always verify at https://docs.rs/pubky before writing Rust code. Do not assume JS examples translate directly.

---

## Local Development

```bash
# Install and run testnet
cargo install pubky-testnet
pubky-testnet
```

```javascript
const pubky = Pubky.testnet();              // defaults to localhost
const pubky = Pubky.testnet("custom-host"); // Docker bridge, etc.
```
