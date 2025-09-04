import { config } from 'dotenv';
config();

import { MCPKnowledgeServer } from './mcp/server.js';
import { HttpServer } from './http/server.js';

async function main(): Promise<void> {
  try {
    console.log('MCP Knowledge Service starting...');
    
    // Determine mode from environment or command line
    const mode = process.env.SERVER_MODE || process.argv[2] || 'both';
    
    let mcpServer: MCPKnowledgeServer | undefined;
    let httpServer: HttpServer | undefined;
    
    switch (mode) {
      case 'mcp':
        console.log('Starting in MCP-only mode...');
        mcpServer = new MCPKnowledgeServer();
        await mcpServer.start();
        break;
        
      case 'http':
        console.log('Starting in HTTP-only mode...');
        httpServer = new HttpServer();
        await httpServer.start();
        break;
        
      case 'both':
      default:
        console.log('Starting in dual MCP+HTTP mode...');
        mcpServer = new MCPKnowledgeServer();
        httpServer = new HttpServer();
        
        // Start HTTP server first (it initializes the database)
        await httpServer.start();
        // MCP server can reuse the database connection
        await mcpServer.start();
        break;
    }
    
    console.log(`Server started in '${mode}' mode`);
    
    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down gracefully...');
      if (mcpServer) {
        await mcpServer.stop();
      }
      console.log('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(console.error);