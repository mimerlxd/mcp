# MCP Knowledge Service Development TODO

## Phase 1: Core Infrastructure
- [ ] Set up TypeScript project structure
- [ ] Configure libSQL database with vector support
- [ ] Implement basic MCP server skeleton
- [ ] Add Tailscale identity integration
- [ ] Create database schema and migrations

## Phase 2: MCP Tools Implementation
- [ ] Implement `rules.search` tool
- [ ] Implement `rules.get` tool  
- [ ] Implement `rules.tags` tool
- [ ] Implement `project.search` tool
- [ ] Implement `project.browse` tool
- [ ] Implement `project.contextPack` tool
- [ ] Implement `refs.list` tool
- [ ] Implement `refs.add` tool
- [ ] Implement `refs.findByTag` tool

## Phase 3: REST API for Ingestion
- [ ] Create HTTP endpoints for ingestion
  - [ ] `POST /ingest/rule`
  - [ ] `POST /ingest/project` 
  - [ ] `POST /refs`
  - [ ] `GET /refs`
- [ ] Add health and admin endpoints
  - [ ] `GET /health`
  - [ ] `GET /admin/metrics`
  - [ ] `POST /admin/reload`

## Phase 4: Channel Management
- [ ] Implement dynamic channel discovery
- [ ] Create channel configuration system
- [ ] Add hot-reload for channel configs
- [ ] Implement MCP resource namespacing

## Phase 5: Security & Access Control
- [ ] Integrate Tailscale Serve identity headers
- [ ] Implement tier-based access control
- [ ] Add audit logging system
- [ ] Create access tier management

## Phase 6: Ingestion CLI
- [ ] Create TypeScript CLI for file ingestion
- [ ] Implement file scanning and filtering
- [ ] Add chunking and embedding pipeline
- [ ] Create batch upload functionality

## Phase 7: Testing & Quality
- [ ] Write unit tests for MCP tools
- [ ] Create integration tests for REST endpoints
- [ ] Add contract tests for MCP tool specifications
- [ ] Implement load testing for vector search performance
- [ ] Add end-to-end testing workflows
- [ ] Create test data fixtures and ground truth sets

## Phase 8: Performance & Observability
- [ ] Add result caching (LRU)
- [ ] Implement query metrics collection
- [ ] Create backup/restore procedures
- [ ] Add performance monitoring

## Phase 9: Go Helper Binary (Optional)
- [ ] Create Go binary for local MCP proxy
- [ ] Implement stdio/SSE MCP modes
- [ ] Add REST client with fallback cache
- [ ] Create ingestion CLI commands

## Parallel Development in /ubuntu/mem
- [ ] Memory subsystem design and implementation
- [ ] Integration points with MCP service
- [ ] Shared data structures and protocols