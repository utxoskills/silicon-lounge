#!/bin/bash
# TBC 漏洞测试环境准备脚本
# 用于快速搭建 TBC 测试环境并运行漏洞测试

set -e

echo "=========================================="
echo "TBC 漏洞测试环境准备"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查依赖
check_dependencies() {
    echo "[1/5] 检查依赖..."
    
    # 检查 Python3
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}错误: 未找到 Python3${NC}"
        echo "请安装 Python3: sudo apt-get install python3"
        exit 1
    fi
    echo "  ✓ Python3 已安装"
    
    # 检查 pip
    if ! command -v pip3 &> /dev/null; then
        echo -e "${RED}错误: 未找到 pip3${NC}"
        echo "请安装 pip3: sudo apt-get install python3-pip"
        exit 1
    fi
    echo "  ✓ pip3 已安装"
    
    # 检查 requests 库
    if ! python3 -c "import requests" 2>/dev/null; then
        echo "  安装 requests 库..."
        pip3 install requests
    fi
    echo "  ✓ requests 库已安装"
    
    echo ""
}

# 创建测试目录
setup_directories() {
    echo "[2/5] 创建测试目录..."
    
    mkdir -p tbc_exploit_test
    cd tbc_exploit_test
    
    # 复制测试脚本
    if [ -f "../tbc_exploit_generator.py" ]; then
        cp ../tbc_exploit_generator.py .
    fi
    
    if [ -f "../tbc_vulnerability_tester.py" ]; then
        cp ../tbc_vulnerability_tester.py .
    fi
    
    echo "  ✓ 测试目录已创建"
    echo ""
}

# 生成测试脚本
generate_scripts() {
    echo "[3/5] 生成测试脚本..."
    
    if [ -f "tbc_exploit_generator.py" ]; then
        python3 tbc_exploit_generator.py
        echo "  ✓ 测试脚本已生成"
    else
        echo -e "${YELLOW}警告: 未找到 tbc_exploit_generator.py${NC}"
    fi
    
    echo ""
}

# 检查 TBC 节点
check_tbc_node() {
    echo "[4/5] 检查 TBC 节点..."
    
    # 检查 tbcd 是否在运行
    if pgrep -x "tbcd" > /dev/null; then
        echo "  ✓ TBC 节点正在运行"
        
        # 检查 RPC 端口
        if netstat -tuln 2>/dev/null | grep -q ":18332"; then
            echo "  ✓ RPC 端口 18332 (测试网) 已开放"
        elif netstat -tuln 2>/dev/null | grep -q ":8332"; then
            echo -e "${YELLOW}  ⚠ 检测到主网 RPC 端口 8332，请确保在测试网运行${NC}"
        else
            echo -e "${YELLOW}  ⚠ 未检测到开放 RPC 端口${NC}"
        fi
    else
        echo -e "${YELLOW}警告: TBC 节点未运行${NC}"
        echo "请启动测试网节点: tbcd -testnet -daemon"
    fi
    
    echo ""
}

# 显示使用说明
show_usage() {
    echo "[5/5] 使用说明"
    echo "=========================================="
    echo ""
    echo "1. 确保 TBC 测试网节点正在运行:"
    echo "   tbcd -testnet -daemon"
    echo ""
    echo "2. 配置 RPC 认证 (~/.tbc/tbc.conf):"
    echo "   rpcuser=your_username"
    echo "   rpcpassword=your_password"
    echo "   rpcport=18332"
    echo "   server=1"
    echo ""
    echo "3. 运行漏洞测试:"
    echo "   python3 tbc_vulnerability_tester.py \\"
    echo "       --host localhost \\"
    echo "       --port 18332 \\"
    echo "       --user your_username \\"
    echo "       --password your_password"
    echo ""
    echo "4. 获取测试网 TBC:"
    echo "   - 使用测试网水龙头"
    echo "   - 或从其他测试网地址转账"
    echo ""
    echo "5. 监控节点状态:"
    echo "   tail -f ~/.tbc/testnet3/debug.log"
    echo ""
    echo "=========================================="
    echo -e "${GREEN}环境准备完成！${NC}"
    echo "=========================================="
}

# 主函数
main() {
    check_dependencies
    setup_directories
    generate_scripts
    check_tbc_node
    show_usage
}

# 运行主函数
main
