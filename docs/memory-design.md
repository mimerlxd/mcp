# Memory Subsystem Design

## Overview
The memory subsystem provides efficient storage and retrieval mechanisms for the MCP knowledge service, designed to work in parallel with the main service development in `/ubuntu/mem`.

## Architecture Goals
- **Low Latency**: Sub-100ms retrieval for cached queries
- **Scalability**: Handle multiple concurrent MCP channels
- **Persistence**: Durable storage with backup/restore capabilities  
- **Integration**: Seamless connection with MCP service layer

## Memory Layers

### L1: In-Memory Cache
- **Technology**: LRU cache with configurable size limits
- **Purpose**: Hot query results and frequently accessed embeddings
- **TTL**: Configurable per query type (rules: 10m, projects: 5m, refs: 30m)
- **Invalidation**: Event-driven on ingestion updates

### L2: Vector Index
- **Technology**: libSQL native vector columns with ANN indexing
- **Purpose**: Semantic search across rules, project docs, and references
- **Dimensions**: Configurable (default: 1536 for OpenAI embeddings)
- **Distance Metric**: Cosine similarity

### L3: Persistent Storage
- **Technology**: libSQL (SQLite-compatible) with WAL mode
- **Purpose**: Durable storage for all knowledge artifacts
- **Backup**: Snapshot-based with incremental updates
- **Migration**: Schema versioning with forward/backward compatibility

## Data Flow

```
Ingestion → Embedding → Vector Index → Cache Warming
     ↓
Query → Cache Check → Vector Search → Result Assembly
```

## Storage Schema

### Rules Table
```sql
CREATE TABLE rules_global (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tags_csv TEXT,
    tier INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    embedding F32_BLOB(1536)  -- libSQL vector type
);

CREATE INDEX idx_rules_vector ON rules_global(embedding);
CREATE INDEX idx_rules_tags ON rules_global(tags_csv);
```

### Project Documents Table  
```sql
CREATE TABLE project_docs (
    id INTEGER PRIMARY KEY,
    project TEXT NOT NULL,
    path TEXT NOT NULL,
    kind TEXT NOT NULL,  -- 'readme', 'doc', 'code', 'api'
    body TEXT NOT NULL,
    tags_csv TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    embedding F32_BLOB(1536)
);

CREATE INDEX idx_project_vector ON project_docs(embedding);
CREATE INDEX idx_project_name ON project_docs(project);
```

### References Table
```sql
CREATE TABLE refs (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    note TEXT,
    tags_csv TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refs_tags ON refs(tags_csv);
```

### Access Control Table
```sql
CREATE TABLE access_tiers (
    login TEXT PRIMARY KEY,
    tier INTEGER NOT NULL DEFAULT 0,
    channels_csv TEXT  -- allowed channels
);
```

## Memory Management

### Cache Policies
- **Size-based eviction**: Max entries per cache type
- **Time-based expiration**: TTL per query pattern
- **Usage-based retention**: LFU for cold data removal
- **Memory pressure handling**: Automatic cache reduction

### Vector Index Optimization
- **Batch embedding**: Group operations for efficiency
- **Index rebuilding**: Periodic optimization for query performance
- **Dimension reduction**: Optional PCA for large embeddings
- **Quantization**: Reduce precision for memory efficiency

## Performance Targets

### Query Performance
- **Cache hit**: < 10ms p95
- **Vector search**: < 100ms p95 for top-K=10
- **Complex queries**: < 200ms p95 with filters
- **Concurrent queries**: 100+ QPS sustained

### Storage Performance  
- **Ingestion**: 1000+ documents/minute
- **Index update**: < 5s for 10K document batch
- **Backup creation**: < 30s for 1GB database
- **Cold start**: < 3s service availability

## Integration Points

### MCP Service Interface
```typescript
interface MemoryService {
  // Query operations
  searchRules(query: string, k: number, tags?: string[]): Promise<SearchResult[]>
  searchProject(project: string, query: string, k: number): Promise<SearchResult[]>
  listRefs(tags?: string[]): Promise<Reference[]>
  
  // Ingestion operations
  ingestRule(rule: RuleDocument): Promise<void>
  ingestProjectDoc(doc: ProjectDocument): Promise<void>
  addReference(ref: Reference): Promise<void>
  
  // Cache operations
  invalidateCache(pattern: string): Promise<void>
  warmCache(queries: string[]): Promise<void>
  
  // Admin operations
  getMetrics(): Promise<MemoryMetrics>
  createBackup(): Promise<string>
  restoreBackup(path: string): Promise<void>
}
```

### Configuration
```yaml
memory:
  cache:
    max_entries: 10000
    ttl_rules: "10m"
    ttl_projects: "5m" 
    ttl_refs: "30m"
  
  vector:
    dimensions: 1536
    index_type: "ann"
    distance_metric: "cosine"
    build_threshold: 1000
  
  storage:
    path: "/var/lib/mcp-db/knowledge.db"
    wal_mode: true
    cache_size: "256MB"
    mmap_size: "1GB"
  
  performance:
    max_concurrent_queries: 100
    query_timeout: "30s"
    batch_size: 500
```

## Monitoring & Observability

### Metrics Collection
- **Query latency**: p50, p95, p99 by query type
- **Cache hit ratio**: Per cache layer and query pattern
- **Vector index health**: Build time, search accuracy, memory usage
- **Storage utilization**: Disk usage, write amplification, fragmentation

### Alerts
- **High latency**: p95 > 200ms sustained
- **Low cache hit ratio**: < 70% for 5 minutes
- **Storage pressure**: > 90% disk usage
- **Index degradation**: Accuracy drop > 5%

## Development Phases

### Phase 1: Core Storage
- [ ] libSQL database setup with vector support
- [ ] Basic schema creation and migrations
- [ ] Simple CRUD operations

### Phase 2: Vector Operations  
- [ ] Embedding pipeline integration
- [ ] Vector index creation and management
- [ ] Top-K search implementation

### Phase 3: Caching Layer
- [ ] LRU cache implementation
- [ ] Cache invalidation strategies
- [ ] Performance optimization

### Phase 4: Integration
- [ ] MCP service interface implementation
- [ ] Configuration management
- [ ] Error handling and resilience

### Phase 5: Observability
- [ ] Metrics collection and export
- [ ] Health checks and diagnostics  
- [ ] Backup and restore procedures

## Parallel Development Coordination

### Shared Interfaces
- Common data structures between `/mcp` and `/ubuntu/mem`
- Protocol definitions for service communication
- Configuration schema synchronization

### Testing Strategy
- Unit tests for memory operations
- Integration tests with MCP service
- Performance benchmarks and load testing
- End-to-end validation of query workflows

### Deployment Coordination
- Synchronized versioning between components
- Migration scripts for schema updates
- Rollback procedures for failed deployments