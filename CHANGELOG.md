# Changelog

## 0.6.0

- 新增赛季手动总数据覆盖：可在赛季编辑表单（随时）或结束赛季表单中手动填写出场、首发、分钟、进球、助攻，覆盖按比赛自动统计的数值；留空则继续使用自动统计。适合不想逐场录入比赛的用法。
- `summarizeSeason` 现在返回生效数值（已应用手动覆盖），并附带 `autoTotals`（纯比赛聚合）与 `hasManualTotals`，赛季列表、提示词摘要、历史赛季表和赛季结算摘要均按生效数值显示，存在覆盖时列表会标注“·手动”。
- 修复“清空本聊天”无法彻底重置的问题：清空时改为先写入一份全新的初始状态（再尽力删除存档），确保 `miscellaneous`（含 `career_start` 标记）与能力历史一并清空，可重新进行开局建档。
- 同步更新数据结构文档与测试。

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
