# TBC API 完整文档

**主网**: `https://api.turingbitchain.io/api/tbc/`
**测试网**: `https://api.tbcdev.org/api/tbc/`

> 以下 URL 中的前缀 `https://api.turingbitchain.io` 为主网地址。测试网替换为 `https://api.tbcdev.org`。

---

[TOC]

# 查询指定地址在指定合约下的Ft余额

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/tokenbalance/address/{address}/contract/{contract_id} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|contract_id |是  |string | 合约id    |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"combine_script": "0baddd8222debc5e4229f4291004e31d771398e700",
			"contract_id": "a2d772d61afeac6b719a74d87872b9bbe847aa21b41a9473db066eabcddd86f3",
			"decimal": 6,
			"balance": 84574813216,
    		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|combine_script |string   |组合脚本|
|contract_id |string   |合约id|
|decimal |int   |小数数位|
|balance |int64   |代币余额|



#查询指定组合脚本在指定合约下的Ft余额

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/tokenbalance/combinescript/{combine_script}/contract/{contract_id} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|combine_script |是  |string |组合脚本   |
|contract_id |是  |string | 合约id    |

##### 返回示例 
``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"combine_script": "0baddd8222debc5e4229f4291004e31d771398e700",
			"contract_id": "a2d772d61afeac6b719a74d87872b9bbe847aa21b41a9473db066eabcddd86f3",
			"decimal": 6,
			"balance": 84574813216,
    		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|combine_script |string   |组合脚本|
|contract_id |string   |合约id|
|decimal |int   |小数数位|
|balance |int64   |代币余额|





#查询指定地址在指定合约下的UTXO

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/utxo/address/{address}/contract/{contract_id} `
  
##### 请求方式
- GET

带查询参数` https://api.turingbitchain.io/api/tbc/ft/utxo/address/{address}/contract/{contract_id} ?limit=10`

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|contract_id |是  |string | 合约id    |
|limit |是  |int |返回utxo数量   |

##### 返回示例 

``` 
{
    "code": "200",
    "data": {
		"totalcount": 2,
        "utxos": [
            {
                "txid": "8dd3df21c6b73c0ae417bdd42dce078a7b8304bea4ab1e8d0e579b9c50591395",
                "index": 0,
                "ftvalue": 3000000,
                "tbcvalue": 500,
                "height": 136432,
                "decimal": 6
            },
            {
                "txid": "8dd3df21c6b73c0ae417bdd42dce078a7b8304bea4ab1e8d0e579b9c50591395",
                "index": 2,
                "ftvalue": 18000000,
                "tbcvalue": 500,
                "height": 136432,
                "decimal": 6
            }
        ]
    },
    "message": "OK"
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|totalcount |int   |utxo总数|
|txid |string   |txid|
|height |int   |高度|
|index |int   |序号|
|ftvalue |int64   |ft值|
|tbcvalue |int64   |tbc值|
|decimal |int   |小数数位|





#查询指定组合脚本在指定合约下的UTXO

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/utxo/combinescript/{combine_script}/contract/{contract_id} `
  
##### 请求方式
- GET

带查询参数` https://api.turingbitchain.io/api/tbc/ft/utxo/address/{address}/contract/{contract_id} ?limit=10`

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|combine_script |是  |string |组合脚本   |
|contract_id |是  |string | 合约id    |
|limit |是  |int |返回utxo数量   |

##### 返回示例 
``` 
{
    "code": "200",
	"message": "OK"
    "data": {
		"totalcount": 2,
        "utxos": [
            {
                "txid": "8dd3df21c6b73c0ae417bdd42dce078a7b8304bea4ab1e8d0e579b9c50591395",
                "index": 0,
                "ft_value": 3000000,
                "tbc_value": 500,
                "height": 136432,
                "decimal": 6
            },
            {
                "txid": "8dd3df21c6b73c0ae417bdd42dce078a7b8304bea4ab1e8d0e579b9c50591395",
                "index": 2,
                "ft_value": 18000000,
                "tbc_value": 500,
                "height": 136432,
                "decimal": 6
            }
        ]
    },
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|totalcount |int   |utxo总数|
|txid |string   |txid|
|height |int   |高度|
|index |int   |序号|
|ft_value |int64   |ft值|
|tbc_value |int64   |tbc值|
|decimal |int   |小数数位|



#分页返回指定地址在指定合约的历史记录

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/history/address/{address}/contract/{contract_id}/start/{start}/end/{end} `
  
##### 请求方式
- GET

请求的交易数据上限为500个

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|contract_id |是  |string | 合约id    |
|start |是  |int | 起始记录号    |
|end |是  |int | 截至记录号    |

##### 返回示例 

``` 
  {
    "code": 200,
	"message":"OK",
    "data": {
				"decimal": 6，
				"history_count": 7723,
				"history_list":[
					{
						"txid": "033d40efe05f5f267065b24cf30ec321e7212f5e739db03881b6ce41c1aa40c8",
						"height": 901600,
						"vin": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373080
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"vout": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373000
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"fee": 80,
						"confirmations": 137,
						"time": 1753095875
					},
					{
						"txid": "033d40efe05f5f267065b24cf30ec321e7212f5e739db03881b6ce41c1aa40c8",
						"height": 901600,
						"vin": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373080
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"vout": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373000
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"fee": 80,
						"confirmations": 137,
						"time": 1753095875
					}
				]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|decimal |int  |小数数位|
|history_count |int  |历史总数|
|txid |string   |交易id|
|height |int   |上块高度|
|address |string   |地址|
|value |int64   |ft金额|
|fee |int   |费用|
|confirmations |int   |确认数|
|time |int   |时间|


# 分页返回指定组合脚本在指定合约的历史记录

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/history/combinescript/{combine_script}/contract/{contract_id}/start/{start}/end/{end} `
  
##### 请求方式
- GET

请求的交易数据上限为500个

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|combine_script |是  |string |组合脚本   |
|contract_id |是  |string | 合约id    |
|start |是  |int | 起始记录号    |
|end |是  |int | 截至记录号    |

##### 返回示例 


``` 
  {
    "code": 200,
	"message":"OK",
    "data": {
				"decimal": 6，
				"history_count": 7723,
				"history_list":[
					{
						"txid": "033d40efe05f5f267065b24cf30ec321e7212f5e739db03881b6ce41c1aa40c8",
						"height": 901600,
						"vin": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373080
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"vout": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373000
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"fee": 80,
						"confirmations": 137,
						"time": 1753095875
					},
					{
						"txid": "033d40efe05f5f267065b24cf30ec321e7212f5e739db03881b6ce41c1aa40c8",
						"height": 901600,
						"vin": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373080
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"vout": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373000
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"fee": 80,
						"confirmations": 137,
						"time": 1753095875
					}
				]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|decimal |int  |小数数位|
|history_count |int  |历史总数|
|txid |string   |交易id|
|height |int   |上块高度|
|address |string   |地址|
|value |int64   |ft金额|
|fee |int   |费用|
|confirmations |int   |确认数|
|time |int   |时间|




#分页返回指定地址的所有ft交易历史记录

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/allhistory/address/{address}/start/{start}/end/{end} `
  
##### 请求方式
- GET

请求的交易数据上限为500个

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|start |是  |int | 起始记录号    |
|end |是  |int | 截至记录号    |

##### 返回示例 

``` 
  {
    "code": 200,
	"message":"OK",
    "data": {
				"history_count": 7723,
				"history_list":[
					{
						"txid": "033d40efe05f5f267065b24cf30ec321e7212f5e739db03881b6ce41c1aa40c8",
						"height": 901600,
						"vin": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373080
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"vout": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373000
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"fee": 80,
						"confirmations": 137,
						"time": 1753095875
					},
					{
						"txid": "033d40efe05f5f267065b24cf30ec321e7212f5e739db03881b6ce41c1aa40c8",
						"height": 901600,
						"vin": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373080
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"vout": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373000
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"fee": 80,
						"confirmations": 137,
						"time": 1753095875
					}
				]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|history_count |int  |历史总数|
|txid |string   |交易id|
|height |int   |上块高度|
|address |string   |地址|
|value |int64   |ft金额|
|fee |int   |费用|
|confirmations |int   |确认数|
|time |int   |时间|



# 分页返回指定组合脚本所有ft交易历史记录

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/allhistory/combinescript/{combine_script}/start/{start}/end/{end} `
  
##### 请求方式
- GET

请求的交易数据上限为500个

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|combine_script |是  |string |组合脚本   |
|start |是  |int | 起始记录号    |
|end |是  |int | 截至记录号    |

##### 返回示例 


``` 
  {
    "code": 200,
	"message":"OK",
    "data": {
				"history_count": 7723,
				"history_list":[
					{
						"txid": "033d40efe05f5f267065b24cf30ec321e7212f5e739db03881b6ce41c1aa40c8",
						"height": 901600,
						"vin": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373080
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"vout": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373000
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"fee": 80,
						"confirmations": 137,
						"time": 1753095875
					},
					{
						"txid": "033d40efe05f5f267065b24cf30ec321e7212f5e739db03881b6ce41c1aa40c8",
						"height": 901600,
						"vin": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373080
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"vout": [
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 1373000
							},
							{
								"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
								"value": 9920
							}
						],
						"fee": 80,
						"confirmations": 137,
						"time": 1753095875
					}
				]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|history_count |int  |历史总数|
|txid |string   |交易id|
|height |int   |上块高度|
|address |string   |地址|
|value |int64   |ft金额|
|fee |int   |费用|
|confirmations |int   |确认数|
|time |int   |时间|



#通过智能合约地址获取FT信息

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/info/contract/{contract_id} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|contract_id |是  |string | 合约id    |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"contract_id": "3aefe51f8ed06a2f41b100df128276b6983ed2890be63faaa69fc013468c882f",
			"code_script": "59796b51798255947f05465461706588537f587f587f587f587f587f587f7581760087646c76550128957f01287f756b756b687c81760087646c76540128957f01287f756b756b68937c81760087646c76530128957f01287f756b756b68937c81760087646c76520128957f01287f756b756b68937c81760087646c76510128957f01287f756b756b68937c81760087646c76000128957f01287f756b756b68936c756b756ba87e6c7e527952797e6b53796b6bbb7e7e6c7ea87e6ba86c7e7ea8a856ba01207f75886c517f7701147f517f758176008763755179a988ad6751885279a9886b7e6b7600886c6c7e7ea87e7e7ea8a87801207f547f7581008888a855ba88ad687652876375527952797e6b6bbb7e7e6c7ea87e7e7ea8a86c6c766c6c01247f75766b01207f75557a887287636c756b6b676c24271c6810c55e3cd0ede96f9f36b7384f7a912f3da78935903cebbd7f39598f0300000000886b6b68687652876375527952797e6b6bbb7e7e6c7ea87e7e7ea8a86c6c766c6c01207f75557a8872886b6b687652876375527952797e6b6bbb7e7e6c7ea87e7e7ea8a86c6c766c6c01207f75557a8872886b6b687652876375527952797e6b6bbb7e7e6c7ea87e7e7ea8a86c6c766c6c01207f75557a8872886b6b687652876375527952797e6b6bbb7e7e6c7ea87e7e7ea8a86c6c766c6c01207f75557a8872886b6b687652876375527952797e6b6bbb7e7e6c7ea87e7e7ea8a86c6c766c6c01207f75557a8872886b6b68765287008857886c6c7c6b6b6b7652876375768276014f876355947f05465461706588537f7c756c765895527a7c7f587f7581760087646c6c76597959797e886b6b686c7c946b756ba87e6bbb6c7e7e6c6c6c537a6b6b6b6b6775014f876352798255947f0546546170658700887568bb7e6c6c6c537a6b6b6b6b68687652876375768276014f876355947f05465461706588537f7c756c765895527a7c7f587f7581760087646c6c76597959797e886b6b686c7c946b756ba87e6bbb6c7e7e6c6c6c537a6c7e6b6b6b6b6775014f876352798255947f0546546170658700887568bb7e6c6c6c537a6c7e6b6b6b6b68687652876375768276014f876355947f05465461706588537f7c756c765895527a7c7f587f7581760087646c6c76597959797e886b6b686c7c946b756ba87e6bbb6c7e7e6c6c6c537a6c7e6b6b6b6b6775014f876352798255947f0546546170658700887568bb7e6c6c6c537a6c7e6b6b6b6b68687652876375768276014f876355947f05465461706588537f7c756c765895527a7c7f587f7581760087646c6c76597959797e886b6b686c7c946b756ba87e6bbb6c7e7e6c6c6c537a6c7e6b6b6b6b6775014f876352798255947f0546546170658700887568bb7e6c6c6c537a6c7e6b6b6b6b68687652876375768276014f876355947f05465461706588537f7c756c765895527a7c7f587f7581760087646c6c76597959797e886b6b686c7c946b756ba87e6bbb6c7e7e6c6c6c537a6c7e6b6b6b6b6775014f876352798255947f0546546170658700887568bb7e6c6c6c537a6c7e6b6b6b6b68687652876375768276014f876355947f05465461706588537f7c756c765895527a7c7f587f7581760087646c6c76597959797e886b6b686c7c946b756ba87e6bbb6c7e7e6c6c6c537a6c7e6b6b6b6b6775014f876352798255947f0546546170658700887568bb7e6c6c6c537a6c7e6b6b6b6b68687652876375768276014f876355947f05465461706588537f7c756c765895527a7c7f587f7581760087646c6c76597959797e886b6b686c7c946b756ba87e6bbb6c7e7e6c6c6c537a6c7e6b6b6b6b6775014f876352798255947f0546546170658700887568bb7e6c6c6c537a6c7e6b6b6b6b68687652876375768276014f876355947f05465461706588537f7c756c765895527a7c7f587f7581760087646c6c76597959797e886b6b686c7c946b756ba87e6bbb6c7e7e6c6c6c537a6c7e6b6b6b6b6775014f876352798255947f0546546170658700887568bb7e6c6c6c537a6c7e6b6b6b6b686876528700886c6c00887551886c6ca857ba877717ffffffffffffffffffffffffffffffffffffffffffffff756a15d21f9ee20f8fe76e23ae956e495cf3a9cfc10273000532436f6465",
			"tape_script": "006a300040075af0750700000000000000000000000000000000000000000000000000000000000000000000000000000000000106095370616365446f6765095370616365446f6765054654617065",
			"amount": 2100000000.0,
			"decimal": 6,
			"name": "SpaceDoge",
			"symbol": "SpaceDoge",
			"creator_combine_script": "d21f9ee20f8fe76e23ae956e495cf3a9cfc1027300",
			"create_timestamp": 1748426020,
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|code_script |string   |code脚本|
|tape_script |string   |tape脚本|
|amount |int64   |ft总数|
|decimal |int   |小数位|
|name |string   |ft名称|
|symbol |string   |简称|
|creator_combine_script |string   |创建者的组合脚本|
|create_timestamp |int   |创建时间|







#解析FT交易

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/decode/txid/{txid} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|txid |是  |string | 交易id    |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
				"txid": "c494d97cc4d57ef40e3fd253fd7cc0b17a72f7da5a11daf6d66ee9058d439c02",
				"contract_id": "a2d772d61afeac6b719a74d87872b9bbe847aa21b41a9473db066eabcddd86f3",
				"decimal": 6
				"input": [
					{
						"txid": "0a2540378c9b95b45c26d4a7a1dd7715991324da044fdcf8fc32d573923c9cbe",
						"vout": 2,
						"address": "14J7WJiw35CjkkxwzmK4YrxkmywvBye3ot",
						"balance": 1259684500000000,
					}
				],
				"output": [
					{
						"txid": "c494d97cc4d57ef40e3fd253fd7cc0b17a72f7da5a11daf6d66ee9058d439c02",
						"vout": 0,
						"address": "1Uyh1H2Bq8UYMmZ34RWXtbx44SuDH7oVb",
						"balance": 300000000000,
					},
					{
						"txid": "c494d97cc4d57ef40e3fd253fd7cc0b17a72f7da5a11daf6d66ee9058d439c02",
						"vout": 2,
						"address": "14J7WJiw35CjkkxwzmK4YrxkmywvBye3ot",
						"balance": 1259384500000000,
					}
				]
			}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|txid |string   |交易id|
|contract_id |string   |合约id|
|decimal |int   |小数位|
|vout |int   |序号|
|address |string   |地址|
|balance |int64   |值|








#获取地址持有的代币列表

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/tokenlist/address/{address} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string | 地址    |

##### 返回示例 

``` 
 {
    "code": "200",
    "message": "OK",
    "data": {
        "address": "1CnbPfkwN6DcLVqwGfwq1SFzUfbbEdJAmm",
        "count": 1,
        "token_list": [
            {
                "contract_id": "ad36b2fca407be3449418ba46550d641c4a004f55b201bbf4b8b267b0905c40b",
                "decimal": 6,
                "balance": 21000000,
                "name": "blake",
                "symbol": "blakeya"
            }
        ]
    }
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|address |string   |地址|
|count |int   |token总数|
|contract_id |string   |合约id|
|decimal |int   |小数位|
|balance |int64   |值|
|name |string   |名称|
|symbol |string   |简称|





#获取组合脚本持有的代币列表

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/tokenlist/combinescript/{combine_script} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|combine_script |是  |string | 组合脚本    |

##### 返回示例 

``` 
 {
    "code": "200",
    "message": "OK",
    "data": {
        "address": "1CnbPfkwN6DcLVqwGfwq1SFzUfbbEdJAmm",
        "count": 1,
        "token_list": [
            {
                "contract_id": "ad36b2fca407be3449418ba46550d641c4a004f55b201bbf4b8b267b0905c40b",
                "decimal": 6,
                "balance": 21000000,
                "name": "blake",
                "symbol": "blakeya"
            }
        ]
    }
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|combine_script |string   |组合脚本|
|count |int   |token总数|
|contract_id |string   |合约id|
|decimal |int   |小数位|
|balance |int64   |值|
|name |string   |名称|
|symbol |string   |简称|


 

#分页返回指定合约的持币人排行

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/ft/rank/contract/{contract_id}/start/{start}/end/{end} `
  
##### 请求方式
- GET

请求的交易数据上限为500个

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|contract_id |是  |string | 合约id    |
|start |是  |int | 起始index    |
|end |是  |int | 结束index    |

##### 返回示例 

``` 
 {
    "code": "200",
    "message": "OK",
    "data": {
				"contract_id": "a74f08e9251cf9e87e6e1a4b39a7f1758bb8d4013f09edc59ad03e90beea783d",
				"decimal": 6,
				"holders_count": 1517,
				"holder_rank": [
					{
						"address": "1KnQcDNmrnrv9VrTrGHC2S2RsrDZBALd5P",
						"balance": 42000000000000,
						"rank": 1,
						"hold_ratio": 0.2
					},
					{
						"address": "contract_id_42742e24f7d788d478fe1dd0be1cf273a991432501",
						"balance": 30334539740151,
						"rank": 2,
						"hold_ratio": 0.1445
					}
				]
			}
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|contract_id |string   |合约id|
|decimal |int   |小数位|
|holders_count |int   |持有数|
|address |string   |地址|
|balance |int64   |值|
|rank |int   |排名|
|hold_ratio |float   |持有占比|
[TOC]

#健康检查
##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/health`
  
##### 请求方式
- get

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"status": "Turing API is running."
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|status |string   |是否有效|

#广播交易
##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/broadcasttx`
  
##### 请求方式
- post
```
{
  "txraw": "0100000001a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890000000006a47304402..."
}
```

##### 返回示例 
######成功时返回
``` 
{
    "code": "200",
    "message": "OK",
    "data": {
        "txid": "92f2de951d01b81a44c1121f42eb63c9d0c490456e0f27530a642f6ec98c5f43"
    }
}
```
######失败时返回
``` 
{
    "code": "400",
    "message": "broadcast transaction failed",
    "data": {
        "error": "Transaction already in the mempool;"
    }
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|txid |string   |广播成功的txid|


#批量广播交易
##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/broadcasttxs`
  
##### 请求方式
- post
```
[
	{  
		"txraw": "0a00000002be7aa9d0c84db3c652aaa8f48659a3d3098e0d39239e6656073c1d07ed920873000000006b483045022100a7c1e2077d18e305cc434133a87d198bdc3d8ad9127bf4a1ee0982688c7eb32e02203f65409901ab31513848c655124309fc3e6f587df9a46194fc13de27da93bd1e412103a82d871a085b7dc723a18b8550a73c25217305977f5c4cf4ec375d0625478747ffffffffbe7aa9d0c84db3c652aaa8f48659a3d3098e0d39239e6656073c1d07ed920873010000006b483045022100db09135a5bcd58f3016cff0b9c7ede7243fb290ac900599904b7c22b90e655b9022060a3053a6f74f5148bb82f4eab1782d588513e5ddd8ab060b17f1aecbf171786412103a82d871a085b7dc723a18b8550a73c25217305977f5c4cf4ec375d0625478747ffffffff0200e87648170000001976a9147a8f15d33528937e563bb2b3843a2185e09c3a8788ac90d07648170000001976a9147a8f15d33528937e563bb2b3843a2185e09c3a8788ac00000000"
	},
	{  
		"txraw": "0a00000004568db970e5920367c4d741db4d257a1cff7b91c678bae7dd2c763df19a3e801e010000006a4730440220546445b98ebe2d1f939dd7f5f0d75109f6c2c183210c3052502f84e6527e4f9c02200b69f80ff6137da14dddf46d5f3c0ce42d9f0fd75fe8516ff0a89328f57adde04121022dc251e196b09e0a30cf5492f7ff6a138081545facd81022ec0eabda14355730ffffffff9306bf548d96fa26dc78464d99f62c80310e79c0d348643f6ae701315c9c3cd5010000006b483045022100b754e042742dfabf0d8befbefbabef7dc83ca092e38a4fbc5b2aba6b8306045c0220493eb4a0725fa89a21fe8d181346dce0ce7cdfbdfc7a16d4662e13b4cf52df714121022dc251e196b09e0a30cf5492f7ff6a138081545facd81022ec0eabda14355730ffffffff08515c8bfe6a306b3aa341d37a2e10741b7747e2ba41aeddeff2811a7be7ce89010000006b48304502210098f2e463a0f11d449519813171c586fec89e67a345ef5c49d080ec126b68551d02200bfdd58758cd8c3a88a1fc5ff7d988cb5048b47e67c1a9a78ef7c52ca221fe724121022dc251e196b09e0a30cf5492f7ff6a138081545facd81022ec0eabda14355730ffffffffdc753168f43a19ceeb2607f77756531c278fde28c0699ff775d3eadd944e8b98010000006b483045022100cfb963a2f4769351698b9100eb8c8feaf7aba8b62610510d3a201e66eee0131d0220532c218f27eaeaceb8085a5dc28069ed45fb805301380ecceedc52f840b3191e4121022dc251e196b09e0a30cf5492f7ff6a138081545facd81022ec0eabda14355730ffffffff0200e87648170000001976a9142158ccfe3dc673b74e67c1ffd77842fd8bc4361c88acd458b1df5a0000001976a9142158ccfe3dc673b74e67c1ffd77842fd8bc4361c88ac00000000"
	}
]
```

##### 返回示例 
###### 成功时返回 
``` 
{
    "code": "200",
    "message": "OK",
    "data": {
        "results": [
            {
                "txid": "2a2c2db97aa0f515d37e47bb211a7d42d033a8479ac1d835489db6fce5476b5b"
            },
            {
                "txid": "1763eedf1db330f2cf92c5e802769a80a5a6125b336b1072ac2b43330465af2d"
            }
        ],
        "success": 2,
        "failed": 0
    }
}
```

###### 失败时返回 
``` 
{
    "code": "400",
    "message": "partial failure: 1 succeeded, 1 failed",
    "data": {
        "results": [
            {
                "txid": "fc33b17d9e018d3ac3ca2ce030395a520fd012069c13e341e6e02313f0f6ef6c"
            },
            {
                "error": "transaction already exists in mempool"
            }
        ],
        "success": 1,
        "failed": 1
    }
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|txid |string   |广播成功的txid|
|success |int   |成功个数|
|failed |int   |成功个数|




# 返回该地址基本信息（验证地址有效性）

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/addressinfo/address/{address} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
				"isValid": true,
				"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
				"scriptPubkey": "76a914f3b17f09913fcbd542db8afb03e732aa4ea59b6c88ac",
				"isScript": false
			}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|isValid |bool   |是否有效|
|address |string   |地址|
|scriptPubkey |string   |公钥脚本|
|isScript |bool   |是否为脚本地址|


# 返回地址余额

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/balance/address/{address} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
				"address": "1BqJ3zWFfbagnvHgPsAskz3pARqK7zrAaF",
				"confirmedBalance": 0,
				"unconfirmedBalance": 0,
				"balance": 406250000
			}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|address |string   |地址|
|confirmedBalance |int64   |确认余额|
|unconfirmedBalance |int64   |未确认余额|
|balance |int64   |余额|


# 返回地址UTXO

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/utxo/address/{address}`
  
##### 请求方式
- GET

若带查询参数如` https://api.turingbitchain.io/api/tbc/utxo/address/{address}?limit=10`，即限制只返回10个utxo。

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|limit |是  |string |返回utxo数量   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
     "data": {
	    "totalcount": 1,
        "utxos": [
            {
                "txid": "666a860f2af836985ea01ef20dbe7d0f012e6a399eaf2b8c997497c35c701f06",
                "height": 824190,
                "index": 1,
                "value": 406250000
            }
        ]
    }
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|totalcount |int   |utxo总数|
|txid |string   |交易id|
|height |int   |高度|
|index |int   |序号|
|value |int64   |余额|


# 分页返回地址交易记录

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/history/address/{address}/start/{start}/end/{end} `
  
##### 请求方式
- GET

请求的交易数据上限为500个

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
     "data": {
		 "history_count": 231,
         "history_list":[
							{
								"txid": "695dfdedf83a507866bf7c9b7dc2e28419013d1bae2e290dac77a780fc3cd272",
								"height": 901995,
								"vin": [
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 1373000
									},
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 9920
									}
								],
								"vout": [
									{
										"address": "1wXbh7EakK7MJd8pWbcfchCyaB7n9MUqk",
										"value": 100000
									},
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 1282840
									}
								],
								"fee": 80,
								"confirmations": 128,
								"time": 1753340990
							},
							{
								"txid": "8ce55e040ca0dffa15371e4122c7993f561a76a78e3ce191d32c3ebfe175cd9e",
								"height": 901600,
								"vin": [
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 1373080
									},
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 9920
									}
								],
								"vout": [
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 1373000
									},
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 9920
									}
								],
								"fee": 80,
								"confirmations": 523,
								"time": 1753095875
							}
						]
    }
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|history_count |int  |历史总数|
|txid |string   |交易id|
|height |int   |高度|
|address |string   |地址|
|value |int   |tbc值|
|fee |int   |费用(satoshi为单位)|
|confirmations |int   |确认数|
|time |int   |时间|



# 分页返回指定脚本哈希的交易记录

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/history/scriptpubkeyhash/{scriptpubkeyhash}/start/{start}/end/{end} `
  
##### 请求方式
- GET

请求的交易数据上限为500个

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|scriptpubkeyhash |是  |string |脚本   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
     "data": {
         "history_list":[
							{
								"txid": "695dfdedf83a507866bf7c9b7dc2e28419013d1bae2e290dac77a780fc3cd272",
								"height": 901995,
								"vin": [
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 1373000
									},
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 9920
									}
								],
								"vout": [
									{
										"address": "1wXbh7EakK7MJd8pWbcfchCyaB7n9MUqk",
										"value": 100000
									},
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 1282840
									}
								],
								"fee": 80,
								"confirmations": 128,
								"time": 1753340990
							},
							{
								"txid": "8ce55e040ca0dffa15371e4122c7993f561a76a78e3ce191d32c3ebfe175cd9e",
								"height": 901600,
								"vin": [
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 1373080
									},
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 9920
									}
								],
								"vout": [
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 1373000
									},
									{
										"address": "1PDXqGePWCpTQTMypzNewY39FfW8gsCrvW",
										"value": 9920
									}
								],
								"fee": 80,
								"confirmations": 523,
								"time": 1753095875
							}
						]
    }
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|txid |string   |交易id|
|height |int   |高度|
|address |string   |地址|
|value |int   |tbc值|
|fee |int   |费用(satoshi为单位)|
|confirmations |int   |确认数|
|time |int   |时间|


# 根据脚本哈希返回地址UTXO

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/utxo/scriptpubkeyhash/{scriptpubkeyhash} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|scriptpubkeyhash |是  |string |脚本   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
     "data": {
        "utxos": [
            {
                "txid": "666a860f2af836985ea01ef20dbe7d0f012e6a399eaf2b8c997497c35c701f06",
                "height": 824190,
                "index": 1,
                "value": 406250000
            }
        ]
    }
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|txid |string   |交易id|
|height |int   |高度|
|index |int   |序号|
|value |int   |tbc值|










# 根据区块高度获取区块详细信息

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/blockByHeight/height/{height} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|height |是  |int |高度   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
     "data": {
				"bits": "1d00e0ff",
				"coinbase":"\u0003\ufffd\f",
				"coinbasefee": 0,
				"coinbaseinfo": "A3+TDA==",
				"coinbasereward": 625000000,
				"coinbasetxid": "f2df5fd72967b2197ef2671161b6bf8d74a51c129620ceeb928a2fc3ca63a710",
				"confirmations": 76970,
				"difficulty": 1.137780169794614,
				"hash": "00000000741ce17614ba9283ce49dd43c8c46d174144c9e51cc05540696c67a7",
				"height": 824191,
				"merkleroot": "f2df5fd72967b2197ef2671161b6bf8d74a51c129620ceeb928a2fc3ca63a710",
				"nexthash": "00000000906eb6c801d3b27ac4047372bd13af6317bdf43eee6b2a5323738d91",
				"nonce": 1662092452,
				"previoushash": "0000000058968601042df9b0d57e41b092c76d6f91f333dc231cdd4cc4fd861d",
				"reward": -625000000,
				"size": 389,
				"time": 1708358793,
				"tx": [
					"f2df5fd72967b2197ef2671161b6bf8d74a51c129620ceeb928a2fc3ca63a710"
				],
				"txcnt": 1,
				"version": 536870912,
				"versionhex": "20000000",
			}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|bits |string   |区块难度目标（压缩格式|
|coinbase |string   |Coinbase交易的输入脚本（Unicode编码）|
|coinbasefee |int   |区块内交易手续费总和|
|coinbaseinfo |string   |Coinbase交易中的自定义数据（Base64编码）|
|coinbasereward |int   |区块奖励|
|coinbasetxid |string   |Coinbase交易的交易ID|
|confirmations |int   |区块确认数|
|difficulty |float   |当前挖矿难度系数|
|hash |string   |区块哈希|
|height |int   |区块高度|
|merkleroot |string   |区块中所有交易的默克尔树根哈希|
|nexthash |string   |下一个区块的哈希|
|nonce |int   |矿工计算的随机数|
|previoushash |string   |前一个区块的哈希|
|reward |int   |系统角度的区块奖励|
|size |int   |区块大小|
|time |int   |区块时间戳|
|tx |array   |区块包含的所有交易ID列表|
|txcnt |int   |区块中的交易数量|
|version |int   |区块版本号|
|versionhex |string   |区块版本号的十六进制表示|













# 根据区块hash值获取区块信息


##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/blockByHash/hash/{hash} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|hash |是  |string |区块hash   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
     "data": {
				"bits": "1d00e0ff",
				"coinbase":"\u0003\ufffd\f",
				"coinbasefee": 0,
				"coinbaseinfo": "A3+TDA==",
				"coinbasereward": 625000000,
				"coinbasetxid": "f2df5fd72967b2197ef2671161b6bf8d74a51c129620ceeb928a2fc3ca63a710",
				"confirmations": 76970,
				"difficulty": 1.137780169794614,
				"hash": "00000000741ce17614ba9283ce49dd43c8c46d174144c9e51cc05540696c67a7",
				"height": 824191,
				"merkleroot": "f2df5fd72967b2197ef2671161b6bf8d74a51c129620ceeb928a2fc3ca63a710",
				"nexthash": "00000000906eb6c801d3b27ac4047372bd13af6317bdf43eee6b2a5323738d91",
				"nonce": 1662092452,
				"previoushash": "0000000058968601042df9b0d57e41b092c76d6f91f333dc231cdd4cc4fd861d",
				"reward": -625000000,
				"size": 389,
				"time": 1708358793,
				"tx": [
					"f2df5fd72967b2197ef2671161b6bf8d74a51c129620ceeb928a2fc3ca63a710"
				],
				"txcnt": 1,
				"version": 536870912,
				"versionhex": "20000000",
			}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|bits |string   |区块难度目标（压缩格式|
|coinbase |string   |Coinbase交易的输入脚本（Unicode编码）|
|coinbasefee |int   |区块内交易手续费总和|
|coinbaseinfo |string   |Coinbase交易中的自定义数据（Base64编码）|
|coinbasereward |int   |区块奖励|
|coinbasetxid |string   |Coinbase交易的交易ID|
|confirmations |int   |区块确认数|
|difficulty |float   |当前挖矿难度系数|
|hash |string   |区块哈希|
|height |int   |区块高度|
|merkleroot |string   |区块中所有交易的默克尔树根哈希|
|nexthash |string   |下一个区块的哈希|
|nonce |int   |矿工计算的随机数|
|previoushash |string   |前一个区块的哈希|
|reward |int   |系统角度的区块奖励|
|size |int   |区块大小|
|time |int   |区块时间戳|
|tx |array   |区块包含的所有交易ID列表|
|txcnt |int   |区块中的交易数量|
|version |int   |区块版本号|
|versionhex |string   |区块版本号的十六进制表示|






# 分页查询最新的区块信息


##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/recentblocks/start/{start}/end/{end}  `
  
##### 请求方式
- GET

一次性请求数量上限为10个，即start跟end差值上限为10

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|start |是  |int |起始序号   |
|end |是  |int |截至序号   |



##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
     "data":     [
					{
						"bits": "1d00e0ff",
						"coinbase":"\u0003\ufffd\f",
						"coinbasefee": 0,
						"coinbaseinfo": "A3+TDA==",
						"coinbasereward": 625000000,
						"coinbasetxid": "f2df5fd72967b2197ef2671161b6bf8d74a51c129620ceeb928a2fc3ca63a710",
						"confirmations": 1,
						"difficulty": 1.137780169794614,
						"hash": "00000000741ce17614ba9283ce49dd43c8c46d174144c9e51cc05540696c67a7",
						"height": 824191,
						"merkleroot": "f2df5fd72967b2197ef2671161b6bf8d74a51c129620ceeb928a2fc3ca63a710",
						"nexthash": "00000000906eb6c801d3b27ac4047372bd13af6317bdf43eee6b2a5323738d91",
						"nonce": 1662092452,
						"previoushash": "0000000058968601042df9b0d57e41b092c76d6f91f333dc231cdd4cc4fd861d",
						"reward": -625000000,
						"size": 389,
						"time": 1708358793,
						"txcnt": 1,
						"version": 536870912,
						"versionhex": "20000000",
					},
					{
						"bits": "1d00e0ff",
						"coinbase":"\u0003\ufffd\f",
						"coinbasefee": 0,
						"coinbaseinfo": "A3+TDA==",
						"coinbasereward": 625000000,
						"coinbasetxid": "f2df5fd72967b2197ef2671161b6bf8d74a51c129620ceeb928a2fc3ca63a710",
						"confirmations": 2,
						"difficulty": 1.137780169794614,
						"hash": "00000000741ce17614ba9283ce49dd43c8c46d174144c9e51cc05540696c67a7",
						"height": 824191,
						"merkleroot": "f2df5fd72967b2197ef2671161b6bf8d74a51c129620ceeb928a2fc3ca63a710",
						"nexthash": "00000000906eb6c801d3b27ac4047372bd13af6317bdf43eee6b2a5323738d91",
						"nonce": 1662092452,
						"previoushash": "0000000058968601042df9b0d57e41b092c76d6f91f333dc231cdd4cc4fd861d",
						"reward": -625000000,
						"size": 389,
						"time": 1708358793,
						"txcnt": 1,
						"version": 536870912,
						"versionhex": "20000000",
					}
				]
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|bits |string   |区块难度目标（压缩格式)|
|coinbase |string   |Coinbase交易的输入脚本（Unicode编码）|
|coinbasefee |int   |区块内交易手续费总和|
|coinbaseinfo |string   |Coinbase交易中的自定义数据（Base64编码）|
|coinbasereward |int   |区块奖励|
|coinbasetxid |string   |Coinbase交易的交易ID|
|confirmations |int   |区块确认数|
|difficulty |float   |当前挖矿难度系数|
|hash |string   |区块哈希|
|height |int   |区块高度|
|merkleroot |string   |区块中所有交易的默克尔树根哈希|
|nexthash |string   |下一个区块的哈希|
|nonce |int   |矿工计算的随机数|
|previoushash |string   |前一个区块的哈希|
|reward |int   |系统角度的区块奖励|
|size |int   |区块大小|
|time |int   |区块时间戳|
|txcnt |int   |区块中的交易数量|
|version |int   |区块版本号|
|versionhex |string   |区块版本号的十六进制表示|














# 根据区块hash分页获取交易数据


##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/txbyblockhash/blockhash/{blockhash}/start/{start}/end/{end}  `
  
##### 请求方式
- GET

请求的交易数据上限为500个

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|blockhash |是  |string |区块hash   |
|start |是  |int |起始序号   |
|end |是  |int |截至序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
     "data":    {
					"coinbase_txid": "41193126204080d7ec2e26cb6df4b95182dbf19f71046edf54ff903fbb17d33e",
					"coinbase": "A5STDA==",
					"txs": [
						{
							"txid": "41193126204080d7ec2e26cb6df4b95182dbf19f71046edf54ff903fbb17d33e",
							"height": 824212,
							"vin": [
								{
									"address": "coinbase",
									"value": 0
								}
							],
							"vout": [
								{
									"address": "",
									"value": 218750000
								},
								{
									"address": "1BqJ3zWFfbagnvHgPsAskz3pARqK7zrAaF",
									"value": 406250000
								}
							],
							"fee": -625000000,
							"confirmations": 0,
							"time": 1708371034
						}
					]
				}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|coinbase_txid |string   |Coinbase交易的交易ID|
|coinbase |string   |Coinbase交易的输入脚本（Unicode编码）|
|txid |string   |交易hash|
|height |int   |区块高度|
|address |string   |地址|
|value |int   |tbc值|
|fee |int   |费用|
|confirmations |int   |区块确认数|
|time |int   |区块时间戳|



# 根据区块高度分页获取交易数据
##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/txbyblockheight/height/{height}/start/{start}/end/{end}  `
  
##### 请求方式
- GET

请求的交易数据上限为500个

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|height |是  |int |height   |
|start |是  |int |起始序号   |
|end |是  |int |截至序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
     "data":    {
					"coinbase_txid": "41193126204080d7ec2e26cb6df4b95182dbf19f71046edf54ff903fbb17d33e",
					"coinbase": "A5STDA==",
					"txs": [
						{
							"txid": "41193126204080d7ec2e26cb6df4b95182dbf19f71046edf54ff903fbb17d33e",
							"height": 824212,
							"vin": [
								{
									"address": "coinbase",
									"value": 0
								}
							],
							"vout": [
								{
									"address": "",
									"value": 218750000
								},
								{
									"address": "1BqJ3zWFfbagnvHgPsAskz3pARqK7zrAaF",
									"value": 406250000
								}
							],
							"fee": -625000000,
							"confirmations": 0,
							"time": 1708371034
						}
					]
				}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|coinbase_txid |string   |Coinbase交易的交易ID|
|coinbase |string   |Coinbase交易的输入脚本（Unicode编码）|
|txid |string   |交易hash|
|height |int   |区块高度|
|address |string   |地址|
|value |int   |tbc值|
|fee |int   |费用|
|confirmations |int   |区块确认数|
|time |int   |区块时间戳|








# 返回内存池信息




##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/mempoolinfo  `
  
##### 请求方式
- GET


##### 返回示例 

``` 
 {
    "code": 200,
    "message": "ok",
    "data": {
        "size": 11,
        "bytes": 51886,
        "usage": 66160,
        "maxmempool": 6000000000,
        "mempoolminfee": 0
    }
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|size |int   |当前内存池中未确认交易的总数量|
|bytes |int   |内存池中所有交易占用的原始数据大小|
|usage |int   |内存池实际消耗的内存|
|maxmempool |int   |内存池最大允许的内存占用|
|mempoolminfee |float   |交易能被内存池接受的最低手续费率|





# 返回内存池交易id

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/mempooltxs `
  
##### 请求方式
- GET


##### 返回示例 

``` 
 {
    "code": 200,
    "message": "ok",
    "data": [
        "0b8724e76f422b8693151d540849d4443e6fb96ee082b48013ce24dd77c4231c",
        "c08ee2a572a3c2ef20e40c5ac6a37ceba4f52a93f8ef3bf58d2d451b45ed1035",
        "372673130b91f7f16362d89b09ee910bed1bcb833d1cd4b866345a7aa8f48c87",
        "583c21b4ec4da7d7f18428371228ccc3d977f72889383035dfaddb77c8f15ffc",
        "f4091e90abb7fc3e94ffb38215613e6870101593f78f6fad25faddde93ba69e4",
        "b4b76ff282c3b4b7fa0bfcb985aa4fd7b61f2b48c21b57405e74e79331e9d5a9",
        "0388f199adc0b3406134dc3c1ed055ef0c4bb6613bf9171c3ab3812e453a8527",
        "1f27b80c49359a6b3a28c51a82403ed4b257f4f682b709bddcb48362255ed4b8",
        "5883efe82c803e92a6d4dd45b031cd4fd64c38437c12cef29d399cabf69d5b39",
        "dda67caf39d20bf75a317701602c7df9471e02d9655c39668caf645b67861458",
        "1ede6cb1e49ff86321a51e8350aed283df3aa71158f2bd42db6b400b0e57526e",
        "44eff48953e0ab53307b3fa968bae203c92f245e6101ec73626c685edb950d06",
        "47644296ac67068c332a1b10adecc1c05f1ba34ac9ccb30af29722f349e29180",
        "2ec571d1f361f07047db81c9635ba7bd621615057f10f674776737ff134a4713",
        "511cfa8d056c03022af97bb282d6efdb9c540fda6eb582e7117a6bf9a0e47a4b",
        "cf4415b0c794dd23dcca41daf209523b2e0f22086bfe9d872ddf1da63cb6f5ea",
        "c79d5a9b7073c693bde478bd0391cdb6bcca584bdb857c53e05ab5bdc0e7630a"
    ]
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|data |array   |交易hash列表|







# 根据交易hash获得交易数据


##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/decode/txid/{txid} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|txid |是  |string |交易hash   |

##### 返回示例 

``` 
 {
    "code": "200",
    "message": "OK",
    "data": {
        "txid": "f2df5fd72967b2197ef2671161b6bf8d74a51c129620ceeb928a2fc3ca63a710",
        "hash": "f2df5fd72967b2197ef2671161b6bf8d74a51c129620ceeb928a2fc3ca63a710",
        "size": 308,
        "version": 10,
        "locktime": 0,
        "vin": [
            {
                "coinbase": "037f930c",
                "sequence": 4294967295
            }
        ],
        "vout": [
            {
                "value": 218.75,
                "n": 0,
                "scriptPubKey": {
                    "asm": "OP_DUP OP_HASH160 b3f89180086dfaa2ed10becff8f3b7051114fd0a OP_EQUALVERIFY OP_CHECKSIG OP_RETURN OP_SPLIT OP_ADD 025bd4599f5812f534d97485 -4517048 9 OP_OVER 77c020e2b607102cb0ad777529884b3045022100e0d9124b52260c56c948ef299c3819 beb3e90834d6efe72093407742ea71320220686ad98b7bcb2d2de9ae2fa3b3d84da1e0d9083f7e1953bb6905e4e4024579e20cf85023473045022100fd31c7 OP_VERIF OP_NOTIF 21414532a980e050d5a978ff366964217eb0059623f564ea OP_2MUL OP_UNKNOWN 25120 OP_NIP OP_SHA256 OP_NOP5 OP_INVALIDOPCODE OP_NOP10 OP_UNKNOWN 0 OP_FROMALTSTACK [error]",
                    "hex": "76a914b3f89180086dfaa2ed10becff8f3b7051114fd0a88ac6a7f930c025bd4599f5812f534d9748503b8ecc459782377c020e2b607102cb0ad777529884b3045022100e0d9124b52260c56c948ef299c38193fbeb3e90834d6efe72093407742ea71320220686ad98b7bcb2d2de9ae2fa3b3d84da1e0d9083f7e1953bb6905e4e4024579e20cf85023473045022100fd31c765641821414532a980e050d5a978ff366964217eb0059623f564ea8dfc02206277a8b4ffb9f9006c1bee306372d84db6ed5c2557add19f9842f2e54de4b6b6",
                    "reqSigs": 1,
                    "type": "pubkeyhash",
                    "addresses": [
                        "1HQbjAs7CQAKeV3FQEUGuepBfR2pJDzUjK"
                    ]
                }
            },
            {
                "value": 406.25,
                "n": 1,
                "scriptPubKey": {
                    "asm": "OP_DUP OP_HASH160 76d3753bc349e4b4e3b476c13709960115377ed4 OP_EQUALVERIFY OP_CHECKSIG",
                    "hex": "76a91476d3753bc349e4b4e3b476c13709960115377ed488ac",
                    "reqSigs": 1,
                    "type": "pubkeyhash",
                    "addresses": [
                        "1BqJ3zWFfbagnvHgPsAskz3pARqK7zrAaF"
                    ]
                }
            }
        ],
        "hex": "0a000000010000000000000000000000000000000000000000000000000000000000000000ffffffff04037f930cffffffff0230dc090d00000000d276a914b3f89180086dfaa2ed10becff8f3b7051114fd0a88ac6a7f930c025bd4599f5812f534d9748503b8ecc459782377c020e2b607102cb0ad777529884b3045022100e0d9124b52260c56c948ef299c38193fbeb3e90834d6efe72093407742ea71320220686ad98b7bcb2d2de9ae2fa3b3d84da1e0d9083f7e1953bb6905e4e4024579e20cf85023473045022100fd31c765641821414532a980e050d5a978ff366964217eb0059623f564ea8dfc02206277a8b4ffb9f9006c1bee306372d84db6ed5c2557add19f9842f2e54de4b6b610e23618000000001976a91476d3753bc349e4b4e3b476c13709960115377ed488ac00000000",
        "blockhash": "00000000741ce17614ba9283ce49dd43c8c46d174144c9e51cc05540696c67a7",
        "confirmations": 92657,
        "time": 1708358793,
        "blocktime": 1708358793
    }
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|hex |string   |原始交易十六进制编码|
|txid |string   |交易ID|
|hash |string   |交易哈希（通常与txid相同）|
|size |int   |交易体积（字节）|
|version |int   |交易版本号|
|locktime |int   |区块高度/时间戳锁定|
|scriptSig |object   |解锁脚本|
|sequence |int   |序列号|
|value |float   |金额|
|scriptPubKey |object   |锁定脚本|
|blockhash |string   |交易所在区块的哈希|
|confirmations |int   |区块确认次数|
|time |int   |交易被打包的时间戳（UNIX时间）|
|blocktime |int   |区块生成的时间戳（UNIX时间）|





# 根据txid得到raw数据


##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/txraw/txid/{txid} `
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|txid |是  |string |交易hash   |

##### 返回示例 

``` 
 {
    "code": 200,
    "message": "ok",
    "data": {
			"txraw":""
		}
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|txraw |string   |当前节点每秒哈希运算量|





# 获取节点总体数据


##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nodeinfo `
  
##### 请求方式
- GET


##### 返回示例 

``` 
 {
    "code": 200,
    "message": "ok",
    "data": {
			"chain": "main",
			"blocks": 902563,
			"headers": 902563,
			"bestblockhash": "00000000275ccbd9f17efc44979e047627ca5c2d248a933439b0555572095950",
			"difficulty": 3.826573273453413,
			"mediantime": 1753667336,
			"verificationprogress": 0.003804520498992573,
			"pruned": false,
			"chainwork": "0000000000000000000000000000000000000000014f159ca1ed62116f1480eb"
		}
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|chain |string   |区块链网络类型|
|blocks |int   |当前节点已同步的区块总数|
|headers |int   |当前节点收到的区块头总数|
|bestblockhash |string   |最新区块的哈希值|
|difficulty |float   |当前挖矿难度系数|
|mediantime |int   |最新区块的前11个区块时间戳中位数|
|verificationprogress |float   |区块验证进度（0~1，1表示同步完成）|
|pruned |bool   |是否启用区块裁剪模式|
|chainwork |string   |全网累计工作量（16进制哈希值）|





# 获取区块链状态


##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/chainstate `
  
##### 请求方式
- GET


##### 返回示例 

``` 
 {
    "code": 200,
    "message": "ok",
    "data": {
			"hashes_per_sec": 0.000027037062909408825,
			"difficulty": 3.802455861534703,
			"profit_per_th": 66130181.20470411,
			"unconfirmed_tx_cnt": 75,
			"unconfirmed_tx_size": 456910,
			"tx_cnt_per_day": 2978,
			"tx_rate_per_day": 0.03629361510243379
		}
}
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|hashes_per_sec |float   |当前节点每秒哈希运算量|
|difficulty |float   |全网挖矿难度系数|
|profit_per_th |float   |每T算力每日收益|
|unconfirmed_tx_cnt |int   |内存池中未确认交易数量|
|unconfirmed_tx_size |int   |未确认交易总大小|
|tx_cnt_per_day |int   |过去24小时链上交易总量|
|tx_rate_per_day |float   |交易量日增长率|


[TOC]


# 分页查询地址的合集列表

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/collectionbyaddress/address/{address}/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
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
				},
				{
					"collectio_id": "1baa5e9d6afd1db039bd71d8bcf69547daa2066ab390178a9cccdb08c883bc20",
					"collection_name": "han",
					"collection_creator": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
					"collection_symbol": "",
					"collection_description": "han",
					"collection_supply": 100,
					"collection_create_timestamp": 1753203811,
					"collection_icon": "https://nftcdn.turingwallet.xyz/collections/1baa5e9d6afd1db039bd71d8bcf69547daa2066ab390178a9cccdb08c883bc20.jpg"
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|collection_count |int   |创建的合集数量|
|collection_id |string   |合集id|
|collection_name |string   |合集名称|
|collection_creator |string   |创建者地址|
|collection_symbol |string   |缩写|
|collection_description |string   |合集描述|
|collection_supply |int   |供应量|
|collection_create_timestamp |int   |创建时间戳|
|collection_icon |string   |图片|







# 分页查询地址的NFT列表

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/nftbyaddress/address/{address}/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"nft_total_count": 1067,
			"nft_list": [
				{
					"collection_id": "b0a0479320ccb429dc27f0655d57681792208aaf93ae51cb8df0da8f8e45948d",
					"collection_index": 90,
					"nft_contract_id": "17e1185e4a3343f990edf2e5a78288c1d91d1ef4e238ad58565729c41ebb4e84",
					"nft_name": "Jv #90",
					"nft_symbol": "Jv #90",
					"nft_attributes": null,
					"nft_description": "Jv series item #90",
					"nft_transfer_count": 0,
					"nft_holder": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
					"nft_create_timestamp": 1753250309,
					"nft_icon": "https://nftcdn.turingwallet.xyz/collections/b0a0479320ccb429dc27f0655d57681792208aaf93ae51cb8df0da8f8e45948d.jpg",
					"nft_last_transfer_time": 1755375612,
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|nft_total_count |int   |持有nft总数|
|collection_id |string   |合集id|
|collection_index |int   |合集序号|
|nft_contract_id |string   |nftid|
|nft_name |string   |名称|
|nft_symbol |string   |缩写|
|nft_attributes |string   |属性|
|nft_description |string   |描述|
|nft_transfer_count |int   |nft转移次数|
|nft_holder |string   |持有者地址|
|nft_create_timestamp |int   |持有时间戳|
|nft_icon |string   |icon图标|
|nft_last_transfer_time |int   |nft最后一次的交易时间|





# 分页查询指定集合中的NFT列表

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/nftbycollection/collectionid/{collection_id}/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|collection_id |是  |string |合集id   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"collection_id": "b9a6fe654cd9a4d2eb7151bae5e4d5c0744fa461173f860612b3228503588dba",
			"collection_name": "Vicky",
			"collection_icon": null,
			"collection_description": null,
			"nft_total_count": 2,
			"nft_list": [
				{
					"collection_index": 1,
					"nft_contract_id": "768f0f665c24cbf2ef5a2868ce1d3477ebdece264777f946f55cbd6f6f253b77",
					"nft_name": "Vicky",
					"nft_symbol": "Vicky",
					"nft_attributes": null,
					"nft_description": "Vicky",
					"nft_transfer_count": 0,
					"nft_holder": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
					"nft_create_timestamp": 1744460648,
					"nft_icon": "https://nftcdn.turingwallet.xyz/nfts/768f0f665c24cbf2ef5a2868ce1d3477ebdece264777f946f55cbd6f6f253b77.jpg"
				},
				{
					"collection_index": 2,
					"nft_contract_id": "167641b38511bee5fbd92dc31e231fee12863c177810f5c421bf41793fbb888c",
					"nft_name": "vicky",
					"nft_symbol": "vicky",
					"nft_attributes": null,
					"nft_description": "vicky",
					"nft_transfer_count": 1,
					"nft_holder": "1PrL99cUqCoMJtNRwnQX4LyWSHQtdkr6Qw",
					"nft_create_timestamp": 1744520908,
					"nft_icon": "https://nftcdn.turingwallet.xyz/nfts/167641b38511bee5fbd92dc31e231fee12863c177810f5c421bf41793fbb888c.jpg"
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|collection_id |string   |合集id|
|collection_name |string   |合集名称|
|collection_description |string   |合集描述|
|collection_icon |string   |图片|
|nft_total_count |int   |持有nft总数|
|collection_index |int   |集合序号|
|nft_contract_id |string   |nftid|
|nft_name |string   |名称|
|nft_symbol |string   |缩写|
|nft_attributes |string   |供应量|
|nft_description |string   |描述|
|nft_transfer_count |int   |nft转移次数|
|nft_holder |string   |持有者地址|
|nft_create_timestamp |int   |持有时间戳|
|nft_icon |string   |icon图标|










# 分页查询指定地址的某个nft的交易历史

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/history/address/{address}/nftid/{nftid}/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|nftid |是  |string |nft合约id   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"address": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
			"collection_id": "b0a0479320ccb429dc27f0655d57681792208aaf93ae51cb8df0da8f8e45948d",
			"collection_index": 61,
			"nft_contract_id": "5256fe51da8c82f39497ac091bae7399900d9554326e46e547734b1f095e6e07",
			"history_count": 1432,
			"result": [
				{
					"txid": "5256fe51da8c82f39497ac091bae7399900d9554326e46e547734b1f095e6e07",
					"sender_address": "",
					"recipient_address": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
					"time_stamp": 1753250636,
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|address |string  |地址|
|collection_id |string   |合集id|
|collection_index |int   |集合序号|
|nft_contract_id |string   |nftid|
|history_count |int  |历史交易数|
|txid |string  |交易hash|
|sender_address |string   |发送地址|
|recipient_address |string   |接收地址|
|time_stamp |int   |时间戳|




# 分页查询指定地址的所有nft的交易历史

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/allhistory/address/{address}/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
                "history_count": 7723,
                "history_list":[
						{
							"txid": "033d40efe05f5f267065b24cf30ec321e7212f5e739db03881b6ce41c1aa40c8",
							"height": 901600,
							"sender_address": "1CnbPfkwN6DcLVqwGfwq1SFzUfbbEdJAmm",
							"recipient_address": "1CnbPfkwN6DcLVqwGfwq1SFzUfbbEdJAmm",
							"fee": 80,
							"confirmations": 137,
							"time": 1753095875
						},
						{
							"txid": "033d40efe05f5f267065b24cf30ec321e7212f5e739db03881b6ce41c1aa40c8",
							"height": 901600,
							"sender_address": "1CnbPfkwN6DcLVqwGfwq1SFzUfbbEdJAmm",
							"recipient_address": "1CnbPfkwN6DcLVqwGfwq1SFzUfbbEdJAmm",
							"fee": 80,
							"confirmations": 137,
							"time": 1753095875
						}
                ]
        }
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|history_count |int  |历史交易数|
|txid |string  |交易hash|
|height |int  |高度|
|sender_address |string   |发送地址|
|recipient_address |string   |接收地址|
|fee |int   |费用|
|confirmations |int   |确认数|
|time |int   |时间戳|





# 分页查询所有合集信息

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/collectionlist/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |
##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"collection_count": 120,
			"collection_list": [
				{
					"collection_id": "99c85f93aef06c93216ab1688054b24a5f27f72d3cf524f961ba59cab2452c55",
					"collection_name": "han",
					"collection_creator": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2s YCFacx",
					"collection_symbol": "",
					"collection_attributes": "",
					"collection_description": "han",
					"collection_supply": 100,
					"collection_create_timestamp": 1753204273,
					"collection_icon": "https://nftcdn.turingwallet.xyz/collections/99c85f93aef06c93216ab1688054b24a5f27f72d3cf524f961ba59cab2452c55.jpg"
				},
				{
					"collection_id": "1baa5e9d6afd1db039bd71d8bcf69547daa2066ab390178a9cccdb08c883bc20",
					"collection_name": "han",
					"collection_creator": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
					"collection_symbol": "",
					"collection_attributes": "",
					"collection_description": "han",
					"collection_supply": 100,
					"collection_create_timestamp": 1753203811,
					"collection_icon": "https://nftcdn.turingwallet.xyz/collections/1baa5e9d6afd1db039bd71d8bcf69547daa2066ab390178a9cccdb08c883bc20.jpg"
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|collection_count |int  |合集数量|
|collection_id |string   |合集id|
|collection_name |string   |合集名称|
|collection_creator |string   |创建者地址|
|collection_symbol |string   |缩写|
|collection_attributes |string   |属性|
|collection_description |string   |合集描述|
|collection_supply |int   |供应量|
|collection_create_timestamp |int   |创建时间戳|
|collection_icon |string   |图片|



# 分页查询所有nft信息

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/nftlist/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |
##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"nft_count": 120,
			"nft_list": [
				{
				"nft_contract_id": "768f0f665c24cbf2ef5a2868ce1d3477ebdece264777f946f55cbd6f6f253b77",
				"collection_id": "b9a6fe654cd9a4d2eb7151bae5e4d5c0744fa461173f860612b3228503588dba",
				"collection_index": 1,
				"collection_name": "Vicky",
				"nft_name": "Vicky",
				"nft_symbol": "Vicky",
				"nft_attributes": "Vicky",
				"nft_description": "Vicky",
				"nft_transfer_count": 0,
				"nft_holder": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
				"nft_create_timestamp": 1744460648,
				"nft_icon": null
				},
				{
				"nft_contract_id": "768f0f665c24cbf2ef5a2868ce1d3477ebdece264777f946f55cbd6f6f253b77",
				"collection_id": "b9a6fe654cd9a4d2eb7151bae5e4d5c0744fa461173f860612b3228503588dba",
				"collection_index": 1,
				"collection_name": "Vicky",
				"nft_name": "Vicky",
				"nft_symbol": "Vicky",
				"nft_attributes": "Vicky",
				"nft_description": "Vicky",
				"nft_transfer_count": 0,
				"nft_holder": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
				"nft_create_timestamp": 1744460648,
				"nft_icon": null
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|collection_count |int  |合集数量|
|collection_id |string   |合集id|
|collection_name |string   |合集名称|
|collection_creator |string   |创建者地址|
|collection_symbol |string   |缩写|
|collection_attributes |string   |属性|
|collection_description |string   |合集描述|
|collection_supply |int   |供应量|
|collection_create_timestamp |int   |创建时间戳|
|collection_icon |string   |图片|












# 查询指定nft信息

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/nftinfo/nftid/{nftid}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|nftid |是  |string |nft合约id   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
            "nft_contract_id": "768f0f665c24cbf2ef5a2868ce1d3477ebdece264777f946f55cbd6f6f253b77",
            "collection_id": "b9a6fe654cd9a4d2eb7151bae5e4d5c0744fa461173f860612b3228503588dba",
            "collection_index": 1,
            "collection_name": "Vicky",
            "nft_name": "Vicky",
            "nft_symbol": "Vicky",
            "nft_attributes": "Vicky",
            "nft_description": "Vicky",
            "nft_transfer_count": 0,
            "nft_holder": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
            "nft_create_timestamp": 1744460648,
            "nft_icon": null,
			"nft_last_transfer_time": 1755375612,
        }
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|nft_contract_id |string   |nftid|
|collection_id |string   |合集id|
|collection_index |int   |集合序号|
|collection_name |string   |合集名称|
|nft_name |string   |名称|
|nft_symbol |string   |缩写|
|nft_attributes |string   |供应量|
|nft_description |string   |描述|
|nft_transfer_count |int   |nft转移次数|
|nft_holder |string   |持有者地址|
|nft_create_timestamp |int   |持有时间戳|
|nft_icon |string   |icon图标|
|nft_last_transfer_time |int   |nft最后一次的交易时间|






# 查询指定合集信息

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/collectioninfo/collectionid/{collection_id}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|collection_id |是  |string |合集id   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
					"collection_id": "99c85f93aef06c93216ab1688054b24a5f27f72d3cf524f961ba59cab2452c55",
					"collection_name": "han",
					"collection_creator": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2s YCFacx",
					"collection_symbol": "",
					"collection_attributes": "",
					"collection_description": "han",
					"collection_supply": 100,
					"collection_create_timestamp": 1753204273,
					"collection_icon": "https://nftcdn.turingwallet.xyz/collections/99c85f93aef06c93216ab1688054b24a5f27f72d3cf524f961ba59cab2452c55.jpg"
			}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|collection_id |string   |合集id|
|collection_name |string   |合集名称|
|collection_creator |string   |创建者地址|
|collection_symbol |string   |缩写|
|collection_attributes |string   |属性|
|collection_description |string   |合集描述|
|collection_supply |int   |供应量|
|collection_create_timestamp |int   |创建时间戳|
|collection_icon |string   |图片|

# 查询指定脚本的NFTUTXO

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/utxo/scriptpubkeyhash/{scriptpubkeyhash}`
  
##### 请求方式
- GET


##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|scriptpubkeyhash |是  |string |脚本   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
     "data": {
        "utxos": [
            {
                "txid": "666a860f2af836985ea01ef20dbe7d0f012e6a399eaf2b8c997497c35c701f06",
                "height": 824190,
                "index": 1,
                "value": 406250000
            }
        ]
    }
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|txid |string   |交易id|
|height |int   |高度|
|index |int   |序号|
|value |int64   |余额|
[TOC]


# 分页查询地址的合集列表

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/collectionbyaddress/address/{address}/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
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
				},
				{
					"collectio_id": "1baa5e9d6afd1db039bd71d8bcf69547daa2066ab390178a9cccdb08c883bc20",
					"collection_name": "han",
					"collection_creator": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
					"collection_symbol": "",
					"collection_description": "han",
					"collection_supply": 100,
					"collection_create_timestamp": 1753203811,
					"collection_icon": "https://nftcdn.turingwallet.xyz/collections/1baa5e9d6afd1db039bd71d8bcf69547daa2066ab390178a9cccdb08c883bc20.jpg"
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|collection_count |int   |创建的合集数量|
|collection_id |string   |合集id|
|collection_name |string   |合集名称|
|collection_creator |string   |创建者地址|
|collection_symbol |string   |缩写|
|collection_description |string   |合集描述|
|collection_supply |int   |供应量|
|collection_create_timestamp |int   |创建时间戳|
|collection_icon |string   |图片|







# 分页查询地址的NFT列表

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/nftbyaddress/address/{address}/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"nft_total_count": 1067,
			"nft_list": [
				{
					"collection_id": "b0a0479320ccb429dc27f0655d57681792208aaf93ae51cb8df0da8f8e45948d",
					"collection_index": 90,
					"nft_contract_id": "17e1185e4a3343f990edf2e5a78288c1d91d1ef4e238ad58565729c41ebb4e84",
					"nft_name": "Jv #90",
					"nft_symbol": "Jv #90",
					"nft_attributes": null,
					"nft_description": "Jv series item #90",
					"nft_transfer_count": 0,
					"nft_holder": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
					"nft_create_timestamp": 1753250309,
					"nft_icon": "https://nftcdn.turingwallet.xyz/collections/b0a0479320ccb429dc27f0655d57681792208aaf93ae51cb8df0da8f8e45948d.jpg",
					"nft_last_transfer_time": 1755375612,
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|nft_total_count |int   |持有nft总数|
|collection_id |string   |合集id|
|collection_index |int   |合集序号|
|nft_contract_id |string   |nftid|
|nft_name |string   |名称|
|nft_symbol |string   |缩写|
|nft_attributes |string   |属性|
|nft_description |string   |描述|
|nft_transfer_count |int   |nft转移次数|
|nft_holder |string   |持有者地址|
|nft_create_timestamp |int   |持有时间戳|
|nft_icon |string   |icon图标|
|nft_last_transfer_time |int   |nft最后一次的交易时间|





# 分页查询指定集合中的NFT列表

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/nftbycollection/collectionid/{collection_id}/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|collection_id |是  |string |合集id   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"collection_id": "b9a6fe654cd9a4d2eb7151bae5e4d5c0744fa461173f860612b3228503588dba",
			"collection_name": "Vicky",
			"collection_icon": null,
			"collection_description": null,
			"nft_total_count": 2,
			"nft_list": [
				{
					"collection_index": 1,
					"nft_contract_id": "768f0f665c24cbf2ef5a2868ce1d3477ebdece264777f946f55cbd6f6f253b77",
					"nft_name": "Vicky",
					"nft_symbol": "Vicky",
					"nft_attributes": null,
					"nft_description": "Vicky",
					"nft_transfer_count": 0,
					"nft_holder": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
					"nft_create_timestamp": 1744460648,
					"nft_icon": "https://nftcdn.turingwallet.xyz/nfts/768f0f665c24cbf2ef5a2868ce1d3477ebdece264777f946f55cbd6f6f253b77.jpg"
				},
				{
					"collection_index": 2,
					"nft_contract_id": "167641b38511bee5fbd92dc31e231fee12863c177810f5c421bf41793fbb888c",
					"nft_name": "vicky",
					"nft_symbol": "vicky",
					"nft_attributes": null,
					"nft_description": "vicky",
					"nft_transfer_count": 1,
					"nft_holder": "1PrL99cUqCoMJtNRwnQX4LyWSHQtdkr6Qw",
					"nft_create_timestamp": 1744520908,
					"nft_icon": "https://nftcdn.turingwallet.xyz/nfts/167641b38511bee5fbd92dc31e231fee12863c177810f5c421bf41793fbb888c.jpg"
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|collection_id |string   |合集id|
|collection_name |string   |合集名称|
|collection_description |string   |合集描述|
|collection_icon |string   |图片|
|nft_total_count |int   |持有nft总数|
|collection_index |int   |集合序号|
|nft_contract_id |string   |nftid|
|nft_name |string   |名称|
|nft_symbol |string   |缩写|
|nft_attributes |string   |供应量|
|nft_description |string   |描述|
|nft_transfer_count |int   |nft转移次数|
|nft_holder |string   |持有者地址|
|nft_create_timestamp |int   |持有时间戳|
|nft_icon |string   |icon图标|










# 分页查询指定地址的某个nft的交易历史

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/history/address/{address}/nftid/{nftid}/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|nftid |是  |string |nft合约id   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"address": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
			"collection_id": "b0a0479320ccb429dc27f0655d57681792208aaf93ae51cb8df0da8f8e45948d",
			"collection_index": 61,
			"nft_contract_id": "5256fe51da8c82f39497ac091bae7399900d9554326e46e547734b1f095e6e07",
			"history_count": 1432,
			"result": [
				{
					"txid": "5256fe51da8c82f39497ac091bae7399900d9554326e46e547734b1f095e6e07",
					"sender_address": "",
					"recipient_address": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
					"time_stamp": 1753250636,
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|address |string  |地址|
|collection_id |string   |合集id|
|collection_index |int   |集合序号|
|nft_contract_id |string   |nftid|
|history_count |int  |历史交易数|
|txid |string  |交易hash|
|sender_address |string   |发送地址|
|recipient_address |string   |接收地址|
|time_stamp |int   |时间戳|




# 分页查询指定地址的所有nft的交易历史

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/allhistory/address/{address}/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|address |是  |string |地址   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
                "history_count": 7723,
                "history_list":[
						{
							"txid": "033d40efe05f5f267065b24cf30ec321e7212f5e739db03881b6ce41c1aa40c8",
							"height": 901600,
							"sender_address": "1CnbPfkwN6DcLVqwGfwq1SFzUfbbEdJAmm",
							"recipient_address": "1CnbPfkwN6DcLVqwGfwq1SFzUfbbEdJAmm",
							"fee": 80,
							"confirmations": 137,
							"time": 1753095875
						},
						{
							"txid": "033d40efe05f5f267065b24cf30ec321e7212f5e739db03881b6ce41c1aa40c8",
							"height": 901600,
							"sender_address": "1CnbPfkwN6DcLVqwGfwq1SFzUfbbEdJAmm",
							"recipient_address": "1CnbPfkwN6DcLVqwGfwq1SFzUfbbEdJAmm",
							"fee": 80,
							"confirmations": 137,
							"time": 1753095875
						}
                ]
        }
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|history_count |int  |历史交易数|
|txid |string  |交易hash|
|height |int  |高度|
|sender_address |string   |发送地址|
|recipient_address |string   |接收地址|
|fee |int   |费用|
|confirmations |int   |确认数|
|time |int   |时间戳|





# 分页查询所有合集信息

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/collectionlist/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |
##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"collection_count": 120,
			"collection_list": [
				{
					"collection_id": "99c85f93aef06c93216ab1688054b24a5f27f72d3cf524f961ba59cab2452c55",
					"collection_name": "han",
					"collection_creator": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2s YCFacx",
					"collection_symbol": "",
					"collection_attributes": "",
					"collection_description": "han",
					"collection_supply": 100,
					"collection_create_timestamp": 1753204273,
					"collection_icon": "https://nftcdn.turingwallet.xyz/collections/99c85f93aef06c93216ab1688054b24a5f27f72d3cf524f961ba59cab2452c55.jpg"
				},
				{
					"collection_id": "1baa5e9d6afd1db039bd71d8bcf69547daa2066ab390178a9cccdb08c883bc20",
					"collection_name": "han",
					"collection_creator": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
					"collection_symbol": "",
					"collection_attributes": "",
					"collection_description": "han",
					"collection_supply": 100,
					"collection_create_timestamp": 1753203811,
					"collection_icon": "https://nftcdn.turingwallet.xyz/collections/1baa5e9d6afd1db039bd71d8bcf69547daa2066ab390178a9cccdb08c883bc20.jpg"
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|collection_count |int  |合集数量|
|collection_id |string   |合集id|
|collection_name |string   |合集名称|
|collection_creator |string   |创建者地址|
|collection_symbol |string   |缩写|
|collection_attributes |string   |属性|
|collection_description |string   |合集描述|
|collection_supply |int   |供应量|
|collection_create_timestamp |int   |创建时间戳|
|collection_icon |string   |图片|



# 分页查询所有nft信息

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/nftlist/start/{start}/end/{end}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|start |是  |int |起始序号   |
|end |是  |int |结束序号   |
##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"nft_count": 120,
			"nft_list": [
				{
				"nft_contract_id": "768f0f665c24cbf2ef5a2868ce1d3477ebdece264777f946f55cbd6f6f253b77",
				"collection_id": "b9a6fe654cd9a4d2eb7151bae5e4d5c0744fa461173f860612b3228503588dba",
				"collection_index": 1,
				"collection_name": "Vicky",
				"nft_name": "Vicky",
				"nft_symbol": "Vicky",
				"nft_attributes": "Vicky",
				"nft_description": "Vicky",
				"nft_transfer_count": 0,
				"nft_holder": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
				"nft_create_timestamp": 1744460648,
				"nft_icon": null
				},
				{
				"nft_contract_id": "768f0f665c24cbf2ef5a2868ce1d3477ebdece264777f946f55cbd6f6f253b77",
				"collection_id": "b9a6fe654cd9a4d2eb7151bae5e4d5c0744fa461173f860612b3228503588dba",
				"collection_index": 1,
				"collection_name": "Vicky",
				"nft_name": "Vicky",
				"nft_symbol": "Vicky",
				"nft_attributes": "Vicky",
				"nft_description": "Vicky",
				"nft_transfer_count": 0,
				"nft_holder": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
				"nft_create_timestamp": 1744460648,
				"nft_icon": null
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|collection_count |int  |合集数量|
|collection_id |string   |合集id|
|collection_name |string   |合集名称|
|collection_creator |string   |创建者地址|
|collection_symbol |string   |缩写|
|collection_attributes |string   |属性|
|collection_description |string   |合集描述|
|collection_supply |int   |供应量|
|collection_create_timestamp |int   |创建时间戳|
|collection_icon |string   |图片|












# 查询指定nft信息

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/nftinfo/nftid/{nftid}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|nftid |是  |string |nft合约id   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
            "nft_contract_id": "768f0f665c24cbf2ef5a2868ce1d3477ebdece264777f946f55cbd6f6f253b77",
            "collection_id": "b9a6fe654cd9a4d2eb7151bae5e4d5c0744fa461173f860612b3228503588dba",
            "collection_index": 1,
            "collection_name": "Vicky",
            "nft_name": "Vicky",
            "nft_symbol": "Vicky",
            "nft_attributes": "Vicky",
            "nft_description": "Vicky",
            "nft_transfer_count": 0,
            "nft_holder": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2sYCFacx",
            "nft_create_timestamp": 1744460648,
            "nft_icon": null,
			"nft_last_transfer_time": 1755375612,
        }
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|nft_contract_id |string   |nftid|
|collection_id |string   |合集id|
|collection_index |int   |集合序号|
|collection_name |string   |合集名称|
|nft_name |string   |名称|
|nft_symbol |string   |缩写|
|nft_attributes |string   |供应量|
|nft_description |string   |描述|
|nft_transfer_count |int   |nft转移次数|
|nft_holder |string   |持有者地址|
|nft_create_timestamp |int   |持有时间戳|
|nft_icon |string   |icon图标|
|nft_last_transfer_time |int   |nft最后一次的交易时间|






# 查询指定合集信息

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/collectioninfo/collectionid/{collection_id}`
  
##### 请求方式
- GET

##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|collection_id |是  |string |合集id   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
					"collection_id": "99c85f93aef06c93216ab1688054b24a5f27f72d3cf524f961ba59cab2452c55",
					"collection_name": "han",
					"collection_creator": "1B1iuWp2sbKgUYtDK5H3KFs3Fs2s YCFacx",
					"collection_symbol": "",
					"collection_attributes": "",
					"collection_description": "han",
					"collection_supply": 100,
					"collection_create_timestamp": 1753204273,
					"collection_icon": "https://nftcdn.turingwallet.xyz/collections/99c85f93aef06c93216ab1688054b24a5f27f72d3cf524f961ba59cab2452c55.jpg"
			}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|collection_id |string   |合集id|
|collection_name |string   |合集名称|
|collection_creator |string   |创建者地址|
|collection_symbol |string   |缩写|
|collection_attributes |string   |属性|
|collection_description |string   |合集描述|
|collection_supply |int   |供应量|
|collection_create_timestamp |int   |创建时间戳|
|collection_icon |string   |图片|

# 查询指定脚本的NFTUTXO

##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/nft/utxo/scriptpubkeyhash/{scriptpubkeyhash}`
  
##### 请求方式
- GET


##### 参数

|参数名|必选|类型|说明|
|:----    |:---|:----- |-----   |
|scriptpubkeyhash |是  |string |脚本   |

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
     "data": {
        "utxos": [
            {
                "txid": "666a860f2af836985ea01ef20dbe7d0f012e6a399eaf2b8c997497c35c701f06",
                "height": 824190,
                "index": 1,
                "value": 406250000
            }
        ]
    }
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|txid |string   |交易id|
|height |int   |高度|
|index |int   |序号|
|value |int64   |余额|



[TOC]


#获取多重签名地址
##### 请求URL
- ` https://api.turingbitchain.io/api/tbc/multisig/multisigaddress/address/{address}`
  
##### 请求方式
- get

##### 返回示例 

``` 
  {
    "code":"200",
    "message":"OK",
    "data": {
			"multi_address_list": [
				{
					"address": "FDKX7GYpy7XkyXuRZryYwYd53WJaEPkGrR",
					"pubkeys": [
						"03485e043f42222430f00ab75735b6598969123095d5570f6de35f5eaa9cda8702",
						"038bafb61b438cc54c2a3940c5773970fe2aa55f55ff16edeb67de30c5659b49dd",
						"03179ff73e34c1d00387d911a3433f388780bd475c33a72b0c8df7c90c081a496e"
					]
				},
				{
					"address": "FMmRo4c6J5fwCATeHro7A3v3u5MRAZTBzE",
					"pubkeys": [
						"03179ff73e34c1d00387d911a3433f388780bd475c33a72b0c8df7c90c081a496e",
						"03485e043f42222430f00ab75735b6598969123095d5570f6de35f5eaa9cda8702",
						"03043e27253bd4deef02e27e6919e756086b5fe09b3f7d1ddb3f3005980cecf718"
					]
				}
			]
		}
  }
```

##### 返回参数说明 

|参数名|类型|说明|
|:-----  |:-----|-----                           |
|code |int   |状态码|
|message |string  |可读信息|
|address |string   |多签地址|
|pubkeys |array   |公钥列表|

