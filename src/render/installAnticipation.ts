/** Presentation state only: never copied into the economy save or installation rules. */
export const INSTALL_ANTICIPATION_VARIANTS = [
  'gravity-flip', 'pixel-tunnel', 'crt-collapse', 'tip-gravity', 'system-fault',
] as const;

export type InstallAnticipationVariant = typeof INSTALL_ANTICIPATION_VARIANTS[number];
export const INSTALL_ANTICIPATION_STORAGE_KEY = 'install-simulator.anticipation.v1';
const INACTIVE_ASSIGNMENT_LIMIT = 64;

export interface InstallAnticipationSnapshot {
  version: 1;
  /** Oldest assignment first. Active jobs are never evicted. */
  assignments: [string, InstallAnticipationVariant][];
  /** Next variant is at index zero. */
  bag: InstallAnticipationVariant[];
  last: InstallAnticipationVariant | null;
}

/** A quiet first build-up, with most of the visual acceleration after 90%. */
export function getAnticipationIntensity(progress: number): number {
  if (!Number.isFinite(progress) || progress <= .75) return 0;
  if (progress >= .99) return 1;
  const normalized = (progress - .75) / .24;
  const eased = normalized * normalized;
  return eased * eased * (3 - 2 * eased);
}

function isVariant(value: unknown): value is InstallAnticipationVariant {
  return typeof value === 'string' && (INSTALL_ANTICIPATION_VARIANTS as readonly string[]).includes(value);
}

function isJobId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && /\S/.test(value);
}

function readSnapshot(value: unknown): InstallAnticipationSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.assignments) || !Array.isArray(data.bag)) return undefined;
  if (data.last !== null && !isVariant(data.last)) return undefined;
  if (data.bag.length > INSTALL_ANTICIPATION_VARIANTS.length || !data.bag.every(isVariant)) return undefined;
  if (new Set(data.bag).size !== data.bag.length || (data.last !== null && data.bag.includes(data.last))) return undefined;
  const seen = new Set<string>();
  const assignments: InstallAnticipationSnapshot['assignments'] = [];
  for (const entry of data.assignments) {
    if (!Array.isArray(entry) || entry.length !== 2 || !isJobId(entry[0]) || !isVariant(entry[1]) || seen.has(entry[0])) return undefined;
    seen.add(entry[0]);
    assignments.push([entry[0], entry[1]]);
  }
  if ((assignments.at(-1)?.[1] ?? null) !== data.last) return undefined;
  return { version: 1, assignments, bag: [...data.bag], last: data.last };
}

/** Malformed or obsolete storage is safely ignored; callers own storage access. */
export function parseInstallAnticipationSnapshot(serialized: string | null | undefined): InstallAnticipationSnapshot | undefined {
  if (!serialized) return undefined;
  try { return readSnapshot(JSON.parse(serialized)); } catch { return undefined; }
}

export function serializeInstallAnticipationSnapshot(snapshot: InstallAnticipationSnapshot): string {
  return JSON.stringify(snapshot);
}

export interface InstallAnticipationRegistry {
  /** Supply every actual job, irrespective of which installer is visible. */
  assign(jobIds: readonly string[]): boolean;
  get(jobId: string): InstallAnticipationVariant | undefined;
  snapshot(): InstallAnticipationSnapshot;
}

export function createInstallAnticipationRegistry({ random = Math.random, snapshot }: {
  random?: () => number;
  snapshot?: unknown;
} = {}): InstallAnticipationRegistry {
  const restored = readSnapshot(snapshot);
  const assignments = new Map<string, InstallAnticipationVariant>(restored?.assignments ?? []);
  let bag = restored?.bag ?? [];
  let last = restored?.last ?? null;

  const randomIndex = (length: number) => {
    const value = random();
    return Math.floor((Number.isFinite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : .5) * length);
  };
  const draw = (): InstallAnticipationVariant => {
    if (!bag.length) {
      bag = [...INSTALL_ANTICIPATION_VARIANTS];
      for (let index = bag.length - 1; index > 0; index--) {
        const swap = randomIndex(index + 1);
        [bag[index], bag[swap]] = [bag[swap], bag[index]];
      }
      // A fresh bag still contains all five variants, but never repeats the last draw.
      if (bag[0] === last) {
        const swap = 1 + randomIndex(bag.length - 1);
        [bag[0], bag[swap]] = [bag[swap], bag[0]];
      }
    }
    last = bag.shift()!;
    return last;
  };

  return {
    assign(jobIds) {
      const active = new Set(jobIds.filter(isJobId));
      let changed = false;
      for (const id of active) {
        if (!assignments.has(id)) {
          assignments.set(id, draw());
          changed = true;
        }
      }
      let inactiveCount = assignments.size - active.size;
      if (inactiveCount > INACTIVE_ASSIGNMENT_LIMIT) {
        for (const id of assignments.keys()) {
          if (active.has(id)) continue;
          assignments.delete(id);
          changed = true;
          if (--inactiveCount <= INACTIVE_ASSIGNMENT_LIMIT) break;
        }
      }
      return changed;
    },
    get: jobId => assignments.get(jobId),
    snapshot: () => ({ version: 1, assignments: [...assignments].map(([id, variant]) => [id, variant]), bag: [...bag], last }),
  };
}
