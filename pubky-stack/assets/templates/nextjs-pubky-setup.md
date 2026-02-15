# Next.js + Pubky Project Setup

Based on the Eventky reference implementation (https://github.com/gillohner/eventky).

## 1. Create Next.js Project

```bash
npx create-next-app@latest my-pubky-app --typescript --tailwind --app --eslint
cd my-pubky-app
```

## 2. Install Pubky Dependencies

```bash
# Pubky SDK (WASM — works in browser and Node.js 20+)
npm install @synonymdev/pubky

# Optional: pubky-app-specs for data validation
npm install pubky-app-specs
# Or build from source for latest version:
# cd ../pubky-app-specs && wasm-pack build --target bundler
# cd ../my-pubky-app && npm install ../pubky-app-specs/pkg
```

## 3. Configure next.config.ts for WASM

WASM modules require webpack configuration. From the Eventky repo:

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

export default nextConfig;
```

## 4. Environment Variables

From Eventky's `.env.example`:

```bash
# .env.local
NEXT_PUBLIC_PUBKY_ENV=testnet          # 'testnet' for local dev
```

## 5. Create Pubky Client Wrapper

Using verified v0.6.0 API:

```typescript
// lib/pubky.ts
import { Pubky, Keypair, PublicKey } from "@synonymdev/pubky";

// Reuse a single Pubky instance (SDK docs: avoid constructing per request)
let _pubky: Pubky | null = null;

export function getPubky(): Pubky {
  if (!_pubky) {
    const env = process.env.NEXT_PUBLIC_PUBKY_ENV;
    _pubky = env === "testnet" ? Pubky.testnet() : new Pubky();
  }
  return _pubky;
}
```

## 6. Local Development with Testnet

```bash
# Install and run testnet (homeserver + relay)
cargo install pubky-testnet
pubky-testnet
```

SDK docs confirm:
```typescript
const pubky = Pubky.testnet();              // defaults to localhost
const pubky = Pubky.testnet("custom-host"); // Docker bridge, etc.
```

## 7. Basic Usage Pattern

```typescript
// In a Client Component ('use client')
import { Pubky, Keypair, PublicKey } from "@synonymdev/pubky";

const pubky = getPubky();

// Create keypair and sign up
const keypair = Keypair.random();
const signer = pubky.signer(keypair);
const homeserver = PublicKey.from("8pinxxgqs41n4aididenw5apqp1urfmzdztr8jt4abrkdn435ewo");
const session = await signer.signup(homeserver, null);

// Write data
await session.storage.putJson("/pub/my-app/data.json", { hello: "world" });

// Read data publicly
const pk = session.info.publicKey.z32();
const data = await pubky.publicStorage.getJson(`${pk}/pub/my-app/data.json`);

// Signout
await session.signout();
```

## 8. Important Notes

- **WASM imports are async.** The SDK handles this internally, but use dynamic imports if you encounter issues: `const { Pubky } = await import("@synonymdev/pubky")`
- **Server Components cannot use WASM directly.** Use Pubky SDK in Client Components (`'use client'`) or Route Handlers.
- **Browser cookie partitioning:** Keep SDK client and homeserver on the same origin family. See SDK docs for details.
- **Eventky** (https://github.com/gillohner/eventky) is the most complete reference. Study its `lib/pubky/`, `hooks/`, and `stores/` directories.

## 9. Eventky Dev Environment

For a full-stack local environment matching Eventky's setup:

```bash
# Clone all repos to same directory
git clone https://github.com/gillohner/eventky
git clone https://github.com/gillohner/pubky-app-specs
git clone https://github.com/gillohner/pubky-nexus
git clone https://github.com/pubky/pubky-core

# Build pubky-app-specs WASM
cd pubky-app-specs
cargo install wasm-pack
wasm-pack build --target bundler

# Install and configure
cd ../eventky
npm install
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_PUBKY_ENV=testnet

# Start everything (tmux: testnet + nexus + frontend)
./scripts/start-eventky-testnet-nexus.sh
```

Services:
- Eventky: http://localhost:3000
- Nexus Swagger: http://localhost:8080/swagger-ui/
- Neo4j Browser: http://localhost:7474/
- Homeserver: http://localhost:6286/
