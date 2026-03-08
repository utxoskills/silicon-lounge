# TBC Code Reference — All Transaction Types

Complete runnable code examples for every TBC transaction type.

---

## Setup

```typescript
import * as tbc from "tbc-lib-js";
import {
  API, FT, NFT, poolNFT, poolNFT2, orderBook, MultiSig,
  HTLC, stableCoin, piggyBank,
  buildUTXO, buildFtPrePreTxData, fetchInBatches, parseDecimalToBigInt,
} from "tbc-contract";
const { deployHTLC, withdraw, refund, fillSigDepoly, fillSigWithdraw, fillSigRefund,
        deployHTLCWithSign, withdrawWithSign, refundWithSign } = HTLC;

const network = "testnet";  // or "mainnet"
const privateKeyA = tbc.PrivateKey.fromString("YOUR_PRIVATE_KEY");
const publicKeyA = tbc.PublicKey.fromPrivateKey(privateKeyA);
const addressA = tbc.Address.fromPrivateKey(privateKeyA).toString();
```

---

## 1. Basic TBC Transfer

```typescript
const tbcAmount = 10;
const utxo = await API.fetchUTXO(privateKeyA, tbcAmount + 0.00008, network);
const tx = new tbc.Transaction()
    .from(utxo)
    .to(addressB, Math.floor(tbcAmount * Math.pow(10, 6)))
    .change(addressA);

const txSize = tx.getEstimateSize();
tx.fee(txSize < 1000 ? 80 : Math.ceil(txSize / 1000) * 80);
tx.sign(privateKeyA).seal();

await API.broadcastTXraw(tx.serialize(), network);
```

---

## 2. FT Mint

```typescript
const newToken = new FT({
    name: "MyToken",
    symbol: "MTK",
    amount: 100000000,  // with decimal=6, max is 10^12
    decimal: 6,
});

const utxo = await API.fetchUTXO(privateKeyA, 0.01, network);
const mintTX = newToken.MintFT(privateKeyA, addressA, utxo);
await API.broadcastTXraw(mintTX[0], network);  // source TX
const ftContractTxid = await API.broadcastTXraw(mintTX[1], network);  // mint TX → returns contract ID
```

---

## 3. FT Transfer

```typescript
const ftContractTxid = "YOUR_FT_CONTRACT_TXID";
const transferAmount = 1000;

const Token = new FT(ftContractTxid);
const TokenInfo = await API.fetchFtInfo(Token.contractTxid, network);
Token.initialize(TokenInfo);

const utxo = await API.fetchUTXO(privateKeyA, 0.01, network);
const transferAmountBN = parseDecimalToBigInt(transferAmount, Token.decimal);
const ftutxo_codeScript = FT.buildFTtransferCode(Token.codeScript, addressA).toBuffer().toString("hex");
const ftutxos = await API.fetchFtUTXOs(Token.contractTxid, addressA, ftutxo_codeScript, network, transferAmountBN);

let preTXs: tbc.Transaction[] = [];
let prepreTxDatas: string[] = [];
for (let i = 0; i < ftutxos.length; i++) {
    preTXs.push(await API.fetchTXraw(ftutxos[i].txId, network));
    prepreTxDatas.push(await API.fetchFtPrePreTxData(preTXs[i], ftutxos[i].outputIndex, network));
}

const transferTX = Token.transfer(privateKeyA, addressB, transferAmount, ftutxos, utxo, preTXs, prepreTxDatas);
await API.broadcastTXraw(transferTX, network);

// Simultaneous FT + TBC transfer:
// Token.transfer(privateKeyA, addressB, transferAmount, ftutxos, utxo, preTXs, prepreTxDatas, tbc_amount);
```

---

## 4. FT Batch Transfer

```typescript
const receiveAddressAmount = new Map<string, number | string>();
receiveAddressAmount.set(addressA, 500);
receiveAddressAmount.set(addressB, 700);
const sum = 1200;

const Token = new FT(ftContractTxid);
const TokenInfo = await API.fetchFtInfo(Token.contractTxid, network);
Token.initialize(TokenInfo);

const times = receiveAddressAmount.size;
const transferFee = 0.005 * times;
const utxo = await API.fetchUTXO(privateKeyA, transferFee, network);
const transferAmountBN = parseDecimalToBigInt(sum, Token.decimal);
const ftutxo_codeScript = FT.buildFTtransferCode(Token.codeScript, addressA).toBuffer().toString("hex");
const ftutxos = await API.fetchFtUTXOs(Token.contractTxid, addressA, ftutxo_codeScript, network, transferAmountBN);

let preTXs: tbc.Transaction[] = [];
let prepreTxDatas: string[] = [];
for (let i = 0; i < ftutxos.length; i++) {
    preTXs.push(await API.fetchTXraw(ftutxos[i].txId, network));
    prepreTxDatas.push(await API.fetchFtPrePreTxData(preTXs[i], ftutxos[i].outputIndex, network));
}

const transferTXs = Token.batchTransfer(privateKeyA, receiveAddressAmount, ftutxos, utxo, preTXs, prepreTxDatas);
transferTXs.length > 0
    ? await API.broadcastTXsraw(transferTXs, network)
    : console.log("Transfer failed");
```

---

## 5. FT Merge

```typescript
const Token = new FT(ftContractTxid);
const TokenInfo = await API.fetchFtInfo(Token.contractTxid, network);
Token.initialize(TokenInfo);

const ftutxo_codeScript = FT.buildFTtransferCode(Token.codeScript, addressA).toBuffer().toString("hex");
const ftutxos = await API.fetchFtUTXOList(Token.contractTxid, addressA, ftutxo_codeScript, network);

const mergeFee = 0.005 * ftutxos.length;
const utxo = await API.fetchUTXO(privateKeyA, mergeFee, network);
let localTX: tbc.Transaction[] = [];

const batchSize = 300;
const preTXs = await fetchInBatches<tbc.Transaction.IUnspentOutput, tbc.Transaction>(
    ftutxos, batchSize,
    (batch) => Promise.all(batch.map(u => API.fetchTXraw(u.txId, network))),
    "fetchFtPreTXData"
);
const prepreTxDatas = await fetchInBatches<tbc.Transaction.IUnspentOutput, string>(
    ftutxos, batchSize,
    (batch) => Promise.all(batch.map(u => {
        const idx = ftutxos.indexOf(u);
        return API.fetchFtPrePreTxData(preTXs[idx], u.outputIndex, network);
    })),
    "fetchFtPrePreTxData"
);

const mergeTX = Token.mergeFT(privateKeyA, ftutxos, utxo, preTXs, prepreTxDatas, localTX);
mergeTX.length > 0
    ? await API.broadcastTXsraw(mergeTX, network)
    : console.log("Merge success");
```

---

## 6. NFT Create Collection

```typescript
const fs = require('fs').promises;
const path = require('path');

async function encodeByBase64(filePath: string): Promise<string> {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mimeType};base64,${data.toString("base64")}`;
}

const content = await encodeByBase64("./image.png");
const collection_data = {
    collectionName: "MyCollection",
    description: "A test collection",
    supply: 10,
    file: content,
};

const utxos = await API.getUTXOs(addressA, 0.2, network);  // ~0.05 TBC per 100KB image
const txraw = NFT.createCollection(addressA, privateKeyA, collection_data, utxos);
const collection_id = await API.broadcastTXraw(txraw, network);
```

---

## 7. NFT Mint

```typescript
const nft_data = {
    nftName: "Art #1",
    symbol: "ART",
    description: "First NFT",
    attributes: "",
    file: content,  // or undefined to use collection image
};

const utxos = nft_data.file
    ? await API.getUTXOs(addressA, 0.2, network)
    : await API.getUTXOs(addressA, 0.001, network);

const nfttxo = await API.fetchNFTTXO({
    script: NFT.buildMintScript(addressA).toBuffer().toString("hex"),
    tx_hash: collection_id,
    network,
});

const txraw = NFT.createNFT(collection_id, addressA, privateKeyA, nft_data, utxos, nfttxo);
const contract_id = await API.broadcastTXraw(txraw, network);
```

---

## 8. NFT Transfer

```typescript
const nft = new NFT(contract_id);
const nftInfo = await API.fetchNFTInfo(contract_id, network);
nft.initialize(nftInfo);

const utxos = await API.getUTXOs(addressA, 0.01, network);
const nfttxo = await API.fetchNFTTXO({
    script: NFT.buildCodeScript(nftInfo.collectionId, nftInfo.collectionIndex).toBuffer().toString("hex"),
    network,
});
const pre_tx = await API.fetchTXraw(nfttxo.txId, network);
const pre_pre_tx = await API.fetchTXraw(pre_tx.toObject().inputs[0].prevTxId, network);

const txraw = nft.transferNFT(addressA, addressB, privateKeyA, utxos, pre_tx, pre_pre_tx);
await API.broadcastTXraw(txraw, network);
```

---

## 9. NFT Batch Mint (using collection image)

```typescript
const number = 1000;
const nft_datas = Array.from({ length: number }, () => ({
    nftName: "Batch NFT",
    symbol: "BNFT",
    description: "",
    attributes: "",
}));

const utxos = await API.getUTXOs(addressA, 0.001 * number, network);
const nfttxos = await API.fetchNFTTXOs({
    script: NFT.buildMintScript(addressA).toBuffer().toString("hex"),
    tx_hash: collection_id,
    network,
});
const selectedNfttxos = nfttxos.slice(0, nft_datas.length);
const txraws = NFT.batchCreateNFT(collection_id, addressA, privateKeyA, nft_datas, utxos, selectedNfttxos);
await API.broadcastTXsraw(txraws, network);
```

---

## 10. Pool v1 — Create, Init, LP, Swap

```typescript
const ftContractTxid = "YOUR_FT_ID";
const fee = 0.01;

// Step 1: Create pool
const pool = new poolNFT({ network });
await pool.initCreate(ftContractTxid);
const utxo1 = await API.fetchUTXO(privateKeyA, fee, network);
const tx1 = await pool.createPoolNFT(privateKeyA, utxo1);
await API.broadcastTXraw(tx1[0], network);
const poolId = await API.broadcastTXraw(tx1[1], network);

// Step 2: Init with liquidity
const poolUse = new poolNFT({ txidOrParams: poolId, network });
await poolUse.initfromContractId();

const utxo2 = await API.fetchUTXO(privateKeyA, 30 + fee, network);
const tx2 = await poolUse.initPoolNFT(privateKeyA, addressA, utxo2, 30, 1000);  // 30 TBC + 1000 FT
await API.broadcastTXraw(tx2, network);

// Step 3: Add liquidity
const utxo3 = await API.fetchUTXO(privateKeyA, 0.1 + fee, network);
const tx3 = await poolUse.increaseLP(privateKeyA, addressA, utxo3, 0.1);  // min 0.1 TBC
await API.broadcastTXraw(tx3, network);

// Step 4: Remove liquidity
const utxo4 = await API.fetchUTXO(privateKeyA, fee, network);
const tx4 = await poolUse.consumeLP(privateKeyA, addressA, utxo4, 2);  // 2 LP tokens
await API.broadcastTXraw(tx4, network);

// Step 5: Swap TBC → FT
const utxo5 = await API.fetchUTXO(privateKeyA, 0.1 + fee, network);
const tx5 = await poolUse.swaptoToken_baseTBC(privateKeyA, addressA, utxo5, 0.1);
await API.broadcastTXraw(tx5, network);

// Step 6: Swap FT → TBC
const utxo6 = await API.fetchUTXO(privateKeyA, fee, network);
const tx6 = await poolUse.swaptoTBC_baseToken(privateKeyA, addressA, utxo6, 100);
await API.broadcastTXraw(tx6, network);

// Merge FT-LP (5 at a time)
const utxo7 = await API.fetchUTXO(privateKeyA, fee, network);
const tx7 = await poolUse.mergeFTLP(privateKeyA, utxo7);
if (typeof tx7 === 'string') await API.broadcastTXraw(tx7, network);

// Merge FT in pool (4 at a time)
const utxo8 = await API.fetchUTXO(privateKeyA, fee, network);
const tx8 = await poolUse.mergeFTinPool(privateKeyA, utxo8);
if (typeof tx8 === 'string') await API.broadcastTXraw(tx8, network);
```

---

## 11. Pool v2 — With Lock, Service Rate, LP Plan

```typescript
const serviceRate = 25;  // 0.25%
const lpPlan = 2;  // Plan 1: LP 0.25% | Plan 2: LP 0.05%
const tag = "tbc";
const isLockTime = true;

// Create
const pool2 = new poolNFT2({ network });
pool2.initCreate(ftContractTxid);
const utxo = await API.fetchUTXO(privateKeyA, fee, network);
const tx1 = await pool2.createPoolNFT(privateKeyA, utxo, tag, serviceRate, lpPlan, isLockTime);

// Or create with pubkey lock (max 10 keys):
const pubKeyLock = ["pubkey1", "pubkey2"];
const lpCostAddress = "...";
const lpCostTBC = 5;
const tx1 = await pool2.createPoolNftWithLock(privateKeyA, utxo, tag, lpCostAddress, lpCostTBC, pubKeyLock, serviceRate, lpPlan, isLockTime);

await API.broadcastTXraw(tx1[0], network);
await API.broadcastTXraw(tx1[1], network);

// Init with lock time
const lockTime = 907022;  // block height or Unix timestamp
const tx2 = await pool2Use.initPoolNFT(privateKeyA, addressA, utxo, 30, 1000, lockTime);

// Add LP with lock
const tx3 = await pool2Use.increaseLP(privateKeyA, addressA, utxo, 0.1, lockTime);

// Remove LP (auto-unlocks if time passed)
const tx4 = await pool2Use.consumeLP(privateKeyA, addressA, utxo, 13);

// Swap with lpPlan param
const tx5 = await pool2Use.swaptoToken_baseTBC(privateKeyA, addressA, utxo, 0.1, lpPlan);
const tx6 = await pool2Use.swaptoTBC_baseToken(privateKeyA, addressA, utxo, 100, lpPlan);

// Burn LP tokens
const tx7 = await pool2Use.burnFTLP(privateKeyA, utxo);

// Merge FT in pool (multiple rounds, ~30s per 10 rounds)
const times = 10;
const mergeFee = 0.005 * times;
const utxoM = await API.fetchUTXO(privateKeyA, mergeFee, network);
const mergeTXs = await pool2Use.mergeFTinPool(privateKeyA, utxoM, times);
mergeTXs.length > 0
    ? await API.broadcastTXsraw(mergeTXs, network)
    : console.log("Merge success");

// Query pool info
const poolInfo = await pool2Use.fetchPoolNftInfo(pool2Use.contractTxid);
const poolUTXO = await pool2Use.fetchPoolNftUTXO(pool2Use.contractTxid);
const extraInfo = await pool2Use.getPoolNftExtraInfo();
const ftlpBalance = await pool2Use.fetchFtlpBalance(addressA);
const ftlpLockTime = await pool2Use.fetchFtlpLockTime(addressA);
```

---

## 12. Pool Swap with Local UTXO (Advanced)

```typescript
// After local merge, build swap from local TX chain:
const preTXs: tbc.Transaction[] = [];
for (const tx of mergeTX) {
    preTXs.push(new tbc.Transaction(tx.txraw));
}
const ftutxo = buildUTXO(preTXs[preTXs.length - 1], 0, true);
const ftPreTX = [preTXs[preTXs.length - 1]];
const ftPrePreTxData = [buildFtPrePreTxData(ftPreTX[0], 0, preTXs)];

// Option A: Use fee UTXO from last output of local FT TX
const tx = await poolUse.swaptoTBC_baseToken_local(
    privateKeyA, addressA, ftutxo, ftPreTX, ftPrePreTxData, ftAmount, lpPlan
);

// Option B: Use separate fee UTXO
const tbcutxo = await API.fetchUTXO(privateKeyA, fee, network);
const tx = await poolUse.swaptoTBC_baseToken_local(
    privateKeyA, addressA, ftutxo, ftPreTX, ftPrePreTxData, ftAmount, lpPlan, tbcutxo
);

// Chain further: use TBC output from swap
const tbcutxo_fromPool = buildUTXO(new tbc.Transaction(tx), 2, false);
// Use tbcutxo_fromPool for next operation...

// Batch broadcast all chained TXs
await API.broadcastTXsraw(txs, network);
```

---

## 13. OrderBook (DEX)

```typescript
const order = new orderBook();
const saleVolume = 10000000n;
const unitPrice = 10100000n;
const feeRate = 100n;

// -- Create Sell Order (sell TBC for FT) --
const sellOrderNoSigs = order.buildSellOrderTX(
    holdAddress, saleVolume, unitPrice, feeRate, ftContractTxid, ftPartialHash, utxos
);
const sellOrder = order.fillSigsSellOrder(sellOrderNoSigs, sigs, publicKey, "make");
await API.broadcastTXraw(sellOrder, network);

// -- Cancel Sell Order --
const cancelSellNoSigs = order.buildCancelSellOrderTX(sellutxo, utxos);
const cancelSell = order.fillSigsSellOrder(cancelSellNoSigs, sigs, publicKey, "cancel");
await API.broadcastTXraw(cancelSell, network);

// -- Create Buy Order (buy TBC with FT) --
const Token = new FT(ftContractTxid);
const TokenInfo = await API.fetchFtInfo(Token.contractTxid, network);
Token.initialize(TokenInfo);
const ftutxo_codeScript = FT.buildFTtransferCode(Token.codeScript, addressA).toBuffer().toString("hex");
const ftutxos = await API.fetchFtUTXOs(Token.contractTxid, addressA, ftutxo_codeScript, network, saleVolume);

let preTXs: tbc.Transaction[] = [];
let prepreTxData: string[] = [];
for (let i = 0; i < ftutxos.length; i++) {
    preTXs.push(await API.fetchTXraw(ftutxos[i].txId, network));
    prepreTxData.push(await API.fetchFtPrePreTxData(preTXs[i], ftutxos[i].outputIndex, network));
}

const buyOrderNoSigs = order.buildBuyOrderTX(
    holdAddress, saleVolume, unitPrice, feeRate, ftContractTxid, utxos, ftutxos, preTXs
);
const buyOrder = order.fillSigsMakeBuyOrder(buyOrderNoSigs, sigs, publicKey, preTXs, prepreTxData);
await API.broadcastTXraw(buyOrder, network);

// -- Cancel Buy Order --
const buyPreTX = await API.fetchTXraw(buyutxo.txId, network);
const ftPreTX = await API.fetchTXraw(ftutxo.txId, network);
const ftPrePreTxData = await API.fetchFtPrePreTxData(ftPreTX, ftutxo.outputIndex, network);

const cancelBuyNoSigs = order.buildCancelBuyOrderTX(buyutxo, ftutxo, ftPreTX, utxos);
const cancelBuy = order.fillSigsCancelBuyOrder(cancelBuyNoSigs, sigs, publicKey, buyPreTX, ftPreTX, ftPrePreTxData);
await API.broadcastTXraw(cancelBuy, network);

// -- Match Order (fill) --
const matchTX = order.matchOrder(
    privateKeyA,
    buyutxo, buyPreTX,
    ftutxo, ftPreTX, ftPrePreTxData,
    sellutxo, sellPreTX,
    utxos, ftFeeAddress, tbcFeeAddress
);
await API.broadcastTXraw(matchTX, network);
```

---

## 14. MultiSig

```typescript
// Pub keys sorted alphabetically, signatureCount: 1-6, publicKeyCount: 3-10
const pubKeys = [pubKeyA, pubKeyB, pubKeyC];  // sorted
const signatureCount = 2;
const publicKeyCount = 3;

// Get multisig address
const multiSigAddress = MultiSig.getMultiSigAddress(pubKeys, signatureCount, publicKeyCount);

// Create wallet
const utxos = await API.getUTXOs(addressA, 1.001, network);
const txraw = MultiSig.createMultiSigWallet(addressA, pubKeys, signatureCount, publicKeyCount, 1, utxos, privateKeyA);
await API.broadcastTXraw(txraw, network);

// P2PKH → MultiSig (TBC)
const utxos2 = await API.getUTXOs(addressA, 10.001, network);
const txraw2 = MultiSig.p2pkhToMultiSig_sendTBC(addressA, multiSigAddress, 10, utxos2, privateKeyA);
await API.broadcastTXraw(txraw2, network);

// MultiSig → P2PKH (TBC)
const script_asm = MultiSig.getMultiSigLockScript(multiSigAddress);
const umtxos = await API.getUMTXOs(script_asm, 10.001, network);
const multiTxraw = MultiSig.buildMultiSigTransaction_sendTBC(multiSigAddress, addressB, 10, umtxos);
const sig1 = MultiSig.signMultiSigTransaction_sendTBC(multiSigAddress, multiTxraw, privateKeyA);
const sig2 = MultiSig.signMultiSigTransaction_sendTBC(multiSigAddress, multiTxraw, privateKeyB);
let sigs: string[][] = [];
for (let i = 0; i < sig1.length; i++) {
    sigs[i] = [sig1[i], sig2[i]];
}
const finalTX = MultiSig.finishMultiSigTransaction_sendTBC(multiTxraw.txraw, sigs, pubKeys);
await API.broadcastTXraw(finalTX, network);

// P2PKH → MultiSig (FT)
const Token = new FT('ft_contract_txid');
const TokenInfo = await API.fetchFtInfo(Token.contractTxid, network);
Token.initialize(TokenInfo);
const transferAmount = 10000;
const transferAmountBN = BigInt(Math.floor(transferAmount * Math.pow(10, Token.decimal)));
const ftutxo_codeScript = FT.buildFTtransferCode(Token.codeScript, addressA).toBuffer().toString("hex");
const ftutxos = await API.fetchFtUTXOs(Token.contractTxid, addressA, ftutxo_codeScript, network, transferAmountBN);
let preTXs: tbc.Transaction[] = [];
let prepreTxDatas: string[] = [];
for (let i = 0; i < ftutxos.length; i++) {
    preTXs.push(await API.fetchTXraw(ftutxos[i].txId, network));
    prepreTxDatas.push(await API.fetchFtPrePreTxData(preTXs[i], ftutxos[i].outputIndex, network));
}
const utxo = await API.fetchUTXO(privateKeyA, 0.01, network);
const ftTX = MultiSig.p2pkhToMultiSig_transferFT(addressA, multiSigAddress, Token, transferAmount, utxo, ftutxos, preTXs, prepreTxDatas, privateKeyA);
await API.broadcastTXraw(ftTX, network);

// MultiSig → P2PKH (FT)  — note: multisig UTXO must have outputIndex=0
const umtxo = await API.fetchUMTXO(script_asm, 0.01, network);
const hash_from = tbc.crypto.Hash.sha256ripemd160(
    tbc.crypto.Hash.sha256(tbc.Script.fromASM(script_asm).toBuffer())
).toString("hex");
const ftutxo_codeScript2 = FT.buildFTtransferCode(Token.codeScript, hash_from).toBuffer().toString("hex");
const ftutxos2 = await API.getFtUTXOS_multiSig(Token.contractTxid, hash_from, ftutxo_codeScript2, transferAmountBN, network);
let preTXs2: tbc.Transaction[] = [];
let prepreTxDatas2: string[] = [];
for (let i = 0; i < ftutxos2.length; i++) {
    preTXs2.push(await API.fetchTXraw(ftutxos2[i].txId, network));
    prepreTxDatas2.push(await API.fetchFtPrePreTxData(preTXs2[i], ftutxos2[i].outputIndex, network));
}
const contractTX = await API.fetchTXraw(umtxo.txId, network);
const multiTxraw2 = MultiSig.buildMultiSigTransaction_transferFT(
    multiSigAddress, addressB, Token, transferAmount, umtxo, ftutxos2, preTXs2, prepreTxDatas2, contractTX, privateKeyC
);
const ftSig1 = MultiSig.signMultiSigTransaction_transferFT(multiSigAddress, multiTxraw2, privateKeyA);
const ftSig2 = MultiSig.signMultiSigTransaction_transferFT(multiSigAddress, multiTxraw2, privateKeyB);
let ftSigs: string[][] = [];
for (let i = 0; i < ftSig1.length; i++) {
    ftSigs[i] = [ftSig1[i], ftSig2[i]];
}
const finalFtTX = MultiSig.finishMultiSigTransaction_transferFT(multiTxraw2.txraw, ftSigs, pubKeys);
await API.broadcastTXraw(finalFtTX, network);
```

---

## 15. Memo Transfer & Time-Locked Transfer

```typescript
// Memo (data embedded in OP_RETURN)
const memo = "Hello TBC";
const tx = new tbc.Transaction()
    .from(utxo)
    .to(addressB, amount)
    .addOutput(new tbc.Transaction.Output({
        script: tbc.Script.fromASM(`OP_FALSE OP_RETURN ${Buffer.from(memo).toString('hex')}`),
        satoshis: 0,
    }))
    .change(addressA)
    .fee(80)
    .sign(privateKeyA);
await API.broadcastTXraw(tx.uncheckedSerialize(), network);

// Time-locked transfer
const tx2 = new tbc.Transaction()
    .from(utxo)
    .to(addressB, amount)
    .change(addressA)
    .fee(80)
    .setLockTime(900000)  // block height or Unix timestamp
    .sign(privateKeyA);
await API.broadcastTXraw(tx2.uncheckedSerialize(), network);
```

---

## 17. HTLC (Hash Time-Lock Contract)

```typescript
const secret = "my_secret_preimage";
const hashlock = tbc.crypto.Hash.sha256(Buffer.from(secret)).toString("hex");
const timelock = 950000; // block height

// -- Method A: Two-phase (build raw + fill signature separately) --
// 1. Deploy HTLC
const deployRaw = deployHTLC(addressA, addressB, hashlock, timelock, 1.0, utxo);
const deployTx = fillSigDepoly(deployRaw, sig, publicKeyA);  // note: SDK typo "Depoly"
const deployTxid = await API.broadcastTXraw(deployTx, network);

// 2. Withdraw (receiver provides preimage)
const htlcUtxo = buildUTXO(new tbc.Transaction(deployTx), 0);
const withdrawRaw = withdraw(addressB, htlcUtxo);
const withdrawTx = fillSigWithdraw(withdrawRaw, secret, sigB, publicKeyB);
await API.broadcastTXraw(withdrawTx, network);

// 3. Refund (sender, after timelock expires)
const refundRaw = refund(addressA, htlcUtxo, timelock);
const refundTx = fillSigRefund(refundRaw, sigA, publicKeyA);
await API.broadcastTXraw(refundTx, network);

// -- Method B: Direct signing with private key --
const deployTx2 = deployHTLCWithSign(addressA, addressB, hashlock, timelock, 1.0, utxo, privateKeyA.toString());
await API.broadcastTXraw(deployTx2, network);

const withdrawTx2 = withdrawWithSign(privateKeyB.toString(), addressB, htlcUtxo, secret);
await API.broadcastTXraw(withdrawTx2, network);

const refundTx2 = refundWithSign(addressA, htlcUtxo, privateKeyA.toString(), timelock);
await API.broadcastTXraw(refundTx2, network);
```

---

## 18. StableCoin

```typescript
// -- Create StableCoin (admin creates coin + NFT certificate) --
const coin = new stableCoin({ name: "USDT-TBC", symbol: "USDT", amount: 1000000, decimal: 6 });
const utxo = await API.fetchUTXO(privateKeyAdmin, 0.1, network);
const utxoTX = await API.fetchTXraw(utxo.txId, network);
const [coinNftTXRaw, coinMintRaw] = coin.createCoin(privateKeyAdmin, addressAdmin, utxo, utxoTX, "Initial mint");
await API.broadcastTXsraw([{ txraw: coinNftTXRaw }, { txraw: coinMintRaw }], network);

// -- Mint more (increase supply) --
const nftPreTX = await API.fetchTXraw(nftUtxo.txId, network);
const nftPrePreTX = await API.fetchTXraw(/* previous nft tx */, network);
const mintRaw = coin.mintCoin(privateKeyAdmin, addressTo, 500000, utxo, nftPreTX, nftPrePreTX, "Minting 500k");
await API.broadcastTXraw(mintRaw, network);

// -- Transfer (inherited from FT, same as FT.transfer) --
const coinInfo = await API.fetchFtInfo(coin.contractTxid, network);
coin.initialize(coinInfo);
const ftutxo_codeScript = FT.buildFTtransferCode(coin.codeScript, addressA).toBuffer().toString("hex");
const ftutxos = await API.fetchFtUTXOs(coin.contractTxid, addressA, ftutxo_codeScript, network);
let preTXs: tbc.Transaction[] = [];
let prepreTxData: string[] = [];
for (let i = 0; i < ftutxos.length; i++) {
    preTXs.push(await API.fetchTXraw(ftutxos[i].txId, network));
    prepreTxData.push(await API.fetchFtPrePreTxData(preTXs[i], ftutxos[i].outputIndex, network));
}
const transferRaw = coin.transfer(privateKeyA, addressB, 1000, ftutxos, utxo, preTXs, prepreTxData);
await API.broadcastTXraw(transferRaw, network);

// -- Merge coin UTXOs --
const mergeRaws = coin.mergeCoin(privateKeyA, utxo, ftutxos, preTXs, prepreTxData);
await API.broadcastTXsraw(mergeRaws, network);

// -- Freeze coin UTXO with locktime --
const frozenRaw = coin.frozenCoinUTXO(privateKeyAdmin, ftutxos[0], utxo, preTXs[0], prepreTxData[0], 1000000);
await API.broadcastTXraw(frozenRaw, network);
```

---

## 19. PiggyBank (TBC Time-Lock Freeze)

```typescript
const lockTime = 1000000; // block height when funds unlock

// -- Freeze TBC (two-phase: build raw, sign externally) --
const freezeRaw = piggyBank.freezeTBC(addressA, 10, lockTime, utxos);
// ... sign externally and broadcast

// -- Freeze TBC (direct with private key) --
const freezeTx = piggyBank._freezeTBC(privateKeyA, 10, lockTime, utxos);
await API.broadcastTXraw(freezeTx, network);

// -- Check lock time of frozen UTXO --
const frozenUtxos = await API.fetchFrozenUTXOList(addressA, network);
for (const utxo of frozenUtxos) {
    const lt = piggyBank.fetchTBCLockTime(utxo);
    console.log(`UTXO ${utxo.txId}:${utxo.outputIndex} locked until block ${lt}`);
}

// -- Unfreeze TBC (after lockTime block height reached) --
const unfreezeTx = await piggyBank._unfreezeTBC(privateKeyA, frozenUtxos, network);
await API.broadcastTXraw(unfreezeTx, network);

// -- Check frozen balance --
const frozenBalance = await API.fetchFrozenTBCBalance(addressA, network);
console.log(`Frozen: ${frozenBalance} TBC`);
```

---

## 20. NFT Transfer with TBC Payment

```typescript
const nft = new NFT(nftContractId);
const nftInfo = await API.fetchNFTInfo(nft.contract_id, network);
nft.initialize(nftInfo);

const pre_tx = await API.fetchTXraw(nftUtxo.txId, network);
const pre_pre_tx = await API.fetchTXraw(/* previous tx */, network);

// Transfer NFT to addressB AND send 5 TBC to addressC in one transaction
const transferRaw = nft.transferNFTWithTBC(
    addressA,        // from
    addressB,        // NFT recipient
    addressC,        // TBC recipient (can be same or different)
    privateKeyA,
    utxos,
    pre_tx,
    pre_pre_tx,
    5                // TBC amount
);
await API.broadcastTXraw(transferRaw, network);
```

---

## 21. FT Transfer with Additional Info

```typescript
const ft = new FT(ftContractTxid);
const ftInfo = await API.fetchFtInfo(ft.contractTxid, network);
ft.initialize(ftInfo);

const ftutxo_codeScript = FT.buildFTtransferCode(ft.codeScript, addressA).toBuffer().toString("hex");
const ftutxos = await API.fetchFtUTXOs(ft.contractTxid, addressA, ftutxo_codeScript, network);
let preTXs: tbc.Transaction[] = [];
let prepreTxData: string[] = [];
for (let i = 0; i < ftutxos.length; i++) {
    preTXs.push(await API.fetchTXraw(ftutxos[i].txId, network));
    prepreTxData.push(await API.fetchFtPrePreTxData(preTXs[i], ftutxos[i].outputIndex, network));
}

// Transfer FT with extra OP_RETURN data (e.g. invoice ID, memo)
const additionalInfo = Buffer.from(JSON.stringify({ invoiceId: "INV-2026-001", note: "Payment" }));
const txraw = ft.transferWithAdditionalInfo(
    privateKeyA, addressB, 100, ftutxos, utxo, preTXs, prepreTxData, additionalInfo
);
await API.broadcastTXraw(txraw, network);
```

---

## 16. Utility: buildUTXO

```typescript
// From a transaction output:
const ftutxo = buildUTXO(tx, 0, true);   // true = FT UTXO
const tbcutxo = buildUTXO(tx, 2, false);  // false = TBC UTXO

// Manual UTXO:
const utxo: tbc.Transaction.IUnspentOutput = {
    txId: "txid_hex",
    outputIndex: 0,
    satoshis: 10000,
    script: "script_hex",
};
```
