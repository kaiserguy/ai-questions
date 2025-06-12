#!/bin/bash

# AI Agent Setup Script for Local Version
# This script sets up the n8n-based AI agent system

set -e

echo "🤖 Setting up AI Agent with n8n..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p n8n-agent/n8n-workflows
mkdir -p n8n-agent/n8n-config
mkdir -p n8n-agent/integration
mkdir -p n8n-agent/config

# Set permissions
chmod -R 755 n8n-agent/

echo "🐳 Starting AI Agent services..."
cd n8n-agent

# Pull required images
echo "📥 Pulling Docker images..."
docker-compose pull

# Start services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check if n8n is running
if curl -f http://localhost:5678/healthz > /dev/null 2>&1; then
    echo "✅ n8n is running at http://localhost:5678"
else
    echo "⚠️  n8n may still be starting up. Check with: docker-compose logs n8n"
fi

# Check if Redis is running
if docker-compose exec redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "⚠️  Redis may not be running properly"
fi

# Install Ollama models if Ollama is running
echo "🧠 Setting up AI models..."
if docker-compose exec ollama ollama list > /dev/null 2>&1; then
    echo "📥 Installing basic AI models..."
    docker-compose exec ollama ollama pull llama2:7b-chat
    docker-compose exec ollama ollama pull mistral:7b
    echo "✅ AI models installed"
else
    echo "⚠️  Ollama may still be starting up. Install models later with:"
    echo "   docker-compose exec ollama ollama pull llama2:7b-chat"
fi

echo ""
echo "🎉 AI Agent setup complete!"
echo ""
echo "📋 Service URLs:"
echo "   • n8n Workflow Editor: http://localhost:5678"
echo "   • AI Questions App: http://localhost:3000"
echo "   • Ollama API: http://localhost:11434"
echo ""
echo "🔧 Management Commands:"
echo "   • View logs: docker-compose logs -f"
echo "   • Stop services: docker-compose down"
echo "   • Restart services: docker-compose restart"
echo ""
echo "📖 Next steps:"
echo "   1. Open http://localhost:5678 to access n8n"
echo "   2. Import the AI agent workflows"
echo "   3. Configure the integration with AI Questions"
echo ""

