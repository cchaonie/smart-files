# ---------- Build Stage 构建阶段 ----------
FROM node:20.18-alpine AS builder
WORKDIR /app

# 分层拷贝依赖文件，利用构建缓存
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/web/package*.json ./packages/web/
COPY packages/mobile/package*.json ./packages/mobile/

# 完整安装所有依赖(包含开发依赖)
RUN npm ci

# 拷贝全部源码
COPY . .

# 构建后端、生成 Prisma Client
RUN npm run build -w packages/backend
RUN npx prisma generate --schema=packages/shared/prisma/schema.prisma

# ---------- Production Stage 生产阶段 ----------
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# 拷贝依赖清单
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/web/package*.json ./packages/web/
COPY packages/mobile/package*.json ./packages/mobile/

# 仅安装生产依赖（使用 install 而非 ci，避免 workspaces lockfile 严格校验）
RUN npm install --production

# 拷贝后端编译产物
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# 拷贝 Prisma 相关文件 + 生成的客户端(Monorepo 必备)
COPY --from=builder /app/packages/shared/prisma ./packages/shared/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 切换工作目录到后端
WORKDIR /app/packages/backend
EXPOSE 4000

# 启动 NestJS API 服务
CMD ["node", "dist/main"]
