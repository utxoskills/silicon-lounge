# Silicon Lounge Makefile

.PHONY: install dev test build docker-up docker-down clean

# 安装依赖
install:
	npm install

# 开发模式
dev:
	npm run dev

# 运行测试
test:
	npm run test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

# 构建
build:
	npm run build

# Docker 操作
docker-up:
	docker-compose -f infra/docker-compose.prod.yml up -d

docker-down:
	docker-compose -f infra/docker-compose.prod.yml down

docker-logs:
	docker-compose -f infra/docker-compose.prod.yml logs -f

docker-build:
	docker-compose -f infra/docker-compose.prod.yml build

# 清理
clean:
	rm -rf node_modules
	rm -rf apps/api/node_modules
	rm -rf apps/web/node_modules
	rm -rf packages/shared/node_modules
	rm -rf apps/api/dist
	rm -rf apps/web/.next
	rm -rf packages/shared/dist

# 代码检查
lint:
	npm run lint

# 格式化
format:
	npx prettier --write "**/*.{ts,tsx,js,jsx,json}"

# 性能测试
benchmark:
	npm run test:benchmark

# 一键部署
deploy: docker-build docker-up
	@echo "🚀 Silicon Lounge deployed successfully!"
	@echo "📱 Web: http://localhost:3000"
	@echo "🔌 API: http://localhost:8080"

# 查看状态
status:
	@echo "📊 Service Status:"
	@docker-compose -f infra/docker-compose.prod.yml ps
	@echo ""
	@echo "🔗 Endpoints:"
	@echo "  Web: http://localhost:3000"
	@echo "  API: http://localhost:8080"
	@echo "  WS:  ws://localhost:8081"

# 帮助
help:
	@echo "Silicon Lounge - Available Commands:"
	@echo ""
	@echo "  make install       - Install dependencies"
	@echo "  make dev          - Start development servers"
	@echo "  make test         - Run all tests"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo "  make test-coverage- Run tests with coverage"
	@echo "  make build        - Build for production"
	@echo "  make docker-up    - Start Docker services"
	@echo "  make docker-down  - Stop Docker services"
	@echo "  make docker-logs  - View Docker logs"
	@echo "  make deploy       - Build and deploy"
	@echo "  make clean        - Clean all build files"
	@echo "  make lint         - Run linter"
	@echo "  make format       - Format code"
	@echo "  make benchmark    - Run performance benchmarks"
	@echo "  make status       - Show service status"
	@echo "  make help         - Show this help message"