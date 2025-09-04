import { db } from '../db/connection.js';
import { z } from 'zod';

const RefSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  note: z.string().optional(),
  tags_csv: z.string().optional(),
});

interface TailscaleUser {
  login: string;
  name?: string;
}

export class RefsService {
  async list(args: { tags?: string[]; limit?: number }): Promise<any> {
    const { tags, limit = 50 } = args;
    const client = db.getClient();

    let query = `
      SELECT id, title, url, note, tags_csv, tier, created_at, updated_at
      FROM refs
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => `tags_csv LIKE ?${paramIndex++}`).join(' OR ');
      query += ` AND (${tagConditions})`;
      tags.forEach((tag: string) => params.push(`%${tag}%`));
    }

    query += ` ORDER BY updated_at DESC LIMIT ?${paramIndex}`;
    params.push(limit);

    const result = await client.execute({ sql: query, args: params });

    return {
      count: result.rows.length,
      tagFilter: tags,
      references: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        url: row.url,
        note: row.note,
        tags_csv: row.tags_csv,
        tier: row.tier,
        created_at: row.created_at,
        updated_at: row.updated_at
      }))
    };
  }

  async add(data: unknown, user?: TailscaleUser): Promise<any> {
    const validated = RefSchema.parse(data);
    const client = db.getClient();

    // TODO: Check user tier and permissions
    // For now, default to tier 0
    const tier = 0;

    const result = await client.execute({
      sql: `
        INSERT INTO refs (title, url, note, tags_csv, tier)
        VALUES (?1, ?2, ?3, ?4, ?5)
        RETURNING id
      `,
      args: [
        validated.title,
        validated.url,
        validated.note || null,
        validated.tags_csv || null,
        tier
      ]
    });

    const newId = result.rows[0]?.id;

    return {
      success: true,
      id: newId,
      title: validated.title,
      url: validated.url
    };
  }
}