# 前端 Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/

# 安装依赖
RUN npm ci

# 复制源代码
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

# 构建
RUN npm run build --workspace=@silicon-lounge/shared
RUN npm run build --workspace=@silicon-lounge/web

# 生产镜像
FROM node:20-alpine AS production

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 复制构建产物
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/package*.json ./
COPY --from=builder /app/apps/web/public ./public

# 安装生产依赖
RUN npm ci --only=production

EXPOSE 3000

CMD ["npm", "start"]