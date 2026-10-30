/** Small original face samples + technical packing of the image-generated hair atlas.
 * Run: npx tsx scripts/create-avatar-test-art.ts /absolute/path/to/generated-hair.png
 * Artist sources are ordinary replaceable compact PNGs; no drawing runs in the game.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PNG } from 'pngjs';
const dir = 'CHARACTER';
type Color = [number, number, number, number];
const dark: Color = [53, 43, 53, 255];
function pixel(p: PNG, x: number, y: number, c: Color) {
  if (x >= 0 && x < p.width && y >= 0 && y < p.height) p.data.set(c, (y * p.width + x) * 4);
}
function box(p: PNG, x: number, y: number, w: number, h: number, c: Color) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) pixel(p, x + dx, y + dy, c);
}
function oval(p: PNG, x: number, y: number, rx: number, ry: number, c: Color) {
  for (let py = Math.floor(y - ry); py <= y + ry; py++)
    for (let px = Math.floor(x - rx); px <= x + rx; px++)
      if (((px + 0.5 - x) / rx) ** 2 + ((py + 0.5 - y) / ry) ** 2 <= 1) pixel(p, px, py, c);
}
async function save(category: string, name: string, p: PNG) {
  await mkdir(`${dir}/${category}`, { recursive: true });
  await writeFile(`${dir}/${category}/${name}.png`, PNG.sync.write(p));
}
const mouths = [
  'Круглый рот',
  'Короткая полоска',
  'Тень верхней губы',
  'Пухлые губы',
  'Улыбка',
  'Тень нижней губы',
];
for (let i = 0; i < 6; i++) {
  const p = new PNG({ width: 64, height: 256 });
  if (i === 0) oval(p, 32, 44, 2, 2, dark);
  if (i === 1) box(p, 29, 43, 6, 2, dark);
  if (i === 2) {
    box(p, 28, 43, 8, 1, dark);
    box(p, 29, 42, 6, 1, [133, 76, 77, 255]);
  }
  if (i === 3) {
    oval(p, 32, 43, 4, 2, [153, 82, 88, 255]);
    oval(p, 32, 45, 4, 2, [188, 109, 111, 255]);
    box(p, 29, 44, 6, 1, [92, 53, 64, 255]);
    box(p, 30, 45, 3, 1, [220, 153, 151, 255]);
  }
  if (i === 4) {
    box(p, 28, 42, 2, 2, dark);
    box(p, 30, 44, 4, 1, dark);
    box(p, 34, 42, 2, 2, dark);
  }
  if (i === 5) {
    box(p, 28, 43, 8, 1, dark);
    box(p, 29, 45, 6, 1, [165, 108, 102, 255]);
  }
  await save('mouth', `mouth_0${i + 1}`, p);
}
const eyes = [
  'Близко посаженные точки',
  'Широкие глаза',
  'Большие глаза со зрачками',
  'Закрытые улыбающиеся глаза',
  'Реснички со зрачками',
  'Недовольный взгляд',
];
for (let i = 0; i < 6; i++) {
  const p = new PNG({ width: 64, height: 256 });
  for (const [j, x] of (i === 0 ? [27, 35] : [22, 38]).entries()) {
    if (i === 0) oval(p, x, 33, 1.5, 1.5, dark);
    if (i === 1) box(p, x, 30, 4, 8, dark);
    if (i === 2) {
      oval(p, x + 2, 34, 4, 5, dark);
      oval(p, x + 2, 34, 3, 4, [250, 244, 231, 255]);
      box(p, x + 1, 31, 3, 7, [91, 69, 57, 255]);
      box(p, x + 2, 32, 2, 5, dark);
      pixel(p, x + 1, 31, [255, 250, 241, 255]);
    }
    if (i === 3) {
      box(p, x - 1, 34, 2, 2, dark);
      box(p, x + 1, 32, 3, 2, dark);
      box(p, x + 4, 34, 2, 2, dark);
    }
    if (i === 4) {
      box(p, x - 1, 31, 6, 2, dark);
      box(p, x, 33, 4, 4, [250, 244, 231, 255]);
      box(p, x + 1, 33, 2, 4, dark);
      box(p, j === 0 ? x - 3 : x + 5, 29, 2, 2, dark);
      pixel(p, x + 1, 33, [255, 250, 241, 255]);
    }
    if (i === 5) {
      box(p, x - 1, 31, 6, 2, dark);
      box(p, x, 33, 4, 3, [240, 229, 214, 255]);
      box(p, x + 1, 33, 2, 3, dark);
    }
  }
  await save('eyes', `eyes_0${i + 1}`, p);
}
const features = [
  'Три родинки',
  'Синяки под глазами',
  'Круглый румянец',
  'Полоски румянца',
  'Румянец на носу',
  'Веснушки на носу',
  'Веснушки по всему лицу',
];
for (let i = 0; i < 7; i++) {
  const p = new PNG({ width: 64, height: 256 });
  if (i === 0)
    for (const [x, y] of [
      [21, 40],
      [40, 42],
      [35, 47],
    ])
      oval(p, x!, y!, 1, 1, [75, 47, 35, 220]);
  if (i === 1)
    for (const x of [24, 40]) {
      oval(p, x, 40, 4, 2, [91, 79, 118, 55]);
      box(p, x - 3, 39, 6, 1, [88, 78, 111, 55]);
    }
  if (i === 2)
    for (const x of [21, 43]) {
      oval(p, x, 41, 4, 3, [214, 88, 99, 50]);
      oval(p, x, 41, 3, 2, [214, 88, 99, 65]);
    }
  if (i === 3) for (const x of [20, 38]) box(p, x, 40, 6, 2, [210, 96, 107, 110]);
  if (i === 4) {
    oval(p, 32, 39, 4, 3, [209, 83, 90, 60]);
    oval(p, 32, 39, 3, 2, [209, 83, 90, 80]);
  }
  if (i === 5 || i === 6) {
    const points =
      i === 5
        ? [
            [29, 39],
            [33, 38],
            [35, 40],
            [31, 41],
            [28, 41],
          ]
        : [
            [19, 38],
            [23, 40],
            [26, 37],
            [30, 39],
            [34, 38],
            [38, 40],
            [42, 37],
            [45, 40],
            [21, 44],
            [25, 45],
            [39, 45],
            [44, 44],
            [28, 28],
            [36, 25],
            [32, 48],
          ];
    for (const [x, y] of points) pixel(p, x!, y!, [132, 80, 49, 165]);
  }
  await save('face_features', `face_0${i + 1}`, p);
}
for (const [category, prefix, names] of [
  ['mouth', 'mouth', mouths],
  ['eyes', 'eyes', eyes],
  ['face_features', 'face', features],
] as const) {
  await writeFile(
    `${dir}/${category}/ITEMS.md`,
    `# Тестовые варианты\n\nОригинальные пиксельные образцы для проверки редактора.\n\n| Файл | Название | Материал |\n| --- | --- | --- |\n${names.map((name, i) => `| ${prefix}_0${i + 1}.png | ${name} | fixed |`).join('\n')}\n`,
  );
}
const input = process.argv[2];
if (input) {
  const atlas = PNG.sync.read(await readFile(input));
  if (atlas.width !== 1423 || atlas.height !== 1105)
    throw new Error(
      'This one-off packer expects the original 1423×1105 generated reference atlas. Artist PNGs use character:import.',
    );
  const palette = [32, 80, 128, 184, 240];
  const names = [
    'Асимметричное кудрявое каре',
    'Длинные волнистые волосы',
    'Прямое каре',
    'Боковой пучок с прядями',
    'Длинные прямые волосы',
    'Объёмные длинные кудри',
  ];
  const sourceRows = [0, 310, 578, 828, atlas.height];
  for (let col = 0; col < 6; col++) {
    const out = new PNG({ width: 96, height: 448 });
    const mask = new PNG({ width: 96, height: 448 });
    let scaleX = 0.28;
    for (let row = 0; row < 4; row++) {
      const left = Math.round((col * atlas.width) / 6),
        right = Math.round(((col + 1) * atlas.width) / 6);
      let x0 = right,
        x1 = left,
        y0 = sourceRows[row + 1]!,
        y1 = sourceRows[row]!;
      const solid = (x: number, y: number) => atlas.data[(y * atlas.width + x) * 4 + 3]! >= 160;
      for (let y = sourceRows[row]!; y < sourceRows[row + 1]!; y++)
        for (let x = left; x < right; x++)
          if (solid(x, y)) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
      let center = (x0 + x1) / 2;
      if (row === 0) {
        const scanY = Math.min(y1 - 5, y0 + 125);
        let a = Math.round(center),
          b = a;
        while (a > x0 && !solid(a, scanY)) a--;
        while (b < x1 && !solid(b, scanY)) b++;
        if (b - a > 30) {
          center = (a + b) / 2;
          scaleX = Math.min(0.42, 32 / (b - a));
        }
      } else {
        const xs: number[] = [];
        for (let y = y0 + 30; y <= Math.min(y0 + 75, y1); y++)
          for (let x = x0; x <= x1; x++) if (solid(x, y)) xs.push(x);
        if (xs.length) center = xs.reduce((a, b) => a + b, 0) / xs.length;
      }
      const end = [59, 87, 59, 63, 90, 90][col]!;
      const sourceNeck = Math.min(y1, y0 + 180);
      const mapY = (y: number) =>
        y <= sourceNeck
          ? 8 + ((y - y0) * 48) / (sourceNeck - y0)
          : 56 + ((y - sourceNeck) * (end - 56)) / Math.max(1, y1 - sourceNeck);
      for (let y = 1; y < 111; y++)
        for (let x = 1; x < 95; x++) {
          const sx = Math.round(center + (x - 48) / scaleX);
          const sy = Math.round(
            y <= 56
              ? y0 + ((y - 8) * (sourceNeck - y0)) / 48
              : sourceNeck + ((y - 56) * (y1 - sourceNeck)) / Math.max(1, end - 56),
          );
          if (sx < x0 || sx > x1 || sy < y0 || sy > y1 || !solid(sx, sy)) continue;
          const at = (sy * atlas.width + sx) * 4;
          const v = (atlas.data[at]! + atlas.data[at + 1]! + atlas.data[at + 2]!) / 3;
          const gray = palette.reduce((a, b) => (Math.abs(a - v) < Math.abs(b - v) ? a : b));
          pixel(out, x, row * 112 + y, [gray, gray, gray, 255]);
        }
      // Registration masks open the actual ear attachments; the hair never supplies ears/skin.
      if (row === 1 || row === 3)
        box(out, row === 1 ? 40 : 51, row * 112 + 33, 5, 10, [0, 0, 0, 0]);
      if (row === 0 && col === 1) for (const x of [23, 68]) box(out, x, 33, 5, 10, [0, 0, 0, 0]);
      // Drop isolated rasterisation specks, then preserve a two-native-pixel external contour.
      const seen = new Set<number>();
      const opaque = (x: number, y: number) =>
        x >= 0 &&
        x < 96 &&
        y >= 0 &&
        y < 112 &&
        out.data[((row * 112 + y) * 96 + x) * 4 + 3] === 255;
      for (let y = 0; y < 112; y++)
        for (let x = 0; x < 96; x++) {
          const start = y * 96 + x;
          if (!opaque(x, y) || seen.has(start)) continue;
          const component = [start];
          seen.add(start);
          for (let at = 0; at < component.length; at++) {
            const pt = component[at]!,
              px = pt % 96,
              py = Math.floor(pt / 96);
            for (const [dx, dy] of [
              [-1, 0],
              [1, 0],
              [0, -1],
              [0, 1],
            ]) {
              const nx = px + dx!,
                ny = py + dy!,
                key = ny * 96 + nx;
              if (opaque(nx, ny) && !seen.has(key)) {
                seen.add(key);
                component.push(key);
              }
            }
          }
          if (component.length < 12)
            for (const pt of component)
              pixel(out, pt % 96, row * 112 + Math.floor(pt / 96), [0, 0, 0, 0]);
        }
      const edge: number[][] = [];
      for (let y = 0; y < 112; y++)
        for (let x = 0; x < 96; x++)
          if (
            opaque(x, y) &&
            [
              [-2, 0],
              [2, 0],
              [0, -2],
              [0, 2],
              [-1, -1],
              [1, -1],
              [-1, 1],
              [1, 1],
            ].some(([dx, dy]) => !opaque(x + dx!, y + dy!))
          )
            edge.push([x, y]);
      for (const [x, y] of edge) pixel(out, x!, row * 112 + y!, [32, 32, 32, 255]);
      for (let y = 0; y < 112; y++)
        for (let x = 0; x < 96; x++) {
          if (!out.data[((row * 112 + y) * 96 + x) * 4 + 3]) continue;
          const back =
            y >= 54 && (row === 2 || row === 0 ? x < 31 || x >= 65 : row === 1 ? x < 48 : x >= 48);
          pixel(mask, x, row * 112 + y, back ? [0, 0, 255, 255] : [255, 0, 0, 255]);
        }
      console.log(
        `${col + 1}/${'SENW'[row]}: source ${x0},${y0}..${x1},${y1}; x scale ${scaleX.toFixed(3)}; head y8..56, hem ${Math.round(mapY(y1))}`,
      );
    }
    await save('hair', `hair_0${col + 1}`, out);
    await save('hair', `hair_0${col + 1}_mask`, mask);
  }
  await writeFile(
    `${dir}/hair/ITEMS.md`,
    `# Причёски по пользовательским референсам\n\nТестовая графика, собственные S/E/N/W, стандартная пятицветная маска. Цвет выбирается в редакторе.\n\n| Файл | Название | Маска |\n| --- | --- | --- |\n${names.map((name, i) => `| hair_0${i + 1}.png | ${name} | hair_0${i + 1}_mask.png |`).join('\n')}\n`,
  );
}
console.log('Created 6 mouths, 6 eyes, 7 facial effects' + (input ? ' and 6 hairstyles.' : '.'));
