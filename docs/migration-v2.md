# v2 迁移说明

`v0.4.0` 将数据结构从 `schemaVersion: 1` 升级到 `schemaVersion: 2`。

## 自动迁移

插件读取 Chat State 或导入 JSON 时会调用：

```js
migrateState(rawState)
```

如果发现旧数据，会通过 `migrateStateV1ToV2(oldState)` 补齐新字段。

## 保留内容

迁移会保留：

- 球员基础资料。
- 赛季。
- 比赛。
- 合同。
- 期初余额和财务流水。
- 当前能力和能力历史。
- 杂项。

迁移不会改变历史金额、比赛统计、能力数值或记录 id。

## 新增默认值

旧数据缺少的新字段会补默认值：

- `player.currentTeam` 默认使用旧 `currentClub`。
- `player.secondaryPositions` 默认 `[]`。
- `player.careerStage` 默认 `youth`。
- `player.squadRole` 默认 `rotation`。
- 正式记录补 `meta.source.type = "migration"`。
- `drafts` 默认 `[]`。
- `operationHistory` 默认 `[]`。

## 失败行为

导入或迁移后会运行 `validateState(state)`。如果校验失败，导入流程不会覆盖当前聊天数据。

## 回滚

升级前建议在“数据管理”导出完整 JSON。若需要回滚插件文件，应先保留导出的 v2 JSON；旧版本不保证能读取 v2 数据。
