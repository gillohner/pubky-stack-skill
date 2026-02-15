# Repository & Package Reference

## Core Repositories

| Repository | Purpose | Language |
|------------|---------|----------|
| [pubky/pkarr](https://github.com/pubky/pkarr) | Pkarr protocol — identity and routing via Mainline DHT | Rust + JS bindings |
| [pubky/pubky-core](https://github.com/pubky/pubky-core) | Homeserver + SDK (Rust + JS WASM bindings) | Rust + TypeScript |
| [pubky/pubky-ring](https://github.com/pubky/pubky-ring) | Mobile key manager app (iOS/Android) | React Native (TypeScript) |
| [pubky/pubky-app-specs](https://github.com/pubky/pubky-app-specs) | Social data model schemas and validation (v0.4.4) | Rust + JS WASM |
| [pubky/pubky-nexus](https://github.com/pubky/pubky-nexus) | Indexer/aggregator (Neo4j + Redis → REST API) | Rust |
| [pubky/pubky-cli](https://github.com/pubky/pubky-cli) | CLI for homeserver interaction | Rust |
| [pubky/pubky-app](https://github.com/pubky/pubky-app) | Social media app (**deprecated** MVP) | — |
| [pubky/franky](https://github.com/pubky/franky) | Next-gen social client (**WIP**) | — |
| [gillohner/eventky](https://github.com/gillohner/eventky) | Calendar/event app on Pubky | Next.js (TypeScript) |

## Infrastructure

| Repository | Purpose |
|------------|---------|
| [pubky/pkdns](https://github.com/pubky/pkdns) | DNS server for resolving public key domains |
| [pubky/pubky-docker](https://github.com/pubky/pubky-docker) | Docker Compose full stack (homeserver + Nexus + Neo4j + Redis + clients). See `pubky-docker.md` |
| pubky/http-relay | HTTP relay for Pkarr and auth token exchange |

## Packages

| Package | Registry | Install |
|---------|----------|---------|
| `pubky` | [crates.io](https://crates.io/crates/pubky) | `cargo add pubky` |
| `pkarr` | [crates.io](https://crates.io/crates/pkarr) | `cargo add pkarr` |
| `pubky-app-specs` | [crates.io](https://crates.io/crates/pubky-app-specs) | `cargo add pubky-app-specs` |
| `@synonymdev/pubky` | [npm](https://www.npmjs.com/package/@synonymdev/pubky) (v0.6.0) | `npm install @synonymdev/pubky` |
| `pubky-app-specs` | [npm](https://www.npmjs.com/package/pubky-app-specs) | `npm install pubky-app-specs` |

## Documentation

| Resource | URL |
|----------|-----|
| Knowledge Base | https://docs.pubky.org |
| Pubky Core Docs (mdBook) | https://pubky.github.io/pubky-core/ |
| Rust API Docs | https://docs.rs/pubky |
| npm Package | https://www.npmjs.com/package/@synonymdev/pubky |
| Nexus Swagger (production) | https://nexus.pubky.app/swagger-ui/ |
| Nexus Swagger (staging) | https://nexus.staging.pubky.app/swagger-ui/ |
| Pkarr Demo | https://app.pkarr.org |

## Tools

| Tool | URL | Purpose |
|------|-----|---------|
| Pubky Explorer | https://explorer.pubky.app | Browse homeserver data |
| Pubky App | https://pubky.app | Production social PWA |
| Eventky | https://eventky.app | Calendar/event app |

## Community

| Channel | URL |
|---------|-----|
| Telegram (Core) | https://t.me/pubkycore |
| Telegram (Chat) | https://t.me/pubkychat |
| GitHub Org | https://github.com/pubky |

## Licenses

All core Pubky repositories: **MIT License**.
