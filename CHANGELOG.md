# Changelog

## 0.5.0

- 新增开局建档草稿类型 `career_start`，确认后一次性写入球员基础资料、开局赛季、七项初始能力和可选开场白 / 开局备注。
- 建议块解析改为覆盖任意非 system 消息，支持解析用户消息中显式的 `<football_ledger_suggestion>`，便于外部建档 UI 把开场白与 `career_start` 一起发送。
- 事件入口改造为 `processSuggestionMessage()`，兼容 `MESSAGE_SENT` / `USER_MESSAGE_SENT` / `MESSAGE_ADDED` / `MESSAGE_RECEIVED` / `GENERATION_ENDED`，并对无 messageId 的 payload 提供最近消息兜底扫描；去重 key 不含事件类型，避免同一消息重复生成草稿。
- 为 `career_start` 增加“一次性确认”边界：每个账本只能成功确认一次，重复确认会失败并标记草稿为 invalid，不修改 player、season、abilities、miscellaneous；撤销首次确认后边界解除。
- 公开 API 保持只读，未新增任何写入接口；`career_start` 仍必须经过草稿确认流程。
- 同步更新建议格式、数据结构文档与 README。

## 0.4.0

- 升级数据结构到 `schemaVersion: 2`，支持 v1 自动迁移。
- 新增球员职业状态、统一记录元数据、草稿队列和操作历史。
- 新增比赛、赛季、合同、财务、能力、杂项的编辑和删除能力。
- 新增结构化建议块解析、草稿确认、拒绝、删除和去重。
- 新增赛季关闭、赛季结算摘要和创建下一赛季流程。
- 新增最近操作撤销。
- 新增 `minimal`、`standard`、`full` 三档提示词摘要。
- 升级只读公开 API 到 `apiVersion: 2`。
- 优化窄屏和安卓 APK 面板布局。
- 补充 v2 迁移、建议格式和记忆图边界文档。

## 0.1.0

- 初始版本：Chat State 账本、管理面板、导入导出、提示词摘要、公开只读 API 和 Node 测试。
