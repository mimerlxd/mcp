export interface Rule {
  id: number;
  title: string;
  body: string;
  tags_csv?: string;
  tier: number;
  updated_at: string;
  source_hash?: string;
}

export interface ProjectDoc {
  id: number;
  project: string;
  path: string;
  kind: 'readme' | 'doc' | 'code' | 'api' | 'todo' | 'comment';
  body: string;
  tags_csv?: string;
  updated_at: string;
  source_hash?: string;
}

export interface Reference {
  id: number;
  title: string;
  url: string;
  note?: string;
  tags_csv?: string;
  tier: number;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  id: number;
  title: string;
  body: string;
  tags_csv?: string;
  score: number;
  type: 'rule' | 'project' | 'ref';
  project?: string;
  path?: string;
}

export interface AccessTier {
  login: string;
  tier: number;
  channels_csv?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  login: string;
  tool: string;
  args_hash?: string;
  k?: number;
  elapsed_ms?: number;
  match_count?: number;
  channel?: string;
}

export interface ChannelConfig {
  name: string;
  resources: string[];
  tools: string[];
  description: string;
  enabled: boolean;
}