import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { db } from '../db/connection.js';
import { IngestService } from './ingest.js';
import { RefsService as HttpRefsService } from './refs.js';
import { AdminService } from './admin.js';

export class HttpServer {
  private app: express.Application;
  private ingestService: IngestService;
  private refsService: HttpRefsService;
  private adminService: AdminService;

  constructor() {
    this.app = express();
    this.ingestService = new IngestService();
    this.refsService = new HttpRefsService();
    this.adminService = new AdminService();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet());
    
    // CORS - restrictive for tailnet only
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Allow tailscale domains (*.ts.net)
        if (origin.includes('.ts.net')) {
          return callback(null, true);
        }
        
        // Allow localhost for development
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'));
      }
    }));

    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));

    // Basic request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });

    // Extract Tailscale identity (when available)
    this.app.use((req, res, next) => {
      const tailscaleUser = req.headers['tailscale-user-login'] as string;
      const tailscaleName = req.headers['tailscale-user-name'] as string;
      
      if (tailscaleUser) {
        (req as any).tailscaleUser = {
          login: tailscaleUser,
          name: tailscaleName,
        };
      }
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Ingestion endpoints
    this.app.post('/ingest/rule', async (req, res) => {
      try {
        const result = await this.ingestService.ingestRule(req.body, (req as any).tailscaleUser);
        res.json(result);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.app.post('/ingest/project', async (req, res) => {
      try {
        const result = await this.ingestService.ingestProject(req.body, (req as any).tailscaleUser);
        res.json(result);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Refs endpoints
    this.app.get('/refs', async (req, res) => {
      try {
        const { tags, limit } = req.query;
        const result = await this.refsService.list({
          tags: tags ? (tags as string).split(',') : undefined,
          limit: limit ? parseInt(limit as string) : undefined
        });
        res.json(result);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.app.post('/refs', async (req, res) => {
      try {
        const result = await this.refsService.add(req.body, (req as any).tailscaleUser);
        res.json(result);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Admin endpoints
    this.app.get('/admin/metrics', async (req, res) => {
      try {
        const metrics = await this.adminService.getMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.app.post('/admin/reload', async (req, res) => {
      try {
        await this.adminService.reloadChannels();
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found'
      });
    });
  }

  async start(): Promise<void> {
    await db.initialize();
    
    const port = parseInt(process.env.PORT || '3000');
    
    return new Promise((resolve) => {
      this.app.listen(port, '127.0.0.1', () => {
        console.log(`HTTP server listening on http://127.0.0.1:${port}`);
        resolve();
      });
    });
  }
}