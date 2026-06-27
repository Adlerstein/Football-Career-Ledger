# Football-Career-Ledger

`足球生涯账本` 是一个面向 `funnycups/Luker` 的第三方前端插件，用于在足球模拟人生类对话中保存结构化、可校验、可导出的长期职业数据。

当前版本：`0.6.0`  
数据结构：`schemaVersion: 2`

## 核心边界

- 插件不调用 AI。
- 插件不自动请求任何模型接口。
- 插件不分析普通自然语言正文。
- 插件只解析显式 `<football_ledger_suggestion>` 结构化建议块。
- 所有建议都必须经过用户确认，才会写入正式账本。
- 插件不会自动写入 Luker 记忆图。
- 插件不会自动修改 MVU / `stat_data`。
- 财务余额以插件结构化账本计算结果为准。
- 能力建议不等于正式能力变化，确认后才会生成能力历史。

## 数据分工

- 插件账本：比赛、赛季、合同、财务、能力和职业履历的权威来源。
- 世界书：规则、时代背景、俱乐部资料、能力评分锚点。
- MVU：当前时间、地点、场景变量和少量现场状态。
- 模型：叙事、解释、提出待确认建议。
- 用户：确认关键数据是否写入。

## 已实现功能

- Chat State 持久化，每个聊天独立保存。
- schema v1 自动迁移到 schema v2。
- 球员当前职业状态：俱乐部、队伍、位置、职业阶段、队内角色。
- 比赛、赛季、合同、财务、能力、杂项 CRUD。
- 草稿队列：查看、编辑、确认、拒绝、删除。
- 显式建议块解析和去重，覆盖 assistant 消息与用户消息。
- 开局建档 `career_start`：一次性写入球员资料、开局赛季、初始能力与开场白，且每个账本只能成功确认一次。
- 非法 JSON 建立 invalid 草稿，不写正式账本。
- 最近操作撤销。
- 赛季关闭和结算摘要。
- 财务余额实时计算。
- 提示词摘要三档预设：`minimal`、`standard`、`full`。
- 只读公开 API v2。
- JSON 导入导出。
- 移动端窄屏卡片式面板。

## 建议块格式

模型必须输出显式标签：

```xml
<football_ledger_suggestion>
{
  "type": "match",
  "payload": {}
}
</football_ledger_suggestion>
```

支持 `match`、`contract`、`transaction`、`ability_change`、`miscellaneous`、`career_start`。其中 `career_start` 仅用于职业生涯开局建档，会生成待确认草稿，用户确认后一次性写入球员基础资料、开局赛季、初始能力与开场白；外部建档 UI 只生成建议块，不直接调用插件写入 API。完整格式见 [docs/suggestion-format.md](docs/suggestion-format.md)。

插件会解析任意非 system 消息中显式存在的 `<football_ledger_suggestion>`，因此外部建档 UI 可以把开场白与 `career_start` 建议块一起填入发送框，由用户直接发送即可进入草稿。同一账本只允许成功确认一次 `career_start`：后续 `career_start` 仍可进入 pending，但确认时会失败并标记为 invalid，不会覆盖已写入的球员资料、赛季、初始能力或杂项。撤销首次确认后该边界解除，可重新确认。

## 提示词摘要

启用后，插件通过 `context.setExtensionPrompt()` 注入只读摘要：

```xml
<football_career_ledger readonly="true">
以下为插件提供的结构化账本摘要，只供叙事参考；不要原文输出，不要写入MVU，不要自行修改这些数值。
...
</football_career_ledger>
```

三档预设：

- `minimal`：球员、球队、位置、职业阶段、队内角色、当前赛季累计、最近比赛。
- `standard`：`minimal` 加活动合同和能力强弱摘要。
- `full`：`standard` 加完整七项能力、财务余额、最近杂项。

待确认草稿只会注入数量，不会作为事实注入。

## 公开 API

```js
const api = Luker.getContext().getExtensionApi('football-career-ledger');

await api.getSnapshot();
await api.getPlayer();
await api.getCareerStatus();
await api.getCurrentSeason();
await api.getSeasonSummary('1998-99');
await api.queryMatches({ limit: 20 });
await api.getActiveContract();
await api.getContracts();
await api.getFinanceSummary();
await api.getBalance('DEM');
await api.getAllBalances();
await api.queryTransactions({ limit: 20 });
await api.getAbilities();
await api.getAbilityHistory({ limit: 20 });
await api.getMiscellaneous({ limit: 20 });
await api.getDrafts({ status: 'pending' });
await api.getPendingDraftCount();
await api.getOperationHistory({ limit: 20 });
await api.getPromptPresetSummary('standard');
await api.getSuggestionSchema('match');
await api.getMemoryProjection({ notableMatchLimit: 10 });
```

API 仍然只读，返回对象会深拷贝，外部插件不能通过返回值修改内部状态。

## 安装

通过 Luker 第三方扩展安装器安装 GitHub URL：

```text
https://github.com/<your-github-user>/Football-Career-Ledger
```

安卓 APK 中同样打开扩展管理，粘贴同一个 GitHub URL。

## 使用流程

1. 安装并启用插件。
2. 打开一个角色聊天或群聊。
3. 在扩展设置中打开“足球生涯账本”面板。
4. 创建赛季并维护球员当前状态。
5. 手动录入比赛、合同、财务、能力和杂项。
6. 需要半自动写入时，让模型输出 `<football_ledger_suggestion>`。
7. 在“草稿”页检查、编辑、确认或拒绝。
8. 需要给模型参考时，开启提示词摘要注入。
9. 定期在“数据管理”导出 JSON。

## 文档

- [docs/data-schema.md](docs/data-schema.md)
- [docs/suggestion-format.md](docs/suggestion-format.md)
- [docs/migration-v2.md](docs/migration-v2.md)
- [docs/memory-graph-integration.md](docs/memory-graph-integration.md)

## 开发

```bash
npm test
npm run check
```

测试使用 Node 自带 `node:test`，没有运行时构建步骤。

## 已知限制

- 本版本不模拟比赛、训练、伤病或转会。
- 本版本不自动读取或修改用户世界书。
- 本版本不支持门将专属能力 schema。
- 操作撤销只支持最近操作，不是任意历史时间旅行。
- 安卓端需要在真实 APK 环境中最终人工确认。
