import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAMES } from '../game/catalog';
import { createInitialState } from '../game/engine';
import type { SaveGame } from '../game/types';
import App from './App';

beforeEach(() => vi.stubGlobal('window', {
  innerWidth: 1366, innerHeight: 768,
  matchMedia: () => ({ matches: false }),
}));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const renderStore = (state: SaveGame) => renderToStaticMarkup(
  <App state={state} incomeTotals={{}} onAction={() => {}} notice={null} onDismissNotice={() => {}}/>,
);

describe('store discovery presentation', () => {
  it('renders public cover URLs under the GitHub Pages project path', () => {
    vi.stubEnv('BASE_URL', '/install-game-simulator/');
    const html = renderStore(createInitialState());
    expect(html).toContain('src="/install-game-simulator/assets/covers/red-alert.png"');
    expect(html).toContain('src="/install-game-simulator/assets/covers/legend-sword.png"');
    expect(html).not.toContain('src="/assets/');
  });

  it('shows only two real games on a new save without leaking locked titles or covers', () => {
    const html = renderStore(createInitialState());
    expect(html).not.toContain('梗游戏专区');
    expect(html.match(/class="game-card locked-game-card"/g)).toHaveLength(30);
    for (const game of GAMES.slice(0, 2)) {
      expect(html).toContain(game.title);
      expect(html).toContain(game.cover);
    }
    for (const game of GAMES.slice(2)) {
      expect(html).not.toContain(game.title);
      expect(html).not.toContain(game.cover);
    }
    expect(html).toContain('再首次安装 1 款不同游戏，揭晓下一批 2 款。');
  });

  it('reveals the next batch immediately after a first installation', () => {
    const state = createInitialState();
    state.collected = [GAMES[0].id];
    const html = renderStore(state);
    expect(html.match(/class="game-card locked-game-card"/g)).toHaveLength(28);
    for (const game of GAMES.slice(0, 4)) expect(html).toContain(game.title);
    for (const game of GAMES.slice(4)) expect(html).not.toContain(game.cover);
  });

  it('keeps an older save purchased game visible without revealing its whole batch', () => {
    const state = createInitialState();
    state.owned.push(GAMES[31].id);
    const html = renderStore(state);
    expect(html).toContain(GAMES[31].title);
    expect(html).toContain(GAMES[31].cover);
    expect(html).not.toContain(GAMES[30].title);
    expect(html.match(/class="game-card locked-game-card"/g)).toHaveLength(29);
  });
});
