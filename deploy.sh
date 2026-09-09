#!/usr/bin/env bash
# ==============================================================================
# 🚀 灵动图 (GifPulse) - Linux 服务器交互式一键部署脚本
# 支持自动化本地构建、SSH 连接检测、静态文件同步、Nginx 自动配置与重载
# ==============================================================================

set -e

# --- 颜色定义 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# --- 打印函数 ---
log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# --- 标题横幅 ---
clear
echo -e "${CYAN}${BOLD}"
echo "================================================================="
echo "   ✨ 灵动图 (GifPulse) - Linux 服务器一键交互式部署工具"
echo "   100% 纯前端静态高效运行 • 毫秒级量化 • 零服务器算力消耗"
echo "================================================================="
echo -e "${NC}"

# --- 1. 检查本地环境依赖 ---
log_info "1/5 正在检查本地环境依赖..."
if ! command -v node >/dev/null 2>&1; then
    log_error "未检测到 Node.js，请先安装 Node.js (推荐 v18+)"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    log_error "未检测到 npm，请先安装 npm"
    exit 1
fi

if ! command -v rsync >/dev/null 2>&1 && ! command -v scp >/dev/null 2>&1; then
    log_error "未检测到 rsync 或 scp，请先安装文件传输工具"
    exit 1
fi
log_success "本地构建环境检查通过 (Node $(node -v), npm $(npm -v))"

# --- 2. 本地生产环境打包 ---
echo ""
log_info "2/5 开始本地编译打包项目 (npm run build)..."
npm run build
if [ ! -d "dist" ]; then
    log_error "打包产物 dist 目录不存在，构建失败！"
    exit 1
fi
log_success "打包完成！产物位于 dist 目录 (Gzip 压缩体积 < 30KB)"

# --- 3. 交互式收集服务器配置 ---
echo ""
echo -e "${BOLD}${BLUE}=== 请输入 Linux 目标服务器连接信息 ===${NC}"

# 服务器 IP / 域名
while true; do
    read -rp "$(echo -e "${BOLD}▶ 请输入服务器 IP 或域名:${NC} ")" SERVER_HOST
    if [ -n "$SERVER_HOST" ]; then
        break
    else
        log_warn "服务器 IP/域名 不能为空，请重新输入！"
    fi
done

# SSH 端口
read -rp "$(echo -e "${BOLD}▶ 请输入 SSH 端口 (默认 22):${NC} ")" SERVER_PORT
SERVER_PORT=${SERVER_PORT:-22}

# SSH 用户名
read -rp "$(echo -e "${BOLD}▶ 请输入 SSH 用户名 (默认 root):${NC} ")" SERVER_USER
SERVER_USER=${SERVER_USER:-root}

# 部署目标目录
read -rp "$(echo -e "${BOLD}▶ 请输入远程服务器部署目录 (默认 /var/www/gif-eesy):${NC} ")" REMOTE_DIR
REMOTE_DIR=${REMOTE_DIR:-/var/www/gif-eesy}

# Web 服务端口 / 域名
read -rp "$(echo -e "${BOLD}▶ 请输入 Web 服务监听端口 (默认 80):${NC} ")" WEB_PORT
WEB_PORT=${WEB_PORT:-80}

read -rp "$(echo -e "${BOLD}▶ 请输入绑定域名 (如无请输入 _ 或直接回车):${NC} ")" DOMAIN_NAME
DOMAIN_NAME=${DOMAIN_NAME:-_}

# 部署模式选择
echo ""
echo -e "${BOLD}▶ 请选择部署模式:${NC}"
echo "  [1] Nginx 自动配置部署 (推荐：高性能静态托管、自动生成配置、支持直接访问)"
echo "  [2] Docker / Docker-Compose 容器化部署 (轻量 Alpine Nginx，无需在宿主机配 Nginx)"
echo "  [3] 仅同步文件 (仅上传 dist 目录到指定远程路径，不修改服务器 Web 服务)"
read -rp "请选择 [1/2/3] (默认 1): " DEPLOY_MODE
DEPLOY_MODE=${DEPLOY_MODE:-1}

# --- 4. 测试 SSH 连接与准备远程环境 ---
echo ""
log_info "3/5 正在测试与服务器 ${SERVER_USER}@${SERVER_HOST}:${SERVER_PORT} 的 SSH 连接..."

SSH_CMD="ssh -p ${SERVER_PORT} -o ConnectTimeout=10 ${SERVER_USER}@${SERVER_HOST}"

if ! ${SSH_CMD} "echo 'SSH_CONNECTED'" >/dev/null 2>&1; then
    log_error "无法通过 SSH 连接到 ${SERVER_USER}@${SERVER_HOST}:${SERVER_PORT}"
    log_warn "请检查："
    log_warn "  1. 服务器 IP、端口、用户名是否正确"
    log_warn "  2. 云服务器安全组/防火墙是否放行了 ${SERVER_PORT} 端口"
    log_warn "  3. 是否已配置 SSH 密钥登录，或可正常交互输入密码"
    exit 1
fi
log_success "SSH 连接成功！"

# 在远程创建目标目录
log_info "正在远程创建部署目录: ${REMOTE_DIR} ..."
${SSH_CMD} "mkdir -p ${REMOTE_DIR}"

# --- 5. 同步静态产物到服务器 ---
echo ""
log_info "4/5 正在同步静态文件到远程服务器..."
if command -v rsync >/dev/null 2>&1; then
    rsync -avz --delete -e "ssh -p ${SERVER_PORT}" dist/ "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/"
else
    scp -P "${SERVER_PORT}" -r dist/* "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/"
fi
log_success "静态文件同步完成！"

# --- 6. 根据模式执行配置 ---
echo ""
log_info "5/5 正在执行服务器部署与配置..."

if [ "$DEPLOY_MODE" == "1" ]; then
    # Mode 1: Nginx 自动配置
    log_info "正在配置远程 Nginx 站点..."

    NGINX_CONF="/tmp/gif-eesy-nginx.conf"
    cat > "${NGINX_CONF}" <<EOF
server {
    listen ${WEB_PORT};
    server_name ${DOMAIN_NAME};

    root ${REMOTE_DIR};
    index index.html;

    # Gzip 压缩支持
    gzip on;
    gzip_min_length 1k;
    gzip_buffers 4 16k;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_vary on;

    # 静态资源长期缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # SPA 前端路由支持
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 安全响应头
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
}
EOF

    # 上传临时 Nginx 配置
    scp -P "${SERVER_PORT}" "${NGINX_CONF}" "${SERVER_USER}@${SERVER_HOST}:/tmp/gif-eesy.conf"
    rm -f "${NGINX_CONF}"

    # 远程安装或激活 Nginx 配置
    ${SSH_CMD} << 'REMOTECODE'
        CONF_DIR="/etc/nginx/conf.d"
        if [ ! -d "$CONF_DIR" ]; then
            CONF_DIR="/etc/nginx/sites-enabled"
            mkdir -p "$CONF_DIR"
        fi

        mv /tmp/gif-eesy.conf "${CONF_DIR}/gif-eesy.conf"

        # 检查是否安装 nginx
        if ! command -v nginx >/dev/null 2>&1; then
            echo "[WARN] 远程服务器未安装 Nginx，已为您将站点配置保存至 ${CONF_DIR}/gif-eesy.conf"
            echo "[INFO] 请在服务器执行 apt install -y nginx 或 yum install -y nginx 安装"
        else
            echo "[INFO] 正在校验 Nginx 配置文件语法..."
            nginx -t && (systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null || systemctl restart nginx)
            echo "[SUCCESS] Nginx 站点配置已生效并重载！"
        fi
REMOTECODE

elif [ "$DEPLOY_MODE" == "2" ]; then
    # Mode 2: Docker 部署
    log_info "正在配置远程 Docker 服务..."
    
    # 上传 Dockerfile 与 docker-compose.yml
    scp -P "${SERVER_PORT}" Dockerfile docker-compose.yml "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/"

    ${SSH_CMD} << REMOTEDOCKER
        cd "${REMOTE_DIR}"
        if command -v docker >/dev/null 2>&1; then
            echo "[INFO] 启动 Docker 容器..."
            docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true
            docker compose up -d --build || docker-compose up -d --build
            echo "[SUCCESS] Docker 容器启动成功！"
        else
            echo "[WARN] 远程服务器未安装 Docker，已将 Dockerfile 传输至 ${REMOTE_DIR}"
        fi
REMOTEDOCKER

else
    log_info "模式 3：仅同步静态资源，无需额外配置 Web 服务。"
fi

# --- 部署完成总结 ---
echo ""
echo -e "${GREEN}${BOLD}=================================================================${NC}"
echo -e "${GREEN}${BOLD}🎉 恭喜！灵动图 (GifPulse) 已成功部署到 Linux 服务器！${NC}"
echo -e "${GREEN}${BOLD}=================================================================${NC}"
echo ""
if [ "$DOMAIN_NAME" != "_" ]; then
    echo -e "🌐 访问地址: ${CYAN}${BOLD}http://${DOMAIN_NAME}:${WEB_PORT}/${NC}"
else
    echo -e "🌐 访问地址: ${CYAN}${BOLD}http://${SERVER_HOST}:${WEB_PORT}/${NC}"
fi
echo -e "📁 远程静态目录: ${REMOTE_DIR}"
echo -e "💡 提示: 若无法访问，请确保服务器安全组 / 阿里云 / 腾讯云防火墙已放行 ${WEB_PORT} 端口！"
echo ""
