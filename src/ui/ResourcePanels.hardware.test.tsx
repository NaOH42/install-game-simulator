import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HARDWARE } from '../game/catalog';
import { createInitialState } from '../game/engine';
import { sortedHardwareOptions } from '../game/hardwarePresentation';
import type { HardwareKey, SaveGame } from '../game/types';
import { HardwareMarketplace } from './ResourcePanels';

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, select: vi.fn() }));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: () => [hooks.values[hooks.cursor++], hooks.select],
}));

type ElementProps = { children?: ReactNode; className?: string; onClick?: () => void; disabled?: boolean; 'aria-pressed'?: boolean };
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function marketplace(state: SaveGame, key: HardwareKey, option: number, onAction = vi.fn()) {
  hooks.cursor = 0;
  hooks.values = [key, option];
  return elements(HardwareMarketplace({ state, onAction }));
}
const isOption = (element: ReactElement<ElementProps>) => element.props.className?.split(' ').includes('hardware-option');
const checkout = (tree: ReactElement<ElementProps>[]) => tree.find(element => element.props.className === 'xp-button primary')!;

beforeEach(() => hooks.select.mockClear());

describe('hardware counter selection after display sorting', () => {
  it('selects a branch by its saved option rather than its visual row, then buys that same model', () => {
    const state = createInitialState();
    state.points = 100_000;
    const key = 'cpu';
    const display = sortedHardwareOptions(HARDWARE[key]);
    const branchRow = display.findIndex(item => item.option === 3);
    expect(branchRow).not.toBe(3);
    const options = marketplace(state, key, 0).filter(isOption);
    options[branchRow].props.onClick!();
    expect(hooks.select).toHaveBeenCalledWith(3);

    const onAction = vi.fn();
    checkout(marketplace(state, key, 3, onAction)).props.onClick!();
    expect(onAction).toHaveBeenCalledWith({ type: 'upgrade', key, option: 3 });
  });

  it('highlights an equipped branch and sends the original index when swapping to an owned flagship', () => {
    const state = createInitialState();
    state.hardware.gpu = 3;
    state.ownedHardware.gpu = [0, 3, 4];
    const display = sortedHardwareOptions(HARDWARE.gpu);
    const options = marketplace(state, 'gpu', 3).filter(isOption);
    const branchRow = display.findIndex(item => item.option === 3);
    expect(options[branchRow].props['aria-pressed']).toBe(true);
    expect(options[branchRow].props.className).toContain('equipped');

    const onAction = vi.fn();
    const button = checkout(marketplace(state, 'gpu', 4, onAction));
    expect(button.props.disabled).toBe(false);
    button.props.onClick!();
    expect(onAction).toHaveBeenCalledWith({ type: 'equipHardware', key: 'gpu', option: 4 });
  });
});
