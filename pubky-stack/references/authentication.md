# Authentication Reference

## Overview

Pubky authentication is based entirely on Ed25519 public key cryptography. No usernames, no passwords. The user's keypair IS their identity.

### Session Model (verified from v0.6.0 SDK docs)

- `signer.signup()` / `signer.signin()` produces a `Session` with an HTTP-only cookie
- `session.storage` provides read/write access (SessionStorage, absolute paths)
- `pubky.publicStorage` reads are always public, no auth needed
- `session.signout()` invalidates the session
- `session.export()` / `pubky.restoreSession()` persist sessions across browser reloads

---

## Method 1: AuthFlow via Pubky Ring (End Users)

Pubky Ring is a React Native mobile app (iOS/Android) that securely stores keypairs and approves auth requests from third-party apps.

### How It Works (Verified SDK API)

```javascript
import { Pubky, AuthFlowKind } from "@synonymdev/pubky";
const pubky = new Pubky();

// 1. Define capabilities your app needs
const caps = "/pub/my-cool-app/:rw";
// Multiple: "/pub/my-cool-app/:rw,/pub/another-app/folder/:w"

// 2. Start auth flow (optional relay — defaults to Synonym-hosted)
const flow = pubky.startAuthFlow(caps, AuthFlowKind.signin());

// 3. Display the authorization URL to the user
//    - Desktop: render as QR code (use any QR library)
//    - Mobile: render as clickable link/button
renderQr(flow.authorizationUrl);
// The URL has the form: pubkyauth:///?caps=...&secret=...&relay=...

// 4. Wait for user to approve in Pubky Ring
const session = await flow.awaitApproval();
// Returns a ready-to-use Session

// 5. Use the session
const pk = session.info.publicKey.z32();
await session.storage.putJson("/pub/my-cool-app/data.json", { status: "authed" });
```

**Note:** The npm README shows `AuthFlowKind::signin()` (Rust-style syntax). In JavaScript this is likely `AuthFlowKind.signin()`. Check the TypeScript types in the installed package for the exact form.

### Capabilities Format

Comma-separated path patterns with permissions:
- `/pub/my-cool-app/:rw` — read and write to your app's namespace
- `/pub/another-app/folder/:w` — write-only to a specific folder
- `/pub/:r` — read-only access to all public data

### Validate User-Supplied Capabilities

```javascript
import { validateCapabilities } from "@synonymdev/pubky";

try {
  const normalizedCaps = validateCapabilities(rawInput ?? "");
  // normalizedCaps has consistent ordering (e.g., :rw not :wr)
} catch (error) {
  if (error.name === "InvalidInput") {
    // error.message: "Invalid capability entries: …"
  }
}
```

### Relay Configuration

- Default relay: `https://httprelay.pubky.app/link/` (Synonym-hosted)
- If the default relay is down, auth flow won't complete
- For production: run your own relay (MIT, Docker): https://httprelay.io
- The channel is `base64url(hash(secret))` — the token is end-to-end encrypted; relay cannot decrypt it
- To use a custom relay:
  ```javascript
  const flow = pubky.startAuthFlow(caps, AuthFlowKind.signin(), "https://my-relay.example.com/link/");
  ```

### Acting as the Signer (Key Manager Side)

If your app IS the key manager (like Pubky Ring), approve incoming auth requests:

```javascript
await signer.approveAuthRequest("pubkyauth:///?caps=...&secret=...&relay=...");
```

---

## Method 2: In-App Keypair Management (Development)

For apps that manage keys directly:

```javascript
import { Pubky, Keypair, PublicKey } from "@synonymdev/pubky";

const pubky = new Pubky();

// Generate new identity
const keypair = Keypair.random();

// Bind to signer
const signer = pubky.signer(keypair);

// First time: signup to a homeserver
const homeserver = PublicKey.from("8pinxxgqs41n4aididenw5apqp1urfmzdztr8jt4abrkdn435ewo");
const session = await signer.signup(homeserver, null); // null = no invite code

// Subsequent times: signin (fast, PKDNS published in background)
const session = await signer.signin();

// Or: signin blocking (waits for PKDNS publish)
const session = await signer.signinBlocking();
```

**CRITICAL:** The keypair IS the user's permanent identity. Loss of the secret key means permanent loss of identity. There is no "forgot password" flow.

---

## Method 3: Recovery File

```javascript
// Create encrypted recovery file from keypair
const recoveryFile = keypair.createRecoveryFile("strong passphrase");
// recoveryFile is a Uint8Array containing a spec line + encrypted secret key

// Restore keypair from recovery file
const restored = Keypair.fromRecoveryFile(recoveryFile, "strong passphrase");

// Use recovered keypair
const signer = pubky.signer(restored);
const session = await signer.signin();
```

---

## Method 4: BIP39 Recovery Phrase

Pubky Ring supports standard 12-word BIP39 mnemonic phrases for key backup/restore. Users can export and import keypairs via these phrases within the Pubky Ring app. This is handled entirely by Pubky Ring — the JS SDK does not expose BIP39 APIs directly.

---

## Session Persistence (Browser)

```javascript
// Save session snapshot (no secrets — relies on HTTP-only cookie)
const snapshot = session.export();
localStorage.setItem("pubky-session", snapshot);

// Later: restore (browser must still have the HTTP-only cookie)
const restored = await pubky.restoreSession(localStorage.getItem("pubky-session"));
```

---

## Security Considerations

- **Keypair IS identity.** No "forgot password." Lost keys = lost identity.
- **Recovery files and BIP39 phrases are the only backup mechanism.**
- **Sessions rely on HTTP-only cookies.** Cross-origin issues can silently break auth — keep SDK client and homeserver on the same origin family.
- **Sessions should be revoked** when no longer needed via `session.signout()`.
- **The auth relay cannot decrypt tokens** — the secret is only shared between the requesting app and the signer.
