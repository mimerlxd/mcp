#!/bin/bash
# Setup script for trail container - run once on mcp-trail-mcp

set -e

echo "Setting up MCP Knowledge Service on trail container..."

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create service user and directories
sudo useradd -r -s /bin/false mcp-service || true
sudo mkdir -p /opt/mcp-knowledge-service
sudo chown ubuntu:ubuntu /opt/mcp-knowledge-service

# Copy systemd service file
sudo cp /opt/mcp-knowledge-service/deploy/mcp-knowledge-service.service /etc/systemd/system/
sudo systemctl daemon-reload

# Create environment file from example
cp /opt/mcp-knowledge-service/.env.example /opt/mcp-knowledge-service/.env

echo "Setup complete. Service ready for deployment via GitHub Actions."
echo "Make sure to:"
echo "1. Configure .env file with actual values"
echo "2. Add GitHub runner's SSH key to authorized_keys"