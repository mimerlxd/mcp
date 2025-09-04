import { db } from '../../db/connection.js';
import type { Rule, SearchResult } from '../../types.js';

export class RulesService {
  async search(args: any): Promise<any> {
    const { q, k = 10, tags } = args;
    const client = db.getClient();

    let query = `
      SELECT id, title, body, tags_csv, tier, updated_at,
             vector_distance_cos(embedding, vector(?1)) as score
      FROM rules_global
      WHERE 1=1
    `;
    
    const params: any[] = [await this.getEmbedding(q)];
    let paramIndex = 2;

    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => `tags_csv LIKE ?${paramIndex++}`).join(' OR ');
      query += ` AND (${tagConditions})`;
      tags.forEach((tag: string) => params.push(`%${tag}%`));
    }

    query += ` ORDER BY score ASC LIMIT ?${paramIndex}`;
    params.push(k);

    const result = await client.execute({ sql: query, args: params });
    
    const results: SearchResult[] = result.rows.map(row => ({
      id: row.id as number,
      title: row.title as string,
      body: row.body as string,
      tags_csv: row.tags_csv as string | undefined,
      score: row.score as number,
      type: 'rule' as const
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query: q,
            count: results.length,
            results
          }, null, 2)
        }
      ]
    };
  }

  async get(args: any): Promise<any> {
    const { id } = args;
    const client = db.getClient();

    const result = await client.execute({
      sql: 'SELECT * FROM rules_global WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) {
      throw new Error(`Rule with id ${id} not found`);
    }

    const rule = result.rows[0];
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(rule, null, 2)
        }
      ]
    };
  }

  async tags(args: any): Promise<any> {
    const client = db.getClient();

    const result = await client.execute(`
      SELECT DISTINCT tags_csv
      FROM rules_global
      WHERE tags_csv IS NOT NULL AND tags_csv != ''
    `);

    const allTags = new Set<string>();
    result.rows.forEach(row => {
      const tags = (row.tags_csv as string)?.split(',') || [];
      tags.forEach(tag => allTags.add(tag.trim()));
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            tags: Array.from(allTags).sort()
          }, null, 2)
        }
      ]
    };
  }

  private async getEmbedding(text: string): Promise<Float32Array> {
    const { EmbeddingService } = await import('../../utils/embeddings.js');
    const embeddingService = new EmbeddingService();
    return await embeddingService.generateEmbedding(text);
  }
}