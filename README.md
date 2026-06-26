# Football-Career-Ledger

`足球生涯账本` 是一个面向 `funnycups/Luker` 的第三方前端插件，用于在足球模拟人生类对话中保存结构化、可校验、可导出的长期职业数据。

它的核心定位不是让模型自己记账，而是把容易幻觉、重复累计或漏记的长期数据从自然语言上下文中拆出来，由插件保存为确定性数据，再把压缩摘要注入给写作模型参考。

## 当前定位

本插件适合保存这些内容：

- 球员基础状态：姓名、当前球队、位置、当前赛季、默认币种。
- 赛季与比赛记录：出场、首发、分钟、进球、助攻、牌、评分、重要比赛标记。
- 合同记录：俱乐部、合同类型、起止日期、工资周期、工资金额、币种、是否当前合同。
- 财务记录：初始余额、收入、支出、合同关联、分类、备注。
- 能力记录：当前能力值与手动变更历史。
- 少量杂项事实：不适合放进比赛、合同、财务、能力表的结构化事实。

本插件不做这些事：

- 不调用 AI。
- 不自动分析聊天正文。
- 不自动从模型回复里提取比赛或训练结果。
- 不自动修改能力、财务、合同或比赛数据。
- 不模拟比赛、训练、伤病、转会或工资结算。
- 不主动写入 Luker 记忆图。
- 不让 MVU / `stat_data` 承担完整职业履历。

## 设计原则

### 插件是可信账本

比赛、赛季、合同、财务和能力值以插件保存的数据为准。模型可以参考这些数据写作，但不应该成为权威数据源。

这样做的原因是：模型擅长叙事和解释，不擅长长期精确累计。把职业数据留在自然语言上下文、记忆图或 MVU 中，容易出现重复加进球、漏掉助攻、赛季边界混乱、能力值突然膨胀等问题。

### 赛季统计由结构化比赛实时计算

赛季总出场、首发、分钟、进球、助攻、黄牌、红牌和平均评分不作为手填权威字段保存，而是由 `matches` 按 `seasonId` 实时汇总。

当前规则：

- `minutes > 0` 计为一次出场。
- `started === true` 计为一次首发。
- `goals` 累加为个人进球。
- `assists` 累加为助攻。
- `yellowCards`、`redCards` 分别累加。
- `rating` 为数字时参与平均评分。

对应代码位置：`src/selectors.js` 的 `summarizeSeason()`。

### MVU 只保存轻量现场变量

当前世界书 `足球.json` 的 MVU 规则已经把边界划清：`stat_data` 只维护时间、地点、当前球队、个人位置和个人存款等轻量变量，不维护能力、比赛统计、合同、完整履历或市场价值。

因此推荐数据分工是：

- MVU：当前场景锚点。
- 世界书：规则、时代背景、足球知识、能力评分锚点。
- 插件：职业履历和可累计数据。
- 写作模型：叙事、解释、提出建议。
- 用户：确认关键数据写入。

## 能力值策略

`足球.json` 中的“球员能力划分”条目提供了能力层级、单项能力解释、参考球员和数值锚点。这适合作为评分规则和判断基准，但不适合直接交给模型每轮自动改数值。

当前插件能力维度为外场球员七项：

- 速度
- 射门
- 传球
- 控球
- 防守
- 身体
- 意识

当前能力值范围为 `0..99`。UI 手动保存能力时，会把变化写入 `abilities.history`，记录变更日期、能力项、变更前、变更后和原因。

推荐的下一阶段能力值方案：

1. 模型只输出“能力变化建议”，不直接写入。
2. 插件展示待确认建议，例如 `传球 +1，原因：连续比赛承担组织职责并有关键助攻`。
3. 用户确认后，插件才写入当前能力与历史。
4. 世界书能力规则作为判断锚点，避免数值失控。

不推荐让模型直接输出最终 JSONPatch 写入能力值，因为长期成长系统最怕幻觉和过度奖励。

## 提示词摘要注入

摘要注入默认关闭。启用后，插件会通过 `context.setExtensionPrompt()` 把压缩后的账本摘要注入为最近上下文。

当前注入策略：

- 使用 `promptTypes.IN_CHAT`。
- 使用 `promptRoles.SYSTEM`。
- 深度为 `1`，尽量贴近最近上下文，但不直接粘在最后用户输入尾部。
- 摘要块标记为只读参考。

摘要示例：

```xml
<football_career_ledger readonly="true">
以下为插件提供的结构化账本摘要，只供叙事参考；不要原文输出，不要写入MVU变量。
球员：弗里德里希·卡尔·冯·阿德勒斯坦；球队：拜仁慕尼黑；位置：中前卫。
当前赛季：1998/99，1次出场，0次首发，0球1助攻。
最近比赛：对多特蒙德3比1，替补20分钟，1次助攻。
财务：DEM余额5000。
能力：速度60，射门60，传球70，控球60，防守70，身体70，意识70。
</football_career_ledger>
```

这个摘要只用于让模型理解当前职业状态，不写入聊天正文，也不参与 MVU 更新。

## 数据保存位置

职业生涯数据保存在当前聊天的 Luker Chat State 中，命名空间固定为：

```text
football-career-ledger
```

这意味着：

- 不同聊天之间的数据互相隔离。
- 删除插件文件不会自动清理已有聊天的 Chat State。
- 卸载或重装前建议先在“数据管理”导出 JSON。

全局扩展设置只保存插件开关、提示词摘要开关、摘要长度、最近比赛数量、是否包含合同/财务/能力/杂项等显示选项。

## 公开 API

其他插件可以通过 Luker 扩展 API 只读访问账本数据：

```js
const api = Luker.getContext().getExtensionApi('football-career-ledger');

await api.getSnapshot();
await api.getPlayer();
await api.getCurrentSeason();
await api.getSeasonSummary('1998-99');
await api.queryMatches({ limit: 20, notableOnly: true });
await api.getActiveContract();
await api.getContracts();
await api.getFinanceSummary();
await api.queryTransactions({ limit: 20 });
await api.getAbilities();
await api.getAbilityHistory({ limit: 20 });
await api.getMiscellaneous({ limit: 20 });
await api.getPromptSummary();
await api.getMemoryProjection({ notableMatchLimit: 10 });
```

API 返回值是克隆对象，外部插件不能通过修改返回值直接篡改内部状态。查询方法有安全上限，默认不会一次返回全部数据。

控制台测试：

```js
const api = Luker.getContext().getExtensionApi('football-career-ledger');
await api.getSnapshot();
await api.getPromptSummary();
await api.getMemoryProjection();
```

## 数据模型概览

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
  finance: {
    openingBalances: [],
    transactions: []
  },
  abilities: {
    current: {},
    history: []
  },
  miscellaneous: []
}
```

详细说明见 [docs/data-schema.md](docs/data-schema.md)。

## 记忆图集成边界

当前版本不修改 Luker 内置记忆图，也不会主动写入记忆图。

未来如果需要接入记忆图，推荐通过独立桥接层主动读取：

```js
const api = Luker.getContext().getExtensionApi('football-career-ledger');
const projection = await api.getMemoryProjection({ notableMatchLimit: 10 });
```

`getMemoryProjection()` 返回压缩语义数据，适合投喂长期记忆或外部规划系统，但仍然不应替代插件账本本身。

详细说明见 [docs/memory-graph-integration.md](docs/memory-graph-integration.md)。

## 安装

通过 Luker 第三方扩展安装器安装 GitHub URL：

```text
https://github.com/<your-github-user>/Football-Career-Ledger
```

安卓 APK 中同样打开扩展管理，粘贴同一个 GitHub URL。安装器会把仓库克隆到 `third-party/Football-Career-Ledger`，读取仓库根目录的 `manifest.json`，再加载 `index.js` 和 `style.css`。

## 使用流程

1. 安装并启用插件。
2. 在扩展设置里打开“足球生涯账本”面板。
3. 在“概览”填写球员、球队、位置和当前赛季。
4. 在“比赛、合同、财务、能力、杂项”中手动录入记录。
5. 如需让模型参考账本，开启“提示词摘要注入”。
6. 在“数据管理”导出 JSON 备份，或运行 API 自检。

## 导入导出

“数据管理”页支持：

- 导出完整 JSON。
- 导入 JSON。
- 下载示例数据。
- 清空当前聊天数据。
- 运行 API 自检。

导入前会校验 `schemaVersion`、字段类型、金额、能力范围、ID 唯一性和引用关系。校验失败不会覆盖原数据。

## 当前已知限制

- 第一版仅提供手动录入，不做自动提取。
- 面板编辑以新增和删除为主，部分记录的细粒度编辑仍可通过导出 JSON 后修改再导入完成。
- 赛季统计依赖已录入的结构化比赛，不会自动读取自然语言正文。
- 能力值当前只能手动保存，不会根据比赛或训练自动增长。
- 门将专属能力维度尚未实现，目前能力维度偏向外场球员。
- 世界书能力规则尚未转为可执行公式，只作为外部规则参考。
- README 截图素材尚未补充。

## 待规划问题

以下问题适合交给统筹规划 AI 评估：

1. 是否需要“模型建议 -> 用户确认 -> 插件写入”的半自动流水线？
2. 比赛结果是否应该支持从模型回复中抽取为待确认草稿？
3. 能力值是否应该引入“成长建议队列”，并要求每次变更必须有原因和来源？
4. 是否需要把 `足球.json` 的能力评分锚点整理成插件内可读的规则摘要？
5. 门将是否需要独立 schema 和 UI，还是先保持外场球员版本？
6. 是否需要赛季结束结算页，例如赛季总结、年度奖项、合同谈判、转会意向？
7. 是否需要更细的比赛字段，例如赛事阶段、位置、球队角色、关键事件、伤病、疲劳？
8. 是否需要和 Luker 记忆图做桥接，还是继续保持插件只读 API 边界？

## 开发

```bash
npm test
npm run check
```

测试使用 Node 自带 `node:test`，没有运行时构建步骤。

## 升级

如果 `auto_update` 开启，Luker 会基于第三方扩展 Git 仓库检查更新。也可以在扩展管理中手动更新，或删除后重新安装。

## 卸载与备份

卸载前建议进入“数据管理”，点击“导出完整 JSON”。恢复时在同一页粘贴 JSON 并确认导入。

在 Luker 扩展管理中删除第三方扩展只会删除插件文件，不会自动清理每个聊天中已有的 Chat State 数据。

## 问题反馈

在 GitHub 仓库 issue 中反馈，并附上 Luker 版本、插件版本、浏览器或 APK 环境、控制台错误和可复现步骤。
