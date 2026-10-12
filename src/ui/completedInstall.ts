import type { InstallJob } from '../game/types';

/** Preserve only the just-finished view, while the real job queue continues independently. */
export function completedInstallView(previous: InstallJob | undefined, previousInstalled: readonly string[], installed: readonly string[], jobs: readonly InstallJob[], celebratingGameId?: string): InstallJob | null {
 if (!previous || jobs.some(job => job.id === previous.id) || !installed.includes(previous.gameId)) return null;
 if (previousInstalled.includes(previous.gameId) && celebratingGameId !== previous.gameId) return null;
 return { ...previous, stage: 'verify', stageProgress: 1, progress: 1 };
}
