# 数据模型

`football-career-ledger` 保存每个聊天独立的 JSON 对象，命名空间固定为 `football-career-ledger`。在 Luker 中优先使用 Chat State；在纯 SillyTavern 中使用 `chatMetadata + saveMetadata()`。

## 顶层结构

```js
{
  schemaVersion: 2,
  meta: { createdAt: "", updatedAt: "" },
  player: {
    name: "",
    currentClub: "",
    currentTeam: "",
    primaryPosition: "",
    secondaryPositions: [],
    careerStage: "youth",
    squadRole: "rotation",
    currentSeasonId: "",
    defaultCurrency: "DEM"
  },
  seasons: [],
  matches: [],
  contracts: [],
  finance: { openingBalances: [], transactions: [] },
  abilities: { current: {}, history: [] },
  miscellaneous: [],
  drafts: [],
  operationHistory: []
}
```

## 记录元数据

比赛、赛季、合同、期初余额、财务流水、能力历史和杂项记录都包含：

```js
meta: {
  createdAt: "",
  updatedAt: "",
  source: {
    type: "manual",
    messageId: null,
    swipeId: null,
    draftId: null
  }
}
```

`source.type` 支持 `manual`、`assistant_suggestion`、`import`、`migration`、`system`。

## 草稿

草稿只代表模型或用户提供的待确认建议，不是正式事实：

```js
{
  id: "",
  type: "match",
  status: "pending",
  payload: {},
  source: {
    messageId: "",
    swipeId: 0,
    suggestionIndex: 0,
    contentHash: ""
  },
  validationErrors: [],
  createdAt: "",
  updatedAt: "",
  resolvedAt: null
}
```

支持类型：`match`、`contract`、`transaction`、`ability_change`、`miscellaneous`、`career_start`。`career_start` 用于开局建档，确认后会写入 player、当前赛季、初始能力以及可选开场白杂项记录；已有能力历史时确认会失败并标记草稿为 invalid，不会覆盖既有能力。

## 设计约束

- 赛季累计默认由 `matches` 实时计算，不保存为权威字段；但赛季可选填 `manualTotals`（出场、首发、分钟、进球、助攻，各为非负整数或 null），非空字段会覆盖对应的自动统计，便于不逐场录入比赛时直接登记赛季总数。
- 财务余额始终由期初余额和流水按币种计算。
- 金额使用整数最小货币单位，不使用浮点数。
- 能力值范围为 `0..99`，正式修改必须追加历史记录。
- 操作历史只保留最近有限条目，用于撤销最近操作，不是完整事件溯源。
- 导入 JSON 会先迁移和校验，失败不会覆盖当前聊天原数据。
