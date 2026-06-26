# 记忆图集成边界

本插件在 `v0.1.0` 只注册只读 API，不修改 Luker 内置记忆图，也不会主动写入记忆图。

注册 API 不会让记忆图自动调用本插件。必须由记忆图本身或一个独立桥接插件主动调用：

```js
const api = Luker.getContext().getExtensionApi('football-career-ledger');
const projection = await api.getMemoryProjection({ notableMatchLimit: 10 });
```

`getMemoryProjection()` 返回压缩语义数据：

```js
{
  currentCareerState: "...",
  currentSeasonSummary: "...",
  notableMatches: [],
  contractMilestones: [],
  abilityMilestones: [],
  financialMilestones: []
}
```

普通比赛不会默认出现在 `notableMatches` 中，只有 `notable: true` 的比赛才会返回。
