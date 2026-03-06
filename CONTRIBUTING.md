# Contributing to guild-builder

## Setup

```bash
git clone https://github.com/citadel-nexus/guild-builder
cd guild-builder
npm install
cp .env.example .env
npm run dev
```

## Architecture Rules

These are non-negotiable for all contributions:

- **Never** import from `@citadel-nexus/core` or any private CNWB package
- **Never** hardcode NATS subjects — use `ctx.eventBus.publish('<subject>', data)`
- **Never** hardcode Supabase URLs — use `ctx.storage.query('<table>', filters)`
- **Never** hardcode credentials — all secrets via environment variables only
- All new modules require a `.sake` file stub (see [guild-sdk](https://github.com/citadel-nexus/guild-sdk))

## Branch Naming

```
feat/<srs-code>/<short-description>   — new features
fix/<srs-code>/<short-description>    — bug fixes
docs/<srs-code>/<short-description>   — documentation
chore/<srs-code>/<short-description>  — maintenance
```

## Workflow

1. Fork the repo and create a branch from `main`
2. `npm install` and `cp .env.example .env`
3. Make your changes in a focused, single-purpose commit series
4. Run `npm test` and `npm run lint` — both must pass
5. Open a PR against `main` with a clear description

## Commit Format

```
<type>(<srs-code>): <description>
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`

## PR Checklist

- [ ] SRS code referenced in branch name and commit
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] No private CNWB package imports
- [ ] No hardcoded NATS subjects or Supabase URLs
- [ ] No credentials or secrets in code
- [ ] SAKE file stub added for new modules

## Security

Vulnerability reports go to **security@citadel-nexus.com**.
Do not open public issues for security vulnerabilities. Response SLA: 48 hours.
