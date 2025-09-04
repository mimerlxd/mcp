import { createClient, Client } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

export class DatabaseConnection {
  private client: Client | null = null;

  async initialize(): Promise<void> {
    const url = process.env.LIBSQL_URL || 'file:./data/knowledge.db';
    const authToken = process.env.LIBSQL_AUTH_TOKEN;

    this.client = createClient({
      url,
      authToken,
    });

    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }

    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      await this.client.execute(statement);
    }

    console.log('Database migrations completed');
  }

  getClient(): Client {
    if (!this.client) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.client;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

export const db = new DatabaseConnection();