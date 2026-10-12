/** Public profile only: the official TOY SDK does not expose a Bilibili UID. */
export type ToyIdentity = { name: string; avatarUrl: string | null };

export type ToyIdentityResult = {
  status: 'ready' | 'guest' | 'unavailable';
  user: ToyIdentity | null;
  message?: string;
};

type ToySdk = {
  getUserProfile(): Promise<unknown>;
  isSupport?(ability: string): Promise<boolean>;
  saveImageToAlbum?(request: { base64Data: string; hintMsg: string }): Promise<unknown>;
};
type ToyWindow = Window & { toy?: ToySdk };

const SDK_URL = 'https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js';
const SDK_ELEMENT_ID = 'achievement-card-toy-sdk';
const SDK_LOAD_TIMEOUT_MS = 8000;
const PROFILE_TIMEOUT_MS = 60000;
const PLATFORM_ORIGIN = 'https://www.bilibili.com';
const CONTENT_ORIGIN = 'https://www.bilibilitoy.com';

let prepared: Promise<boolean> | null = null;
let profileRequest: Promise<ToyIdentityResult> | null = null;
let currentIdentity: ToyIdentity | null = null;
let albumSupported = false;
let guardedWindow: Window | null = null;

function currentWindow(): ToyWindow | null {
  return typeof window === 'undefined' ? null : window as ToyWindow;
}

function hasToyPath(url: URL): boolean {
  // Both published and preview content have their own directory under /toy/.
  return /^\/toy\/(?!publish(?:\/|$)|intro(?:\/|$))[A-Za-z0-9_-]+\//.test(url.pathname);
}

/** Reject lookalike hosts and TOY content embedded by an unrelated parent. */
export function isToyHost(): boolean {
  const browser = currentWindow();
  if (!browser) return false;
  try {
    const url = new URL(browser.location.href);
    if (!hasToyPath(url) || url.username || url.password) return false;
    if (url.origin === PLATFORM_ORIGIN) return browser.parent === browser;
    if (url.origin !== CONTENT_ORIGIN || browser.parent === browser) return false;
    // no-referrer may redact ancestorOrigins to "null". An opaque or unavailable
    // parent is verified by the RPC origin guard, rather than blocking real TOYs.
    const origins = browser.location.ancestorOrigins;
    if (origins?.length && origins[0] !== 'null') return origins[0] === PLATFORM_ORIGIN;
    try {
      const parent = new URL(browser.parent.location.href);
      return parent.origin === PLATFORM_ORIGIN && hasToyPath(parent);
    } catch {
      return true;
    }
  } catch {
    return false;
  }
}

function guardParentMessages(): void {
  const browser = currentWindow();
  if (!browser || browser === guardedWindow || browser.parent === browser) return;
  browser.addEventListener('message', (event: MessageEvent) => {
    const data: unknown = event.data;
    if (!data || typeof data !== 'object' || (data as { ns?: unknown }).ns !== 'toy-sdk-rpc') return;
    // The SDK binds its first parent hello, so filter before its own listener.
    if (event.source !== browser.parent || event.origin !== PLATFORM_ORIGIN) event.stopImmediatePropagation();
  }, true);
  guardedWindow = browser;
}

function sdk(): ToySdk | null {
  const candidate = currentWindow()?.toy;
  return candidate && typeof candidate.getUserProfile === 'function' ? candidate : null;
}

/** Preload when opening the card panel; this never requests a user's profile. */
export function prepareToyIdentity(): Promise<boolean> {
  if (!isToyHost()) return Promise.resolve(false);
  guardParentMessages();
  if (prepared) return prepared;
  const loading = sdk() ? Promise.resolve(true) : new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.id = SDK_ELEMENT_ID;
    script.src = SDK_URL;
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      if (!ready) script.remove();
      resolve(ready);
    };
    const timeout = setTimeout(() => finish(false), SDK_LOAD_TIMEOUT_MS);
    script.onload = () => finish(Boolean(sdk()));
    script.onerror = () => finish(false);
    try {
      document.head.appendChild(script);
    } catch {
      finish(false);
    }
  });
  prepared = loading.then(async (ready) => {
    if (!ready) {
      prepared = null;
      return false;
    }
    const api = sdk();
    if (typeof navigator !== 'undefined' && /BiliApp/i.test(navigator.userAgent) && api?.isSupport && api.saveImageToAlbum) {
      try {
        albumSupported = await bounded(api.isSupport('saveImageToAlbum'), SDK_LOAD_TIMEOUT_MS) === true;
      } catch {
        albumSupported = false;
      }
    }
    return ready;
  });
  return prepared;
}

function cachedResult(): ToyIdentityResult {
  return currentIdentity
    ? { status: 'ready', user: { ...currentIdentity } }
    : { status: 'guest', user: null, message: '点击授权后，可在卡片上展示 B站昵称和头像。' };
}

/** Only reads this page's memory. There is no documented silent profile API. */
export function readToyIdentity(): Promise<ToyIdentityResult> {
  if (!isToyHost()) {
    return Promise.resolve({ status: 'unavailable', user: null, message: '在 B站 TOY 内可添加昵称和头像；现在也可以生成游客卡片。' });
  }
  return Promise.resolve(cachedResult());
}

function avatarUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value);
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    // The SDK documents p0 and also handles the existing i0/i1/i2 CDN aliases.
    if (!/^(?:p0|i[012])\.hdslb\.com$/.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function normalizeProfile(value: unknown): ToyIdentity | null {
  if (!value || typeof value !== 'object') return null;
  const profile = value as Record<string, unknown>;
  if (typeof profile.nickname !== 'string' || !profile.nickname.trim()) return null;
  const name = profile.nickname.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
  if (!name) return null;
  // Deliberately omit toyOpenId and any unexpected fields from the public card.
  return { name, avatarUrl: avatarUrl(profile.avatar) };
}

function failure(error: unknown): ToyIdentityResult {
  const type = error && typeof error === 'object' ? (error as { type?: unknown }).type : null;
  if (type === 'user_denied' || type === 'denied') {
    return { status: 'guest', user: null, message: '未授权昵称和头像，仍可保存游客卡片。' };
  }
  if (type === 'not_logged_in') {
    return { status: 'guest', user: null, message: '请先在 B站登录，再点击添加昵称和头像。' };
  }
  if (type === 'unsupported') {
    return { status: 'unavailable', user: null, message: '当前浏览器不支持 B站资料授权，可在 B站 App 或电脑端 TOY 中重试。' };
  }
  return { status: 'unavailable', user: null, message: '暂时无法获取 B站资料，仍可保存游客卡片。' };
}

/** Call directly from a click handler after prepareToyIdentity has completed. */
export function loginToyIdentity(): Promise<ToyIdentityResult> {
  if (!isToyHost()) return readToyIdentity();
  guardParentMessages();
  if (currentIdentity) return Promise.resolve(cachedResult());
  if (profileRequest) return profileRequest;
  const api = sdk();
  if (!api) {
    return Promise.resolve({ status: 'unavailable', user: null, message: 'B站授权组件尚未准备好，请稍后再点一次；游客卡片可正常保存。' });
  }
  if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.isActive) {
    return Promise.resolve({ status: 'guest', user: null, message: '请点击按钮，授权在卡片中展示 B站昵称和头像。' });
  }
  let operation: Promise<unknown>;
  try {
    // No awaiting script loads or capability checks here: preserve user gesture.
    operation = Promise.resolve(api.getUserProfile());
  } catch (error) {
    return Promise.resolve(failure(error));
  }
  profileRequest = new Promise<ToyIdentityResult>((resolve) => {
    let expired = false;
    const timeout = setTimeout(() => {
      expired = true;
      resolve({ status: 'unavailable', user: null, message: '授权尚未完成，可先保存游客卡片。' });
    }, PROFILE_TIMEOUT_MS);
    operation.then((value) => {
      if (expired) return;
      const identity = normalizeProfile(value);
      if (!identity) {
        resolve(failure(null));
        return;
      }
      currentIdentity = identity;
      resolve(cachedResult());
    }, (error: unknown) => {
      if (!expired) resolve(failure(error));
    }).finally(() => {
      clearTimeout(timeout);
      // Keep a pending SDK consent dialog single-flight even after our timeout.
      profileRequest = null;
    });
  });
  return profileRequest;
}

function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), milliseconds);
    operation.then((result) => { clearTimeout(timer); resolve(result); }, () => { clearTimeout(timer); resolve(null); });
  });
}

/** User-triggered App album save; false lets the UI offer browser download. */
export async function saveToyCardImage(dataUrl: string): Promise<boolean> {
  if (!isToyHost() || typeof navigator === 'undefined' || !/BiliApp/i.test(navigator.userAgent)) return false;
  if (navigator.userActivation && !navigator.userActivation.isActive) return false;
  if (!/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl) || dataUrl.length > 5 * 1024 * 1024) return false;
  const api = sdk();
  if (!albumSupported || !api?.saveImageToAlbum) return false;
  guardParentMessages();
  try {
    // Capability was checked while preparing the panel. Enter the App bridge
    // synchronously in the user's click handler, before the first await.
    const result = await bounded(api.saveImageToAlbum({ base64Data: dataUrl, hintMsg: '将你的装机成果卡保存到相册' }), PROFILE_TIMEOUT_MS);
    return Boolean(result && typeof result === 'object' && typeof (result as { localPath?: unknown }).localPath === 'string' && (result as { localPath: string }).localPath.length);
  } catch {
    return false;
  }
}
