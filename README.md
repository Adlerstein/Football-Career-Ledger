# Football-Career-Ledger

`足球生涯账本` 是 Luker 前端插件，用于手动保存足球模拟人生中的结构化隐藏状态：比赛、赛季汇总、合同、财务流水、余额、能力值变化和少量杂项事实。

功能截图占位：首版交付先保留截图位置，发布前建议补充桌面端面板和安卓窄屏面板截图。

## 边界

- 插件本身不调用 AI。
- 插件不会自动分析聊天内容。
- 插件不会自动修改能力或财务。
- 插件不会自动模拟比赛、训练、伤病、转会或工资结算。
- 插件不会让记忆图自动读取数据。
- 记忆图或桥接插件必须主动调用公开 API。

## 兼容版本

按 `funnycups/Luker` release 分支当前前端插件文档开发，依赖以下公开 API：

- `Luker.getContext()`
- `context.getChatState()`
- `context.updateChatState()`
- `context.deleteChatState()`
- `context.setExtensionPrompt()`
- `context.registerExtensionApi()`
- `context.getExtensionApi()`
- `context.extensionSettings`
- `context.saveSettingsDebounced()`

## 安装

通过 Luker 第三方扩展安装器安装 GitHub URL：

```text
https://github.com/<your-github-user>/Football-Career-Ledger
```

安卓 APK 中同样打开扩展管理，粘贴同一个 GitHub URL。安装器会把仓库克隆到 `third-party/Football-Career-Ledger`，读取仓库根目录的 `manifest.json`，再加载 `index.js` 和 `style.css`。

## 升级

如果 `auto_update` 开启，Luker 会基于第三方扩展 Git 仓库检查更新。也可以在扩展管理中手动更新或删除后重新安装。

## 使用

1. 安装并启用插件。
2. 在扩展设置里打开“足球生涯账本”面板。
3. 先在“概览”填写球员、球队、位置和当前赛季。
4. 在“比赛、合同、财务、能力、杂项”中手动录入记录。
5. 在“数据管理”导出 JSON 备份，或运行 API 自检。

数据保存位置：职业生涯数据保存在当前聊天的 Luker Chat State 命名空间 `football-career-ledger`，不同聊天互相隔离。全局扩展设置只保存插件开关和摘要选项。

## 导入导出

“数据管理”页支持导出完整 JSON、导入 JSON、下载示例数据和清空当前聊天数据。导入前会校验 `schemaVersion`、字段类型、金额、能力范围、ID 唯一性和引用关系；失败不会覆盖原数据。

## 公开 API

其他插件可读取：

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

## 提示词摘要

摘要注入默认关闭。启用后通过 `context.setExtensionPrompt()` 注入压缩摘要，不写入聊天正文，也不参与 MVU 更新。摘要会遵守最大字符数，数据过多时优先保留当前状态和最近记录。

## 记忆图集成

见 [docs/memory-graph-integration.md](docs/memory-graph-integration.md)。`v0.1.0` 不修改 Luker 记忆图，只提供 `getMemoryProjection()` 给未来桥接插件主动读取。

## 卸载

在 Luker 扩展管理中删除第三方扩展。卸载前建议在“数据管理”导出当前聊天 JSON。删除插件文件不会自动清理每个聊天中已有的 Chat State 数据。

## 备份

进入“数据管理”，点击“导出完整JSON”。恢复时在同一页粘贴 JSON 并确认导入。

## 已知限制

- 第一版仅提供手动录入，不做自动提取。
- 面板编辑以新增和删除为主，部分记录的细粒度编辑仍可通过导出 JSON 后导入完成。
- 未提供截图素材，README 中保留截图占位。

## 开发

```bash
npm test
npm run check
```

测试使用 Node 自带 `node:test`，没有运行时构建步骤。

## 问题反馈

在 GitHub 仓库 issue 中反馈，并附上 Luker 版本、插件版本、浏览器或 APK 环境、控制台错误和可复现步骤。
