# Smart Files 部署指南

本文档说明如何使用 Podman 部署 Smart Files 应用到服务器。

## 部署架构

- **容器运行时**: Podman (无守护进程，rootless 支持)
- **容器编排**: podman-compose
- **镜像仓库**: GitHub Container Registry (ghcr.io)
- **数据持久化**: Podman named volumes

## 本地开发

本地开发直接使用 Node.js 运行，不通过容器运行应用。

### 1. 启动本地数据库

```bash
# 使用 podman-compose 启动 PostgreSQL
npm run db:start

# 查看数据库状态
podman ps

# 停止数据库
npm run db:stop
```

### 2. 运行应用

```bash
# 安装依赖
npm install

# 执行数据库迁移
npm run db:migrate

# 启动开发服务器
npm run dev
```

应用将运行在 http://localhost:3000

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

#### 2. 配置非 root 用户（推荐）

```bash
# 创建用户
sudo useradd -m -s /bin/bash smartfiles

# 添加到 systemd-journal 组（可选，用于查看日志）
sudo usermod -aG systemd-journal smartfiles

# 切换到用户
sudo su - smartfiles
```

### 首次部署

#### 1. 创建部署目录

```bash
mkdir -p /opt/smart-files
cd /opt/smart-files
```

#### 2. 下载配置文件

```bash
# 下载 podman-compose 配置
curl -O https://raw.githubusercontent.com/cchaonie/smart-files/main/podman-compose.prod.yml

# 下载部署脚本
curl -O https://raw.githubusercontent.com/cchaonie/smart-files/main/scripts/deploy-podman.sh
chmod +x deploy-podman.sh

# 下载备份脚本（可选）
curl -O https://raw.githubusercontent.com/cchaonie/smart-files/main/scripts/backup-podman.sh
chmod +x backup-podman.sh
```

#### 3. 配置环境变量

```bash
# 下载模板
curl -O https://raw.githubusercontent.com/cchaonie/smart-files/main/.env.example
cp .env.example .env

# 编辑配置
vim .env
```

必须修改的配置项：
- `POSTGRES_PASSWORD`: 设置强密码
- `AUTH_SECRET`: 生成密钥 `openssl rand -base64 32`
- `AUTH_URL`: 改为实际域名 `https://your-domain.com`

#### 4. 执行首次部署

```bash
./deploy-podman.sh --first-time
```

此命令会：
- 拉取最新镜像
- 创建数据卷
- 启动数据库和应用
- 执行数据库迁移

### 更新版本

当代码更新并推送新镜像后：

```bash
cd /opt/smart-files
./deploy-podman.sh
```

此命令会：
- 拉取最新镜像
- 停止旧容器
- 启动新容器（数据自动保留）
- 执行数据库迁移

### 查看状态

```bash
./deploy-podman.sh --status
```

## 数据管理

### 数据持久化说明

数据存储在 Podman named volumes 中：
- `smart-files-postgres-data`: 数据库数据
- `smart-files-storage-data`: 上传的文件

更新镜像时，volumes 会自动挂载到新容器，数据不会丢失。

### 备份数据

```bash
# 执行备份
./backup-podman.sh

# 备份文件位置: ./backups/backup_YYYYMMDD_HHMMSS.tar.gz

# 查看备份内容
tar -tzf backups/backup_20240101_120000.tar.gz
```

### 恢复数据

```bash
# 停止服务
podman-compose -f podman-compose.prod.yml down

# 恢复数据库
podman exec -i smart-files-db psql -U postgres smartfiles < database.sql

# 恢复文件
podman cp storage/. smart-files-app:/data/storage/

# 重启服务
podman-compose -f podman-compose.prod.yml up -d
```

### 手动操作数据卷

```bash
# 查看数据卷
podman volume ls

# 查看数据卷详情
podman volume inspect smart-files-postgres-data

# 备份数据卷（原始方式）
podman run --rm -v smart-files-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# 删除数据卷（谨慎操作！）
podman volume rm smart-files-postgres-data
```

## 故障排查

### 查看日志

```bash
# 查看应用日志
podman logs -f smart-files-app

# 查看数据库日志
podman logs -f smart-files-db

# 查看最近 100 行日志
podman logs --tail 100 smart-files-app
```

### 常见命令

```bash
# 进入应用容器
podman exec -it smart-files-app sh

# 进入数据库容器
podman exec -it smart-files-db psql -U postgres -d smartfiles

# 重启应用
podman restart smart-files-app

# 重启数据库
podman restart smart-files-db

# 停止所有服务
podman-compose -f podman-compose.prod.yml down

# 停止并删除数据（危险！）
podman-compose -f podman-compose.prod.yml down -v
```

### 数据库迁移失败

```bash
# 手动执行迁移
podman exec smart-files-app npx prisma migrate deploy

# 查看迁移状态
podman exec smart-files-app npx prisma migrate status
```

### 端口冲突

如果 3000 端口被占用，修改 `.env`：
```bash
APP_PORT=8080
```

然后重启服务：
```bash
podman-compose -f podman-compose.prod.yml down
./deploy-podman.sh --first-time
```

## 安全建议

1. **使用非 root 用户运行容器**（Podman 默认支持）
2. **定期备份数据**，使用 `./backup-podman.sh`
3. **配置防火墙**，只开放必要的端口
4. **使用 HTTPS**，通过反向代理（如 Nginx/Caddy）
5. **定期更新**基础镜像和依赖

## 系统服务（可选）

配置 systemd 服务实现开机自启：

```bash
# 生成 systemd 配置
podman generate systemd --new --name smart-files-app > ~/.config/systemd/user/smart-files-app.service
podman generate systemd --new --name smart-files-db > ~/.config/systemd/user/smart-files-db.service

# 启用服务
systemctl --user daemon-reload
systemctl --user enable smart-files-app.service
systemctl --user enable smart-files-db.service

# 启动服务
systemctl --user start smart-files-app.service
systemctl --user start smart-files-db.service

# 允许用户服务在后台运行
loginctl enable-linger $USER
```
