#!/usr/bin/env bash
#
# 词库数据定期更新脚本
#
# 功能:
#   1. 拉取上游 GitHub 仓库最新数据
#   2. 补充缺失的例句、音标、词性
#   3. 验证补充结果
#   4. 生成更新日志
#
# 使用方法:
#   手动运行: ./scripts/periodic-update.sh
#   定时任务: 添加到 crontab (例如每周日凌晨 3 点)
#     0 3 * * 0 /path/to/project/scripts/periodic-update.sh >> /var/log/vocab-update.log 2>&1
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/vocab-update-$(date +%Y%m%d-%H%M%S).log"
REPORT_FILE="${LOG_DIR}/supplement-report-$(date +%Y%m%d-%H%M%S).json"
LOCK_FILE="/tmp/vocab-update.lock"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

log_info()  { log "${GREEN}[INFO]${NC} $*"; }
log_warn()  { log "${YELLOW}[WARN]${NC} $*"; }
log_error() { log "${RED}[ERROR]${NC} $*"; }

# 检查锁文件，防止并发执行
if [ -f "${LOCK_FILE}" ]; then
    log_warn "检测到锁文件 ${LOCK_FILE}，可能有其他实例正在运行。"
    # 检查锁是否过期（超过2小时）
    LOCK_TIME=$(stat -f%m "${LOCK_FILE}" 2>/dev/null || stat -c%Y "${LOCK_FILE}" 2>/dev/null)
    NOW=$(date +%s)
    DIFF=$((NOW - LOCK_TIME))
    if [ ${DIFF} -gt 7200 ]; then
        log_info "锁文件已过期（${DIFF}秒），强制移除"
        rm -f "${LOCK_FILE}"
    else
        log_error "退出现有实例"
        exit 1
    fi
fi

# 创建锁文件
echo $$ > "${LOCK_FILE}"
trap "rm -f ${LOCK_FILE}" EXIT INT TERM

# 创建日志目录
mkdir -p "${LOG_DIR}"

log_info "=========================================="
log_info "  词库数据定期更新任务开始"
log_info "=========================================="
log_info "项目目录: ${PROJECT_DIR}"
log_info "日志文件: ${LOG_FILE}"

# Step 1: 检查运行环境
log_info "检查运行环境..."
cd "${PROJECT_DIR}"

if ! command -v npx &> /dev/null; then
    log_error "npx 未安装"
    exit 1
fi

log_info "Node.js: $(node --version)"
log_info "npm: $(npm --version)"

# Step 2: 拉取上游仓库
log_info "加载上游数据..."

CLONE_DIR="/tmp/english-vocabulary"

if [ -d "${CLONE_DIR}" ]; then
    log_info "上游仓库已存在，拉取最新数据..."
    if git -C "${CLONE_DIR}" pull --ff-only 2>&1 | tee -a "${LOG_FILE}"; then
        log_info "拉取成功"
    else
        log_warn "拉取失败，重新克隆..."
        rm -rf "${CLONE_DIR}"
        git clone --depth 1 https://github.com/KyleBing/english-vocabulary.git "${CLONE_DIR}" 2>&1 | tee -a "${LOG_FILE}"
    fi
else
    log_info "克隆上游仓库..."
    git clone --depth 1 https://github.com/KyleBing/english-vocabulary.git "${CLONE_DIR}" 2>&1 | tee -a "${LOG_FILE}"
fi

# Step 3: 运行补充脚本
log_info "运行数据补充脚本..."

set +e
npx tsx scripts/supplement-word-data.ts 2>&1 | tee -a "${LOG_FILE}"
SUPPLEMENT_EXIT_CODE=$?
set -e

if [ ${SUPPLEMENT_EXIT_CODE} -ne 0 ]; then
    log_error "补充脚本执行失败 (exit code: ${SUPPLEMENT_EXIT_CODE})"
    # 继续执行验证，了解当前状态
fi

# Step 4: 运行验证脚本
log_info "运行验证脚本..."

set +e
npx tsx scripts/verify-supplementation.ts --output "${REPORT_FILE}" 2>&1 | tee -a "${LOG_FILE}"
VERIFY_EXIT_CODE=$?
set -e

if [ ${VERIFY_EXIT_CODE} -ne 0 ]; then
    log_warn "验证脚本返回非零状态码 (exit code: ${VERIFY_EXIT_CODE})"
fi

# Step 5: 旋转旧的日志文件（保留最近30天的日志）
log_info "清理旧日志..."
find "${LOG_DIR}" -name "vocab-update-*.log" -mtime +30 -delete 2>/dev/null || true
find "${LOG_DIR}" -name "supplement-report-*.json" -mtime +30 -delete 2>/dev/null || true

# Step 6: 完成
if [ ${SUPPLEMENT_EXIT_CODE} -eq 0 ] && [ ${VERIFY_EXIT_CODE} -eq 0 ]; then
    log_info "=========================================="
    log_info "  ✅ 定期更新任务成功完成"
    log_info "=========================================="
else
    log_warn "=========================================="
    log_warn "  ⚠️  定期更新任务完成，但存在警告"
    log_warn "=========================================="
fi

log_info "报告文件: ${REPORT_FILE}"
log_info "日志文件: ${LOG_FILE}"

# 检查是否需要发送通知
PUBLIC_COUNT=$(npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasourceUrl: 'file:./prisma/dev.db' });
p.publicWord.count({ where: { example: null } }).then(c => console.log(c)).finally(() => p.\$disconnect());
" 2>/dev/null || echo "unknown")

if [ "${PUBLIC_COUNT}" != "unknown" ] && [ "${PUBLIC_COUNT}" -gt 10 ]; then
    log_warn "仍有 ${PUBLIC_COUNT} 个公共词条缺少例句"
fi

exit 0
