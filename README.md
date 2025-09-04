# MCP Knowledge Service

MCP-based knowledge and rules suite for Tailscale networks with semantic search via libSQL vectors.

## Features

- **MCP Tools**: `rules.search`, `project.search`, `refs.list`, and more
- **Semantic Search**: Vector-based search using libSQL with OpenAI embeddings  
- **Multi-Channel**: Support for multiple MCP channels (rules, projects, refs)
- **Tailscale Security**: Identity-based access control via Tailscale Serve
- **Vector Database**: libSQL with native vector support for ANN search

## Quick Start

1. **Setup Environment**:
   ```bash
   ./scripts/setup.sh
   ```

2. **Configure Environment**:
   Edit `.env` with your configuration:
   ```env
   LIBSQL_URL=file:./data/knowledge.db
   OPENAI_API_KEY=your-openai-api-key
   ```

3. **Development**:
   ```bash
   npm run dev        # Start development server
   npm run build      # Build for production
   npm test          # Run tests
   npm run lint      # Lint code
   ```

## Architecture

- **`src/mcp/`** - MCP server and tool implementations
- **`src/db/`** - Database schema, connections, and migrations  
- **`src/http/`** - REST API endpoints for ingestion
- **`src/auth/`** - Tailscale identity and access control
- **`src/utils/`** - Shared utilities and helpers

## MCP Tools

### Rules Service
- `rules.search(q, k?, tags?)` - Search global development rules
- `rules.get(id)` - Get specific rule by ID
- `rules.tags()` - List all available rule tags

### Project Service  
- `project.search(project, q, k?)` - Search within project docs
- `project.browse(project, path?)` - Browse project structure
- `project.contextPack(project, facets?)` - Get curated context bundle

### References Service
- `refs.list(tags?, limit?)` - List references with optional tag filter
- `refs.add(title, url, note?, tags_csv?)` - Add new reference
- `refs.findByTag(tag)` - Find references by specific tag

## Database Schema

The service uses libSQL with vector support:

- **`rules_global`** - Global AI development rules with embeddings
- **`project_docs`** - Project-specific documentation with embeddings  
- **`refs`** - Quick reference links and documentation
- **`access_tiers`** - User access control and permissions
- **`audit_log`** - Query audit trail and metrics

## Development Status

See [TODO.md](TODO.md) for current development phases and tasks.

## Related

- Memory subsystem development: `/home/ubuntu/mem`
- Design documentation: `docs/memory-design.md`