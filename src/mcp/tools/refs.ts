import { db } from '../../db/connection.js';
import type { Reference } from '../../types.js';

export class RefsService {
  async list(args: any): Promise<any> {
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

    const refs: Reference[] = result.rows.map(row => ({
      id: row.id as number,
      title: row.title as string,
      url: row.url as string,
      note: row.note as string | undefined,
      tags_csv: row.tags_csv as string | undefined,
      tier: row.tier as number,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            count: refs.length,
            tagFilter: tags,
            references: refs
          }, null, 2)
        }
      ]
    };
  }

  async add(args: any): Promise<any> {
    const { title, url, note, tags_csv } = args;
    const client = db.getClient();

    // TODO: Check user tier and permissions

    const result = await client.execute({
      sql: `
        INSERT INTO refs (title, url, note, tags_csv, tier)
        VALUES (?1, ?2, ?3, ?4, 0)
        RETURNING id
      `,
      args: [title, url, note || null, tags_csv || null]
    });

    const newId = result.rows[0]?.id;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            id: newId,
            title,
            url
          }, null, 2)
        }
      ]
    };
  }

  async findByTag(args: any): Promise<any> {
    const { tag } = args;
    const client = db.getClient();

    const result = await client.execute({
      sql: `
        SELECT id, title, url, note, tags_csv, tier, created_at, updated_at
        FROM refs
        WHERE tags_csv LIKE ?1
        ORDER BY updated_at DESC
      `,
      args: [`%${tag}%`]
    });

    const refs: Reference[] = result.rows.map(row => ({
      id: row.id as number,
      title: row.title as string,
      url: row.url as string,
      note: row.note as string | undefined,
      tags_csv: row.tags_csv as string | undefined,
      tier: row.tier as number,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            tag,
            count: refs.length,
            references: refs
          }, null, 2)
        }
      ]
    };
  }
}