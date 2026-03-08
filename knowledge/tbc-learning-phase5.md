# TBC 节点代码学习 - 阶段五：存储与数据库

## 1. LevelDB 封装

### 1.1 CDBWrapper - LevelDB 包装器

```cpp
class CDBWrapper {
private:
    leveldb::Env *penv;              // 自定义环境
    leveldb::Options options;        // 数据库选项
    leveldb::ReadOptions readoptions;    // 读选项
    leveldb::WriteOptions writeoptions;  // 写选项
    leveldb::WriteOptions syncoptions;   // 同步写选项
    leveldb::DB *pdb;                // LevelDB 实例
    std::vector<uint8_t> obfuscate_key;  // 混淆密钥

public:
    // 构造函数
    CDBWrapper(const fs::path& path, size_t nCacheSize, 
               bool fMemory = false, bool fWipe = false, 
               bool obfuscate = false);
    
    // 基本操作
    template <typename K, typename V>
    bool Read(const K& key, V& value) const {
        CDataStream ssKey(SER_DISK, CLIENT_VERSION);
        ssKey.reserve(DBWRAPPER_PREALLOC_KEY_SIZE);
        ssKey << key;
        leveldb::Slice slKey(ssKey.data(), ssKey.size());
        
        std::string strValue;
        leveldb::Status status = pdb->Get(readoptions, slKey, &strValue);
        if (!status.ok()) {
            if (status.IsNotFound()) return false;
            dbwrapper_private::HandleError(status);
        }
        
        // 解混淆并反序列化
        CDataStream ssValue(strValue.data(), strValue.data() + strValue.size(),
                           SER_DISK, CLIENT_VERSION);
        ssValue.Xor(obfuscate_key);
        ssValue >> value;
        return true;
    }
    
    template <typename K, typename V>
    bool Write(const K& key, const V& value, bool fSync = false) {
        CDBBatch batch(*this);
        batch.Write(key, value);
        return WriteBatch(batch, fSync);
    }
    
    template <typename K>
    bool Exists(const K& key) const {
        CDataStream ssKey(SER_DISK, CLIENT_VERSION);
        ssKey.reserve(DBWRAPPER_PREALLOC_KEY_SIZE);
        ssKey << key;
        leveldb::Slice slKey(ssKey.data(), ssKey.size());
        
        std::string strValue;
        leveldb::Status status = pdb->Get(readoptions, slKey, &strValue);
        if (!status.ok()) {
            if (status.IsNotFound()) return false;
            dbwrapper_private::HandleError(status);
        }
        return true;
    }
    
    // 迭代器
    CDBIterator *NewIterator() {
        return new CDBIterator(*this, pdb->NewIterator(iteroptions));
    }
};
```

### 1.2 CDBBatch - 批量写入

```cpp
class CDBBatch {
private:
    const CDBWrapper &parent;
    leveldb::WriteBatch batch;   // LevelDB 批量写入对象
    CDataStream ssKey;           // 序列化密钥流
    CDataStream ssValue;         // 序列化值流
    size_t size_estimate;        // 大小估算

public:
    CDBBatch(const CDBWrapper &_parent)
        : parent(_parent),
          ssKey(SER_DISK, CLIENT_VERSION),
          ssValue(SER_DISK, CLIENT_VERSION),
          size_estimate(0) {}

    template <typename K, typename V>
    void Write(const K &key, const V &value) {
        ssKey.reserve(DBWRAPPER_PREALLOC_KEY_SIZE);
        ssKey << key;
        leveldb::Slice slKey(ssKey.data(), ssKey.size());

        ssValue.reserve(DBWRAPPER_PREALLOC_VALUE_SIZE);
        ssValue << value;
        ssValue.Xor(dbwrapper_private::GetObfuscateKey(parent));
        leveldb::Slice slValue(ssValue.data(), ssValue.size());

        batch.Put(slKey, slValue);
        
        // 估算大小：header + varint(key_len) + key + varint(value_len) + value
        size_estimate += 3 + (slKey.size() > 127) + slKey.size() +
                        (slValue.size() > 127) + slValue.size();
        ssKey.clear();
        ssValue.clear();
    }

    template <typename K>
    void Erase(const K &key) {
        ssKey.reserve(DBWRAPPER_PREALLOC_KEY_SIZE);
        ssKey << key;
        leveldb::Slice slKey(ssKey.data(), ssKey.size());

        batch.Delete(slKey);
        size_estimate += 2 + (slKey.size() > 127) + slKey.size();
        ssKey.clear();
    }

    size_t SizeEstimate() const { return size_estimate; }
    void Clear() { batch.Clear(); size_estimate = 0; }
};
```

### 1.3 数据混淆

```cpp
// 可选的 XOR 混淆，防止外部工具轻易读取数据库
const std::vector<uint8_t> &GetObfuscateKey(const CDBWrapper &w) {
    return w.obfuscate_key;
}

// XOR 操作
void CDataStream::Xor(const std::vector<uint8_t> &key) {
    if (key.empty()) return;
    for (size_type i = 0; i != size(); i++)
        *(begin() + i) ^= key[i % key.size()];
}
```

---

## 2. UTXO 数据库存储

### 2.1 CCoinsViewDB

```cpp
// UTXO 数据库 (chainstate/)
class CCoinsViewDB : public CCoinsView {
protected:
    CDBWrapper db;  // LevelDB 实例

public:
    CCoinsViewDB(size_t nCacheSize, bool fMemory = false, bool fWipe = false)
        : db(GetDataDir() / "chainstate", nCacheSize, fMemory, fWipe, true) {}

    // 获取 Coin
    bool GetCoin(const COutPoint &outpoint, Coin &coin) const override {
        return db.Read(CoinEntry(&outpoint), coin);
    }

    // 检查是否存在
    bool HaveCoin(const COutPoint &outpoint) const override {
        return db.Exists(CoinEntry(&outpoint));
    }

    // 获取最佳区块
    uint256 GetBestBlock() const override {
        uint256 hashBestChain;
        if (!db.Read(DB_BEST_BLOCK, hashBestChain)) return uint256();
        return hashBestChain;
    }

    // 批量写入
    bool BatchWrite(CCoinsMap &mapCoins, const uint256 &hashBlock) override {
        CDBBatch batch(db);
        size_t count = 0;
        size_t changed = 0;
        size_t batch_size = nDefaultDbBatchSize;  // 默认 16MB

        // 写入头标记（原子性保护）
        uint256 old_tip = GetBestBlock();
        batch.Erase(DB_BEST_BLOCK);
        batch.Write(DB_HEAD_BLOCKS, std::vector<uint256>{hashBlock, old_tip});

        // 批量写入 UTXO
        for (CCoinsMap::iterator it = mapCoins.begin(); it != mapCoins.end();) {
            if (it->second.flags & CCoinsCacheEntry::DIRTY) {
                CoinEntry entry(&it->first);
                if (it->second.coin.IsSpent()) {
                    batch.Erase(entry);  // 删除已花费
                } else {
                    batch.Write(entry, it->second.coin);  // 写入新 UTXO
                }
                changed++;
            }
            count++;
            
            CCoinsMap::iterator itOld = it++;
            mapCoins.erase(itOld);
            
            // 分批写入，避免单批次过大
            if (batch.SizeEstimate() > batch_size) {
                db.WriteBatch(batch);
                batch.Clear();
            }
        }

        // 写入尾标记
        batch.Erase(DB_HEAD_BLOCKS);
        batch.Write(DB_BEST_BLOCK, hashBlock);

        return db.WriteBatch(batch);
    }

    // 创建迭代器
    CCoinsViewCursor *Cursor() const override {
        CCoinsViewDBCursor *i = new CCoinsViewDBCursor(
            const_cast<CDBWrapper &>(db).NewIterator(), GetBestBlock());
        i->pcursor->Seek(DB_COIN);
        return i;
    }
};

// Coin 条目键
struct CoinEntry {
    COutPoint *outpoint;
    char key;
    
    CoinEntry(const COutPoint *ptr)
        : outpoint(const_cast<COutPoint *>(ptr)), key(DB_COIN) {}

    template <typename Stream>
    void Serialize(Stream &s) const {
        s << key;
        s << outpoint->GetTxId();
        s << VARINT(outpoint->GetN());
    }
};
```

### 2.2 数据库键前缀

```cpp
// chainstate 数据库键前缀
static const char DB_COIN = 'C';           // UTXO 条目
static const char DB_COINS = 'c';          // 旧版 UTXO (已弃用)
static const char DB_BLOCK_FILES = 'f';    // 区块文件信息
static const char DB_TXINDEX = 't';        // 交易索引
static const char char DB_BLOCK_INDEX = 'b';  // 区块索引

static const char DB_BEST_BLOCK = 'B';     // 最佳区块哈希
static const char DB_HEAD_BLOCKS = 'H';    // 头区块（用于原子写入）
static const char DB_FLAG = 'F';           // 标志
static const char DB_REINDEX_FLAG = 'R';   // 重建索引标志
static const char DB_LAST_BLOCK = 'l';     // 最后区块文件号
```

---

## 3. 区块文件存储

### 3.1 区块文件格式

```
blocks/
├── index/          # LevelDB: 区块索引
│   └── ...
├── blk00000.dat    # 区块数据文件
├── blk00001.dat
├── ...
├── rev00000.dat    # Undo 数据文件
├── rev00001.dat
└── ...
```

### 3.2 区块文件信息

```cpp
// 区块文件信息
class CBlockFileInfo {
public:
    unsigned int nBlocks;       // 文件中区块数
    unsigned int nHeightFirst;  // 第一个区块高度
    unsigned int nHeightLast;   // 最后一个区块高度
    uint64_t nTimeFirst;        // 最早时间戳
    uint64_t nTimeLast;         // 最晚时间戳
    uint64_t nSize;             // 文件大小
    uint64_t nUndoSize;         // Undo 文件大小

    ADD_SERIALIZE_METHODS;

    template <typename Stream, typename Operation>
    inline void SerializationOp(Stream &s, Operation ser_action) {
        // 支持 64 位大小的序列化
        unsigned int nSizeLegacy;
        unsigned int nUndoSizeLegacy;
        if (nSize >= std::numeric_limits<uint32_t>::max())
            nSizeLegacy = std::numeric_limits<uint32_t>::max();
        else
            nSizeLegacy = static_cast<uint32_t>(nSize);
        
        READWRITE(VARINT(nBlocks));
        READWRITE(VARINT(nSizeLegacy));
        READWRITE(VARINT(nUndoSizeLegacy));
        // ... 其他字段
        
        // 如果大小超过 32 位，单独写入 64 位值
        if (nSizeLegacy == std::numeric_limits<uint32_t>::max())
            READWRITE(VARINT(nSize));
        else
            nSize = nSizeLegacy;
    }
};

// 磁盘位置
struct CDiskBlockPos {
    int nFile;              // 文件号
    unsigned int nPos;      // 文件内位置

    ADD_SERIALIZE_METHODS;

    template <typename Stream, typename Operation>
    inline void SerializationOp(Stream &s, Operation ser_action) {
        READWRITE(VARINT(nFile));
        READWRITE(VARINT(nPos));
    }
};
```

### 3.3 写入区块

```cpp
bool WriteBlockToDisk(const CBlock &block, CDiskBlockPos &pos, 
                      const CMessageHeader::MessageMagic& messageStart) {
    // 打开区块文件
    FILE *file = OpenBlockFile(pos);
    if (!file) return false;

    // 写入文件头（魔数 + 大小）
    unsigned int nSize = GetSerializeSize(block, SER_DISK, CLIENT_VERSION);
    
    // 写入魔数
    fwrite(messageStart.data(), 1, CMessageHeader::MESSAGE_START_SIZE, file);
    // 写入大小
    fwrite(&nSize, 1, sizeof(nSize), file);
    // 写入区块
    fileout << block;

    // 刷新到磁盘
    fflush(file);
    if (!IsInitialBlockDownload())
        FileCommit(file);

    return true;
}

bool ReadBlockFromDisk(CBlock &block, const CDiskBlockPos &pos, 
                       const CMessageHeader::MessageMagic& messageStart) {
    block.SetNull();

    // 打开文件
    FILE *file = OpenBlockFile(pos, true);
    if (!file) return false;

    // 读取文件头
    char pchMessageStart[CMessageHeader::MESSAGE_START_SIZE];
    if (fread(pchMessageStart, 1, sizeof(pchMessageStart), file) != sizeof(pchMessageStart)) {
        return error("%s: failed to read message start", __func__);
    }
    if (memcmp(pchMessageStart, messageStart.data(), CMessageHeader::MESSAGE_START_SIZE) != 0) {
        return error("%s: invalid message start", __func__);
    }

    // 读取大小
    unsigned int nSize;
    if (fread(&nSize, 1, sizeof(nSize), file) != sizeof(nSize)) {
        return error("%s: failed to read size", __func__);
    }

    // 读取区块
    file >> block;

    return true;
}
```

---

## 4. Undo 数据

### 4.1 Undo 数据结构

```cpp
// 单个输入的 Undo 信息
class TxInUndoSerializer {
    const Coin *pcoin;

public:
    TxInUndoSerializer(const Coin *pcoinIn) : pcoin(pcoinIn) {}

    template <typename Stream>
    void Serialize(Stream &s) const {
        // 编码：高度 * 2 + (是否Coinbase ? 1 : 0)
        ::Serialize(s, VARINT(pcoin->GetHeight() * 2 + (pcoin->IsCoinBase() ? 1 : 0)));
        if (pcoin->GetHeight() > 0) {
            // 兼容性：旧版本在此处存储交易版本号
            ::Serialize(s, uint8_t(0));
        }
        // 序列化输出（压缩格式）
        ::Serialize(s, CTxOutCompressor(REF(pcoin->GetTxOut())));
    }
};

class TxInUndoDeserializer {
    Coin *pcoin;

public:
    TxInUndoDeserializer(Coin *pcoinIn) : pcoin(pcoinIn) {}

    template <typename Stream>
    void Unserialize(Stream &s) {
        uint32_t nCode = 0;
        ::Unserialize(s, VARINT(nCode));
        uint32_t nHeight = nCode / 2;
        bool fCoinBase = nCode & 1;
        
        if (nHeight > 0) {
            // 跳过旧版本的交易版本号
            int nVersionDummy;
            ::Unserialize(s, VARINT(nVersionDummy));
        }

        CTxOut txout;
        ::Unserialize(s, REF(CTxOutCompressor(REF(txout))));

        *pcoin = Coin(std::move(txout), nHeight, fCoinBase);
    }
};

// 单个交易的 Undo
class CTxUndo {
public:
    std::vector<Coin> vprevout;  // 所有输入的 Undo 信息

    template <typename Stream> void Serialize(Stream &s) const {
        uint64_t count = vprevout.size();
        ::Serialize(s, COMPACTSIZE(REF(count)));
        for (const auto &prevout : vprevout) {
            ::Serialize(s, REF(TxInUndoSerializer(&prevout)));
        }
    }

    template <typename Stream> void Unserialize(Stream &s) {
        uint64_t count = 0;
        ::Unserialize(s, COMPACTSIZE(count));
        if (count > MAX_INPUTS_PER_TX) {
            throw std::ios_base::failure("Too many input undo records");
        }
        vprevout.resize(count);
        for (auto &prevout : vprevout) {
            ::Unserialize(s, REF(TxInUndoDeserializer(&prevout)));
        }
    }
};

// 整个区块的 Undo
class CBlockUndo {
public:
    std::vector<CTxUndo> vtxundo;  // 除 Coinbase 外的所有交易

    ADD_SERIALIZE_METHODS;

    template <typename Stream, typename Operation>
    inline void SerializationOp(Stream &s, Operation ser_action) {
        READWRITE(vtxundo);
    }
};
```

### 4.2 Undo 数据写入

```cpp
bool UndoWriteToDisk(const CBlockUndo &blockundo, const CDiskBlockPos &pos,
                     const uint256 &hashBlock) {
    // 打开 Undo 文件
    FILE *file = OpenUndoFile(pos);
    if (!file) return false;

    // 计算哈希
    uint256 hashWriter;
    CHashWriter hasher(SER_GETHASH, PROTOCOL_VERSION);
    hasher <> blockundo;
    hashWriter = hasher.GetHash();

    // 写入：魔数 + 大小 + 数据 + 哈希
    unsigned int nSize = GetSerializeSize(blockundo, SER_DISK, CLIENT_VERSION);
    fwrite(messageStart.data(), 1, CMessageHeader::MESSAGE_START_SIZE, file);
    fwrite(&nSize, 1, sizeof(nSize), file);
    file << blockundo;
    fwrite(hashWriter.begin(), 1, sizeof(hashWriter), file);

    return true;
}
```

### 4.3 区块回滚

```cpp
DisconnectResult ApplyBlockUndo(const CBlockUndo &blockUndo,
                                const CBlock &block, 
                                const CBlockIndex *pindex,
                                CCoinsViewCache &coins) {
    bool fClean = true;

    // 反向遍历交易（除了 Coinbase）
    for (int i = block.vtx.size() - 1; i >= 1; i--) {
        const CTransaction &tx = *(block.vtx[i]);
        const CTxUndo &txundo = blockUndo.vtxundo[i - 1];

        if (txundo.vprevout.size() != tx.vin.size()) {
            return DISCONNECT_FAILED;  // 数据不一致
        }

        // 恢复输入（将 UTXO 标记为未花费）
        for (unsigned int j = tx.vin.size(); j-- > 0;) {
            const COutPoint &out = tx.vin[j].prevout;
            const Coin &undo = txundo.vprevout[j];
            
            DisconnectResult res = UndoCoinSpend(undo, coins, out, config);
            if (res == DISCONNECT_FAILED) return DISCONNECT_FAILED;
            if (res == DISCONNECT_UNCLEAN) fClean = false;
        }

        // 删除输出（从 UTXO 集移除）
        for (unsigned int j = 0; j < tx.vout.size(); j++) {
            COutPoint out(tx.GetId(), j);
            coins.SpendCoin(out);  // 实际上是删除
        }
    }

    // 处理 Coinbase（恢复其输出到 UTXO 集）
    const CTransaction &tx = *(block.vtx[0]);
    for (unsigned int j = 0; j < tx.vout.size(); j++) {
        COutPoint out(tx.GetId(), j);
        coins.SpendCoin(out);
    }

    return fClean ? DISCONNECT_OK : DISCONNECT_UNCLEAN;
}

DisconnectResult UndoCoinSpend(const Coin &undo, CCoinsViewCache &view,
                               const COutPoint &out, const Config &config) {
    // 检查该输出是否已存在
    bool clean = true;
    if (view.HaveCoin(out)) {
        // 不应该存在，标记为不干净
        clean = false;
    }

    // 恢复 UTXO
    view.AddCoin(out, undo, true);
    return clean ? DISCONNECT_OK : DISCONNECT_UNCLEAN;
}
```

---

## 5. 交易索引

### 5.1 交易索引数据库

```cpp
// 交易磁盘位置
struct CDiskTxPos : public CDiskBlockPos {
    uint64_t nTxOffset;  // 区块内交易偏移

    ADD_SERIALIZE_METHODS;

    template <typename Stream, typename Operation>
    inline void SerializationOp(Stream &s, Operation ser_action) {
        READWRITE(*(CDiskBlockPos *)this);
        
        // 支持 64 位偏移
        unsigned int offset = (nTxOffset >= std::numeric_limits<unsigned int>::max())
            ? std::numeric_limits<unsigned int>::max()
            : static_cast<unsigned int>(nTxOffset);
        READWRITE(VARINT(offset));

        if (offset == std::numeric_limits<unsigned int>::max())
            READWRITE(VARINT(nTxOffset));
        else
            nTxOffset = offset;
    }
};

// 区块树数据库（包含交易索引）
class CBlockTreeDB : public CDBWrapper {
public:
    // 读取交易索引
    bool ReadTxIndex(const uint256 &txid, CDiskTxPos &pos) {
        return Read(std::make_pair(DB_TXINDEX, txid), pos);
    }

    // 写入交易索引
    bool WriteTxIndex(const std::vector<std::pair<uint256, CDiskTxPos>> &list) {
        CDBBatch batch(*this);
        for (const auto &item : list) {
            batch.Write(std::make_pair(DB_TXINDEX, item.first), item.second);
        }
        return WriteBatch(batch);
    }
};
```

### 5.2 构建交易索引

```cpp
bool ConnectBlock(const CBlock &block, ...) {
    // ...
    
    std::vector<std::pair<uint256, CDiskTxPos>> vPos;
    vPos.reserve(block.vtx.size());
    
    for (const auto &ptx : block.vtx) {
        const CTransaction &tx = *ptx;
        
        // 记录交易位置
        CDiskTxPos pos(pindex->GetBlockPos(), 
                       GetSerializeSize(block, SER_DISK, CLIENT_VERSION));
        vPos.push_back(std::make_pair(tx.GetId(), pos));
        
        // ... 其他处理
    }
    
    // 写入交易索引（如果启用）
    if (fTxIndex)
        pblocktree->WriteTxIndex(vPos);
    
    // ...
}
```

---

## 6. 数据库配置

### 6.1 缓存大小配置

```cpp
// 默认配置
static const int64_t nDefaultDbCache = 450;           // 默认 450MB
static const int64_t nMaxDbCache = 16384;             // 最大 16GB (64位)
static const int64_t nMinDbCache = 4;                 // 最小 4MB
static const int64_t nDefaultDbBatchSize = 16 << 20;  // 默认 16MB

// UTXO 数据库专用缓存
static const int64_t nMaxCoinsDBCache = 8;            // 最大 8MB

// 区块树数据库缓存
static const int64_t nMaxBlockDBCache = 2;            // 无 txindex 时
static const int64_t nMaxBlockDBAndTxIndexCache = 1024;  // 有 txindex 时

// 计算缓存分配
void InitCacheSizes(Config &config) {
    int64_t nTotalCache = config.GetDbCache();
    
    // 分配给 UTXO 数据库
    int64_t nCoinDBCache = std::min(nTotalCache / 2, nMaxCoinsDBCache);
    nTotalCache -= nCoinDBCache;
    
    // 分配给区块树数据库
    int64_t nBlockTreeDBCache = std::min(nTotalCache, 
        fTxIndex ? nMaxBlockDBAndTxIndexCache : nMaxBlockDBCache);
    nTotalCache -= nBlockTreeDBCache;
    
    // 剩余分配给 UTXO 缓存
    int64_t nCoinCacheUsage = nTotalCache;
    
    // 设置配置
    config.SetCoinDBCache(nCoinDBCache);
    config.SetBlockTreeDBCache(nBlockTreeDBCache);
    config.SetCoinCacheUsage(nCoinCacheUsage);
}
```

---

## 下一步

阶段五完成。接下来进入**阶段六：挖矿与内存池**，将学习：
1. 挖矿接口 (getblocktemplate)
2. 交易选择和区块组装
3. 费率估算
4. RBF/CPFP 机制
