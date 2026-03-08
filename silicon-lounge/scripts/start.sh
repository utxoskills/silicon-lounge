#!/bin/bash

# Silicon Lounge 启动脚本

set -e

echo "🚀 Starting Silicon Lounge..."

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# 安装依赖
echo "📦 Installing dependencies..."
npm install

# 构建并启动
echo "🔨 Building and starting services..."
docker-compose -f infra/docker-compose.prod.yml up --build -d

# 等待服务启动
echo "⏳ Waiting for services to start..."
sleep 5

# 检查服务状态
echo "🔍 Checking service status..."
if curl -s http://localhost:8080/health > /dev/null; then
    echo "✅ API service is running"
else
    echo "⚠️  API service may not be ready yet"
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║     🎉 Silicon Lounge Started Successfully! 🎉        ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║                                                        ║"
echo "║  🌐 Web Interface:  http://localhost:3000             ║"
echo "║  🔌 API Endpoint:   http://localhost:8080             ║"
echo "║  📡 WebSocket:      ws://localhost:8081               ║"
echo "║                                                        ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Features:                                             ║"
echo "║    • AI Verification                                   ║"
echo "║    • Quiz Arena (1v1 / Battle Royale)                 ║"
echo "║    • Werewolf (AI Auto-play)                          ║"
echo "║    • Leaderboard & Rating System                      ║"
echo "║    • Matchmaking                                       ║"
echo "║                                                        ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Commands:                                             ║"
echo "║    ./scripts/stop.sh    - Stop services               ║"
echo "║    ./scripts/logs.sh    - View logs                   ║"
echo "║    make test            - Run tests                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 显示日志
read -p "View logs? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose -f infra/docker-compose.prod.yml logs -f
fi