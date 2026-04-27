#!/bin/bash
set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
IMAGE_NAME="ghcr.io/cchaonie/smart-files"
COMPOSE_FILE="podman-compose.prod.yml"
ENV_FILE=".env"

# 打印信息函数
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    if ! command -v podman &> /dev/null; then
        error "podman 未安装，请先安装 podman"
        exit 1
    fi

    if ! command -v podman-compose &> /dev/null; then
        error "podman-compose 未安装，请先安装 podman-compose"
        exit 1
    fi
}

# 检查环境变量文件
check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        error "环境变量文件 $ENV_FILE 不存在"
        echo "请复制 .env.example 到 .env 并配置相关变量"
        exit 1
    fi
}

# 首次部署
first_time_deploy() {
    info "开始首次部署..."

    # 检查环境变量文件
    check_env_file

    # 检查必要的权限
    if [ "$EUID" -eq 0 ]; then
        warn "以 root 用户运行，建议创建普通用户运行容器"
    fi

    # 创建必要的目录（如果需要 bind mount 时使用）
    # mkdir -p ./data/postgres ./data/storage

    # 拉取最新镜像
    info "拉取应用镜像..."
    podman pull $IMAGE_NAME:latest

    # 启动服务
    info "启动服务..."
    podman-compose -f $COMPOSE_FILE up -d

    # 等待数据库启动
    info "等待数据库启动..."
    sleep 5

    # 等待数据库健康检查通过
    info "等待数据库健康检查..."
    for i in {1..30}; do
        if podman exec smart-files-db pg_isready -U postgres &> /dev/null; then
            info "数据库已就绪"
            break
        fi
        echo -n "."
        sleep 2
    done

    # 执行数据库迁移
    info "执行数据库迁移..."
    podman exec smart-files-app npx prisma migrate deploy

    info "首次部署完成！"
    info "应用访问地址: http://localhost:${APP_PORT:-3000}"
}

# 更新部署
update_deploy() {
    info "开始更新部署..."

    # 备份标记（可选）
    if [ "$BACKUP_BEFORE_UPDATE" = "true" ]; then
        warn "更新前备份未实现，请先手动备份"
    fi

    # 拉取最新镜像
    info "拉取最新镜像..."
    podman pull $IMAGE_NAME:latest

    # 停止当前服务
    info "停止当前服务..."
    podman-compose -f $COMPOSE_FILE down

    # 启动新服务（volume 会自动保留）
    info "启动新服务..."
    podman-compose -f $COMPOSE_FILE up -d

    # 等待数据库启动
    info "等待数据库启动..."
    sleep 5

    # 执行数据库迁移
    info "执行数据库迁移..."
    podman exec smart-files-app npx prisma migrate deploy || warn "迁移可能已是最新"

    info "更新部署完成！"
    info "应用访问地址: http://localhost:${APP_PORT:-3000}"
}

# 显示状态
show_status() {
    info "服务状态:"
    podman ps --filter "name=smart-files" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    echo ""
    info "数据卷状态:"
    podman volume ls | grep smart-files || echo "没有数据卷"
}

# 主函数
main() {
    # 检查依赖
    check_dependencies

    # 解析参数
    case "${1:-}" in
        --first-time|-f)
            first_time_deploy
            ;;
        --status|-s)
            show_status
            ;;
        --help|-h)
            echo "使用方法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --first-time, -f    首次部署（创建数据卷并初始化）"
            echo "  --status, -s        显示服务状态"
            echo "  --help, -h          显示帮助信息"
            echo ""
            echo "无参数时执行更新部署"
            ;;
        "")
            update_deploy
            ;;
        *)
            error "未知选项: $1"
            echo "使用 --help 查看帮助"
            exit 1
            ;;
    esac
}

main "$@"
