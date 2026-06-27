# 模型建议格式

插件只解析显式标签，不分析普通正文：

```xml
<football_ledger_suggestion>
{
  "type": "match",
  "payload": {}
}
</football_ledger_suggestion>
```

一条 assistant 回复可以包含多个建议块。所有建议都会先进入草稿队列，必须由用户确认后才写入正式账本。

## 通用规则

- 只有比赛正式结束、合同正式签订、款项实际发生、能力评估正式完成时，才输出建议块。
- 不要为普通训练、口头讨论、未完成谈判或未来计划输出正式建议。
- 建议块放在叙事正文之后。
- 不要在建议块中虚构未发生的数据。
- 模型不得假设建议已经写入账本。

## 比赛

```xml
<football_ledger_suggestion>
{
  "type": "match",
  "payload": {
    "date": "1998-08-15",
    "seasonId": "1998-99",
    "competition": "德国青年联赛",
    "club": "拜仁慕尼黑青年队",
    "opponent": "多特蒙德青年队",
    "homeAway": "home",
    "goalsFor": 3,
    "goalsAgainst": 1,
    "started": false,
    "minutes": 20,
    "goals": 0,
    "assists": 1,
    "yellowCards": 0,
    "redCards": 0,
    "rating": 7.2,
    "notable": false,
    "notes": ""
  }
}
</football_ledger_suggestion>
```

## 合同

```xml
<football_ledger_suggestion>
{
  "type": "contract",
  "payload": {
    "club": "拜仁慕尼黑",
    "contractType": "professional",
    "startDate": "1999-07-01",
    "endDate": "2002-06-30",
    "wageAmountMinor": 70000,
    "wageCurrency": "DEM",
    "wagePeriod": "weekly",
    "bonuses": "",
    "clauses": "",
    "active": true,
    "notes": ""
  }
}
</football_ledger_suggestion>
```

## 财务

```xml
<football_ledger_suggestion>
{
  "type": "transaction",
  "payload": {
    "date": "1999-07-02",
    "direction": "income",
    "category": "signing_bonus",
    "amountMinor": 500000,
    "currency": "DEM",
    "description": "首份职业合同签字费",
    "relatedContractId": null,
    "notes": ""
  }
}
</football_ledger_suggestion>
```

## 能力变化

```xml
<football_ledger_suggestion>
{
  "type": "ability_change",
  "payload": {
    "date": "1999-01-01",
    "ability": "passing",
    "delta": 1,
    "evaluationPeriod": {
      "start": "1998-10-01",
      "end": "1998-12-31"
    },
    "reason": "连续承担组织职责，三个月内多次完成关键助攻。",
    "evidence": [
      "连续获得稳定出场",
      "传球和组织职责明显增加"
    ],
    "sourceRecordIds": []
  }
}
</football_ledger_suggestion>
```

能力建议确认时由插件计算 `after = current + delta`。单次 `delta` 限制为 `-2..2`。

## 杂项

```xml
<football_ledger_suggestion>
{
  "type": "miscellaneous",
  "payload": {
    "date": "1999-03-10",
    "key": "squad_role",
    "value": "一线队边缘球员",
    "tags": ["职业阶段"],
    "notes": ""
  }
}
</football_ledger_suggestion>
```

## 开局建档（career_start）

`career_start` 只用于职业生涯开局建档，一次性写入球员基础资料、开局赛季、七项初始能力和可选开场白 / 开局备注。

- 只有用户明确完成开局建档、确认创建角色，或外部建档 UI 输出正式建档结果时才使用。
- 不要为普通剧情、训练、比赛、转会传闻输出该类型。
- 它会生成待确认草稿；用户在插件内确认后才会写入正式账本。
- 已有能力历史时，确认 `career_start` 会失败并把草稿标记为 invalid，不会默认覆盖既有初始能力。
- 同一账本只允许成功确认一次：确认成功后会写入 `miscellaneous` 系统标记 `key=career_start`，后续 `career_start` 草稿确认时会失败并标记为 invalid，不会修改 player、season、abilities、miscellaneous。撤销首次确认后标记消失，可重新确认。
- 外部建档 UI 不应调用插件写入 API，正式写入只能通过插件内部草稿确认流程完成。

```xml
<football_ledger_suggestion>
{
  "type": "career_start",
  "payload": {
    "date": "1998-07-01",
    "openingText": "开场白正文……",
    "player": {
      "name": "张三",
      "currentClub": "拜仁慕尼黑青年队",
      "currentTeam": "拜仁慕尼黑青年队",
      "primaryPosition": "中前卫／全能中场",
      "secondaryPositions": ["前腰"],
      "careerStage": "youth",
      "squadRole": "prospect",
      "defaultCurrency": "DEM"
    },
    "season": {
      "id": "1998-99",
      "label": "1998/99",
      "club": "拜仁慕尼黑青年队",
      "startedAt": "1998-07-01",
      "endedAt": null,
      "status": "active",
      "notes": "开局赛季"
    },
    "abilities": {
      "pace": 68,
      "shooting": 62,
      "passing": 70,
      "control": 70,
      "defending": 58,
      "physical": 66,
      "awareness": 68
    },
    "notes": "开局建档"
  }
}
</football_ledger_suggestion>
```
