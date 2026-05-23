# ---------- Build Stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/web/package*.json ./packages/web/
COPY packages/shared/package*.json ./packages/shared/
RUN npm install --prefer-offline --no-audit

# Copy source and build
COPY . .
RUN npm run build -w packages/backend
RUN npm run build -w packages/web
RUN npx prisma generate --schema=packages/shared/prisma/schema.prisma

# ---------- Production Stage ----------
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies + prisma CLI for migrations
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --omit=dev && npm install prisma@6.19.3 --omit=optional && npm cache clean --force

# Copy built artifacts and Prisma schema
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist
COPY --from=builder /app/packages/shared/prisma ./packages/shared/prisma
# Copy generated Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

WORKDIR /app/packages/backend
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy --schema=../../packages/shared/prisma/schema.prisma && node dist/src/main"]
