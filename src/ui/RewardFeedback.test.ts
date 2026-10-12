import { describe, expect, it } from 'vitest';
import { GAME_MAP } from '../game/catalog';
import { createInitialState } from '../game/engine';
import { getFeedbackChanges, getIncomeChanges } from './RewardFeedback';
import { createCompletionQueue, enqueueCompletions, finishCompletion } from './completionQueue';

describe('reward feedback accounts for actual earnings', () => {
  it('does not treat purchases or hardware spending as income', () => {
    const before = createInitialState();
    const after = { ...before, points: before.points - 70, owned: [...before.owned, 'legend-sword'] };
    expect(getFeedbackChanges(before, after).income).toBe(0);
  });

  it('subtracts a new collection reward from earned and keeps only passive income', () => {
    const before = createInitialState();
    const reward = GAME_MAP['red-alert'].reward;
    const after = { ...before, earned: before.earned + reward + .3, installed: ['red-alert'], collected: ['red-alert'] };
    const result = getFeedbackChanges(before, after);
    expect(result.income).toBeCloseTo(.3);
    expect(result.completions).toEqual([{ gameId: 'red-alert', firstInstall: true, reward }]);
  });

  it('presents reinstalls with zero first-install reward', () => {
    const before = { ...createInitialState(), collected: ['red-alert'] };
    const after = { ...before, installed: ['red-alert'] };
    const result = getFeedbackChanges(before, after);
    expect(result.income).toBe(0);
    expect(result.completions).toEqual([{ gameId: 'red-alert', firstInstall: false, reward: 0 }]);
  });

  it('aggregates simultaneous completions without counting their rewards twice', () => {
    const before = createInitialState();
    const ids = ['red-alert', 'legend-sword', 'need-parking'];
    const reward = ids.reduce((sum, id) => sum + GAME_MAP[id].reward, 0);
    const after = { ...before, installed: ids, collected: ids, earned: before.earned + reward + 1.25 };
    const result = getFeedbackChanges(before, after);
    expect(result.income).toBeCloseTo(1.25);
    expect(result.completions.map(item => item.gameId)).toEqual(ids);
    expect(getFeedbackChanges(after, { ...after }).completions).toEqual([]);
    expect(getFeedbackChanges(after, { ...after }).income).toBe(0);
  });

  it('does not emit completion or new income from uninstalling a game', () => {
    const before = { ...createInitialState(), installed: ['red-alert'], collected: ['red-alert'] };
    const after = { ...before, installed: [] };
    expect(getFeedbackChanges(before, after)).toEqual({ income: 0, completions: [], reset: false });
  });

  it('observes successive state snapshots once while queueing first installs and later reinstalls', () => {
    let previous = createInitialState();
    let queue = createCompletionQueue();
    const observe = (current: typeof previous, visible = true) => {
      queue = enqueueCompletions(queue, getFeedbackChanges(previous, current).completions, visible);
      previous = current;
    };
    const completed = { ...previous, installed: ['red-alert', 'legend-sword'], collected: ['red-alert', 'legend-sword'], earned: previous.earned + 360 };
    observe(completed, false);
    observe({ ...completed }, false);
    expect(queue.active).toBeNull();
    expect(queue.waiting).toHaveLength(2);
    observe({ ...completed });
    const activeId = queue.active!.id;
    expect(queue.active?.items[0].gameId).toBe('red-alert');
    observe({ ...completed, installed: ['legend-sword'] });
    observe({ ...completed });
    expect(queue.active!.id).toBe(activeId);
    expect(queue.waiting.map(entry => [entry.items[0].gameId, entry.totalReward])).toEqual([['legend-sword', 200], ['red-alert', 0]]);
    observe({ ...completed });
    queue = finishCompletion(queue, activeId, true);
    expect(queue.active?.items[0].gameId).toBe('legend-sword');
    expect(queue.waiting).toHaveLength(1);
  });
});

describe('per-game feedback receipts', () => {
  it('uses individual actual deltas instead of copying or proportionally splitting the total', () => {
    const previous = { 'red-alert': 12, 'legend-sword': 4 };
    const current = { 'red-alert': 12.6, 'legend-sword': 4.16 };
    const changes = getIncomeChanges(previous, current);
    expect(changes.amounts['red-alert']).toBeCloseTo(.6);
    expect(changes.amounts['legend-sword']).toBeCloseTo(.16);
    expect(changes.amount).toBeCloseTo(.76);
    expect(changes.reset).toBe(false);
    expect(previous).toEqual({ 'red-alert': 12, 'legend-sword': 4 });
  });

  it('does not replay the initial totals, duplicate the same receipt, or invent income for uninstalled games', () => {
    const baseline = { 'red-alert': 17, 'legend-sword': 9 };
    expect(getIncomeChanges({ ...baseline }, baseline)).toEqual({ amounts: {}, amount: 0, reset: false });
    const current = { ...baseline, 'legend-sword': 9.96 };
    const changes = getIncomeChanges(baseline, current);
    expect(changes.amounts['red-alert']).toBeUndefined();
    expect(changes.amounts['legend-sword']).toBeCloseTo(.96);
    expect(getIncomeChanges(current, { ...current })).toEqual({ amounts: {}, amount: 0, reset: false });
  });

  it('combines background receipts once, including a game installed during that interval', () => {
    const before = { 'red-alert': 1 };
    const middle = { 'red-alert': 11, 'legend-sword': 3.2 };
    const after = { 'red-alert': 15, 'legend-sword': 9.6 };
    const combined = getIncomeChanges(before, after);
    const first = getIncomeChanges(before, middle);
    const second = getIncomeChanges(middle, after);
    expect(combined.amounts['red-alert']).toBeCloseTo(14);
    expect(combined.amounts['legend-sword']).toBeCloseTo(9.6);
    expect(combined.amount).toBeCloseTo(first.amount + second.amount);
    expect(getIncomeChanges(after, after).amount).toBe(0);
  });

  it('recognizes a new session baseline and clears old pending receipts instead of replaying them', () => {
    expect(getIncomeChanges({ 'red-alert': 14 }, {})).toEqual({ amounts: {}, amount: 0, reset: true });
    expect(getIncomeChanges({ 'red-alert': 14, 'legend-sword': 9 }, { 'red-alert': 1, 'legend-sword': 9.2 })).toEqual({ amounts: {}, amount: 0, reset: true });
    expect(getIncomeChanges({}, { 'red-alert': .4 }).amounts['red-alert']).toBeCloseTo(.4);
  });
});
