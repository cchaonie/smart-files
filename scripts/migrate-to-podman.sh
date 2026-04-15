#!/bin/bash
# 将本地 PostgreSQL 数据迁移到 Podman 容器
# 用法: ./scripts/migrate-to-podman.sh

set -e

echo "=== 数据迁移工具: 本地 PostgreSQL → Podman ==="
echo ""

# 检查 podman 是否安装
if ! command -v podman > /dev/null 2>&1; then
    echo "错误: 未找到 podman 命令"
    echo "请先安装 Podman: https://podman.io/getting-started/installation"
    exit 1
fi

# 检查 podman-compose 是否安装
if ! command -v podman-compose > /dev/null 2>&1; then
    echo "错误: 未找到 podman-compose 命令"
    echo "请先安装 podman-compose: pip3 install podman-compose"
    exit 1
fi

echo "✓ Podman 和 podman-compose 已安装"

# 检查本地 PostgreSQL 是否可连接
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "错误: 无法连接到本地 PostgreSQL (localhost:5432)"
    echo "请确保本地 PostgreSQL 正在运行"
    exit 1
fi

echo "✓ 本地 PostgreSQL 连接正常"

# 检查 smartfiles 数据库是否存在
if ! psql -h localhost -U postgres -lqt | cut -d \| -f 1 | grep -qw smartfiles; then
    echo "错误: 本地不存在 smartfiles 数据库"
    exit 1
fi

echo "✓ smartfiles 数据库存在"

# 创建备份目录
mkdir -p ./data/backups
BACKUP_FILE="./data/backups/migration-$(date +%Y%m%d-%H%M%S).sql"

echo ""
echo "步骤 1: 导出本地数据库..."
echo "  备份文件: $BACKUP_FILE"

# 导出数据库（需要输入密码）
PGPASSWORD=postgres pg_dump -h localhost -U postgres -d smartfiles -F p > "$BACKUP_FILE"

echo "✓ 数据库导出完成"
echo ""

# 检查是否有上传的文件
if [ -d "./data/storage/files" ]; then
    FILE_COUNT=$(find ./data/storage/files -type f 2>/dev/null | wc -l)
    echo "✓ 发现 $FILE_COUNT 个已上传的文件在 ./data/storage/"
else
    echo "ℹ 上传目录为空或不存在"
fi

echo ""
echo "步骤 2: 启动 Podman 数据库..."
echo "  这将创建 ./data/postgres/ 目录用于存储 Podman 数据库数据"
echo ""

# 确保数据目录存在并有正确权限
mkdir -p ./data/postgres
mkdir -p ./data/storage

# 只启动数据库服务
podman-compose -f podman-compose.dev.yml up -d db

echo "  等待数据库就绪..."
sleep 5

# 等待健康检查
for i in {1..30}; do
    if podman-compose -f podman-compose.dev.yml exec -T db pg_isready -U postgres > /dev/null 2>&1; then
        echo "✓ Podman 数据库已就绪"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "警告: 数据库启动超时，继续尝试导入..."
    fi
    sleep 1
done

echo ""
echo "步骤 3: 导入数据到 Podman..."

# 导入备份
podman-compose -f podman-compose.dev.yml exec -T db psql -U postgres -d smartfiles < "$BACKUP_FILE" 2>/dev/null || {
    # 如果数据库不存在，先创建
    podman-compose -f podman-compose.dev.yml exec -T db psql -U postgres -c "CREATE DATABASE smartfiles;" 2>/dev/null || true
    podman-compose -f podman-compose.dev.yml exec -T db psql -U postgres -d smartfiles < "$BACKUP_FILE"
}

echo "✓ 数据导入完成"
echo ""

# 显示迁移结果
echo "=== 迁移完成 ==="
echo ""
echo "数据摘要:"
echo "  - 数据库备份: $BACKUP_FILE"
echo "  - Podman 数据库: ./data/postgres/"
echo "  - 上传文件: ./data/storage/"
echo ""
echo "你现在可以启动 Podman 开发环境:"
echo "  npm run dev:podman"
echo ""
echo "提示:"
echo "  - 所有账号和文件记录已迁移到 Podman"
echo "  - 上传的文件已经在 ./data/storage/，无需迁移"
echo "  - 原始备份已保存，如需恢复可手动导入"
echo ""
echo "Podman 相关命令:"
echo "  - 查看容器: podman ps"
echo "  - 查看日志: podman-compose -f podman-compose.dev.yml logs"
echo "  - 停止服务: npm run dev:podman:down"
