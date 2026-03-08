#!/bin/bash

# Silicon Lounge 停止脚本

echo "🛑 Stopping Silicon Lounge..."

docker-compose -f infra/docker-compose.prod.yml down

echo "✅ Services stopped."

# 可选：清理数据
read -p "Clean all data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose -f infra/docker-compose.prod.yml down -v
    echo "🗑️  All data cleaned."
fi