import { Request, Response, NextFunction } from 'express';

export interface TailscaleUser {
  login: string;
  name?: string;
  profilePicUrl?: string;
}

export interface AuthenticatedRequest extends Request {
  tailscaleUser?: TailscaleUser;
}

export class TailscaleAuth {
  /**
   * Middleware to extract Tailscale user identity from headers
   * When running behind Tailscale Serve, these headers are automatically injected
   */
  static extractIdentity() {
    return (req: Request, res: Response, next: NextFunction) => {
      const tailscaleUser = req.headers['tailscale-user-login'] as string;
      const tailscaleName = req.headers['tailscale-user-name'] as string;
      const tailscaleProfilePic = req.headers['tailscale-user-profile-pic'] as string;
      
      if (tailscaleUser) {
        (req as AuthenticatedRequest).tailscaleUser = {
          login: tailscaleUser,
          name: tailscaleName,
          profilePicUrl: tailscaleProfilePic
        };
      }
      
      next();
    };
  }

  /**
   * Middleware to require authentication
   */
  static requireAuth() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.tailscaleUser) {
        res.status(401).json({
          error: 'Authentication required. This endpoint must be accessed via Tailscale Serve.'
        });
        return;
      }
      next();
    };
  }

  /**
   * Middleware to check user tier/permissions
   */
  static requireTier(minTier: number = 1) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!req.tailscaleUser) {
        res.status(401).json({
          error: 'Authentication required'
        });
        return;
      }

      try {
        const userTier = await TailscaleAuth.getUserTier(req.tailscaleUser.login);
        
        if (userTier < minTier) {
          res.status(403).json({
            error: `Insufficient permissions. Required tier: ${minTier}, user tier: ${userTier}`
          });
          return;
        }
        
        next();
      } catch (error) {
        console.error('Tier check error:', error);
        res.status(500).json({
          error: 'Failed to check user permissions'
        });
      }
    };
  }

  /**
   * Get user's access tier from database
   */
  static async getUserTier(login: string): Promise<number> {
    // TODO: Import db connection properly
    // For now, return default tier 0
    return 0;
    
    /*
    const client = db.getClient();
    const result = await client.execute({
      sql: 'SELECT tier FROM access_tiers WHERE login = ?',
      args: [login]
    });
    
    return result.rows[0]?.tier as number || 0;
    */
  }

  /**
   * Set or update user's access tier
   */
  static async setUserTier(login: string, tier: number, channels?: string[]): Promise<void> {
    // TODO: Implement when db is available in this context
    console.log(`Would set user ${login} to tier ${tier} with channels: ${channels?.join(',') || 'none'}`);
  }

  /**
   * Development helper - simulate Tailscale identity headers for local testing
   */
  static simulateIdentity(login: string, name?: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (process.env.NODE_ENV === 'development') {
        req.headers['tailscale-user-login'] = login;
        if (name) {
          req.headers['tailscale-user-name'] = name;
        }
      }
      next();
    };
  }

  /**
   * Log user activity for audit purposes
   */
  static async logActivity(
    user: TailscaleUser, 
    action: string, 
    details?: any
  ): Promise<void> {
    try {
      console.log('User activity:', {
        timestamp: new Date().toISOString(),
        user: user.login,
        action,
        details
      });
      
      // TODO: Store in audit_log table when db is available
    } catch (error) {
      console.error('Activity logging error:', error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }
}