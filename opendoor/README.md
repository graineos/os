# OPENDOOR OS

OPENDOOR OS is a modular, Linux-ready system core and application platform. Its role is to coordinate infrastructure, applications, data flows, workflows, releases, nodes, storage and recovery without imposing one website, AI provider, database or hosting platform.

The architectural model is intentionally close to the Linux ecosystem: a reusable system core, then distributions and applications built above it.

## Official boundary

```text
Host OS / Linux
   ↓
OPENDOOR OS Core
   ├─ events / telemetry / memory
   ├─ durable workflows
   ├─ hybrid orchestration
   ├─ release / deploy / nodes / gateway
   ├─ sync / realtime / storage
   ├─ guardian / recovery
   └─ application runtime
        ↓
        ├─ OPENDOOR OS IA (AI distribution)
        ├─ angel-leclerc.fr
        └─ future applications
```

**OPENDOOR OS** is the system layer. It must remain usable without AI.

**OPENDOOR OS IA** is a separate distribution built on OPENDOOR OS. It adds AI providers, conversation, analysis, generation, agents and intelligent automation. Dependency direction is strictly `OPENDOOR OS IA -> OPENDOOR OS`; the Core must never depend on OPENDOOR OS IA.

`angel-leclerc.fr` is an application using OPENDOOR OS and selected capabilities from OPENDOOR OS IA. It is not the Core.

## Hybrid design

OPENDOOR OS does not remove external services simply to become independent. Existing useful services are combined with Angel Native engines so the complete system gains capacity, resilience and observability.

Examples:

- GitHub remains a source of truth for code and CI.
- Vercel can remain a web deployment node.
- Angel Node provides a Linux-ready native web node implementation for additional targets.
- Google Drive / `OPENDOOR OS Storage` is used as a heavy-file archive tier.
- Existing application data services remain available while Angel Native storage, cache and sync add complementary capabilities.
- External AI providers belong to OPENDOOR OS IA, while workflows, memory, events, deployment and recovery remain OPENDOOR OS system capabilities.

## Core services

### Event Log and Telemetry
System operations can produce events and metrics instead of failing silently.

### Memory Index
A cross-module search index for operational context.

### Durable Workflow Engine
Checkpointed workflows with retries and resumable state.

### Hybrid Orchestrator
Runs external and native providers using cascade, race, merge or adaptive selection strategies.

### Angel Release and Angel Deploy
A release identifies version, commit and checksum. Angel Deploy can distribute the same release to several targets and record each target state.

### Angel Gateway and Angel Node
Nodes are ranked by health, priority and latency. Vercel can be one node; a Linux Angel Node can be another. A transparent public-domain failover still requires an appropriate reachable network/DNS/proxy layer.

### Angel Sync
Versioned reconciliation, duplicate detection and conflict handling between data representations.

### Guardian and Recovery
Guardian detects anomalies. Recovery maps them to retry, fallback, rollback, resync, cache invalidation, provider isolation or checkpoint restoration policies.

### Application Runtime
Distributions and applications are explicitly registered above the Core instead of being mixed into system services.

## Native and external services

Angel Native services are complementary. They are not presented as fake MySQL, Redis, Python or Rust instances.

- TypeScript is the main application and orchestration language.
- Python can supply data/automation workers where it is actually executable.
- Rust is reserved for performance-critical or system-level work when infrastructure makes it useful.
- Redis/MySQL/Express can extend OPENDOOR OS when genuinely available, while native cache/realtime/API/storage primitives keep the architecture functional without pretending those external services exist.

## Deployment model

```text
GitHub
   ↓
Angel Release / Angel Deploy
   ├─ Vercel
   ├─ Angel Node Linux
   └─ future targets

clients
   ↓
network / gateway layer
   ↓
healthy serving node
```

The software components for multi-target deployment and Angel Node are part of the Core. Real redundancy is only live when at least two independently reachable serving targets exist.

## Documentation

See `docs/DISTRIBUTED_HYBRID_ARCHITECTURE.md` for the detailed architecture and system rules.

## License

OPENDOOR OS source code in this directory is intended to be distributed under GPL-2.0-only. Third-party components remain under their own licenses.
