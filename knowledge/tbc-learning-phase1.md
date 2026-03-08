# TBC 节点代码学习 - 阶段一：核心数据结构与算法

## 1. 序列化系统 (serialize.h)

### 1.1 基础序列化函数

比特币使用小端序 (Little Endian) 进行网络传输和磁盘存储。

```cpp
// 写数据（转换为小端序）
template <typename Stream> inline void ser_writedata8(Stream &s, uint8_t obj);
template <typename Stream> inline void ser_writedata16(Stream &s, uint16_t obj) {
    obj = htole16(obj);  // 主机序转小端序
    s.write((char *)&obj, 2);
}
template <typename Stream> inline void ser_writedata32(Stream &s, uint32_t obj) {
    obj = htole32(obj);
    s.write((char *)&obj, 4);
}
template <typename Stream> inline void ser_writedata64(Stream &s, uint64_t obj) {
    obj = htole64(obj);
    s.write((char *)&obj, 8);
}

// 读数据（小端序转主机序）
template <typename Stream> inline uint16_t ser_readdata16(Stream &s) {
    uint16_t obj;
    s.read((char *)&obj, 2);
    return le16toh(obj);  // 小端序转主机序
}
```

### 1.2 紧凑大小格式 (Compact Size)

用于序列化变长数据的大小信息，节省空间。

```
大小范围              编码格式
< 253                1字节 (直接值)
253 - 65535          3字节 (0xFD + 2字节小端序)
65536 - 4294967295   5字节 (0xFE + 4字节小端序)
> 4294967295         9字节 (0xFF + 8字节小端序)
```

```cpp
inline uint32_t GetSizeOfCompactSize(uint64_t nSize) {
    if (nSize < 253) return sizeof(uint8_t);
    if (nSize <= std::numeric_limits<uint16_t>::max()) 
        return sizeof(uint8_t) + sizeof(uint16_t);
    if (nSize <= std::numeric_limits<uint32_t>::max()) 
        return sizeof(uint8_t) + sizeof(uint32_t);
    return sizeof(uint8_t) + sizeof(uint64_t);
}

template <typename Stream> void WriteCompactSize(Stream &os, uint64_t nSize) {
    if (nSize < 253) {
        ser_writedata8(os, nSize);
    } else if (nSize <= std::numeric_limits<uint16_t>::max()) {
        ser_writedata8(os, 253);
        ser_writedata16(os, nSize);
    } else if (nSize <= std::numeric_limits<uint32_t>::max()) {
        ser_writedata8(os, 254);
        ser_writedata32(os, nSize);
    } else {
        ser_writedata8(os, 255);
        ser_writedata64(os, nSize);
    }
}
```

### 1.3 序列化宏

```cpp
#define ADD_SERIALIZE_METHODS                                                  \
    template <typename Stream> void Serialize(Stream &s) const {               \
        NCONST_PTR(this)->SerializationOp(s, CSerActionSerialize());           \
    }                                                                          \
    template <typename Stream> void Unserialize(Stream &s) {                   \
        SerializationOp(s, CSerActionUnserialize());                           \
    }

#define READWRITE(obj) (::SerReadWrite(s, (obj), ser_action))
```

**使用示例**:
```cpp
class CTransaction {
    int32_t nVersion;
    std::vector<CTxIn> vin;
    std::vector<CTxOut> vout;
    uint32_t nLockTime;

    ADD_SERIALIZE_METHODS;

    template <typename Stream, typename Operation>
    inline void SerializationOp(Stream &s, Operation ser_action) {
        READWRITE(nVersion);
        READWRITE(vin);
        READWRITE(vout);
        READWRITE(nLockTime);
    }
};
```

### 1.4 序列化类型标志

```cpp
enum {
    SER_NETWORK = (1 << 0),   // 网络传输格式
    SER_DISK = (1 << 1),      // 磁盘存储格式
    SER_GETHASH = (1 << 2),   // 计算哈希时的格式
};
```

---

## 2. 安全内存分配器 (secure.h)

### 2.1 secure_allocator

用于存储私钥等敏感数据，防止被交换到磁盘。

```cpp
template <typename T> struct secure_allocator : public std::allocator<T> {
    T *allocate(std::size_t n, const void *hint = 0) {
        // 使用锁定内存池分配
        return static_cast<T *>(
            LockedPoolManager::Instance().alloc(sizeof(T) * n));
    }

    void deallocate(T *p, std::size_t n) {
        if (p != nullptr) {
            // 清零后释放
            memory_cleanse(p, sizeof(T) * n);
        }
        LockedPoolManager::Instance().free(p);
    }
};

// 使用示例
typedef std::vector<uint8_t, secure_allocator<uint8_t>> CPrivKey;
typedef std::basic_string<char, std::char_traits<char>, secure_allocator<char>> SecureString;
```

### 2.2 内存锁定池 (lockedpool.h)

```cpp
class LockedPool {
public:
    // 分配锁定内存（防止被交换到交换分区）
    void *alloc(size_t size);
    
    // 释放内存
    void free(void *ptr);
    
private:
    // 使用 mlock/munlock 系统调用
    // 或使用 VirtualLock/VirtualUnlock (Windows)
};

class LockedPoolManager : public LockedPool {
    // 单例模式
    static LockedPoolManager &Instance();
};
```

### 2.3 内存清零 (cleanse.h)

```cpp
// 安全清零内存（防止编译器优化掉）
void memory_cleanse(void *ptr, size_t len);

// 实现使用汇编或volatile，确保实际写入
```

---

## 3. 预分配向量 (prevector.h)

### 3.1 设计原理

`prevector<N, T>` 是 `std::vector<T>` 的替代品，对小数据使用栈分配，大数据使用堆分配。

```cpp
template <unsigned int N, typename T, typename Size = uint64_t, typename Diff = int64_t>
class prevector {
    // 小数据（<= N个元素）：直接存储在栈上
    // 大数据（> N个元素）：动态分配堆内存
    
    union {
        struct {
            Size _size;
            T direct[N];  // 栈数组
        } _direct;
        
        struct {
            Size _size;
            Size capacity;
            T *indirect;  // 堆指针
        } _indirect;
    };
};
```

### 3.2 使用场景

```cpp
// CScript 使用 prevector<28, uint8_t>
// 大多数脚本 < 28 字节，避免堆分配
class CScript : public prevector<28, uint8_t> {
    // 小脚本：栈分配，无堆开销
    // 大脚本：自动切换到堆分配
};

// 性能优势
// - 避免小内存分配的开销
// - 更好的缓存局部性
// - 减少内存碎片
```

### 3.3 实现细节

```cpp
class prevector {
public:
    // 判断当前使用直接还是间接存储
    bool is_direct() const {
        return _size <= N;
    }
    
    // 获取元素指针
    T *item_ptr(difference_type pos) {
        return is_direct() ? &_direct.direct[pos] : _indirect.indirect[pos];
    }
    
    // 容量管理
    void change_capacity(size_type new_capacity) {
        if (new_capacity <= N) {
            // 切换到直接存储
            if (!is_direct()) {
                // 从堆复制到栈
                T *indirect = _indirect.indirect;
                // ... 复制元素
                free(indirect);
            }
        } else {
            // 切换到间接存储
            T *new_indirect = static_cast<T *>(realloc(...));
            // ... 复制元素
        }
    }
};
```

---

## 4. UTXO 缓存系统 (coins.h/cpp)

### 4.1 Coin 类

表示一个未花费的交易输出。

```cpp
class Coin {
    CTxOut out;                    // 输出内容
    uint32_t nHeightAndIsCoinBase; // 高度和Coinbase标志（打包存储）

public:
    Coin(CTxOut outIn, uint32_t nHeightIn, bool IsCoinbase)
        : out(std::move(outIn)),
          nHeightAndIsCoinBase((nHeightIn << 1) | IsCoinbase) {}

    uint32_t GetHeight() const { return nHeightAndIsCoinBase >> 1; }
    bool IsCoinBase() const { return nHeightAndIsCoinBase & 0x01; }
    bool IsSpent() const { return out.IsNull(); }
    void Clear() { out.SetNull(); }
};
```

### 4.2 带盐的哈希器 (SaltedOutpointHasher)

防止哈希碰撞攻击。

```cpp
class SaltedOutpointHasher {
    const uint64_t k0, k1;  // 随机盐值

public:
    SaltedOutpointHasher()
        : k0(GetRand(std::numeric_limits<uint64_t>::max())),
          k1(GetRand(std::numeric_limits<uint64_t>::max())) {}

    size_t operator()(const COutPoint &outpoint) const {
        // 使用 SipHash-2-4
        return SipHashUint256Extra(k0, k1, outpoint.GetTxId(), outpoint.GetN());
    }
};
```

### 4.3 缓存条目 (CCoinsCacheEntry)

```cpp
struct CCoinsCacheEntry {
    Coin coin;      // UTXO 数据
    uint8_t flags;  // 状态标志

    enum Flags {
        DIRTY = (1 << 0),  // 与父视图不同
        FRESH = (1 << 1),  // 父视图没有此条目（可安全删除）
    };
};

typedef std::unordered_map<COutPoint, CCoinsCacheEntry, SaltedOutpointHasher> CCoinsMap;
```

### 4.4 缓存视图 (CCoinsViewCache)

实现多层缓存架构：内存缓存 → LevelDB → 磁盘

```cpp
class CCoinsViewCache : public CCoinsViewBacked {
    mutable CCoinsMap cacheCoins;     // 缓存映射
    mutable size_t cachedCoinsUsage;  // 内存使用量

public:
    // 获取 Coin（自动从父视图加载）
    const Coin &AccessCoin(const COutPoint &output) const {
        std::unique_lock<std::mutex> lock { mCoinsViewCacheMtx };
        
        CCoinsMap::iterator it = cacheCoins.find(output);
        if (it != cacheCoins.end()) {
            return it->second.coin;  // 缓存命中
        }
        
        // 缓存未命中，从父视图加载
        Coin tmp;
        if (!base->GetCoin(output, tmp)) {
            return coinEmpty;  // 不存在
        }
        
        // 加入缓存
        auto ret = cacheCoins.emplace(output, CCoinsCacheEntry(std::move(tmp)));
        cachedCoinsUsage += ret.first->second.coin.DynamicMemoryUsage();
        return ret.first->second.coin;
    }

    // 添加 Coin
    void AddCoin(const COutPoint &outpoint, Coin coin, bool potential_overwrite) {
        // 检查是否不可花费
        if (coin.GetTxOut().scriptPubKey.IsUnspendable(...)) {
            return;  // 不存储不可花费的输出
        }
        
        auto [it, inserted] = cacheCoins.emplace(outpoint, CCoinsCacheEntry());
        
        if (!inserted) {
            cachedCoinsUsage -= it->second.coin.DynamicMemoryUsage();
        }
        
        it->second.coin = std::move(coin);
        it->second.flags |= CCoinsCacheEntry::DIRTY;
        cachedCoinsUsage += it->second.coin.DynamicMemoryUsage();
    }

    // 花费 Coin
    bool SpendCoin(const COutPoint &outpoint, Coin *moveout) {
        CCoinsMap::iterator it = FetchCoinNL(outpoint);
        if (it == cacheCoins.end()) {
            return false;  // 不存在
        }
        
        if (moveout) {
            *moveout = std::move(it->second.coin);  // 移出数据
        }
        
        if (it->second.flags & CCoinsCacheEntry::FRESH) {
            // 父视图没有，直接删除
            cacheCoins.erase(it);
        } else {
            // 标记为已花费（清空但不删除）
            it->second.flags |= CCoinsCacheEntry::DIRTY;
            it->second.coin.Clear();
        }
        
        return true;
    }

    // 批量写入父视图
    bool Flush() {
        CCoinsMap mapCoins;
        {
            std::unique_lock<std::mutex> lock { mCoinsViewCacheMtx };
            mapCoins.swap(cacheCoins);
            cachedCoinsUsage = 0;
        }
        return base->BatchWrite(mapCoins, hashBlock);
    }
};
```

### 4.5 视图层级架构

```
┌─────────────────────────────────────┐
│     CCoinsViewCache (内存缓存)       │  ← 读写操作
│     - 热数据缓存                      │
│     - 批量写入优化                    │
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│     CCoinsViewDB (LevelDB)          │  ← 持久化存储
│     - UTXO 数据库                     │
│     - 快速随机访问                    │
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│     磁盘文件 (LevelDB SST)           │  ← 长期存储
└─────────────────────────────────────┘
```

### 4.6 批量添加 Coin

```cpp
void AddCoins(CCoinsViewCache &cache, const CTransaction &tx, 
              int nHeight, uint64_t genesisActivationHeight, bool check) {
    bool fCoinbase = tx.IsCoinBase();
    const TxId txid = tx.GetId();
    
    for (size_t i = 0; i < tx.vout.size(); ++i) {
        const COutPoint outpoint(txid, i);
        
        // Coinbase 交易可能重复（BIP30前），需要覆盖
        bool overwrite = check ? cache.HaveCoin(outpoint) : fCoinbase;
        
        cache.AddCoin(outpoint, 
                     Coin(tx.vout[i], nHeight, fCoinbase),
                     overwrite, 
                     genesisActivationHeight);
    }
}
```

---

## 5. 关键设计模式总结

### 5.1 写时复制 (Copy-on-Write)

```cpp
// CTransaction 使用共享指针
class CTransaction {
    std::shared_ptr<const CTransactionData> data;
    
public:
    // 读取操作共享数据
    const std::vector<CTxIn>& vin() const { return data->vin; }
    
    // 修改时复制 (需要 CMutableTransaction)
};
```

### 5.2 访问者模式

```cpp
// 序列化使用访问者模式
template <typename Stream, typename Operation>
void SerializationOp(Stream &s, Operation ser_action) {
    // ser_action 可以是 CSerActionSerialize 或 CSerActionUnserialize
    READWRITE(nVersion);
}
```

### 5.3 装饰器模式

```cpp
// CCoinsViewCache 装饰 CCoinsViewBacked
class CCoinsViewCache : public CCoinsViewBacked {
    // 添加缓存功能
};
```

### 5.4 延迟加载

```cpp
// FetchCoinNL 实现延迟加载
CCoinsMap::iterator FetchCoinNL(const COutPoint &outpoint) const {
    auto it = cacheCoins.find(outpoint);
    if (it != cacheCoins.end()) return it;  // 已加载
    
    // 从父视图加载
    Coin tmp;
    if (!base->GetCoin(outpoint, tmp)) {
        return cacheCoins.end();
    }
    
    // 加入缓存
    return cacheCoins.emplace(outpoint, CCoinsCacheEntry(std::move(tmp))).first;
}
```

---

## 6. 性能优化要点

### 6.1 内存布局

```cpp
// Coin 使用位打包减少内存
uint32_t nHeightAndIsCoinBase;  // 高度(31位) + Coinbase标志(1位)

// 相比分开存储节省 4 字节
// uint32_t nHeight;      // 4 bytes
// bool fCoinBase;        // 1 byte (实际可能 4 bytes 对齐)
```

### 6.2 哈希优化

```cpp
// 使用 SipHash 替代标准哈希
// - 防止哈希碰撞攻击
// - 更好的分布性
// - 固定 64 位输出

size_t operator()(const COutPoint &outpoint) const {
    return SipHashUint256Extra(k0, k1, outpoint.GetTxId(), outpoint.GetN());
}
```

### 6.3 缓存策略

```cpp
// FRESH 标志优化删除
// 如果条目是 FRESH 且被花费，可以直接删除而不写入父视图

if (it->second.flags & CCoinsCacheEntry::FRESH) {
    cacheCoins.erase(it);  // 父视图没有，直接删除
} else {
    it->second.coin.Clear();  // 需要写入父视图标记为已花费
}
```

---

## 下一步

阶段一完成。接下来进入**阶段二：共识机制**，重点学习：
1. 区块验证完整流程
2. 分叉处理和链重组
3. 检查点机制
4. 时间锁实现
