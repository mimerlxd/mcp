import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { db } from '../db/connection.js';
import { RulesService } from './tools/rules.js';
import { ProjectService } from './tools/project.js';
import { RefsService } from './tools/refs.js';

export class MCPKnowledgeServer {
  private server: Server;
  private rulesService: RulesService;
  private projectService: ProjectService;
  private refsService: RefsService;

  constructor() {
    this.server = new Server({
      name: 'mcp-knowledge-service',
      version: '1.0.0',
    });

    this.rulesService = new RulesService();
    this.projectService = new ProjectService();
    this.refsService = new RefsService();

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'rules.search',
            description: 'Search through global AI development rules and standards',
            inputSchema: {
              type: 'object',
              properties: {
                q: { type: 'string', description: 'Search query' },
                k: { type: 'number', description: 'Number of results to return', default: 10 },
                tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' }
              },
              required: ['q']
            }
          },
          {
            name: 'rules.get',
            description: 'Get a specific rule by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Rule ID' }
              },
              required: ['id']
            }
          },
          {
            name: 'rules.tags',
            description: 'List all available rule tags',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'project.search',
            description: 'Search within a specific project\'s documentation',
            inputSchema: {
              type: 'object',
              properties: {
                project: { type: 'string', description: 'Project name' },
                q: { type: 'string', description: 'Search query' },
                k: { type: 'number', description: 'Number of results to return', default: 10 }
              },
              required: ['project', 'q']
            }
          },
          {
            name: 'project.browse',
            description: 'Browse project structure and documents',
            inputSchema: {
              type: 'object',
              properties: {
                project: { type: 'string', description: 'Project name' },
                path: { type: 'string', description: 'Path prefix to filter by' }
              },
              required: ['project']
            }
          },
          {
            name: 'project.contextPack',
            description: 'Get a curated context bundle for a project',
            inputSchema: {
              type: 'object',
              properties: {
                project: { type: 'string', description: 'Project name' },
                facets: { type: 'array', items: { type: 'string' }, description: 'Context facets to include' }
              },
              required: ['project']
            }
          },
          {
            name: 'refs.list',
            description: 'List references, optionally filtered by tags',
            inputSchema: {
              type: 'object',
              properties: {
                tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
                limit: { type: 'number', description: 'Maximum number of results', default: 50 }
              }
            }
          },
          {
            name: 'refs.add',
            description: 'Add a new reference (requires appropriate tier)',
            inputSchema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Reference title' },
                url: { type: 'string', description: 'Reference URL' },
                note: { type: 'string', description: 'Optional note' },
                tags_csv: { type: 'string', description: 'Comma-separated tags' }
              },
              required: ['title', 'url']
            }
          },
          {
            name: 'refs.findByTag',
            description: 'Find references by specific tag',
            inputSchema: {
              type: 'object',
              properties: {
                tag: { type: 'string', description: 'Tag to search for' }
              },
              required: ['tag']
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'rules.search':
            return await this.rulesService.search(args);
          case 'rules.get':
            return await this.rulesService.get(args);
          case 'rules.tags':
            return await this.rulesService.tags(args);
          case 'project.search':
            return await this.projectService.search(args);
          case 'project.browse':
            return await this.projectService.browse(args);
          case 'project.contextPack':
            return await this.projectService.contextPack(args);
          case 'refs.list':
            return await this.refsService.list(args);
          case 'refs.add':
            return await this.refsService.add(args);
          case 'refs.findByTag':
            return await this.refsService.findByTag(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'mcp://rules/schema',
            name: 'Rules Database Schema',
            description: 'Database schema for rules storage',
            mimeType: 'application/sql'
          },
          {
            uri: 'mcp://projects/list',
            name: 'Available Projects',
            description: 'List of all available projects',
            mimeType: 'application/json'
          }
        ]
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      switch (uri) {
        case 'mcp://rules/schema':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/sql',
                text: '-- Rules schema would be here --'
              }
            ]
          };
        case 'mcp://projects/list':
          const projects = await this.projectService.listProjects();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(projects, null, 2)
              }
            ]
          };
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }

  async start(): Promise<void> {
    await db.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log('MCP Knowledge Server started and listening on stdio');
  }

  async stop(): Promise<void> {
    await db.close();
  }
}