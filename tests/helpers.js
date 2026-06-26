import { createExampleState } from '../src/import-export.js';

export function exampleState() {
  return createExampleState();
}

export function makeManyMatches(count = 500) {
  const state = createExampleState();
  state.matches = Array.from({ length: count }, (_, index) => ({
    id: `match-${index}`,
    seasonId: '1998-99',
    date: `1998-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
    competition: index % 2 ? '青年联赛' : '杯赛',
    club: '拜仁慕尼黑青年队',
    opponent: `对手${index}`,
    homeAway: index % 3 === 0 ? 'home' : 'away',
    goalsFor: index % 5,
    goalsAgainst: index % 4,
    started: index % 2 === 0,
    minutes: 90,
    goals: index % 7 === 0 ? 1 : 0,
    assists: index % 9 === 0 ? 1 : 0,
    yellowCards: index % 11 === 0 ? 1 : 0,
    redCards: 0,
    rating: 6 + (index % 30) / 10,
    notable: index % 100 === 0,
    notes: '',
  }));
  return state;
}
