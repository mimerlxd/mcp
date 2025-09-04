#!/bin/bash

# MCP Knowledge Service Setup Script

set -e

echo "Setting up MCP Knowledge Service..."

# Create data directory
mkdir -p data

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file from .env.example"
    echo "Please edit .env with your configuration"
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the project
echo "Building project..."
npm run build

# Run database migrations (when implemented)
# npm run migrate

echo "Setup complete!"
echo "Run 'npm run dev' to start development server"