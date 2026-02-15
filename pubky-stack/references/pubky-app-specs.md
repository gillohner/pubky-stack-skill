# pubky-app-specs Data Model Reference

Source of truth: https://github.com/pubky/pubky-app-specs (README + Rust source in `src/`)

Version: 0.4.4 (early development, expect changes)

> In case of disagreement between this document and the Rust implementation, the Rust implementation prevails.
> When stable, paths will adopt `/pub/pubky.app/v1/` format.

---

## PubkyAppUser (Profile)

**Path:** `/pub/pubky.app/profile.json`

```json
{
  "name": "Alice",
  "bio": "Toxic maximalist.",
  "image": "pubky://user_id/pub/pubky.app/files/0000000000000",
  "links": [
    { "title": "GitHub", "url": "https://github.com/alice" }
  ],
  "status": "Exploring decentralized tech."
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | String | Yes | 3–50 chars. Cannot be `"[DELETED]"`. |
| `bio` | String | No | Max 160 chars. |
| `image` | String | No | Valid URL. Max 300 chars. |
| `links` | Array\<UserLink\> | No | Max 5 links. Each: title ≤100 chars, url ≤300 chars, valid URL. |
| `status` | String | No | Max 50 chars. |

---

## PubkyAppPost

**Path:** `/pub/pubky.app/posts/<post_id>`

```json
{
  "content": "Hello world! This is my first post.",
  "kind": "short",
  "parent": null,
  "embed": {
    "kind": "short",
    "uri": "pubky://user_id/pub/pubky.app/posts/0000000000000"
  },
  "attachments": ["pubky://user_id/pub/pubky.app/files/0000000000000"]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `content` | String | Yes | Max 2,000 (short) or 50,000 (long). Cannot be `"[DELETED]"`. |
| `kind` | String | Yes | One of: `short`, `long`, `image`, `video`, `link`, `file` |
| `parent` | String | No | Valid URI if present (for replies). |
| `embed` | Object | No | `{ kind: String, uri: String }`. URI must be valid. |
| `attachments` | Array\<String\> | No | Each must be a valid URI. |

**ID:** Timestamp ID (13-char Crockford Base32 from microsecond timestamp).

---

## PubkyAppFollow

**Path:** `/pub/pubky.app/follows/<user_id>`

```json
{
  "created_at": 1700000000
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `created_at` | Integer | Yes | Unix timestamp. |

The path segment `<user_id>` IS the followed user's public key.

---

## PubkyAppTag

**Path:** `/pub/pubky.app/tags/<tag_id>`

```json
{
  "uri": "pubky://user_id/pub/pubky.app/posts/0000000000000",
  "label": "interesting",
  "created_at": 1700000000
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `uri` | String | Yes | Valid URI of the tagged object. |
| `label` | String | Yes | Trimmed, lowercase. Max 20 chars. |
| `created_at` | Integer | Yes | Unix timestamp. |

**ID:** Hash ID — Blake3 hash of (uri + label), first half of bytes, Crockford Base32 encoded.

---

## PubkyAppBookmark

**Path:** `/pub/pubky.app/bookmarks/<bookmark_id>`

```json
{
  "uri": "pubky://user_id/pub/pubky.app/posts/0000000000000",
  "created_at": 1700000000
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `uri` | String | Yes | Valid URI. |
| `created_at` | Integer | Yes | Unix timestamp. |

**ID:** Hash ID — Blake3 hash of the uri, first half of bytes, Crockford Base32 encoded.

---

## PubkyAppFile

**Path:** `/pub/pubky.app/files/<file_id>`

```json
{
  "name": "photo.jpg",
  "created_at": 1700000000,
  "src": "pubky://user_id/pub/pubky.app/blobs/HASH",
  "content_type": "image/jpeg",
  "size": 102400
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | String | Yes | 1–255 chars. |
| `created_at` | Integer | Yes | Unix timestamp. |
| `src` | String | Yes | Valid URL. Max 1024 chars. Points to the actual blob. |
| `content_type` | String | Yes | Valid IANA MIME type. |
| `size` | Integer | Yes | Positive integer. Max 10MB. |

**ID:** Timestamp ID.

---

## PubkyAppFeed

**Path:** `/pub/pubky.app/feeds/<feed_id>`

```json
{
  "name": "My Feed",
  "reach": "friends",
  "layout": "columns",
  "sort": "recent",
  "tags": ["bitcoin", "tech"],
  "content": "short"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | String | Yes | Feed name. |
| `reach` | String | Yes | Valid reach value (e.g., `all`, `friends`). |
| `layout` | String | Yes | Valid layout (e.g., `columns`). |
| `sort` | String | Yes | Valid sort order (e.g., `recent`). |
| `tags` | Array\<String\> | No | Strings must be trimmed. |
| `content` | String | No | Content type filter. |

**ID:** Timestamp ID.

---

## ID Generation

### Timestamp IDs

Used for sequential objects (posts, files, feeds).

- Take current time in **microseconds**
- Encode as 13-character **Crockford Base32** string

### Hash IDs

Used for content-keyed objects (tags, bookmarks).

- Compute **Blake3** hash of the deterministic input (e.g., uri + label for tags, uri for bookmarks)
- Take the **first half** of the resulting hash bytes
- Encode as **Crockford Base32** string

This ensures the same content always produces the same ID (idempotent).

---

## Custom App Namespaces

You are not restricted to the `pubky.app` namespace. Define your own:

```
/pub/eventky.app/events/<id>
/pub/eventky.app/calendars/<id>
/pub/myapp.example/settings.json
```

Guidelines:
- Use a unique namespace to avoid collisions
- Follow the same patterns (JSON, timestamp IDs)
- Consider reading `/pub/pubky.app/profile.json` for cross-app user identity
- Use `pubky-app-specs` as a reference for designing your schemas

---

## JS WASM Package

```bash
# From npm (if published)
npm install pubky-app-specs

# Or build from source
cd pubky-app-specs
cargo install wasm-pack
wasm-pack build --target bundler

# In your project
cd ../your-app
npm install ../pubky-app-specs/pkg
```

Building from source and testing:
```bash
cd pkg
npm run build
npm run test
npm run example
```

---

## Rust Package

```toml
pubky-app-specs = "0.4"  # https://crates.io/crates/pubky-app-specs
```
