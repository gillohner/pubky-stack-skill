# Pubky Docker — Full Stack Local Environment

Source: [pubky/pubky-docker](https://github.com/pubky/pubky-docker)

## Overview

Pubky Docker provides a one-command Docker Compose setup for the **entire Pubky stack**. It orchestrates:

1. **Pkarr relay** — DHT relay for identity resolution
2. **PostgreSQL** — Homeserver database backend
3. **Pubky Homeserver** — decentralized per-user key-value store
4. **Pubky Nexus (nexusd)** — indexer/aggregator with Neo4j + Redis
5. **Neo4j** — graph database for Nexus social queries
6. **Redis** — cache/index for Nexus
7. **Pubky App client** — social UI (deprecated MVP)
8. **Franky** — next-gen social client (WIP replacement)

> **Note:** Running the full stack is overkill if you only want to develop an app using Pubky. For app development, use the SDK directly with `Pubky.testnet()` or `cargo install pubky-testnet`. Use pubky-docker when you need the full indexer pipeline or want to work on Nexus/homeserver infrastructure.

## Quick Start (Pre-built Images)

```bash
git clone https://github.com/pubky/pubky-docker.git
cd pubky-docker
cp .env-sample .env
# Edit .env if needed (defaults work for testnet)
docker compose up -d
```

This pulls pre-built images from the `synonymsoft` Docker registry.

## Building from Source

To build locally, clone all required repos at the **same directory level**:

```
parent-dir/
├── pubky-docker/      # this repo
├── pkarr/             # git clone https://github.com/pubky/pkarr
├── pubky-core/        # git clone https://github.com/pubky/pubky-core
├── pubky-nexus/       # git clone https://github.com/pubky/pubky-nexus
├── pubky-app/         # git clone https://github.com/pubky/pubky-app (optional, deprecated)
└── franky/            # git clone https://github.com/pubky/franky (optional)
```

Then:

```bash
cd pubky-docker
cp .env-sample .env
docker compose up       # builds from local source via build contexts
```

## Environment Configuration (.env)

Key variables:

```bash
# Network mode: "testnet" or "mainnet"
NETWORK=testnet

# PostgreSQL (homeserver database)
POSTGRES_USER=test_user
POSTGRES_PASSWORD=test_pass
POSTGRES_DB=pubky_homeserver

# Client config (testnet defaults)
NEXT_PUBLIC_HOMESERVER=8pinxxgqs41n4aididenw5apqp1urfmzdztr8jt4abrkdn435ewo
NEXT_PUBLIC_NEXUS=http://localhost:8080
NEXT_PUBLIC_TESTNET=true
NEXT_PUBLIC_DEFAULT_HTTP_RELAY=http://localhost:15412/link/

# For mainnet, uncomment and adjust:
# NETWORK=mainnet
# NEXT_PUBLIC_TESTNET=false
# NEXT_PUBLIC_DEFAULT_HTTP_RELAY=https://httprelay.staging.pubky.app/link/
```

Mainnet staging servers (optional):

```bash
NEXT_PUBLIC_HOMESERVER=ufibwbmed6jeq9k4p583go95wofakh9fwpp4k734trq79pd9u1uy
NEXT_PUBLIC_NEXUS=https://nexus.staging.pubky.app
```

Docker image tags can be overridden:

```bash
REGISTRY=synonymsoft          # Docker registry
PKARR_TAG=latest
HOMESERVER_TAG=latest
PUBKY_NEXUS_TAG=latest
PUBKY_APP_TAG=latest
FRANKY_TAG=latest
```

## Services & Ports

| Service | Container | Ports | Purpose |
|---------|-----------|-------|---------|
| Pkarr relay | `pkarr` | 6882 | DHT relay (profile: `pkarr`) |
| PostgreSQL | `postgres` | 5432 | Homeserver database |
| Homeserver | `homeserver` | 6286, 6287, 6288, 15411, 15412 | Key-value store + HTTP relay |
| Nexus daemon | `nexusd` | 8080 (HTTP), 8081 (pubky) | Indexer REST API |
| Neo4j | `nexus-neo4j` | 7474 (browser), 7687 (bolt) | Graph database |
| Redis | `nexus-redis` | 6379, 8001 (Redis Insight) | Cache/index |
| Pubky App | `client` | 4200 | Social UI (deprecated) |
| Franky | `franky` | 3000 | Next-gen social UI |

### Key Port Notes

- **8080** — Nexus REST API (the main API your app queries)
- **15412** — HTTP auth relay (used for Pubky Ring auth token exchange)
- **7474** — Neo4j browser UI (http://localhost:7474)
- **8001** — Redis Insight UI (http://localhost:8001)

## Docker Network

All services run on a shared bridge network `pubky` with subnet `172.18.0.0/16`:

| Service | IP |
|---------|----|
| Pkarr | 172.18.0.2 |
| Nexus daemon | 172.18.0.3 |
| Homeserver | 172.18.0.4 |
| Neo4j | 172.18.0.5 |
| Redis | 172.18.0.6 |
| Pubky App | 172.18.0.7 |
| Franky | 172.18.0.8 |
| PostgreSQL | 172.18.0.9 |

## Service Configuration Files

### homeserver.config.toml

```toml
[general]
signup_mode = "token_required"  # or "open" for dev
database_url = "postgres://test_user:test_pass@172.18.0.9:5432/pubky_homeserver?pubky_test=true"

[pkdns]
icann_domain = "localhost"
public_ip = "172.18.0.4"

[derive]
testnet_host = "homeserver"
```

- `signup_mode`: `"open"` allows anyone to register; `"token_required"` needs an invite token
- `database_url`: Points to the PostgreSQL container
- `testnet_host`: Used for testnet key derivation

### pkarr.config.toml

```toml
relay_port = 6882
dht_port = 6882
cache_path = "/cache"
cache_size = 1_000_000
resolvers = []
minimum_ttl = 300
maximum_ttl = 86400

[rate_limiter]
behind_proxy = false
per_second = 2
burst_size = 10
```

### pubky-nexus-config-testnet.toml

```toml
[api]
http_address = "0.0.0.0:8080"
pubky_address = "0.0.0.0:8081"
public_ip = "172.18.0.3"

[watcher]
testnet = true
homeserver = "8pinxxgqs41n4aididenw5apqp1urfmzdztr8jt4abrkdn435ewo"
events_limit = 1000
monitors_limit = 50
sleep_interval_ms = 100

[stack]
log_level = "debug"
static_files_path = "/static/files/"
redis_url = "redis://nexus-redis:6379"
neo4j_url = "bolt://nexus-neo4j:7687"
neo4j_username = "neo4j"
neo4j_password = "12345678"
```

### neo4j.env

```bash
NEO4J_AUTH=neo4j/12345678
NEO4J_server_memory_pagecache_size=1G
NEO4J_server_memory_heap_initial__size=1G
NEO4J_server_memory_heap_max__size=2G
NEO4J_apoc_uuid_enabled=false
```

> Neo4j free edition only supports default db name and username (`neo4j`). If you change auth params after initial setup, run `docker compose down -v` to reset.

### redis.conf

```
maxmemory 17179869184           # 16GB — adjust for your system
tcp-keepalive 0
tcp-backlog 65536
maxclients 30000
save 900 1
save 300 10
save 60 10000
```

## Homeserver Entrypoint Logic

The homeserver container uses a conditional entrypoint:

- **Testnet** (`NETWORK != "mainnet"`): Runs `homeserver --homeserver-config=/config.toml` using the mounted config
- **Mainnet** (`NETWORK=mainnet`): Runs `homeserver` with built-in defaults

## Common Operations

### Start the full stack

```bash
docker compose up -d
```

### Start specific services only

```bash
# Just Nexus + databases (no client apps)
docker compose up -d nexusd nexus-neo4j nexus-redis homeserver postgres

# Include Pkarr relay (uses profile)
docker compose --profile pkarr up -d
```

### View logs

```bash
docker compose logs -f nexusd       # Nexus indexer logs
docker compose logs -f homeserver   # Homeserver logs
```

### Reset all data

```bash
docker compose down -v              # Removes volumes (Neo4j, Redis, Postgres data)
rm -rf .storage/                    # Remove local storage mounts
```

### Connect your app to the Docker stack

```javascript
// Point SDK at the Docker homeserver
import { Pubky, PublicKey } from "@synonymdev/pubky";

const pubky = Pubky.testnet("172.18.0.4");  // or "localhost" if ports are mapped
const homeserver = PublicKey.from("8pinxxgqs41n4aididenw5apqp1urfmzdztr8jt4abrkdn435ewo");

// Nexus API at http://localhost:8080
// HTTP relay at http://localhost:15412/link/
```

## Testnet vs Mainnet

| Aspect | Testnet | Mainnet |
|--------|---------|---------|
| `NETWORK` env | `testnet` | `mainnet` |
| `NEXT_PUBLIC_TESTNET` | `true` | `false` |
| DHT | Local/isolated | Real Mainline DHT |
| Homeserver config | Mounted `/config.toml` | Built-in defaults |
| Data persistence | Local only | Production |
| Default homeserver PK | `8pinxxgqs41n4aididenw5apqp1urfmzdztr8jt4abrkdn435ewo` | Same or custom |

## Persistent Storage

Data is stored in `.storage/` under the pubky-docker directory:

```
.storage/
├── pkarr/          # Pkarr relay cache
├── postgres/data/  # Homeserver database
├── neo4j/
│   ├── conf/       # Neo4j configuration
│   ├── data/       # Graph data
│   └── logs/       # Neo4j logs
├── redis/data/     # Redis persistence
└── static/         # Nexus static files (uploaded content)
```

## Troubleshooting

- **Port conflicts**: Check that 5432, 6379, 7474, 7687, 8080, 8001 aren't already in use
- **Neo4j auth issues after config change**: Run `docker compose down -v` to reset
- **Redis memory**: Adjust `maxmemory` in `redis.conf` for your system (default 16GB)
- **Homeserver signup fails**: Check `signup_mode` in `homeserver.config.toml` — set to `"open"` for development
- **Pkarr relay not starting**: It uses a Docker Compose profile; start with `--profile pkarr`
