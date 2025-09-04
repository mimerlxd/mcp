import { db } from '../db/connection.js';
import { EmbeddingService } from '../utils/embeddings.js';
import { z } from 'zod';
import { createHash } from 'crypto';

const RuleIngestSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  tags_csv: z.string().optional(),
  tier: z.number().default(0),
});

const ProjectIngestSchema = z.object({
  project: z.string().min(1),
  path: z.string().min(1),
  kind: z.enum(['readme', 'doc', 'code', 'api', 'todo', 'comment']),
  body: z.string().min(1),
  tags_csv: z.string().optional(),
});

interface TailscaleUser {
  login: string;
  name?: string;
}

export class IngestService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  async ingestRule(data: unknown, user?: TailscaleUser): Promise<any> {
    const validated = RuleIngestSchema.parse(data);
    const client = db.getClient();

    // Generate source hash for deduplication
    const sourceHash = createHash('sha256')
      .update(validated.title + validated.body)
      .digest('hex');

    // Generate embedding
    const embedding = await this.embeddingService.generateEmbedding(
      `${validated.title}\n\n${validated.body}`
    );

    try {
      const result = await client.execute({
        sql: `
          INSERT OR REPLACE INTO rules_global 
          (title, body, tags_csv, tier, source_hash, embedding, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, vector(?6), CURRENT_TIMESTAMP)
          RETURNING id
        `,
        args: [
          validated.title,
          validated.body,
          validated.tags_csv || null,
          validated.tier,
          sourceHash,
          new Uint8Array(embedding.buffer)
        ]
      });

      const newId = result.rows[0]?.id;

      // Log audit entry
      if (user) {
        await this.logAudit(user.login, 'ingest_rule', { title: validated.title }, 1);
      }

      return {
        success: true,
        id: newId,
        title: validated.title,
        source_hash: sourceHash
      };
    } catch (error) {
      console.error('Rule ingestion error:', error);
      throw new Error('Failed to ingest rule');
    }
  }

  async ingestProject(data: unknown, user?: TailscaleUser): Promise<any> {
    const validated = ProjectIngestSchema.parse(data);
    const client = db.getClient();

    // Generate source hash
    const sourceHash = createHash('sha256')
      .update(validated.project + validated.path + validated.body)
      .digest('hex');

    // Generate embedding
    const embedding = await this.embeddingService.generateEmbedding(
      `Project: ${validated.project}\nPath: ${validated.path}\n\n${validated.body}`
    );

    try {
      const result = await client.execute({
        sql: `
          INSERT OR REPLACE INTO project_docs
          (project, path, kind, body, tags_csv, source_hash, embedding, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, vector(?7), CURRENT_TIMESTAMP)
          RETURNING id
        `,
        args: [
          validated.project,
          validated.path,
          validated.kind,
          validated.body,
          validated.tags_csv || null,
          sourceHash,
          new Uint8Array(embedding.buffer)
        ]
      });

      const newId = result.rows[0]?.id;

      // Log audit entry
      if (user) {
        await this.logAudit(user.login, 'ingest_project', { 
          project: validated.project, 
          path: validated.path 
        }, 1);
      }

      return {
        success: true,
        id: newId,
        project: validated.project,
        path: validated.path,
        source_hash: sourceHash
      };
    } catch (error) {
      console.error('Project ingestion error:', error);
      throw new Error('Failed to ingest project document');
    }
  }

  private async logAudit(login: string, tool: string, args: any, matchCount: number): Promise<void> {
    const client = db.getClient();
    const argsHash = createHash('sha256').update(JSON.stringify(args)).digest('hex');

    try {
      await client.execute({
        sql: `
          INSERT INTO audit_log (login, tool, args_hash, match_count, channel)
          VALUES (?1, ?2, ?3, ?4, ?5)
        `,
        args: [login, tool, argsHash, matchCount, 'http']
      });
    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't fail the main operation if audit logging fails
    }
  }
}