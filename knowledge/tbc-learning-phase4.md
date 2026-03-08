# TBC 节点代码学习 - 阶段四：网络与P2P

## 1. 网络架构概览

### 1.1 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                      CConnman (连接管理器)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  CNode 1     │  │  CNode 2     │  │  CNode N     │       │
│  │  (对等节点)   │  │  (对等节点)   │  │  (对等节点)   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│  CAddrMan (地址管理器)  │  CNetMessage (消息处理)            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 关键类定义

```cpp
// 对等节点
class CNode {
    NodeId id;                    // 节点ID
    CService addr;               // 地址
    SOCKET hSocket;              // 套接字
    
    // 消息队列
    std::deque<CSerializedNetMsg> vSendMsg;   // 发送队列
    std::list<CNetMessage> listRecvMsg;      // 接收队列
    
    // 统计
    uint64_t nSendBytes = 0;
    uint64_t nRecvBytes = 0;
    int64_t nLastSend = 0;
    int64_t nLastRecv = 0;
    
    // 服务标志
    ServiceFlags nServices = NODE_NONE;
    bool fInbound = false;       // 入站连接
    bool fSuccessfullyConnected = false;
    
public:
    void PushMessage(const char* pszCommand);
    bool Misbehaving(int howmuch);  // 惩罚分数
};

// 连接管理器
class CConnman {
    std::vector<CNodePtr> vNodes;           // 所有节点
    std::vector<CNodePtr> vNodesDisconnected;  // 断开但未删除
    
    // 线程
    std::thread threadSocketHandler;        // 套接字处理
    std::thread threadOpenConnections;      // 建立连接
    std::thread threadMessageHandler;       // 消息处理
    
    // 地址管理
    CAddrMan addrman;                       // 地址管理器
    std::vector<CAddress> vAddedNodes;      // 手动添加的节点
    
public:
    bool Start(CScheduler& scheduler);
    void Stop();
    bool ConnectNode(const CAddress& addrConnect);
    void RelayTransaction(const CTransaction& tx);
};
```

---

## 2. 地址管理 (CAddrMan)

### 2.1 地址桶设计

```cpp
// 地址管理器使用两级桶结构防止攻击者填满地址表

// Tried 桶: 已验证可连接的地址
#define ADDRMAN_TRIED_BUCKET_COUNT_LOG2 8   // 256 个桶
#define ADDRMAN_TRIED_BUCKET_COUNT (1 << ADDRMAN_TRIED_BUCKET_COUNT_LOG2)

// New 桶: 新地址（未验证）
#define ADDRMAN_NEW_BUCKET_COUNT_LOG2 10    // 1024 个桶
#define ADDRMAN_NEW_BUCKET_COUNT (1 << ADDRMAN_NEW_BUCKET_COUNT_LOG2)

// 每个桶的大小
#define ADDRMAN_BUCKET_SIZE_LOG2 6          // 64 个地址
#define ADDRMAN_BUCKET_SIZE (1 << ADDRMAN_BUCKET_SIZE_LOG2)

// 地址信息
class CAddrInfo : public CAddress {
    CNetAddr source;           // 地址来源
    int64_t nLastSuccess;      // 上次成功连接时间
    int nAttempts;             // 尝试次数
    bool fInTried;             // 是否在 tried 桶
    
public:
    // 计算 tried 桶位置
    int GetTriedBucket(const uint256 &nKey) const {
        uint64_t hash1 = (CHashWriter(SER_GETHASH, 0) << nKey << GetKey()).GetHash().GetCheapHash();
        uint64_t hash2 = (CHashWriter(SER_GETHASH, 0) << nKey << GetGroup() << (hash1 % ADDRMAN_TRIED_BUCKETS_PER_GROUP)).GetHash().GetCheapHash();
        return hash2 % ADDRMAN_TRIED_BUCKET_COUNT;
    }
    
    // 计算 new 桶位置
    int GetNewBucket(const uint256 &nKey, const CNetAddr &src) const {
        uint64_t hash1 = (CHashWriter(SER_GETHASH, 0) << nKey << GetGroup() << src.GetGroup()).GetHash().GetCheapHash();
        uint64_t hash2 = (CHashWriter(SER_GETHASH, 0) << nKey << src.GetGroup() << (hash1 % ADDRMAN_NEW_BUCKETS_PER_SOURCE_GROUP)).GetHash().GetCheapHash();
        return hash2 % ADDRMAN_NEW_BUCKET_COUNT;
    }
    
    // 计算连接概率
    double GetChance(int64_t nNow = GetAdjustedTime()) const {
        double fChance = 1.0;
        
        // 惩罚最近失败的地址
        int64_t nSinceLastTry = nNow - nLastTry;
        if (nSinceLastTry < 60 * 60)  // 1小时内
            fChance *= 0.01;
        
        // 惩罚多次失败的地址
        fChance *= pow(0.66, nAttempts);
        
        return fChance;
    }
};
```

### 2.2 地址选择算法

```cpp
class CAddrMan {
    // 随机选择地址连接
    CAddrInfo Select_(bool newOnly) {
        // 优先选择 tried 地址
        if (!newOnly && nTried > 0 && (nNew == 0 || GetRandInt(2) == 0)) {
            // 从 tried 桶随机选择
            int bucket = GetRandInt(ADDRMAN_TRIED_BUCKET_COUNT);
            int position = GetRandInt(ADDRMAN_BUCKET_SIZE);
            return mapInfo[vvTried[bucket][position]];
        } else {
            // 从 new 桶随机选择
            int bucket = GetRandInt(ADDRMAN_NEW_BUCKET_COUNT);
            int position = GetRandInt(ADDRMAN_BUCKET_SIZE);
            return mapInfo[vvNew[bucket][position]];
        }
    }
    
    // 添加新地址
    bool Add_(const CAddress &addr, const CNetAddr& source, int64_t nTimePenalty) {
        // 检查地址是否已存在
        CAddrInfo *pinfo = Find(addr);
        
        if (pinfo) {
            // 更新现有地址
            bool fCurrentlyOnline = (GetAdjustedTime() - addr.nTime < 24 * 60 * 60);
            int64_t nUpdateInterval = (fCurrentlyOnline ? 60 * 60 : 24 * 60 * 60);
            if (addr.nTime && (!pinfo->nTime || pinfo->nTime < addr.nTime - nUpdateInterval - nTimePenalty))
                pinfo->nTime = addr.nTime;
        } else {
            // 创建新地址条目
            CAddrInfo info(addr, source);
            info.nTime = std::max((int64_t)0, info.nTime - nTimePenalty);
            
            // 添加到 new 桶
            int nId = nIdCount++;
            mapInfo[nId] = info;
            mapAddr[addr] = nId;
            
            // 添加到多个 new 桶增加选择概率
            int nUBucket = info.GetNewBucket(nKey);
            int nUBucketPos = info.GetBucketPosition(nKey, true, nUBucket);
            vvNew[nUBucket][nUBucketPos] = nId;
        }
        
        return true;
    }
};
```

---

## 3. P2P 消息协议

### 3.1 消息头结构

```cpp
class CMessageHeader {
public:
    enum {
        MESSAGE_START_SIZE = 4,      // 魔数大小
        COMMAND_SIZE = 12,           // 命令名大小
        MESSAGE_SIZE_SIZE = 4,       // 消息体大小
        CHECKSUM_SIZE = 4,           // 校验和大小
        HEADER_SIZE = 24             // 头总大小
    };
    
    MessageMagic pchMessageStart;    // 魔数 (网络标识)
    char pchCommand[COMMAND_SIZE];   // 命令名
    uint32_t nPayloadLength;         // 消息体长度
    uint8_t pchChecksum[CHECKSUM_SIZE];  // 校验和 (双SHA256前4字节)
    
    // 序列化
    template <typename Stream, typename Operation>
    inline void SerializationOp(Stream &s, Operation ser_action) {
        READWRITE(FLATDATA(pchMessageStart));
        READWRITE(FLATDATA(pchCommand));
        READWRITE(nPayloadLength);
        READWRITE(FLATDATA(pchChecksum));
    }
};

// TBC 网络魔数
// diskMagic[0] = 0xf9; diskMagic[1] = 0xbe; diskMagic[2] = 0xb4; diskMagic[3] = 0xd9;
// netMagic[0] = 0xe3;  netMagic[1] = 0xe1;  netMagic[2] = 0xf3;  netMagic[3] = 0xe8;
```

### 3.2 核心消息类型

```cpp
namespace NetMsgType {
    const char *VERSION = "version";           // 版本协商
    const char *VERACK = "verack";             // 版本确认
    const char *ADDR = "addr";                 // 地址广播
    const char *INV = "inv";                   // 库存通知
    const char *GETDATA = "getdata";           // 数据请求
    const char *GETBLOCKS = "getblocks";       // 区块请求
    const char *GETHEADERS = "getheaders";     // 头请求
    const char *TX = "tx";                     // 交易
    const char *BLOCK = "block";               // 区块
    const char *HEADERS = "headers";           // 区块头
    const char *GETADDR = "getaddr";           // 地址请求
    const char *MEMPOOL = "mempool";           // 内存池请求
    const char *PING = "ping";                 // 心跳
    const char *PONG = "pong";                 // 心跳响应
    const char *NOTFOUND = "notfound";         // 未找到
    const char *REJECT = "reject";             // 拒绝
    const char *SENDHEADERS = "sendheaders";   // 发送头偏好
    const char *FEEFILTER = "feefilter";       // 费率过滤
    const char *SENDCMPCT = "sendcmpct";       // 紧凑区块偏好
    const char *CMPCTBLOCK = "cmpctblock";     // 紧凑区块
    const char *GETBLOCKTXN = "getblocktxn";   // 区块交易请求
    const char *BLOCKTXN = "blocktxn";         // 区块交易
    const char *PROTOCONF = "protoconf";       // 协议配置 (TBC)
};
```

### 3.3 版本消息

```cpp
// 版本消息 (握手第一步)
void PushNodeVersion(const CNodePtr& pnode, CConnman &connman, int64_t nTime) {
    ServiceFlags nLocalNodeServices = pnode->GetLocalServices();
    uint64_t nonce = pnode->GetLocalNonce();
    int nNodeStartingHeight = pnode->GetMyStartingHeight();
    
    CAddress addrYou = (addr.IsRoutable() && !IsProxy(addr)
                            ? addr
                            : CAddress(CService(), addr.nServices));
    CAddress addrMe = CAddress(CService(), nLocalNodeServices);
    
    connman.PushMessage(pnode,
        CNetMsgMaker(INIT_PROTO_VERSION).Make(
            NetMsgType::VERSION,
            PROTOCOL_VERSION,           // 协议版本
            (uint64_t)nLocalNodeServices,  // 服务标志
            nTime,                      // 时间戳
            addrYou,                    // 对方地址
            addrMe,                     // 本地地址
            nonce,                      // 随机数
            userAgent(),                // 用户代理
            nNodeStartingHeight,        // 起始高度
            ::fRelayTxes                // 是否中继交易
        ));
}

// 协议配置消息 (TBC 特有)
void PushProtoconf(const CNodePtr& pnode, CConnman &connman) {
    connman.PushMessage(
        pnode, CNetMsgMaker(INIT_PROTO_VERSION).Make(
            NetMsgType::PROTOCONF, 
            CProtoconf(MAX_PROTOCOL_RECV_PAYLOAD_LENGTH)  // 最大接收负载
        ));
}
```

### 3.4 库存消息 (INV)

```cpp
// 库存向量
class CInv {
public:
    int type;       // 类型
    uint256 hash;   // 哈希
    
    enum GetDataMode {
        MSG_TX = 1,              // 交易
        MSG_BLOCK = 2,           // 区块
        MSG_FILTERED_BLOCK = 3,  // 过滤区块 (Merkle)
        MSG_CMPCT_BLOCK = 4,     // 紧凑区块
    };
};

// 广播交易
void RelayTransaction(const CTransaction& tx) {
    CInv inv(MSG_TX, tx.GetId());
    
    // 通知所有对等节点
    for (const CNodePtr& pnode : vNodes) {
        pnode->PushInventory(inv);
    }
}

// 处理 INV 消息
bool ProcessMessageInv(CNode* pfrom, CNetMessage& msg) {
    std::vector<CInv> vInv;
    msg.vRecv >> vInv;
    
    for (const CInv& inv : vInv) {
        if (inv.type == MSG_TX) {
            // 如果交易不在内存池，请求它
            if (!AlreadyHave(inv)) {
                pfrom->AskFor(inv);
            }
        } else if (inv.type == MSG_BLOCK) {
            // 处理区块通知
            UpdateBlockAvailability(pfrom->GetId(), inv.hash);
        }
    }
}
```

---

## 4. 连接管理

### 4.1 连接建立

```cpp
bool CConnman::ConnectNode(const CAddress& addrConnect) {
    // 检查是否已连接
    if (FindNode((CNetAddr)addrConnect))
        return false;
    
    // 创建套接字
    SOCKET hSocket = CreateSocket(addrConnect);
    if (hSocket == INVALID_SOCKET)
        return false;
    
    // 设置非阻塞模式
    SetSocketNonBlocking(hSocket, true);
    
    // 连接
    int ret = connect(hSocket, addrConnect);
    if (ret == SOCKET_ERROR && WSAGetLastError() != WSAEWOULDBLOCK) {
        CloseSocket(hSocket);
        return false;
    }
    
    // 创建节点对象
    CNodePtr pnode = std::make_shared<CNode>(
        hSocket, addrConnect, "", false
    );
    
    // 添加到节点列表
    {
        LOCK(cs_vNodes);
        vNodes.push_back(pnode);
    }
    
    return true;
}
```

### 4.2 连接类型

```cpp
// 连接限制
static const int MAX_OUTBOUND_CONNECTIONS = 8;    // 最大出站连接
static const int MAX_ADDNODE_CONNECTIONS = 8;     // 最大手动添加连接
static const unsigned int DEFAULT_MAX_PEER_CONNECTIONS = 125;  // 默认最大连接

// 连接线程
void CConnman::ThreadOpenConnections() {
    while (!interruptNet) {
        // 等待一段时间
        interruptNet.sleep_for(std::chrono::milliseconds(500));
        
        // 检查是否需要更多连接
        if (GetConnectedNodeCount() >= nMaxConnections)
            continue;
        
        // 优先连接种子节点
        if (addrman.size() == 0 && !GetName().empty()) {
            // 使用 DNS 种子
            std::vector<CAddress> vAdd;
            for (const CDNSSeedData &seed : vSeeds) {
                if (HaveNameProxy()) {
                    AddOneShot(seed.host);
                } else {
                    std::vector<CNetAddr> vIPs;
                    LookupHost(seed.host.c_str(), vIPs, 0, true);
                    for (CNetAddr &ip : vIPs) {
                        vAdd.push_back(CAddress(CService(ip, GetDefaultPort()), NODE_NETWORK));
                    }
                }
            }
            addrman.Add(vAdd, CNetAddr());
        }
        
        // 选择地址连接
        CAddress addrConnect;
        int nTries = 0;
        while (!interruptNet) {
            CAddrInfo addr = addrman.Select_(fFeeler);
            
            // 检查地址是否可用
            if (!addr.IsValid() || IsLocal(addr))
                continue;
            
            // 检查是否已连接
            if (FindNode((CNetAddr)addr))
                continue;
            
            addrConnect = addr;
            break;
        }
        
        // 建立连接
        if (addrConnect.IsValid()) {
            ConnectNode(addrConnect);
        }
    }
}
```

---

## 5. 消息处理流程

### 5.1 消息接收

```cpp
// 套接字处理线程
void CConnman::ThreadSocketHandler() {
    while (!interruptNet) {
        // 准备 select 的 fd_set
        fd_set fdsetRecv;
        fd_set fdsetSend;
        FD_ZERO(&fdsetRecv);
        FD_ZERO(&fdsetSend);
        
        // 添加所有节点套接字
        for (const CNodePtr& pnode : vNodes) {
            if (pnode->hSocket == INVALID_SOCKET)
                continue;
            
            FD_SET(pnode->hSocket, &fdsetRecv);
            if (!pnode->vSendMsg.empty())
                FD_SET(pnode->hSocket, &fdsetSend);
        }
        
        // 等待 I/O 事件
        int nSelect = select(..., &fdsetRecv, &fdsetSend, nullptr, &timeout);
        
        // 处理接收数据
        for (const CNodePtr& pnode : vNodes) {
            if (FD_ISSET(pnode->hSocket, &fdsetRecv)) {
                // 接收数据
                char pchBuf[0x10000];
                int nBytes = recv(pnode->hSocket, pchBuf, sizeof(pchBuf), 0);
                
                if (nBytes > 0) {
                    pnode->nRecvBytes += nBytes;
                    pnode->vRecvMsg.write(pchBuf, nBytes);
                } else if (nBytes == 0) {
                    // 连接关闭
                    pnode->CloseSocketDisconnect();
                }
            }
        }
    }
}
```

### 5.2 消息分发

```cpp
// 消息处理线程
void CConnman::ThreadMessageHandler() {
    while (!interruptNet) {
        std::vector<CNodePtr> vNodesCopy;
        {
            LOCK(cs_vNodes);
            vNodesCopy = vNodes;
        }
        
        for (const CNodePtr& pnode : vNodesCopy) {
            // 处理接收消息
            ProcessMessages(pnode.get());
            
            // 发送待发送消息
            SendMessages(pnode.get());
        }
        
        interruptNet.sleep_for(std::chrono::milliseconds(100));
    }
}

// 处理接收的消息
bool ProcessMessages(CNode* pfrom) {
    // 获取完整消息
    CNetMessage msg;
    if (!pfrom->vRecvMsg.GetMessage(msg))
        return false;
    
    // 验证消息头
    if (!msg.hdr.IsValid(config))
        return false;
    
    // 验证校验和
    uint256 hash = Hash(msg.vRecv.begin(), msg.vRecv.end());
    if (memcmp(hash.begin(), msg.hdr.pchChecksum, CMessageHeader::CHECKSUM_SIZE) != 0)
        return false;
    
    // 获取命令名
    std::string strCommand = msg.hdr.GetCommand();
    
    // 分发到处理器
    bool fRet = false;
    if (strCommand == NetMsgType::VERSION)
        fRet = ProcessMessageVersion(pfrom, msg);
    else if (strCommand == NetMsgType::VERACK)
        fRet = ProcessMessageVerack(pfrom, msg);
    else if (strCommand == NetMsgType::ADDR)
        fRet = ProcessMessageAddr(pfrom, msg);
    else if (strCommand == NetMsgType::INV)
        fRet = ProcessMessageInv(pfrom, msg);
    else if (strCommand == NetMsgType::GETDATA)
        fRet = ProcessMessageGetData(pfrom, msg);
    else if (strCommand == NetMsgType::TX)
        fRet = ProcessMessageTx(pfrom, msg);
    else if (strCommand == NetMsgType::BLOCK)
        fRet = ProcessMessageBlock(pfrom, msg);
    // ... 其他消息类型
    
    return fRet;
}
```

---

## 6. DoS 防护

### 6.1 惩罚机制

```cpp
// 节点状态
struct CNodeState {
    int nMisbehavior = 0;        // 不当行为分数
    bool fShouldBan = false;     // 是否应该禁止
    
    // 增加惩罚分数
    bool Misbehaving(int howmuch) {
        if (howmuch == 0)
            return true;
        
        nMisbehavior += howmuch;
        
        // 超过阈值则禁止
        if (nMisbehavior >= GetBanScoreThreshold()) {
            fShouldBan = true;
        }
        
        return true;
    }
};

// 处理无效区块
bool ProcessMessageBlock(CNode* pfrom, CNetMessage& msg) {
    CBlock block;
    msg.vRecv >> block;
    
    CValidationState state;
    if (!ProcessNewBlock(block, state, pfrom)) {
        int nDoS = state.GetNDoS();
        if (nDoS > 0) {
            // 惩罚发送无效区块的节点
            LOCK(cs_main);
            Misbehaving(pfrom->GetId(), nDoS);
        }
        return false;
    }
    
    return true;
}
```

### 6.2 Ban 管理

```cpp
// Ban 列表
class CBanDB {
    std::map<CSubNet, int64_t> banMap;  // 子网 -> 解除时间
    
public:
    // 禁止节点
    bool Ban(const CNetAddr& addr, int64_t banTimeOffset = 0) {
        CSubNet subNet(addr);
        banMap[subNet] = GetTime() + banTimeOffset;
        return true;
    }
    
    // 检查是否被禁止
    bool IsBanned(const CNetAddr& addr) {
        for (const auto& entry : banMap) {
            if (entry.first.Match(addr)) {
                if (GetTime() < entry.second)
                    return true;
            }
        }
        return false;
    }
};

// 断开并禁止
void BanNode(NodeId nodeId, int banReason) {
    CNodePtr pnode = FindNode(nodeId);
    if (pnode) {
        // 添加到禁止列表
        banman.Ban(pnode->addr);
        
        // 断开连接
        pnode->CloseSocketDisconnect();
    }
}
```

---

## 7. 带宽优化

### 7.1 紧凑区块 (Compact Blocks)

```cpp
// 紧凑区块编码
class CompactBlock {
    CBlockHeader header;                    // 区块头
    uint64_t nonce;                         // 随机数
    std::vector<uint64_t> shortids;        // 短交易ID
    std::vector<CTransactionRef> prefilled; // 预填充交易
    
    // 计算短ID
    uint64_t GetShortID(const uint256& txhash) const {
        uint64_t hash1 = SipHashUint256(nonce, txhash);
        return hash1 & 0xffff;  // 取低16位
    }
};

// 发送紧凑区块
void SendCompactBlock(CNode* pto, const CBlock& block) {
    // 创建紧凑区块
    CompactBlock cmpctblock(block);
    
    // 发送
    pto->PushMessage(NetMsgType::CMPCTBLOCK, cmpctblock);
}

// 处理紧凑区块
bool ProcessCompactBlock(CNode* pfrom, CompactBlock& cmpctblock) {
    // 重建交易列表
    std::vector<CTransactionRef> vtx;
    
    for (uint64_t shortid : cmpctblock.shortids) {
        // 从内存池查找匹配的交易
        CTransactionRef ptx = FindTxByShortId(shortid);
        if (ptx) {
            vtx.push_back(ptx);
        } else {
            // 缺失交易，请求补充
            RequestMissingTx(pfrom, cmpctblock, missingIndices);
            return false;
        }
    }
    
    // 重建完整区块
    CBlock block;
    block.header = cmpctblock.header;
    block.vtx = vtx;
    
    // 处理区块
    return ProcessNewBlock(block, ...);
}
```

### 7.2 费率过滤

```cpp
// 费率过滤器
class CFeeFilter {
    Amount feeFilter;  // 最小费率
    
public:
    // 设置费率过滤器
    void SetFeeFilter(Amount newFeeFilter) {
        feeFilter = newFeeFilter;
    }
    
    // 检查交易是否满足费率要求
    bool IsWorthRelaying(const CTransaction& tx, const CFeeRate& feerate) {
        return feerate.GetFeePerK() >= feeFilter;
    }
};

// 发送费率过滤器
void PushFeeFilter(CNode* pto, Amount feerate) {
    pto->PushMessage(NetMsgType::FEEFILTER, feerate);
}
```

---

## 下一步

阶段四完成。接下来进入**阶段五：存储与数据库**，将学习：
1. LevelDB 封装和区块存储
2. 区块文件格式 (blk*.dat)
3. Undo 数据和回滚
4. 索引系统 (txindex)
