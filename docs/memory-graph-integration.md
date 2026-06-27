# 记忆图集成边界

本插件不修改宿主内置记忆图或向量记忆，也不会主动写入这些系统。

本版本只提供只读 API：

```js
const context = globalThis.Luker?.getContext?.() ?? globalThis.SillyTavern?.getContext?.();
const api = context.getExtensionApi?.('football-career-ledger');
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

边界：

- 不开发独立记忆图桥接项目。
- 不修改宿主记忆图核心代码。
- 不把待确认草稿作为已发生事实输出。
- 记忆图不是比赛、合同、财务、能力和职业履历的权威来源。
- 插件账本仍然是权威结构化数据源。
