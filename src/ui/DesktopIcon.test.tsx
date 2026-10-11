import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DesktopIcon from './DesktopIcon';
import { desktopPositionKey } from './desktopLayout';

afterEach(() => vi.unstubAllGlobals());

describe('compact icons preserve desktop layout', () => {
  it('does not read or write stored desktop coordinates while visiting or rotating a phone', () => {
    const saved = JSON.stringify({ version: 1, x: 1018, y: 512 });
    const readStorage = vi.fn(() => ({
      length: 1,
      key: () => desktopPositionKey('test:phone-return'),
      getItem: () => saved,
      setItem: vi.fn(),
    }));
    const viewport = {
      innerWidth: 390,
      innerHeight: 844,
      get localStorage() { return readStorage(); },
    };
    vi.stubGlobal('window', viewport);

    for (const [width, height] of [[390, 844], [844, 390], [360, 800]]) {
      viewport.innerWidth = width;
      viewport.innerHeight = height;
      // Even a stale parent snapshot cannot mount desktop layout on a phone.
      const markup = renderToStaticMarkup(<DesktopIcon id="test:phone-return" index={0} compact={false} onOpen={() => {}}>商店</DesktopIcon>);
      expect(markup).toContain('is-compact');
      expect(markup).not.toContain('style=');
    }
    expect(readStorage).not.toHaveBeenCalled();

    viewport.innerWidth = 1366;
    viewport.innerHeight = 768;
    const restored = renderToStaticMarkup(<DesktopIcon id="test:phone-return" index={0} onOpen={() => {}}>商店</DesktopIcon>);
    expect(restored).toContain('left:1018px;top:512px');
    expect(readStorage).toHaveBeenCalledOnce();
  });

  it('honors compact mode without initializing layout even during a wide-screen transition', () => {
    const readStorage = vi.fn();
    vi.stubGlobal('window', { innerWidth: 1366, innerHeight: 768, get localStorage() { return readStorage(); } });
    const markup = renderToStaticMarkup(<DesktopIcon id="test:compact-transition" index={0} compact className="system-shortcut" onOpen={() => {}}>商店</DesktopIcon>);
    expect(markup).toContain('desktop-icon is-compact system-shortcut');
    expect(readStorage).not.toHaveBeenCalled();
  });
});
