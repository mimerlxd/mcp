-- MCP Knowledge Service Database Schema

-- Rules table for global AI development rules
CREATE TABLE IF NOT EXISTS rules_global (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tags_csv TEXT,
    tier INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_hash TEXT UNIQUE,
    embedding F32_BLOB(1536)
);

-- Project documents table
CREATE TABLE IF NOT EXISTS project_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    path TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('readme', 'doc', 'code', 'api', 'todo', 'comment')),
    body TEXT NOT NULL,
    tags_csv TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_hash TEXT,
    embedding F32_BLOB(1536),
    UNIQUE(project, path)
);

-- References table for quick links and docs
CREATE TABLE IF NOT EXISTS refs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    note TEXT,
    tags_csv TEXT,
    tier INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Access control table
CREATE TABLE IF NOT EXISTS access_tiers (
    login TEXT PRIMARY KEY,
    tier INTEGER NOT NULL DEFAULT 0,
    channels_csv TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    login TEXT NOT NULL,
    tool TEXT NOT NULL,
    args_hash TEXT,
    k INTEGER,
    elapsed_ms INTEGER,
    match_count INTEGER,
    channel TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rules_vector ON rules_global(embedding) USING vector;
CREATE INDEX IF NOT EXISTS idx_rules_tags ON rules_global(tags_csv);
CREATE INDEX IF NOT EXISTS idx_rules_tier ON rules_global(tier);
CREATE INDEX IF NOT EXISTS idx_rules_updated ON rules_global(updated_at);

CREATE INDEX IF NOT EXISTS idx_project_vector ON project_docs(embedding) USING vector;
CREATE INDEX IF NOT EXISTS idx_project_name ON project_docs(project);
CREATE INDEX IF NOT EXISTS idx_project_kind ON project_docs(kind);
CREATE INDEX IF NOT EXISTS idx_project_tags ON project_docs(tags_csv);
CREATE INDEX IF NOT EXISTS idx_project_updated ON project_docs(updated_at);

CREATE INDEX IF NOT EXISTS idx_refs_tags ON refs(tags_csv);
CREATE INDEX IF NOT EXISTS idx_refs_tier ON refs(tier);

CREATE INDEX IF NOT EXISTS idx_access_tier ON access_tiers(tier);

CREATE INDEX IF NOT EXISTS idx_audit_login ON audit_log(login);
CREATE INDEX IF NOT EXISTS idx_audit_tool ON audit_log(tool);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);