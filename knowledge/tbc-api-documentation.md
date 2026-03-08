# TBC API文档（旧版 - 不完整）

> **⚠️ 已废弃**：请使用 `knowledge/tbc-api-complete.md`，那个文件包含所有端点的完整定义。

**主网**: `https://api.turingbitchain.io/api/tbc/`
**测试网**: `https://api.tbcdev.org/api/tbc/`

---

## 1. FT接口文档 (同质化代币)

### 1.1 查询FT余额
```http
GET /api/tbc/ft/balance/address/{address}/token/{token_contract_id}
```
**返回**:
```json
{
  "code": "200",
  "message": "OK",
  "data": {
    "address": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
    "confirmedBalance": 1000000,
    "unconfirmedBalance": 0,
    "balance": 1000000
  }
}
```

### 1.2 查询FT的UTXO
```http
GET /api/tbc/ft/utxo/address/{address}/token/{token_contract_id}
```

### 1.3 查询交易历史
```http
GET /api/tbc/ft/history/address/{address}/token/{token_contract_id}/start/{start}/end/{end}
```

### 1.4 获取FT信息
```http
GET /api/tbc/ft/ftinfo/ftid/{ftid}
```
**返回**:
```json
{
  "code": "200",
  "message": "OK",
  "data": {
    "ft_contract_id": "a2d772d61afeac6b719a74d87872b9bbe847aa21b41a9473db066eabcddd86f3",
    "ft_name": "山特币",
    "ft_symbol": "SATOSHI",
    "ft_decimal": 6,
    "ft_total_supply": "2100000000000000",
    "ft_holder_count": 100,
    "ft_create_timestamp": 1752054680,
    "ft_icon": "https://ftcdn.turingwallet.xyz/fts/a2d772d61afeac6b719a74d87872b9bbe847aa21b41a9473db066eabcddd86f3.jpg"
  }
}
```

### 1.5 解析FT交易
```http
GET /api/tbc/ft/decodetx/txid/{txid}
```

### 1.6 获取代币列表
```http
GET /api/tbc/ft/ftlist/start/{start}/end/{end}
```

### 1.7 持币人排行
```http
GET /api/tbc/ft/holderlist/ftid/{ftid}/start/{start}/end/{end}
```

---

## 2. TBC接口文档 (原生代币)

### 2.1 健康检查
```http
GET /api/tbc/health
```
**返回**:
```json
{
  "code": "200",
  "message": "OK",
  "data": {
    "status": "Turing API is running."
  }
}
```

### 2.2 广播交易
```http
POST /api/tbc/broadcasttx
Content-Type: application/json

{
  "txraw": "0100000001a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890000000006a47304402..."
}
```

### 2.3 批量广播交易
```http
POST /api/tbc/broadcasttxs
Content-Type: application/json

[
  { "txraw": "0a00000002be7aa9d0c84db3c652aaa8f48659a3d3098e0d39239e6656073c1d07ed920873..." },
  { "txraw": "0a00000004568db970e5920367c4d741db4d257a1cff7b91c678bae7dd2c763df19a3e801e..." }
]
```

### 2.4 地址信息
```http
GET /api/tbc/addressinfo/address/{address}
```

### 2.5 余额查询
```http
GET /api/tbc/balance/address/{address}
```
**返回**:
```json
{
  "code": "200",
  "message": "OK",
  "data": {
    "address": "1BqJ3zWFfbagnvHgPsAskz3pARqK7zrAaF",
    "confirmedBalance": 0,
    "unconfirmedBalance": 0,
    "balance": 406250000
  }
}
```

### 2.6 UTXO查询
```http
GET /api/tbc/utxo/address/{address}?limit=10
```

### 2.7 交易历史
```http
GET /api/tbc/history/address/{address}/start/{start}/end/{end}
```

### 2.8 区块信息
```http
GET /api/tbc/blockByHeight/height/{height}
GET /api/tbc/blockByHash/hash/{hash}
```

### 2.9 内存池信息
```http
GET /api/tbc/mempoolinfo
GET /api/tbc/mempooltxs
```

### 2.10 节点信息
```http
GET /api/tbc/nodeinfo
GET /api/tbc/chainstate
```

---

## 3. NFT接口文档 (非同质化代币)

### 3.1 查询地址的合集列表
```http
GET /api/tbc/nft/collectionbyaddress/address/{address}/start/{start}/end/{end}
```
**返回**:
```json
{
  "code": "200",
  "message": "OK",
  "data": {
    "collection_count": 36,
    "collection_list": [
      {
        "collection_id": "99c85f93aef06c93216ab1688054b24a5f27f72d3cf524f961ba59cab2452c55",
        "collection_name": "han",
        "collection_creator": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
        "collection_symbol": "",
        "collection_description": "han",
        "collection_supply": 100,
        "collection_create_timestamp": 1753204273,
        "collection_icon": "https://nftcdn.turingwallet.xyz/collections/99c85f93aef06c93216ab1688054b24a5f27f72d3cf524f961ba59cab2452c55.jpg"
      }
    ]
  }
}
```

### 3.2 查询地址的NFT列表
```http
GET /api/tbc/nft/nftbyaddress/address/{address}/start/{start}/end/{end}
```

### 3.3 查询指定集合中的NFT列表
```http
GET /api/tbc/nft/nftbycollection/collectionid/{collection_id}/start/{start}/end/{end}
```

### 3.4 查询NFT交易历史
```http
GET /api/tbc/nft/history/address/{address}/nftid/{nftid}/start/{start}/end/{end}
GET /api/tbc/nft/allhistory/address/{address}/start/{start}/end/{end}
```

### 3.5 查询所有合集/NFT信息
```http
GET /api/tbc/nft/collectionlist/start/{start}/end/{end}
GET /api/tbc/nft/nftlist/start/{start}/end/{end}
```

### 3.6 查询指定NFT/合集信息
```http
GET /api/tbc/nft/nftinfo/nftid/{nftid}
GET /api/tbc/nft/collectioninfo/collectionid/{collection_id}
```

### 3.7 查询NFT UTXO
```http
GET /api/tbc/nft/utxo/scriptpubkeyhash/{scriptpubkeyhash}
```

---

## 4. Pool接口文档 (流动性池)

### 4.1 查询流动池状态
```http
GET /api/tbc/pool/poolinfo/poolid/{pool_id}
```
**返回**:
```json
{
  "code": "200",
  "message": "OK",
  "data": {
    "lp_balance": 0,
    "token_balance": 0,
    "tbc_balance": 0,
    "version": 2,
    "service_fee_rate": 25,
    "service_provider": "bison",
    "ft_lp_partial_hash": "aa94e8bdf1942f9b626462afdad67e00a7598a8d66d1820f62a09cf4b3509ab3",
    "ft_a_partial_hash": "099833bb194c7ec6c2461b9010f51ecc67dd15dc0a4e9f3c577b2ba8065253c8",
    "ft_contract_id": "818a2f931e51a8191e611d8c6ff0cab0c1c7c1b6b46f7c1a05911f7e8dac9686",
    "txid": "d1abc259d8ed237b0db2a1ac5cf734c77b493ec7723a20e8a6322e0fd14cdfc6",
    "vout": 0,
    "value": 1000,
    "pool_code_script": "5479816b5179537f7701207f01207f517f77587f587f587f75816b816b816b6b6b6ba87e6c7e51796b7e7ea87e517901247f756b6ba87e6c7eaa56ba01207f758851796b7e7ea87e7e7eaa6c6c7601207f75537a887c6c766b876375672410492873b929d0d3052f89cef17116a8df0c4426f7f1167e544a66efa06489f70000000088687651876375760087636b6776011988bb7e6b687600876375675279021c06885479517f7701147f756c6c766ba97c6b870088a87e6bbb7e6c6c7e7e6b685279021c0688768255947f05465461706588537f77587f587f587f587f587f587f75817c81937c81937c81937c81937c81936c6c6c5779886b7c6b6ba87e6bbb7e6c6c7e7e6b5279021c0688768255947f05465461706588537f77587f587f587f587f587f587f75817c81937c81937c81937c81937c81936c6c6c6c766b587988766ba95879517f7701147f75886b7c6b6ba87e6bbb7e6c6c7e7e6b6ea87e6b537953797e6c6c7e7ea857ba8877527a816c6c6c6c6c6c6c6c547a6b547a76a96b597a88567a817c6ea051886e946ea263766b7c02e80381940340420f81957c96777c6c936b6e7c0340420f81957c965579887c547a936b6e7c0340420f81957c9653798875936c6c67766b0340420f81957c02e8038194537900876496777c6c936b6e950340420f81965579887c547a936b6e950340420f819653798875936c6c676d756c936b537a936b936c6c6868537a8255947f054e546170658801447f77587f587f587f7581537a8881527a88818876a855ba886b765287637578021c0687636c6c6c766b557988766b5579517f7701147f758700886b686bbb7e7e6c7ea87e7e7eaa6c820128947f01207f75527a886b68765287637578021c0687636c6c6c766b557988766b5579517f7701147f758700886b686bbb7e7e6c7ea87e7e7eaa6c820128947f01207f75527a886b68765287637578021c0687636c6c6c766b557988766b5579517f7701147f758700886b686bbb7e7e6c7ea87e7e7eaa6c820128947f01207f75527a886b68765287637578021c0687636c6c6c766b557988766b5579517f7701147f758700886b686bbb7e7e6c7ea87e7e7eaa6c820128947f01207f75527a886b68765287637578021c0687636c6c6c766b557988766b5579517f7701147f758700886b686bbb7e7e6c7ea87e7e7eaa6c820128947f01207f75527a886b68518867765287637576a855ba886b006b765287637578021c0687636c6c6c6c6c766b577987636b6b6b557981936b67766b5679886b6b6b68686bbb7e7e6c7ea87e7e7eaa6c6c820128947f01207f75537a886b6b68765287637578021c0687636c6c6c6c6c766b577987636b6b6b557981936b67766b5679886b6b6b68686bbb7e7e6c7ea87e7e7eaa6c6c820128947f01207f75537a886b6b68765287637578021c0687636c6c6c6c6c766b577987636b6b6b557981936b67766b5679886b6b6b68686bbb7e7e6c7ea87e7e7eaa6c6c820128947f01207f75537a886b6b68765287637578021c0687636c6c6c6c6c766b577987636b6b6b557981936b67766b5679886b6b6b68686bbb7e7e6c7ea87e7e7eaa6c6c820128947f01207f75537a886b6b68765287637578021c0687636c6c6c6c6c766b577987636b6b6b557981936b67766b5679886b6b6b68686bbb7e7e6c7ea87e7e7eaa6c6c820128947f01207f75537a886b6b6851886c6c6d760087636b6776011988bb7e6b687600876375675279021c06885479517f7701147f756c6c766ba9527a886ba87e6bbb7e6c6c7e7e6b687600876375675279021c06886c6c6c766b5679886b6ba87e6bbb7e6c6c7e7e6b685279021c0688768255947f05465461706588756c6c6c5679886b5579517f7701147f7514759d6677091e973b9e9d99f19c68fbf43e3f05f98878537f77587f587f587f587f587f587f75817c81937c81937c81937c81937c81936b6ba87e6bbb7e6c6c7e7e6b760119886c5479816b6bbb7e6c7e6b5279021c0688768255947f05465461706588756c6c6c6c6c5879886b6b5279537f77587f587f587f587f587f587f75817c81937c81937c81937c81937c81936b6b6ba87e6bbb7e6c6c7e7e6b6ea87e6b537953797e6c6c7e7ea857ba8877527a816c6c6c6c02e8038194577a02e80381946e6ea051889458798875537a547a6e946b7c0340420f81957c966e7c0340420f81957c96567a887c756e7c0340420f81957c967c6b946c7c6b6e7c0340420f81957c96537988757c946c6c527a527a537a8255947f054e546170658801447f77587f587f587f7581537a8881527a88818867765387637576a855ba8801287f776c6c756b6b765287637578011987636bbb7e7e6c7ea87e7e7eaa6c01287f006b6b01207f7588765287637578011987636bbb7e7e676c6c6c6c766b5879886b587981936b6b6ba87e6bbb7e7e6c7e686c7ea87e7e7eaa6c01287f6b01207f758868765287637578011987636bbb7e7e676c6c6c6c766b5879886b587981936b6b6ba87e6bbb7e7e6c7e686c7ea87e7e7eaa6c01287f6b01207f758868765287637578011987636bbb7e7e676c6c6c6c766b5879886b587981936b6b6ba87e6bbb7e7e6c7e686c7ea87e7e7eaa6c01287f6b01207f758868765287637578011987636bbb7e7e676c6c6c6c766b5879886b587981936b6b6ba87e6bbb7e7e6c7e686c7ea87e7e7eaa6c01287f6b01207f75886851886c6c6d760087636b6776011988bb7e6b687600876375675279021c0688768255947f05465461706588756c6c6c766b567988766ba95679517f7701147f75886ba87e6bbb7e6c6c7e7e6b68760087637567760119885279537f7701147f75149fd4106333baf69c11d5b174046f92c9ac963aab88bb7e6c7e6b685279021c0688768255947f05465461706588756c6c6c5679886b78537f77587f587f587f587f587f587f75817c81937c81937c81937c81937c81936b6ba87e6bbb7e6c6c7e7e6b6ea87e6b537953797e6c6c7e7ea857ba88778255947f054e546170658801447f77587f587f587f75817c817c547a816c6c567a886c6c6c6e956c7c6b5679766b5279a0518855796e7ca051885779a251886d527a94766c6c7c9688547a88537a81886d676c6c6c766b577988766ba95779517f7701147f758700886b6ba87e6bbb7e7e6c6c7e7ea87e7e7eaa6c01287f6b01207f7588765287637578011987636bbb7e7e676c6c6c766b577988766ba95779517f7701147f758700886b6ba87e6bbb7e7e6c7e686c7ea87e7e7eaa6c01287f6b01207f758868765287637578011987636bbb7e7e676c6c6c766b577988766ba95779517f7701147f758700886b6ba87e6bbb7e7e6c7e686c7ea87e7e7eaa6c01287f6b01207f758868765287637578011987636bbb7e7e676c6c6c766b577988766ba95779517f7701147f758700886b6ba87e6bbb7e7e6c7e686c7ea87e7e7eaa6c01287f6b01207f758868765287637578011987636bbb7e7e676c6c6c766b577988766ba95779517f7701147f758700886b6ba87e6bbb7e7e6c7e686c7ea87e7e7eaa6c01287f6b01207f75886851886c75760087636b6776011988bb7e6b687600876375675279021c0688a87e6bbb7e6c6c7e7e6b68760087637567760119885279537f7701147f75149fd4106333baf69c11d5b174046f92c9ac963aab886c6c6c6c6c6c6c5a7981946b6b6b6b6b6b6bbb7e6c7e6b685279021c06885479517f7701147f756c6c6c577988766ba9527a8878537f77587f587f587f587f587f587f75817c81937c81937c81937c81937c81936b6ba87e6bbb7e6c6c7e7e6b760119886c5479816b6bbb7e6c7e6b6ea87e6b537953797e6c6c7e7ea857ba88778255947f054e546170658801447f77587f587f587f75817c817c547a816c6c6c577a886c6c6c6e956c7c6b567a6ea0518894557988557994547aa25188527a93766c7c96537a88527a887c8188686867548876a855ba886c6c756b006b6b765287637578021c0687636c6c6c6c766b5679886b567981936b6b686bbb7e7e6c7ea87e7e7eaa6c820128947f01207f75527a886b68765287637578021c0687636c6c6c6c766b5679886b567981936b6b686bbb7e7e6c7ea87e7e7eaa6c820128947f01207f75527a886b68765287637578021c0687636c6c6c6c766b5679886b567981936b6b686bbb7e7e6c7ea87e7e7eaa6c820128947f01207f75527a886b68765287637578021c0687636c6c6c6c766b5679886b567981936b6b686bbb7e7e6c7ea87e7e7eaa6c820128947f01207f75527a886b68765287637578021c0687636c6c6c6c766b5679886b567981936b6b686bbb7e7e6c7ea87e7e7eaa6c820128947f01207f75527a886b6851886c6c6d76011988bb7e6b5279021c06886c6c6c567988766ba95679517f7701147f75886ba87e6bbb7e6c6c7e7e6b6ea87e6b537953797e6c6c7e7ea857ba8877527a816c537a886c6c6c547a8255947f054e546170658801447f77587f587f587f7581537a8881527a8881886c88686868516a056269736f6e0532436f6465"
  }
}
```

### 4.2 查询LP UTXO
```http
GET /api/tbc/pool/lputxo/scriptpubkeyhash/{scriptpubkeyhash}
```

### 4.3 分页返回Pool列表
```http
GET /api/tbc/pool/poollist/start/{start}/end/{end}
```
**返回**:
```json
{
  "code": "200",
  "message": "OK",
  "data": {
    "total_pool_count": 453,
    "pool_list": [
      {
        "pool_id": "006e6e0f5138454135631d66c8ecbd91571b12e5ac18a532eebd98e66b80c1b9",
        "token_pair_a_id": "TBC",
        "token_pair_a_name": "TBC",
        "token_pair_b_id": "6b4791a9ac3a429fdd9d856241a6123030a78e44a25709cd0e19ef4e0fe7d08f",
        "token_pair_b_name": "山特币",
        "pool_create_timestamp": 1751878233
      }
    ]
  }
}
```

---

## 5. 多签接口文档

### 5.1 获取多重签名地址
```http
GET /api/tbc/multisig/multisigaddress/address/{address}
```
**返回**:
```json
{
  "code": "200",
  "message": "OK",
  "data": {
    "multi_address_list": [
      {
        "address": "FDKX7GYpy7XkyXuRZryYwYd53WJaEPkGrR",
        "pubkeys": [
          "03485e043f42222430f00ab75735b6598969123095d5570f6de35f5eaa9cda8702",
          "038bafb61b438cc54c2a3940c5773970fe2aa55f55ff16edeb67de30c5659b49dd",
          "03179ff73e34c1d00387d911a3433f388780bd475c33a72b0c8df7c90c081a496e"
        ]
      }
    ]
  }
}
```

---

## 6. 关键发现与实战应用

### 6.1 打狗策略的API实现
```javascript
// 1. 监控新Pool创建
async monitorNewPools() {
  const response = await fetch('/api/tbc/pool/poollist/start/0/end/10');
  const data = await response.json();
  
  // 检查新Pool
  for (const pool of data.data.pool_list) {
    // 获取Pool详情
    const poolInfo = await fetch(`/api/tbc/pool/poolinfo/poolid/${pool.pool_id}`);
    const info = await poolInfo.json();
    
    // 判断初始市值
    if (info.data.tbc_balance < threshold) {
      // 小市值新币，考虑进入
      console.log(`发现新币: ${pool.token_pair_b_name}`);
    }
  }
}

// 2. 获取FT信息
async getFTInfo(ftid) {
  const response = await fetch(`/api/tbc/ft/ftinfo/ftid/${ftid}`);
  return response.json();
}

// 3. 查询交易历史
async getTradeHistory(address, ftid) {
  const response = await fetch(
    `/api/tbc/ft/history/address/${address}/token/${ftid}/start/0/end/100`
  );
  return response.json();
}
```

### 6.2 API调用限制
- 分页查询上限：500个记录
- 区块查询上限：10个区块
- 内存池查询：实时

### 6.3 重要字段说明
| 字段 | 说明 | 用途 |
|------|------|------|
| `pool_id` | Pool唯一标识 | 监控新Pool |
| `ft_contract_id` | FT合约ID | 查询代币信息 |
| `collection_id` | NFT合集ID | 查询NFT集合 |
| `txid` | 交易哈希 | 查询交易详情 |
| `scriptpubkeyhash` | 脚本哈希 | 查询UTXO |

---

## 7. 总结

### 已掌握内容
1. ✅ FT接口 - 同质化代币查询
2. ✅ TBC接口 - 原生代币操作
3. ✅ NFT接口 - 非同质化代币查询
4. ✅ Pool接口 - 流动性池监控
5. ✅ 多签接口 - 多重签名地址

### 实战价值
- **打狗策略**: 通过Pool列表API监控新币发射
- **投研分析**: 通过FT信息API分析代币基本面
- **交易监控**: 通过历史记录API追踪大户动向
- **NFT追踪**: 通过NFT接口监控热门合集

### 下一步
- 使用这些API构建自动化监控工具
- 实现新Pool发现与预警系统
- 开发代币分析与筛选工具

---

*学习时间: 2026-03-03 23:58 CST*  
*文档来源: ShowDoc TBC API文档*  
*掌握程度: 完全理解所有API接口及应用场景*
