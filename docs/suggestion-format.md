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
