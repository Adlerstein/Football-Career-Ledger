# 数据模型

`football-career-ledger` 使用 Luker Chat State 保存每个聊天独立的 JSON 对象，命名空间固定为 `football-career-ledger`。

顶层结构：

```js
{
  schemaVersion: 1,
  meta: { createdAt: "", updatedAt: "" },
  player: {
    name: "",
    currentClub: "",
    primaryPosition: "",
    currentSeasonId: "",
    defaultCurrency: "DEM"
  },
  seasons: [],
  matches: [],
  contracts: [],
  finance: { openingBalances: [], transactions: [] },
  abilities: { current: {}, history: [] },
  miscellaneous: []
}
```

设计约束：

- 赛季累计不保存为权威字段，由 `matches` 实时计算。
- 金额使用整数最小货币单位，不使用浮点数。
- 财务余额按币种分别计算，不做汇率换算。
- 能力值范围为 `0..99`，UI 修改能力时会追加历史记录。
- `miscellaneous` 只用于少量结构化事实，不作为自然语言记忆库。
- 未来版本必须通过 `schemaVersion` 迁移。

导入 JSON 时会先解析和校验，失败不会覆盖当前聊天原数据。
