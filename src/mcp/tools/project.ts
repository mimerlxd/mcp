import { db } from '../../db/connection.js';
import type { ProjectDoc, SearchResult } from '../../types.js';

export class ProjectService {
  async search(args: any): Promise<any> {
    const { project, q, k = 10 } = args;
    const client = db.getClient();

    const query = `
      SELECT id, project, path, kind, body, tags_csv, updated_at,
             vector_distance_cos(embedding, vector(?1)) as score
      FROM project_docs
      WHERE project = ?2
      ORDER BY score ASC
      LIMIT ?3
    `;

    const embedding = await this.getEmbedding(q);
    const result = await client.execute({
      sql: query,
      args: [embedding, project, k]
    });

    const results: SearchResult[] = result.rows.map(row => ({
      id: row.id as number,
      title: `${row.path}`,
      body: row.body as string,
      tags_csv: row.tags_csv as string | undefined,
      score: row.score as number,
      type: 'project' as const,
      project: row.project as string,
      path: row.path as string
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            project,
            query: q,
            count: results.length,
            results
          }, null, 2)
        }
      ]
    };
  }

  async browse(args: any): Promise<any> {
    const { project, path } = args;
    const client = db.getClient();

    let query = `
      SELECT id, path, kind, tags_csv, updated_at
      FROM project_docs
      WHERE project = ?1
    `;
    
    const params: any[] = [project];
    
    if (path) {
      query += ` AND path LIKE ?2`;
      params.push(`${path}%`);
    }

    query += ` ORDER BY path ASC`;

    const result = await client.execute({ sql: query, args: params });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            project,
            pathFilter: path,
            count: result.rows.length,
            documents: result.rows.map(row => ({
              id: row.id,
              path: row.path,
              kind: row.kind,
              tags_csv: row.tags_csv,
              updated_at: row.updated_at
            }))
          }, null, 2)
        }
      ]
    };
  }

  async contextPack(args: any): Promise<any> {
    const { project, facets = ['readme', 'api'] } = args;
    const client = db.getClient();

    const contexts: Record<string, any[]> = {};

    for (const facet of facets) {
      let query: string;
      let params: any[];

      switch (facet) {
        case 'readme':
          query = `
            SELECT path, body FROM project_docs
            WHERE project = ?1 AND kind = 'readme'
            ORDER BY updated_at DESC LIMIT 3
          `;
          params = [project];
          break;
        case 'api':
          query = `
            SELECT path, body FROM project_docs
            WHERE project = ?1 AND kind = 'api'
            ORDER BY updated_at DESC LIMIT 5
          `;
          params = [project];
          break;
        case 'recent':
          query = `
            SELECT path, kind, body FROM project_docs
            WHERE project = ?1
            ORDER BY updated_at DESC LIMIT 10
          `;
          params = [project];
          break;
        default:
          continue;
      }

      const result = await client.execute({ sql: query, args: params });
      contexts[facet] = result.rows.map(row => ({
        path: row.path,
        kind: row.kind || facet,
        body: (row.body as string).substring(0, 1000) // Truncate for context pack
      }));
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            project,
            facets,
            contextPack: contexts
          }, null, 2)
        }
      ]
    };
  }

  async listProjects(): Promise<string[]> {
    const client = db.getClient();

    const result = await client.execute(`
      SELECT DISTINCT project FROM project_docs ORDER BY project ASC
    `);

    return result.rows.map(row => row.project as string);
  }

  private async getEmbedding(text: string): Promise<Float32Array> {
    const { EmbeddingService } = await import('../../utils/embeddings.js');
    const embeddingService = new EmbeddingService();
    return await embeddingService.generateEmbedding(text);
  }
}