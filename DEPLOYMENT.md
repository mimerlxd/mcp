# Deployment Setup

## GitHub Actions Deployment to Tailscale

The CI/CD workflow deploys to `mcp-trail-mcp.tail2d448.ts.net` on pushes to the `master` branch.

### Required Setup

1. **Add SSH Key Secret**
   ```bash
   gh secret set DEPLOY_SSH_KEY < ~/.ssh/id_rsa
   ```

2. **Setup Trail Container** (run once on mcp-trail-mcp.tail2d448.ts.net)
   ```bash
   # Copy setup script to container
   scp deploy/setup-trail-container.sh ubuntu@mcp-trail-mcp.tail2d448.ts.net:/tmp/
   
   # Run setup
   ssh ubuntu@mcp-trail-mcp.tail2d448.ts.net
   chmod +x /tmp/setup-trail-container.sh
   sudo /tmp/setup-trail-container.sh
   ```

3. **Configure Environment**
   ```bash
   # Edit environment variables on container
   ssh ubuntu@mcp-trail-mcp.tail2d448.ts.net
   sudo nano /opt/mcp-knowledge-service/.env
   ```

### Deployment Process

- Triggers on push to `master` branch
- Runs tests and builds project
- Creates deployment package
- Deploys via SSH to Tailscale address
- Manages systemd service
- Verifies deployment success

### Service Management

On the trail container:
```bash
# Check service status
sudo systemctl status mcp-knowledge-service

# View logs
sudo journalctl -u mcp-knowledge-service -f

# Restart service
sudo systemctl restart mcp-knowledge-service
```