#!/bin/bash
set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_CONTAINER="smart-files-db"
APP_CONTAINER="smart-files-app"
DB_NAME="${POSTGRES_DB:-smartfiles}"
DB_USER="${POSTGRES_USER:-postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

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
        error "podman 未安装"
        exit 1
    fi
}

# 检查容器状态
check_containers() {
    if ! podman ps | grep -q "$DB_CONTAINER"; then
        error "数据库容器 $DB_CONTAINER 未运行"
        exit 1
    fi

    if ! podman ps | grep -q "$APP_CONTAINER"; then
        warn "应用容器 $APP_CONTAINER 未运行，将只备份数据库"
    fi
}

# 创建备份目录
setup_backup_dir() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/backup_$timestamp"

    mkdir -p "$backup_path"
    echo "$backup_path"
}

# 备份数据库
backup_database() {
    local backup_path=$1
    local db_backup_file="$backup_path/database.sql"

    info "备份数据库..."
    podman exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$db_backup_file"

    if [ $? -eq 0 ]; then
        info "数据库备份完成: $db_backup_file"
    else
        error "数据库备份失败"
        return 1
    fi
}

# 备份上传的文件
backup_storage() {
    local backup_path=$1
    local storage_backup_dir="$backup_path/storage"

    if podman ps | grep -q "$APP_CONTAINER"; then
        info "备份上传的文件..."
        mkdir -p "$storage_backup_dir"
        podman cp "$APP_CONTAINER:/data/storage/." "$storage_backup_dir/"

        if [ $? -eq 0 ]; then
            info "文件备份完成: $storage_backup_dir"
        else
            warn "文件备份可能不完整"
        fi
    else
        warn "应用容器未运行，跳过文件备份"
    fi
}

# 创建备份信息文件
create_backup_info() {
    local backup_path=$1
    local info_file="$backup_path/backup_info.txt"

    cat > "$info_file" << EOF
备份时间: $(date '+%Y-%m-%d %H:%M:%S')
数据库: $DB_NAME
容器状态:
$(podman ps --filter "name=smart-files" --format "table {{.Names}}\t{{.Status}}")

备份内容:
- database.sql: PostgreSQL 数据库转储
- storage/: 上传的文件

恢复方法:
1. 数据库恢复:
   podman exec -i $DB_CONTAINER psql -U $DB_USER $DB_NAME < database.sql

2. 文件恢复:
   podman cp storage/. $APP_CONTAINER:/data/storage/
EOF

    info "备份信息已写入: $info_file"
}

# 压缩备份
compress_backup() {
    local backup_path=$1
    local compressed_file="$backup_path.tar.gz"

    info "压缩备份..."
    tar -czf "$compressed_file" -C "$(dirname "$backup_path")" "$(basename "$backup_path")"

    if [ $? -eq 0 ]; then
        info "备份已压缩: $compressed_file"
        # 删除未压缩的目录
        rm -rf "$backup_path"
        echo "$compressed_file"
    else
        warn "压缩失败，保留未压缩的备份"
        echo "$backup_path"
    fi
}

# 清理旧备份
cleanup_old_backups() {
    info "清理 $RETENTION_DAYS 天前的旧备份..."

    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -name "backup_*" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
        find "$BACKUP_DIR" -name "backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
        info "旧备份清理完成"
    fi
}

# 执行完整备份
perform_backup() {
    local compress="${1:-true}"

    info "开始备份..."
    info "备份目录: $BACKUP_DIR"

    # 创建备份目录
    local backup_path
    backup_path=$(setup_backup_dir)

    # 执行备份
    backup_database "$backup_path"
    backup_storage "$backup_path"
    create_backup_info "$backup_path"

    # 压缩备份
    local final_backup
    if [ "$compress" = "true" ]; then
        final_backup=$(compress_backup "$backup_path")
    else
        final_backup="$backup_path"
    fi

    info "备份完成: $final_backup"

    # 清理旧备份
    cleanup_old_backups
}

# 显示帮助
show_help() {
    echo "使用方法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --no-compress    不压缩备份（保留为目录）"
    echo "  --cleanup-only   仅清理旧备份"
    echo "  --help, -h       显示帮助信息"
    echo ""
    echo "环境变量:"
    echo "  BACKUP_DIR              备份目录 (默认: ./backups)"
    echo "  BACKUP_RETENTION_DAYS   保留天数 (默认: 7)"
    echo "  POSTGRES_DB             数据库名 (默认: smartfiles)"
    echo "  POSTGRES_USER           数据库用户 (默认: postgres)"
}

# 主函数
main() {
    check_dependencies

    case "${1:-}" in
        --no-compress)
            check_containers
            perform_backup "false"
            ;;
        --cleanup-only)
            cleanup_old_backups
            ;;
        --help|-h)
            show_help
            ;;
        "")
            check_containers
            perform_backup "true"
            ;;
        *)
            error "未知选项: $1"
            echo "使用 --help 查看帮助"
            exit 1
            ;;
    esac
}

main "$@"
