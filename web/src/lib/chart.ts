/** A round axis maximum and 4 equal steps: 0 / 25 / 50 / 75 / 100. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0]
  const rough = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough) ?? rough
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, index) => index * step)
}
