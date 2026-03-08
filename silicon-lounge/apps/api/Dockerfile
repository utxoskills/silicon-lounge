# 多阶段构建
FROM node:20-alpine AS builder

# 安装依赖
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 复制 package 文件
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# 安装依赖
RUN npm ci

# 复制源代码
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# 构建
RUN npm run build --workspace=@silicon-lounge/shared
RUN npm run build --workspace=@silicon-lounge/api

# 生产镜像
FROM node:20-alpine AS production

WORKDIR /app

# 只复制生产依赖
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/api/package*.json ./apps/api/
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/

RUN npm ci --only=production

# 复制构建产物
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

EXPOSE 8080 8081

CMD ["node", "apps/api/dist/index.js"]