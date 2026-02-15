# Pubky Stack Skill for Claude

A [Claude skill](https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills) that teaches Claude how to build applications on the [Pubky](https://pubky.org) decentralized protocol stack.

With this skill enabled, Claude understands the full Pubky ecosystem — Pkarr identity, the JS/Rust SDK, homeserver operations, authentication via Pubky Ring, data schemas, indexers, and app architecture patterns — and can help you build Pubky-powered apps accurately.

## What's Covered

- **Pubky SDK** (`@synonymdev/pubky` v0.6.0) — complete API: `Pubky` facade, `Signer`, `Session`, `SessionStorage`, `PublicStorage`, `AuthFlow`
- **Pkarr** — decentralized identity and routing via Mainline DHT
- **Authentication** — Pubky Ring deeplinks/QR, in-app keypairs, recovery files, BIP39 phrases
- **pubky-app-specs** (v0.4.4) — profiles, posts, follows, tags, bookmarks, files, feeds with validation rules
- **Custom app namespaces** — building your own data models on Pubky
- **Pubky Nexus** — official indexer architecture, local setup, REST API
- **Custom indexers** — polling patterns for app-specific data
- **App architecture** — three patterns (direct, indexer-backed, custom backend)
- **Eventky** — real-world reference app (Next.js + Pubky)
- **Templates** — ready-to-use code for auth flows, CRUD operations, and Next.js project setup

## Install

### Claude.ai

1. Download or clone this repo
2. Zip the `pubky-stack/` folder (just that folder, not the repo root)
3. Open Claude.ai → **Settings** → **Capabilities** → **Skills**
4. Click **Upload skill** and select the zip
5. Toggle it on

The skill is now available in every conversation. Claude will automatically load it when you mention Pubky, Pkarr, homeservers, pubky-app-specs, Pubky Ring, or related topics.

### Claude Code

```bash
# Global (available in all projects)
git clone https://github.com/user/pubky-stack-skill
cp -r pubky-stack-skill/pubky-stack ~/.claude/skills/

# Or per-project
cp -r pubky-stack-skill/pubky-stack your-repo/.claude/skills/
```

### Organization-wide

Claude Teams/Enterprise admins can deploy skills workspace-wide via the admin dashboard. All team members get the skill automatically.

## Skill Structure

```
pubky-stack/
├── SKILL.md                              # Core instructions (loaded when skill triggers)
├── references/                           # Detailed docs (loaded on demand)
│   ├── sdk-usage.md                      # Full JS SDK v0.6.0 API reference
│   ├── authentication.md                 # All auth methods with code examples
│   ├── pubky-app-specs.md                # Data model field definitions & validation
│   ├── indexer-patterns.md               # Nexus setup + custom indexer guide
│   ├── app-architectures.md              # Three architecture patterns
│   └── repository-reference.md           # All repos, packages, URLs
└── assets/templates/                     # Ready-to-use code templates
    ├── pubky-ring-auth.ts                # "Login with Pubky Ring" implementation
    ├── homeserver-crud.ts                # Typed CRUD helpers using v0.6.0 API
    └── nextjs-pubky-setup.md             # Step-by-step Next.js project scaffolding
```

This follows the [progressive disclosure](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf) pattern recommended by Anthropic: `SKILL.md` provides the overview and triggers, `references/` contains detailed documentation loaded as needed, and `assets/templates/` has reusable code.

## Example Usage

Once installed, just ask Claude naturally:

- *"Help me build a Pubky app with Next.js"*
- *"How do I implement login with Pubky Ring?"*
- *"Write a component that reads a user's profile from the homeserver"*
- *"Set up a custom indexer for my event data"*
- *"What's the pubky-app-specs schema for posts?"*

Claude will automatically activate the skill and use accurate, up-to-date API calls.

## Related

- [Pubky Knowledge Base](https://docs.pubky.org)
- [Pubky Core Docs](https://pubky.github.io/pubky-core/)
- [Anthropic Skills Guide](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)

## License

MIT
