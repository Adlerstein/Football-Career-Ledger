export function formatSeasonTotals(totals, style = 'prompt') {
  if (!totals) return '';
  const appearances = totals.appearances ?? 0;
  const starts = totals.starts ?? 0;
  const minutes = totals.minutes ?? 0;
  const goals = totals.goals ?? 0;
  const assists = totals.assists ?? 0;

  if (style === 'compact') {
    return `${appearances}场 / ${starts}首发 / ${minutes}分钟 / ${goals}球 / ${assists}助`;
  }

  return `${appearances}次出场，${starts}次首发，${minutes}分钟，${goals}球，${assists}次助攻`;
}
