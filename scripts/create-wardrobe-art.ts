/** One-off technical packing of image-generated clothes into the unchanged artist canvases.
 * Usage: tsx scripts/create-wardrobe-art.ts upper-a.png upper-b.png lower.png shoes.png
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';
import wardrobe from '../content/avatars/wardrobe.json';
import { reviewPose } from '../apps/web/src/avatar/editorMotion';
const views = ['south', 'east', 'north'] as const;
type Rect = [number, number, number, number];
type Box = { x: number; y: number; r: number; b: number; area: number };
function boxes(p: PNG, count: number) {
  const seen = new Uint8Array(p.width * p.height),
    all: Box[] = [];
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < p.width && y < p.height && p.data[(y * p.width + x) * 4 + 3]! >= 160;
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) {
      const start = y * p.width + x;
      if (seen[start] || !solid(x, y)) continue;
      const q = [start];
      seen[start] = 1;
      const b = { x, y, r: x, b: y, area: 0 };
      for (let at = 0; at < q.length; at++) {
        const n = q[at]!,
          px = n % p.width,
          py = Math.floor(n / p.width);
        b.area++;
        b.x = Math.min(b.x, px);
        b.r = Math.max(b.r, px);
        b.y = Math.min(b.y, py);
        b.b = Math.max(b.b, py);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = px + dx,
              ny = py + dy,
              key = ny * p.width + nx;
            if (solid(nx, ny) && !seen[key]) {
              seen[key] = 1;
              q.push(key);
            }
          }
      }
      if (b.area > 100) all.push(b);
    }
  const main = all
    .sort((a, b) => b.area - a.area)
    .slice(0, count * 3)
    .sort((a, b) => a.y + a.b - (b.y + b.b));
  if (main.length !== count * 3)
    throw new Error(`Expected ${count * 3} separated garments, found ${main.length}.`);
  return Array.from({ length: 3 }, (_, r) =>
    main.slice(r * count, (r + 1) * count).sort((a, b) => a.x + a.r - (b.x + b.r)),
  );
}
const rgba = (p: PNG, x: number, y: number, c: number[]) => p.data.set(c, (y * p.width + x) * 4);
function contour(p: PNG, height: number) {
  const copy = Buffer.from(p.data);
  const opaque = (x: number, y: number, row: number) =>
    x >= 0 &&
    x < p.width &&
    y >= 0 &&
    y < height &&
    copy[((row * height + y) * p.width + x) * 4 + 3] === 255;
  for (let row = 0; row < p.height / height; row++)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < p.width; x++)
        if (
          opaque(x, y, row) &&
          [
            [-2, 0],
            [2, 0],
            [0, -2],
            [0, 2],
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].some(([dx, dy]) => !opaque(x + dx!, y + dy!, row))
        )
          rgba(p, x, row * height + y, [32, 32, 32, 255]);
}
function pack(
  source: PNG,
  bounds: Box[][],
  col: number,
  width: number,
  height: number,
  target: (row: number) => Rect,
  mixed = false,
  collarOnly = false,
  jeans = false,
) {
  const out = new PNG({ width, height: height * (width === 40 ? 3 : 4) }),
    levels = [32, 80, 128, 184, 240];
  for (let row = 0; row < 3; row++) {
    const b = bounds[row]![col]!,
      [x0, y0, x1, y1] = target(row);
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const sx = Math.min(b.r, Math.floor(b.x + ((x - x0 + 0.5) * (b.r - b.x + 1)) / (x1 - x0)));
        let t = (y - y0 + 0.5) / (y1 - y0);
        if (jeans && row !== 1) {
          const crotch = (28 - y0) / (y1 - y0);
          t = t < crotch ? (t / crotch) * 0.58 : 0.58 + ((t - crotch) / (1 - crotch)) * 0.42;
        }
        const sy = Math.min(b.b, Math.floor(b.y + t * (b.b - b.y + 1))),
          at = (sy * source.width + sx) * 4;
        if (source.data[at + 3]! < 160) continue;
        const r = source.data[at]!,
          g = source.data[at + 1]!,
          bl = source.data[at + 2]!,
          v = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
        if (
          mixed &&
          r - bl >= 8 &&
          r - g >= 2 &&
          v > 85 &&
          (!collarOnly || (y < 64 && x > 34 && x < 62))
        ) {
          const c =
            v > 214
              ? [241, 233, 216]
              : v > 165
                ? [217, 203, 188]
                : v > 110
                  ? [162, 143, 123]
                  : [99, 86, 79];
          rgba(out, x, row * height + y, [...c, 255]);
        } else {
          const gray = levels.reduce((a, b) => (Math.abs(a - v) < Math.abs(b - v) ? a : b));
          rgba(out, x, row * height + y, [gray, gray, gray, 255]);
        }
      }
  }
  contour(out, height);
  return out;
}
async function save(category: string, name: string, p: PNG) {
  await mkdir(`CHARACTER/${category}`, { recursive: true });
  await writeFile(`CHARACTER/${category}/${name}.png`, PNG.sync.write(p));
}
const read = async (f: string) => PNG.sync.read(await readFile(f));
const args = process.argv.slice(2);
if (args.length !== 4)
  throw new Error('Provide upper-a, upper-b, lower and footwear generated atlas paths.');
const [a, b, lower, shoes] = await Promise.all([
  read(args[0]!),
  read(args[1]!),
  read(args[2]!),
  read(args[3]!),
]);
const gridA = boxes(a, 5),
  gridB = boxes(b, 5),
  gridL = boxes(lower, 6),
  gridF = boxes(shoes, 5);
const topRows: string[] = [];
for (let id = 1; id <= 10; id++) {
  const plainDress = id === 3 || id === 4,
    combo = id === 5 || id === 6;
  const rect = (row: number): Rect => {
    const side = row === 1;
    if (plainDress) return side ? [32, 56, 64, 106] : [22, 56, 74, 106];
    if (combo) return side ? [30, 52, 66, 106] : [18, 52, 78, 106];
    if (id === 1) return side ? [33, 51, 63, 93] : [22, 51, 74, 93];
    if (id === 2) return side ? [30, 52, 66, 93] : [17, 52, 79, 93];
    if (id === 7) return side ? [31, 52, 65, 98] : [18, 52, 78, 98];
    if (id === 8) return side ? [31, 53, 65, 92] : [18, 53, 78, 92];
    if (id === 9) return side ? [33, 56, 63, 93] : [23, 56, 73, 93];
    return side ? [29, 54, 67, 99] : [16, 54, 80, 99];
  };
  const mixed = combo || id === 10 || id === 2;
  const p = pack(
    id <= 5 ? a : b,
    id <= 5 ? gridA : gridB,
    (id - 1) % 5,
    96,
    112,
    rect,
    mixed,
    id === 2,
  );
  // The generated fashion drawing has sloping sleeves. Register their cloth onto
  // the approved vertical upper arms once, before producing the immutable PNG.
  if (!plainDress)
    for (const row of [0, 2]) {
      const original = Buffer.from(p.data),
        end = id === 9 ? 76 : 92,
        puff = id === 2 || combo ? 18 : id >= 7 && id !== 9 ? 16 : 12;
      for (const center of [29, 67])
        for (let y = 58; y < end; y++) {
          const t = (y - 58) / (end - 58),
            w = combo && y > end - 5 ? 18 : Math.round(12 + (puff - 12) * Math.sin(t * Math.PI));
          let samples: number[] = [];
          for (let distance = 0; distance <= 10 && !samples.length; distance++)
            for (const yy of distance ? [y - distance, y + distance] : [y]) {
              if (yy < 52 || yy >= 96) continue;
              for (let x = center < 48 ? 16 : 58; x < (center < 48 ? 40 : 80); x++) {
                const at = ((row * 112 + yy) * 96 + x) * 4;
                if (
                  original[at + 3] &&
                  original[at] !== 32 &&
                  (!combo || original[at] !== original[at + 2])
                )
                  samples.push(at);
              }
              if (samples.length) break;
            }
          if (!samples.length) continue;
          for (let x = Math.round(center - w / 2); x < Math.round(center + w / 2); x++) {
            const at =
              samples[
                Math.min(
                  samples.length - 1,
                  Math.floor(((x - center + w / 2) / w) * samples.length),
                )
              ]!;
            rgba(p, x, row * 112 + y, [...original.subarray(at, at + 4)]);
          }
        }
    }
  contour(p, 112);
  const mask = new PNG({ width: 96, height: 448 });
  for (let row = 0; row < 3; row++) {
    const dir = views[row]!,
      pose = reviewPose('average', dir, 0, 'male');
    for (let y = 0; y < 112; y++)
      for (let x = 0; x < 96; x++) {
        const at = ((row * 112 + y) * 96 + x) * 4;
        if (!p.data[at + 3]) continue;
        const warm = p.data[at] !== p.data[at + 2];
        let arm = -1;
        if (!plainDress && (!combo || warm) && y >= 56 && y < (id === 9 ? 76 : 94)) {
          if (row === 1) {
            if (Math.abs(x + 0.5 - pose.arms[1]!.root.x) < 9) arm = 1;
          } else if (x < 34) arm = dir === 'north' ? 1 : 0;
          else if (x >= 62) arm = dir === 'north' ? 0 : 1;
        }
        rgba(
          mask,
          x,
          row * 112 + y,
          arm === 0 ? [0, 255, 0, 255] : arm === 1 ? [0, 0, 255, 255] : [255, 0, 0, 255],
        );
      }
  }
  const name = `top_${String(id).padStart(2, '0')}`;
  await save('tops', name, p);
  await save('tops', name + '_mask', mask);
  topRows.push(
    `| ${name}.png | ${wardrobe.top[id - 1]} | ${name}_mask.png | ${mixed ? 'mixed' : ''} |`,
  );
}
await writeFile(
  'CHARACTER/tops/ITEMS.md',
  `# Верхняя одежда\n\nЦельные вещи на неизменном TOP; платья входят в верх.\n\n| Файл | Название | Маска | Материал |\n| --- | --- | --- | --- |\n${topRows.join('\n')}\n`,
);
const lowerRows: string[] = [];
for (const [col, id, end, top, width] of [
  [0, 1, 48, 8, 48],
  [1, 2, 48, 8, 48],
  [2, 3, 32, 14, 44],
  [3, 4, 34, 16, 38],
  [4, 5, 41, 12, 44],
  [5, 8, 48, 14, 40],
]) {
  const p = pack(
    lower,
    gridL,
    col!,
    80,
    64,
    (row) => (row === 1 ? [25, top!, 55, end!] : [40 - width! / 2, top!, 40 + width! / 2, end!]),
    id === 8,
    false,
    id === 8,
  );
  const name = `${[1, 2, 3, 5].includes(id!) ? 'skirt' : 'bottom'}_${String(id).padStart(2, '0')}`;
  await save('bottoms', name, p);
  lowerRows.push(`| ${name}.png | ${wardrobe.bottom[id! - 1]} | ${id === 8 ? 'mixed' : ''} |`);
}
const rectangle = (p: PNG, row: number, x0: number, y0: number, x1: number, y1: number) => {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) rgba(p, x, row * 64 + y, [184, 184, 184, 255]);
};
for (const [id, end] of [
  [6, 46],
  [7, 35],
  [9, 48],
]) {
  const p = new PNG({ width: 80, height: 256 });
  for (let row = 0; row < 3; row++) {
    rectangle(p, row, 25, 16, 55, 28);
    for (const x of row === 1 ? [42] : [32, 48]) rectangle(p, row, x - 6, 22, x + 6, end!);
  }
  contour(p, 64);
  const name = `bottom_0${id}`;
  await save('bottoms', name, p);
  lowerRows.push(`| ${name}.png | ${wardrobe.bottom[id! - 1]} | |`);
}
await writeFile(
  'CHARACTER/bottoms/ITEMS.md',
  `# Нижняя одежда\n\nПояс входит в рисунок. Прозрачность не заполняется.\n\n| Файл | Название | Материал |\n| --- | --- | --- |\n${lowerRows.join('\n')}\n`,
);
for (let id = 1; id <= 5; id++) {
  const p = pack(
    shoes,
    gridF,
    id - 1,
    40,
    18,
    (row) => {
      const widths = [14, 16, 14, 14, 16],
        w =
          row === 1
            ? [18, 20, 19, 20, 20][id - 1]!
            : row === 2
              ? widths[id - 1]! - 2
              : widths[id - 1]!;
      const x = row === 1 ? 14 : 20 - w / 2;
      return [x, id === 5 ? 1 : id === 3 ? 3 : 6, x + w, 15];
    },
    [2, 3, 5].includes(id),
  );
  if (id === 5)
    for (let row = 0; row < 3; row++)
      for (let y = 3; y < 7; y++)
        for (let x = [14, 18, 19][row]!; x < [14, 18, 19][row]! + 3; x++)
          rgba(p, x, row * 18 + y, [241, 233, 216, 255]);
  await save('footwear', `shoes_0${id}`, p);
}
await writeFile(
  'CHARACTER/footwear/ITEMS.md',
  `# Обувь\n\nОдин ботинок, S/E/N, второй формируется программно.\n\n| Файл | Название | Материал |\n| --- | --- | --- |\n${wardrobe.footwear.map((name, i) => `| shoes_0${i + 1}.png | ${name} | ${[1, 2, 4].includes(i) ? 'mixed' : ''} |`).join('\n')}\n`,
);
for (let id = 1; id <= 3; id++) {
  const p = new PNG({ width: 80, height: 256 });
  for (let row = 0; row < 3; row++)
    for (const x of row === 1 ? [42] : [32, 48])
      rectangle(p, row, x - 6, [40, 34, 28][id - 1]!, x + 6, 46);
  contour(p, 64);
  await save('socks', `socks_0${id}`, p);
}
await writeFile(
  'CHARACTER/socks/ITEMS.md',
  `# Носки\n\nГотовые нижние модули на BOTTOM без отдельных фаз.\n\n| Файл | Название |\n| --- | --- |\n${wardrobe.socks
    .slice(1)
    .map((n, i) => `| socks_0${i + 1}.png | ${n} |`)
    .join('\n')}\n`,
);
console.log('Packed 10 tops, 9 bottoms, 5 shoes and 3 socks; TECH_DOCS unchanged.');
