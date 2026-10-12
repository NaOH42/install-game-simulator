/** Shared audiovisual build-up from the focused installation's real 0–1 progress. */
export function getInstallIntensity(progress: number): number {
 if (!Number.isFinite(progress) || progress <= .6) return 0;
 if (progress >= .95) return 1;
 const smooth = (value: number) => value * value * (3 - 2 * value);
 return progress < .85
  ? .68 * smooth((progress - .6) / .25)
  : .68 + .32 * smooth((progress - .85) / .1);
}
