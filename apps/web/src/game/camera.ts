/** Integrate the unrounded target; round only the final displayed scroll. */
export function followAxis(current: number, target: number, delta: number, zoom: number) {
  const next =
    Math.abs(target - current) < 0.02
      ? target
      : current + (target - current) * (1 - Math.exp(-Math.min(delta, 100) / 90));
  return { value: next, display: Math.round(next * zoom) / zoom };
}
