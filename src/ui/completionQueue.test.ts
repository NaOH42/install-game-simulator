import { describe, expect, it } from 'vitest';
import { advanceCompletionQueue, claimCompletionStart, createCompletionQueue, enqueueCompletions, finishCompletion, resetCompletionQueue, type CompletionItem } from './completionQueue';

const first: CompletionItem = { gameId: 'red-alert', firstInstall: true, reward: 160 };
const second: CompletionItem = { gameId: 'legend-sword', firstInstall: true, reward: 200 };
const third: CompletionItem = { gameId: 'need-parking', firstInstall: true, reward: 170 };

describe('completion playback queue', () => {
  it('plays simultaneous completions one game at a time in arrival order with individual rewards', () => {
    let queue = enqueueCompletions(createCompletionQueue(), [first, second, third], true);
    expect(queue.active?.items).toEqual([first]);
    expect(queue.active?.totalReward).toBe(160);
    expect(queue.waiting.map(entry => entry.items[0].gameId)).toEqual(['legend-sword', 'need-parking']);
    queue = finishCompletion(queue, queue.active!.id, true);
    expect(queue.active?.items).toEqual([second]);
    expect(queue.active?.totalReward).toBe(200);
    queue = finishCompletion(queue, queue.active!.id, true);
    expect(queue.active?.items).toEqual([third]);
    queue = finishCompletion(queue, queue.active!.id, true);
    expect(queue.active).toBeNull();
    expect(queue.waiting).toEqual([]);
  });

  it('leaves the active scene identity untouched when more games complete', () => {
    let queue = enqueueCompletions(createCompletionQueue(), [first], true);
    const active = queue.active;
    queue = enqueueCompletions(queue, [second, third], true);
    expect(queue.active).toBe(active);
    expect(advanceCompletionQueue(queue, true)).toBe(queue);
    expect(queue.waiting).toHaveLength(2);
  });

  it('defers background completions and their start announcements until visible playback', () => {
    let queue = enqueueCompletions(createCompletionQueue(), [first, second], false);
    expect(queue.active).toBeNull();
    expect(claimCompletionStart(queue, queue.waiting[0].id, false).item).toBeNull();
    expect(claimCompletionStart(queue, queue.waiting[0].id, true).item).toBeNull();
    queue = advanceCompletionQueue(queue, true);
    const started = claimCompletionStart(queue, queue.active!.id, true);
    expect(started.item).toEqual(first);
    expect(started.queue.waiting).toHaveLength(1);
    expect(claimCompletionStart(started.queue, started.queue.waiting[0].id, true).item).toBeNull();
  });

  it('keeps a playing scene and its once-only announcement through hiding and resuming', () => {
    let queue = enqueueCompletions(createCompletionQueue(), [first], true);
    queue = claimCompletionStart(queue, queue.active!.id, true).queue;
    const active = queue.active;
    queue = enqueueCompletions(queue, [second], false);
    expect(queue.active).toBe(active);
    expect(finishCompletion(queue, active!.id, false)).toBe(queue);
    expect(advanceCompletionQueue(queue, false)).toBe(queue);
    expect(claimCompletionStart(queue, active!.id, false).item).toBeNull();
    queue = advanceCompletionQueue(queue, true);
    expect(queue.active).toBe(active);
    expect(claimCompletionStart(queue, active!.id, true).item).toBeNull();
    queue = finishCompletion(queue, active!.id, true);
    expect(claimCompletionStart(queue, queue.active!.id, true).item).toEqual(second);
  });

  it('does not replay a sound under repeated mount effects or consume two games on a double finish', () => {
    let queue = enqueueCompletions(createCompletionQueue(), [first, second], true);
    const firstId = queue.active!.id;
    let announced = claimCompletionStart(queue, firstId, true);
    expect(announced.item).toEqual(first);
    queue = announced.queue;
    announced = claimCompletionStart(queue, firstId, true);
    expect(announced.item).toBeNull();
    expect(announced.queue).toBe(queue);
    queue = finishCompletion(queue, firstId, true);
    const secondActive = queue.active;
    expect(finishCompletion(queue, firstId, true)).toBe(queue);
    expect(finishCompletion(queue, firstId, true).active).toBe(secondActive);
    expect(claimCompletionStart(queue, firstId, true).item).toBeNull();
  });

  it('plays a later reinstall of the same game independently with no extra reward', () => {
    const reinstall: CompletionItem = { ...first, firstInstall: false, reward: 0 };
    let queue = enqueueCompletions(createCompletionQueue(), [first, reinstall], true);
    const firstId = queue.active!.id;
    queue = finishCompletion(queue, firstId, true);
    expect(queue.active?.id).not.toBe(firstId);
    expect(queue.active?.items).toEqual([reinstall]);
    expect(queue.active?.totalReward).toBe(0);
    expect(claimCompletionStart(queue, queue.active!.id, true).item).toEqual(reinstall);
  });

  it('clears a replaced session without recycling IDs or letting stale callbacks dismiss new scenes', () => {
    let queue = enqueueCompletions(createCompletionQueue(), [first, second], true);
    const oldId = queue.active!.id;
    queue = resetCompletionQueue(queue);
    expect(queue.active).toBeNull();
    expect(queue.waiting).toEqual([]);
    queue = enqueueCompletions(queue, [third], true);
    expect(queue.active!.id).toBeGreaterThan(oldId);
    expect(finishCompletion(queue, oldId, true)).toBe(queue);
    expect(claimCompletionStart(queue, oldId, true).item).toBeNull();
  });
});
