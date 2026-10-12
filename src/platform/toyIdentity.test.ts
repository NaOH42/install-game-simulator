import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TOY = 'https://www.bilibilitoy.com/toy/install-game-simulator/index.html';
const PARENT = 'https://www.bilibili.com';

function browser(href = TOY, ancestorOrigins = [PARENT]) {
  const parent = { location: { get href(): string { throw new Error('cross-origin'); } } };
  const instance = { location: { href, ancestorOrigins }, parent, toy: undefined as unknown, addEventListener: vi.fn() };
  vi.stubGlobal('window', instance);
  vi.stubGlobal('navigator', { userActivation: { isActive: true } });
  return instance;
}

function documentMock() {
  const scripts: Array<{ onload: (() => void) | null; onerror: (() => void) | null; src: string; remove: ReturnType<typeof vi.fn> }> = [];
  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({ onload: null, onerror: null, src: '', remove: vi.fn() })),
    head: { appendChild: vi.fn((script) => scripts.push(script)) },
  });
  return scripts;
}

beforeEach(() => vi.resetModules());
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('TOY public profile adapter', () => {
  it('accepts official content and preview frames with a verified Bilibili parent', async () => {
    const { isToyHost } = await import('./toyIdentity');
    browser();
    expect(isToyHost()).toBe(true);
    browser('https://www.bilibilitoy.com/toy/preview/preview_test/index.html');
    expect(isToyHost()).toBe(true);
    const direct = browser('https://www.bilibili.com/toy/install-game-simulator/index.html');
    direct.parent = direct;
    expect(isToyHost()).toBe(true);
  });

  it.each([
    ['http://www.bilibilitoy.com/toy/game/index.html', [PARENT]],
    ['https://www.bilibilitoy.com.evil.test/toy/game/index.html', [PARENT]],
    ['https://www.bilibilitoy.com:8080/toy/game/index.html', [PARENT]],
    ['https://evil.test/toy/game/index.html?host=www.bilibili.com', [PARENT]],
    [TOY, ['https://www.bilibili.com.evil.test']],
    [TOY, ['http://www.bilibili.com']],
    ['https://www.bilibili.com/toy/publish/guide', [PARENT]],
    ['https://www.bilibilitoy.com/other/index.html', [PARENT]],
  ])('rejects unsupported or forged host %s %s', async (href, ancestors) => {
    browser(href as string, ancestors as string[]);
    const scripts = documentMock();
    const { isToyHost, prepareToyIdentity, loginToyIdentity } = await import('./toyIdentity');
    expect(isToyHost()).toBe(false);
    expect(await prepareToyIdentity()).toBe(false);
    expect((await loginToyIdentity()).status).toBe('unavailable');
    expect(scripts).toHaveLength(0);
  });

  it.each([[], ['null']])('supports no-referrer frames (%s), but filters forged SDK messages by source and exact origin', async (...args) => {
    const context = browser(TOY, args as string[]);
    context.toy = { getUserProfile: vi.fn() };
    const { isToyHost, prepareToyIdentity } = await import('./toyIdentity');
    expect(isToyHost()).toBe(true);
    expect(await prepareToyIdentity()).toBe(true);
    expect(context.addEventListener).toHaveBeenCalledWith('message', expect.any(Function), true);
    const listener = context.addEventListener.mock.calls[0][1];
    const makeMessage = (origin: string, source: unknown = context.parent) => ({ data: { ns: 'toy-sdk-rpc', type: 'hello' }, source, origin, stopImmediatePropagation: vi.fn() });
    const real = makeMessage(PARENT);
    listener(real);
    expect(real.stopImmediatePropagation).not.toHaveBeenCalled();
    const forged = makeMessage('https://www.bilibili.com.evil.test');
    listener(forged);
    expect(forged.stopImmediatePropagation).toHaveBeenCalledOnce();
    const sibling = makeMessage(PARENT, {});
    listener(sibling);
    expect(sibling.stopImmediatePropagation).toHaveBeenCalledOnce();
  });

  it('keeps local and unauthenticated card generation independent of SDK requests', async () => {
    const context = browser('http://127.0.0.1:5173/');
    const getUserProfile = vi.fn();
    context.toy = { getUserProfile };
    const { readToyIdentity, loginToyIdentity } = await import('./toyIdentity');
    expect((await readToyIdentity()).status).toBe('unavailable');
    expect((await loginToyIdentity()).status).toBe('unavailable');
    expect(getUserProfile).not.toHaveBeenCalled();
    context.location.href = TOY;
    expect((await readToyIdentity()).status).toBe('guest');
    expect(getUserProfile).not.toHaveBeenCalled();
  });

  it('prepares the official script once, without opening a profile prompt', async () => {
    const context = browser();
    const scripts = documentMock();
    const { prepareToyIdentity, readToyIdentity } = await import('./toyIdentity');
    const first = prepareToyIdentity();
    const second = prepareToyIdentity();
    expect(first).toBe(second);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe('https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js');
    const getUserProfile = vi.fn();
    context.toy = { getUserProfile };
    scripts[0].onload?.();
    expect(await first).toBe(true);
    expect((await readToyIdentity()).status).toBe('guest');
    expect(getUserProfile).not.toHaveBeenCalled();
  });

  it('bounds script loading and allows a later manual preparation retry', async () => {
    vi.useFakeTimers();
    browser();
    const scripts = documentMock();
    const { prepareToyIdentity } = await import('./toyIdentity');
    const loading = prepareToyIdentity();
    await vi.advanceTimersByTimeAsync(8001);
    expect(await loading).toBe(false);
    expect(scripts[0].remove).toHaveBeenCalled();
    const retry = prepareToyIdentity();
    expect(scripts).toHaveLength(2);
    scripts[1].onerror?.();
    expect(await retry).toBe(false);
  });

  it('invokes official profile API synchronously during the click, keeps only public card fields', async () => {
    const context = browser();
    const getUserProfile = vi.fn().mockResolvedValue({ nickname: '测试装机玩家', avatar: '//p0.hdslb.com/bfs/face/test.jpg', toyOpenId: 'private-toy-id', uid: 'unexpected-field' });
    context.toy = { getUserProfile };
    const { loginToyIdentity, readToyIdentity } = await import('./toyIdentity');
    const pending = loginToyIdentity();
    expect(getUserProfile).toHaveBeenCalledOnce();
    const result = await pending;
    expect(result).toEqual({ status: 'ready', user: { name: '测试装机玩家', avatarUrl: 'https://p0.hdslb.com/bfs/face/test.jpg' } });
    expect(JSON.stringify(result)).not.toContain('private-toy-id');
    result.user!.name = 'changed';
    expect((await readToyIdentity()).user?.name).toBe('测试装机玩家');
    expect(getUserProfile).toHaveBeenCalledOnce();
  });

  it('does not request profile data without a click or before the SDK is ready', async () => {
    const context = browser();
    const { loginToyIdentity } = await import('./toyIdentity');
    expect((await loginToyIdentity()).status).toBe('unavailable');
    const getUserProfile = vi.fn();
    context.toy = { getUserProfile };
    vi.stubGlobal('navigator', { userActivation: { isActive: false } });
    expect((await loginToyIdentity()).status).toBe('guest');
    expect(getUserProfile).not.toHaveBeenCalled();
  });

  it.each(['javascript:alert(1)', 'data:image/svg+xml,unsafe', 'https://p0.hdslb.com.evil.test/avatar.jpg', 'https://evil.test/avatar.jpg'])('omits an untrusted avatar URL: %s', async (avatar) => {
    browser().toy = { getUserProfile: vi.fn().mockResolvedValue({ nickname: '玩家', avatar }) };
    const { loginToyIdentity } = await import('./toyIdentity');
    expect((await loginToyIdentity()).user).toEqual({ name: '玩家', avatarUrl: null });
  });

  it.each([
    ['user_denied', 'guest'], ['not_logged_in', 'guest'], ['unsupported', 'unavailable'], ['network_error', 'unavailable'],
  ])('returns a usable guest fallback on %s', async (type, status) => {
    browser().toy = { getUserProfile: vi.fn().mockRejectedValue({ type, secret: 'do-not-expose' }) };
    const { loginToyIdentity } = await import('./toyIdentity');
    const result = await loginToyIdentity();
    expect(result.status).toBe(status);
    expect(result.user).toBeNull();
    expect(JSON.stringify(result)).not.toContain('do-not-expose');
  });

  it('bounds a hanging consent request, prevents duplicate dialogs and ignores late identity data', async () => {
    vi.useFakeTimers();
    let finish!: (value: unknown) => void;
    const getUserProfile = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    browser().toy = { getUserProfile };
    const { loginToyIdentity, readToyIdentity } = await import('./toyIdentity');
    const pending = loginToyIdentity();
    expect(loginToyIdentity()).toBe(pending);
    await vi.advanceTimersByTimeAsync(60001);
    expect((await pending).status).toBe('unavailable');
    await loginToyIdentity();
    expect(getUserProfile).toHaveBeenCalledOnce();
    finish({ nickname: 'late profile', avatar: '' });
    await vi.advanceTimersByTimeAsync(1);
    expect((await readToyIdentity()).user).toBeNull();
  });

  it('saves an App card only when the official capability and success receipt are present', async () => {
    const isSupport = vi.fn().mockResolvedValue(true);
    const saveImageToAlbum = vi.fn().mockResolvedValue({ localPath: '/album/card.png' });
    browser().toy = { getUserProfile: vi.fn(), isSupport, saveImageToAlbum };
    vi.stubGlobal('navigator', { userAgent: 'BiliApp', userActivation: { isActive: true } });
    const { saveToyCardImage, prepareToyIdentity } = await import('./toyIdentity');
    expect(await prepareToyIdentity()).toBe(true);
    expect(saveImageToAlbum).not.toHaveBeenCalled();
    const saving = saveToyCardImage('data:image/png;base64,AAAA');
    expect(saveImageToAlbum).toHaveBeenCalledOnce();
    expect(await saving).toBe(true);
    expect(isSupport).toHaveBeenCalledWith('saveImageToAlbum');
    expect(saveImageToAlbum).toHaveBeenCalledWith({ base64Data: 'data:image/png;base64,AAAA', hintMsg: '将你的装机成果卡保存到相册' });
    saveImageToAlbum.mockResolvedValue({});
    expect(await saveToyCardImage('data:image/png;base64,AAAA')).toBe(false);
  });

  it('falls back from album saving in a browser, on unsupported capabilities, and on large data', async () => {
    const isSupport = vi.fn().mockResolvedValue(false);
    const saveImageToAlbum = vi.fn();
    browser().toy = { getUserProfile: vi.fn(), isSupport, saveImageToAlbum };
    const { saveToyCardImage } = await import('./toyIdentity');
    expect(await saveToyCardImage('data:image/png;base64,AAAA')).toBe(false);
    expect(isSupport).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', { userAgent: 'BiliApp', userActivation: { isActive: true } });
    expect(await saveToyCardImage('data:image/png;base64,AAAA')).toBe(false);
    expect(await saveToyCardImage(`data:image/png;base64,${'A'.repeat(5 * 1024 * 1024)}`)).toBe(false);
    expect(saveImageToAlbum).not.toHaveBeenCalled();
  });
});
