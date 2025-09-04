import { db } from '../db/connection.js';

export class AdminService {
  async getMetrics(): Promise<any> {
    const client = db.getClient();

    try {
      // Get counts from each table
      const rulesCount = await client.execute('SELECT COUNT(*) as count FROM rules_global');
      const projectsCount = await client.execute('SELECT COUNT(*) as count FROM project_docs');
      const refsCount = await client.execute('SELECT COUNT(*) as count FROM refs');
      const usersCount = await client.execute('SELECT COUNT(*) as count FROM access_tiers');
      
      // Get recent audit activity
      const recentActivity = await client.execute(`
        SELECT tool, COUNT(*) as count, AVG(elapsed_ms) as avg_ms
        FROM audit_log 
        WHERE timestamp > datetime('now', '-1 hour')
        GROUP BY tool
        ORDER BY count DESC
      `);

      // Get top queried terms (simplified - would need more sophisticated tracking)
      const topQueries = await client.execute(`
        SELECT tool, COUNT(*) as count
        FROM audit_log
        WHERE timestamp > datetime('now', '-24 hour')
        GROUP BY tool
        ORDER BY count DESC
        LIMIT 10
      `);

      // Database size (approximate)
      const dbStats = await client.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()");

      return {
        timestamp: new Date().toISOString(),
        counts: {
          rules: rulesCount.rows[0]?.count || 0,
          projects: projectsCount.rows[0]?.count || 0,
          refs: refsCount.rows[0]?.count || 0,
          users: usersCount.rows[0]?.count || 0
        },
        activity: {
          lastHour: recentActivity.rows.map(row => ({
            tool: row.tool,
            count: row.count,
            avgMs: row.avg_ms
          })),
          topQueries: topQueries.rows.map(row => ({
            tool: row.tool,
            count: row.count
          }))
        },
        database: {
          estimatedSize: dbStats.rows[0]?.size || 0
        }
      };
    } catch (error) {
      console.error('Metrics collection error:', error);
      throw new Error('Failed to collect metrics');
    }
  }

  async reloadChannels(): Promise<void> {
    // TODO: Implement channel hot-reload
    // For now, just return success
    console.log('Channel reload requested - not yet implemented');
    return Promise.resolve();
  }

  async getHealth(): Promise<any> {
    const client = db.getClient();

    try {
      // Simple health check - try to query the database
      await client.execute('SELECT 1');
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        uptime: process.uptime()
      };
    } catch (error) {
      throw new Error('Database health check failed');
    }
  }
}