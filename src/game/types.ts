export type Genre = 'strategy' | 'wuxia' | 'racing' | 'scifi';
export type HardwareKey = 'cpu' | 'ram' | 'disk' | 'gpu' | 'network';
export type Hardware = Record<HardwareKey, number>;
export type ResourceKey = 'cpu' | 'ram' | 'gpu' | 'network';
export type ResourceDemand = Record<ResourceKey, number>;
export type OwnedHardware = Record<HardwareKey, number[]>;
export type SystemLoad = Record<ResourceKey, { demand: number; capacity: number; ratio: number }>;
export interface GamePerformance {
 running: boolean; efficiency: number; incomePerSecond: number; baseIncome: number;
 demand: ResourceDemand; bottleneck: ResourceKey | null;
}
export type Stage = 'download' | 'unpack' | 'write' | 'verify';
export interface GameDefinition {
 id: string; title: string; subtitle: string; genre: Genre; tier: number; year: string;
 description: string; tagline: string; sizeGB: number; downloadMB: number;
 price: number; reward: number; income: number; min: Hardware; recommended: Hardware;
 work: Record<Stage, number>; cover: string; focalPoint: string; color: string; featured?: boolean;
 runtime: ResourceDemand; online: boolean;
}
export interface HardwareLevel {
 name: string; detail: string; price: number; value: number;
 generation: 0 | 1 | 2; capacity: number; installSpeed: number; slots: number; focus: string; cpuRelief: number;
}
export interface InstallJob { id: string; gameId: string; stage: Stage; stageProgress: number; progress: number; elapsed: number; }
export interface GameEvent { id: number; text: string; kind: 'info' | 'success' | 'warning'; }
export interface SaveGame {
 version: 1; points: number; earned: number; hardware: Hardware; ownedHardware: OwnedHardware;
 owned: string[]; installed: string[]; running: string[]; collected: string[];
 queue: string[]; jobs: InstallJob[]; automation: boolean; pipeline: boolean; autoEnabled: boolean;
 playTime: number; installedCount: number; events: GameEvent[]; nextEventId: number; won: boolean;
 settings: { music: number; effects: number; reducedMotion: boolean };
}
export type Action = {type:'buy'|'install'|'queue'|'removeQueue'|'uninstall'|'run'|'stop'; gameId:string}
 | {type:'upgrade'; key:HardwareKey; option?:number} | {type:'equipHardware'; key:HardwareKey; option:number}
 | {type:'unlockPipeline'|'unlockAutomation'|'toggleAuto'|'stopAll'}
 | {type:'moveQueue'; gameId:string; direction:-1|1}
 | {type:'settings'; settings:Partial<SaveGame['settings']>};
export interface ActionResult { state: SaveGame; error?: string; }
