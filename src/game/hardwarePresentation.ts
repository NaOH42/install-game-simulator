import type { HardwareLevel } from './types';

/** Display order is separate from the option indices persisted in saves. */
export function sortedHardwareOptions(models: readonly HardwareLevel[]) {
  return models.map((model, option) => ({ model, option })).sort((a, b) =>
    a.model.generation - b.model.generation || a.model.price - b.model.price || a.option - b.option,
  );
}
