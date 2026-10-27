export const INDEX_LEVELS = [32, 80, 128, 184, 240];
export const OUTLINE = '#352b35';
export function mix(a: string, b: string, t: number): string {
  return (
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function shades(base: string) {
  return [
    OUTLINE,
    mix(base, '#382b3a', 0.48),
    mix(base, '#573d42', 0.22),
    base,
    mix(base, '#fff3dc', 0.3),
  ];
}
export function normalizeMask(data: ImageData, preserveAlpha = false) {
  let adjusted = 0;
  for (let i = 0; i < data.data.length; i += 4) {
    if (preserveAlpha ? data.data[i + 3] === 0 : data.data[i + 3]! < 128) {
      data.data[i] = data.data[i + 1] = data.data[i + 2] = data.data[i + 3] = 0;
      continue;
    }
    const light = 0.2126 * data.data[i]! + 0.7152 * data.data[i + 1]! + 0.0722 * data.data[i + 2]!;
    const value = INDEX_LEVELS.reduce((a, b) =>
      Math.abs(a - light) < Math.abs(b - light) ? a : b,
    );
    if (
      data.data[i] !== value ||
      data.data[i + 1] !== value ||
      data.data[i + 2] !== value ||
      data.data[i + 3] !== 255
    )
      adjusted++;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = value;
    if (!preserveAlpha) data.data[i + 3] = 255;
  }
  return adjusted;
}
export function colorMask(data: ImageData, color: string) {
  const palette = shades(color).map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  for (let i = 0; i < data.data.length; i += 4)
    if (data.data[i + 3]) {
      const index = INDEX_LEVELS.indexOf(data.data[i]!);
      if (index < 0) throw new Error('Неиндексированный цвет маски');
      [data.data[i], data.data[i + 1], data.data[i + 2]] = palette[index]! as [
        number,
        number,
        number,
      ];
    }
  return data;
}
