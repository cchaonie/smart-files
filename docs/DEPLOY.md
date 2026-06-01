# Smart Files 部署指南

本文档说明如何部署 Smart Files 应用到服务器。

## 部署架构

```
用户 → Nginx (80/443) → 静态文件 (SPA)
                      → /api/* → NestJS (容器 :4000) → PostgreSQL (容器 :5432)
```

- **Nginx**: 宿主机上运行，直接提供前端静态文件和 API 反向代理
- **NestJS API**: 容器运行，仅处理 `/api/*` 业务逻辑
  - 端口: 4000（仅 localhost 暴露，不对外）
  - 环境: `DATABASE_URL`, `JWT_SECRET`, `UPLOAD_ROOT`, `PORT`, `CORS_ORIGIN`
- **PostgreSQL**: 容器运行，数据持久化到 `./data/postgres`
- **文件存储**: 共享卷挂载到 `./data/storage`

容器运行时: Podman (无守护进程，rootless 支持)  
容器编排: podman-compose  
镜像仓库: GitHub Container Registry (ghcr.io)

## 本地开发

本地开发直接使用 Node.js 运行，不通过容器运行应用。

### 1. 启动本地数据库

```bash
# 使用 Podman 启动 PostgreSQL
npm run db:start

# 查看数据库状态
podman ps

# 停止数据库
npm run db:stop
```

### 2. 运行应用

**后端:**

```bash
cd packages/backend
npm run start:dev
```

**前端:**

```bash
cd packages/web
npm run dev
```

**数据库迁移:**

```bash
cd packages/shared
npx prisma migrate dev
```

应用将运行在:
- 前端: http://localhost:3000
- API: http://localhost:4000/api
- API 文档: http://localhost:4000/api/docs

## 服务器部署

### 环境准备

#### 1. 安装 Podman

**RHEL / CentOS / Fedora:**
```bash
sudo dnf install -y podman podman-compose
```

**Ubuntu / Debian:**
```bash
sudo apt-get update
sudo apt-get install -y podman podman-compose
```

**验证安装:**
```bash
podman --version
podman-compose --version
```

#### 2. 安装 Nginx

**RHEL / CentOS / Fedora:**
```bash
sudo dnf install -y nginx
```

**Ubuntu / Debian:**
```bash
sudo apt-get install -y nginx
```

#### 3. 配置非 root 用户（推荐）

```bash
# 创建用户
sudo useradd -m -s /bin/bash smartfiles

# 添加到 systemd-journal 组（可选，用于查看日志）
sudo usermod -aG systemd-journal smartfiles

# 切换到用户
sudo su - smartfiles
```

### 构建前端

在项目根目录构建前端静态文件：

```bash
npm ci
npm run build -w packages/web
```

构建产物位于 `packages/web/dist/`，需要部署到 nginx 静态文件目录。

### 构建生产镜像

从项目根目录构建后端镜像：

```bash
podman build -t smart-files:latest .
```

### 部署静态文件

将前端构建产物拷贝到 nginx 静态文件目录：

```bash
sudo mkdir -p /opt/smart-files/web-dist
sudo cp -r packages/web/dist/* /opt/smart-files/web-dist/
```

### 配置 Nginx

将项目中的 `nginx.conf` 拷贝到 nginx 配置目录：

```bash
sudo cp nginx.conf /etc/nginx/conf.d/smart-files.conf
```

确认 nginx 配置中 `root` 路径与实际部署路径一致，然后重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 使用 podman-compose 部署

```yaml
services:
  db:
    image: docker.io/library/postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: smartfiles
    volumes:
      - ./data/postgres:/var/lib/postgresql/data:Z
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  backend:
    image: smart-files:latest
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/smartfiles?schema=public
      JWT_SECRET: ${JWT_SECRET}
      UPLOAD_ROOT: /data/storage
      MAX_FILE_SIZE_BYTES: ${MAX_FILE_SIZE_BYTES:-10737418240}
      PORT: 4000
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost}
    volumes:
      - ./data/storage:/data/storage:Z
    depends_on:
      - db
    restart: unless-stopped
```

注意：backend 服务不再需要对外暴露端口，nginx 通过 Podman 网络或 localhost 直连即可。如果需要从宿主机访问 backend 端口（例如调试），可以加上 `ports: - "127.0.0.1:4000:4000"` 仅绑定 localhost。

部署命令：

```bash
# 设置环境变量
export JWT_SECRET="$(openssl rand -base64 32)"
export POSTGRES_PASSWORD="your-secure-password"

# 启动服务
podman-compose -f podman-compose.yml up --build -d
```

启动后访问：
- UI 界面: http://localhost
- API 文档: http://localhost/api/docs

### 使用 HTTPS（推荐）

生产环境建议配置 SSL 证书：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;

    root /opt/smart-files/web-dist;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 数据管理

### 数据持久化说明

数据存储在 Podman bind mounts 中：
- `./data/postgres`: 数据库数据
- `./data/storage`: 上传的文件

更新镜像时，数据会自动保留。

### 备份数据

```bash
# 手动备份
tar czvf smartfiles-backup-$(date +%Y%m%d).tar.gz data/
```

### 恢复数据

```bash
# 停止服务
podman-compose -f podman-compose.yml down

# 恢复数据库
podman exec -i smart-files-db psql -U postgres smartfiles < backup.sql

# 恢复文件
cp -r backup/storage/* data/storage/

# 重启服务
podman-compose -f podman-compose.yml up -d
```

## 故障排查

### 查看日志

```bash
# 查看后端日志
podman logs -f smart-files-backend

# 查看数据库日志
podman logs -f smart-files-db

# 查看 nginx 日志
sudo journalctl -u nginx -f
```

### 常见命令

```bash
# 进入后端容器
podman exec -it smart-files-backend sh

# 进入数据库容器
podman exec -it smart-files-db psql -U postgres -d smartfiles

# 手动执行数据库迁移
podman exec smart-files-backend npx prisma migrate deploy

# 重启服务
podman restart smart-files-backend

# 停止所有服务
podman-compose -f podman-compose.yml down

# 停止并删除数据（危险！）
podman-compose -f podman-compose.yml down -v
```

### 数据库迁移失败

```bash
# 在后端容器内手动执行迁移
podman exec smart-files-backend npx prisma migrate deploy

# 查看迁移状态
podman exec smart-files-backend npx prisma migrate status
```

### 端口冲突

| 服务 | 默认端口 |
|------|---------|
| Nginx | 80 / 443 |
| NestJS API | 4000（仅 localhost） |
| DB | 5432 |

## 安全建议

1. **使用非 root 用户运行容器**（Podman 默认支持）
2. **定期备份数据**
3. **配置防火墙**，只开放必要的端口（80/443）
4. **使用 HTTPS**，通过 nginx 配置 SSL 证书
5. **定期更新**基础镜像和依赖
6. **使用强密码**生成 `JWT_SECRET` 和 `POSTGRES_PASSWORD`

## 系统服务（可选）

配置 systemd 服务实现开机自启：

```bash
# 生成 systemd 配置
podman generate systemd --new --name smart-files-backend > ~/.config/systemd/user/smart-files-backend.service
podman generate systemd --new --name smart-files-db > ~/.config/systemd/user/smart-files-db.service

# 启用服务
systemctl --user daemon-reload
systemctl --user enable smart-files-backend.service
systemctl --user enable smart-files-db.service

# 启动服务
systemctl --user start smart-files-backend.service
systemctl --user start smart-files-db.service

# 允许用户服务在后台运行
loginctl enable-linger $USER
```
