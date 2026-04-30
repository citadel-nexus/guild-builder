# Changelog

All notable changes to `guild-builder` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Tenant provisioning orchestrator spine (`src/provision/`) for
  TENANT-PROVISION-FABRIC-001 §6: typed Stage interface, idempotency
  store, sequential runner, transport-agnostic event publisher,
  default subject formatter, and optional NATS bridge gated by
  `PROVISION_ORCHESTRATOR=on`. Vendor stage bodies (Cal.com, Mautic,
  Twenty, Customer.io, email-bank, tenant-agent, tenant-mcp,
  cockpit-ui, workflow-mesh) plug in via the public Stage contract.

## [0.1.0] - 2026-03-06

### Added
- Initial guild scaffold with NATS listener and health endpoint
- CML bridge for task queue integration
- Docker and Docker Compose deployment configuration
- GitHub Actions CI workflow (Node 18 + 20 matrix)
- SAKE-compliant module structure
- Guild SDK integration via `@citadel-guilds/sdk`
