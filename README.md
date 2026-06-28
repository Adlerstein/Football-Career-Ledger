# Football-Career-Ledger

`足球生涯账本` 是一个主要面向 `funnycups/Luker`、同时兼容 SillyTavern 的第三方前端扩展，用于在足球模拟人生类对话中保存结构化、可校验、可导出的长期职业数据。`0.7.0` 起内置一个只读的「球探资料」赛事参考子系统（详见下文）。

当前版本：`0.7.0`  
数据结构：`schemaVersion: 2`

## 核心边界

- 插件不调用 AI。
- 插件不自动请求任何模型接口。
- 插件不分析普通自然语言正文。
- 插件只解析显式 `<football_ledger_suggestion>` 结构化建议块。
- 所有建议都必须经过用户确认，才会写入正式账本。
- 插件不会自动写入宿主记忆图或向量记忆。
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

- SillyTavern 聊天级持久化，每个聊天独立保存；在 Luker 中优先使用 Chat State，纯 SillyTavern 中回退到 `chatMetadata`。
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
- “球探报告”主题面板：复古档案纸质感（稿纸横线、内嵌边框、衬线排版、点线分节标题、印章绿/警示红配色），与 Luker 足球世界建档界面风格统一。
- 混合明暗皮肤：自动跟随宿主 SillyTavern 主题，浅色主题用纸张配色，深色主题切换为夜间羊皮纸配色，不会在深色主题下变成刺眼的浅色块。
- 移动端窄屏卡片式面板，全程响应式排版。
- 内置「球探资料」只读赛事参考子系统：数据集导入导出、本轮参考预览、一次性提示词注入，以及 Luker 编排器只读工具。

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

## 球探资料（赛事参考子系统）

`0.7.0` 起内置一个**只读的足球赛事资料**子系统（原 `Football-Reference-Scout` 插件），在面板的「球探资料」标签页中使用。它与账本数据完全独立：账本是这名球员的**可写生涯记录**（按聊天存储），球探资料是**只读的外部赛事事实库**（全局存储），只供叙事参考。

### 它做什么

- 维护一份结构化赛事数据集：赛季、联赛、球队、比赛、进球/换人事件、首发名单、来源。
- 按「当前日期 / 赛季 / 球队」推断本回合相关的比赛，打包成紧凑的只读「参考胶囊」。
- 两种把参考喂给 AI 的方式：
  - **一次性注入**：在标签页点「下一次生成注入参考」，仅对下一次生成注入一份胶囊，生成结束自动清除。
  - **Orchestrator 工具**（Luker 编排器可用时）：注册只读工具 `football_ref_build_turn_capsule`，由编排器在写比赛场景前调用。

### 怎么用

1. 打开面板的「球探资料」标签页。
2. 在「资料库」导入符合 `schemaVersion: 1` 的 JSON 数据集（不导入则使用内置样例）。
3. 在「查询档案」填当前赛季 / 球队 / 日期（也会自动从账本读取当前俱乐部与赛季）。
4. 在「本轮参考」点「预览本轮参考」查看将注入的内容，确认后点「下一次生成注入参考」。

### 数据集格式

字段：`seasons / competitions / teams（含 aliases 别名） / matches（date、round、score、sourceIds） / events / lineups / sources`。导入时做引用完整性校验：每场比赛引用的 `seasonId / competitionId / homeTeamId / awayTeamId / sourceIds` 都必须在对应表中存在，否则数据集判为非法、拒绝导入。

### 边界与存储

- 只读：不写账本、不写 MVU / `stat_data`、不写世界书、不模拟赛季或重算积分榜。
- 资料库存储在浏览器 IndexedDB（库名 `football-reference-scout`），设置存于 `extensionSettings['football-reference-scout']`，与账本数据互不影响。

## 公开 API

```js
const context = globalThis.Luker?.getContext?.() ?? globalThis.SillyTavern?.getContext?.();
const api = context.getExtensionApi?.('football-career-ledger');

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

API 仍然只读，返回对象会深拷贝，外部插件不能通过返回值修改内部状态。`getExtensionApi()` / `registerExtensionApi()` 属于兼容宿主提供的扩展注册表；如果某个纯 SillyTavern 环境没有该注册表，插件自身面板和账本功能仍可使用，但外部插件无法通过这组 API 读取账本。

### 球探资料公开 API

球探资料子系统单独注册为 `football-reference-scout`，方便编排器和外部集成按原名调用：

```js
const ref = context.getExtensionApi?.('football-reference-scout');

await ref.getReferenceStatus();
await ref.listDatasets();
await ref.queryMatches({ seasonId, team, dateRange });
await ref.getMatchDetail({ matchId });
await ref.buildTurnCapsule({ userMessage, stateTime, ledgerSnapshot });
ref.getActiveProfile();
ref.updateActiveProfile({ seasonId, team, currentDate });
await ref.importDatasetFromJson(dataset);
await ref.exportDataset(datasetId);
await ref.deleteDataset(datasetId);
```

> 若曾单独安装过 `Football-Reference-Scout` 插件，融合后请将其卸载，避免重复注册同一 API 名与同名编排器工具造成冲突。

在 Luker 或安卓 APK 中同样打开扩展/插件管理，粘贴同一个 GitHub URL。

## 宿主兼容性

- 优先使用 `Luker.getContext()` 初始化，保留 `SillyTavern.getContext()` 作为兼容入口。
- 存储优先级为 Luker Chat State API，其次是 SillyTavern 标准 `chatMetadata + saveMetadata()`。
- 插件不会调用模型接口，也不依赖 Luker 专属记忆图；Luker 专属能力只作为可选增强。
- 扩展 ID、设置命名空间和公开 API 名称保持 `football-career-ledger`，方便旧数据和外部集成继续工作。

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
10. 需要真实赛事参考时，在“球探资料”页导入数据集，并按需预览/注入本轮参考。

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
