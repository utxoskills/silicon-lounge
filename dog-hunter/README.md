# 打狗预警程序 - Dog Hunter

## 程序说明
监控TBC链上新Pool创建，当TBC余额超过1000时触发预警。

## 核心逻辑
1. 定时扫描新Pool（1小时内创建的）
2. 监控新Pool的TBC余额变化
3. 当TBC余额 > 1000时触发预警
4. 老Pool自动忽略

## 文件结构
```
dog-hunter/
├── config.js          # 配置文件
├── scanner.js         # Pool扫描器
├── monitor.js         # 监控器
├── alerter.js         # 预警器
├── index.js           # 主程序
├── package.json       # 依赖配置
└── data/
    └── monitored_pools.json  # 监控数据存储
```

## 安装运行
```bash
# 1. 创建目录
mkdir dog-hunter && cd dog-hunter

# 2. 初始化项目
npm init -y

# 3. 安装依赖
npm install axios

# 4. 创建数据目录
mkdir data

# 5. 复制代码文件
# 将下面的代码保存到对应文件

# 6. 运行程序
node index.js
```

## 配置文件说明
- `SCAN_INTERVAL`: 扫描间隔（默认60秒）
- `POOL_AGE_THRESHOLD`: 新Pool定义（默认1小时=3600秒）
- `TBC_ALERT_THRESHOLD`: TBC预警阈值（默认1000 TBC）
- `ALERT_WEBHOOK`: 预警Webhook地址（可选）
