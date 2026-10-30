import { PNG } from 'pngjs';
import type { Metadata, ParsedName } from './pipeline';
import type { SourceTemplate, Category } from '../../apps/web/src/avatar/modular/templates';
import { PartEntrySchema, type PartEntry } from '../../apps/web/src/avatar/modular/parts';
import { parentPoint } from '../../apps/web/src/avatar/modular/rig';
import { reviewPose, editorDimensions } from '../../apps/web/src/avatar/editorMotion';
import { projectFront } from './front-projection';
import {
  COMPACT_SPECS,
  COMPACT_TYPES,
  SOURCE_VIEWS,
  RUNTIME_VIEWS,
  BELT_ZONE,
  type CompactType,
} from './compact-contract';
import type { CompiledSource } from './compile-source';
export function parseCompact(name: string, category: Category): ParsedName | undefined {
  const m = name.match(
    /^(hair|top|bottom|skirt|shoes|hat|accessory|eyes|mouth|face)(?:_([fm]))?_([0-9]{2})\.png$/,
  );
  if (!m) return;
  const type = m[1] as CompactType,
    spec = COMPACT_TYPES[type],
    slot = Number(m[3]);
  if (spec.category !== category) throw new Error('Имя PNG не соответствует папке CHARACTER.');
  if (slot < 1 || slot > 6)
    throw new Error('Номер должен быть 01…06; bottom и skirt используют общие слоты.');
  if (m[2] && type !== 'hair')
    throw new Error(
      'Суффикс f/m используется только для волос; посадка одежды задаётся необязательной строкой ITEMS.',
    );
  return {
    id: name.slice(0, -4),
    compact: type,
    slot,
    gender: m[2] === 'f' ? 'female' : m[2] === 'm' ? 'male' : undefined,
    mode: type === 'shoes' ? 'pair' : 'full',
    simple: true,
    fixed: false,
  };
}
export function compactTemplate(n: ParsedName): SourceTemplate {
  const type = COMPACT_TYPES[n.compact!],
    t = COMPACT_SPECS[type.template];
  return {
    id: `compact-${n.compact}`,
    category: type.category,
    label: n.compact!,
    width: t.width,
    height: t.height,
    anchor: t.anchor,
    parent: t.parent,
    fit: 'fixed',
    material: type.material,
    field: type.field,
    referenceWidth: undefined,
  };
}
export type ViewTransform = { source: number; mirror: boolean };
export function detectViews(
  png: PNG,
  height: number,
  type: CompactType,
  back = '',
): ViewTransform[] {
  const views = type === 'shoes' ? SOURCE_VIEWS.slice(0, 3) : SOURCE_VIEWS;
  const occupied = views.map((_, row) =>
    png.data
      .subarray(row * height * png.width * 4, (row + 1) * height * png.width * 4)
      .some((v, i) => i % 4 === 3 && v > 0),
  );
  const pattern = occupied.map((v, i) => (v ? 'SENW'[i] : '')).join('');
  if (['eyes', 'mouth', 'face'].includes(type)) {
    if (pattern !== 'S')
      throw new Error(`${type}: заполните только S, остальные три ячейки оставьте прозрачными.`);
    return [];
  }
  const head = type === 'hat' || type === 'accessory';
  if (
    type === 'shoes'
      ? pattern !== 'SEN'
      : head
        ? !['S', 'SE', 'SEN', 'SEW', 'SENW'].includes(pattern)
        : !['SEN', 'SENW'].includes(pattern)
  )
    throw new Error(
      `Недопустимые ячейки ${pattern || '(пусто)'}: ${head ? 'допустимы S, S/E, S/E/N, S/E/W, S/E/N/W' : type === 'shoes' ? 'нужны S/E/N одного ботинка' : 'нужны S/E/N; самостоятельный W необязателен'}.`,
    );
  if (back && !['copy', 'mirror', 'копия', 'отражение'].includes(back))
    throw new Error('Вид N: copy/копия или mirror/отражение.');
  const row = (name: string) => views.indexOf(name as (typeof views)[number]);
  return RUNTIME_VIEWS.map((direction) => {
    if (occupied[row(direction)]) return { source: row(direction), mirror: false };
    if (direction === 'west' && occupied[1]) return { source: 1, mirror: true };
    return { source: 0, mirror: pattern === 'SEW' && !['copy', 'копия'].includes(back) };
  });
}
function transformed(source: PNG, height: number, transforms: ViewTransform[]) {
  const out = new PNG({ width: source.width, height: height * 4 });
  for (let row = 0; row < 4; row++)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < source.width; x++) {
        const tr = transforms[row]!,
          src =
            ((tr.source * height + y) * source.width + (tr.mirror ? source.width - 1 - x : x)) * 4;
        source.data.copy(out.data, ((row * height + y) * source.width + x) * 4, src, src + 4);
      }
  return out;
}
export function expandCompact(
  source: PNG,
  t: SourceTemplate,
  n: ParsedName,
  meta?: Metadata,
  mask?: PNG,
) {
  const transforms = detectViews(source, t.height, n.compact!, meta?.back);
  if (mask && (mask.width !== source.width || mask.height !== source.height))
    throw new Error('Техническая маска должна иметь тот же полный размер, что PNG вещи.');
  if (!transforms.length) {
    if (mask) throw new Error('Глазам/рту/лицевым эффектам маска разрезания не нужна.');
    if (n.compact === 'eyes') {
      const halves = [false, false];
      for (let y = 0; y < t.height; y++)
        for (let x = 0; x < t.width; x++)
          if (source.data[(y * t.width + x) * 4 + 3]) halves[x < t.anchor.x ? 0 : 1] = true;
      if (!halves.every(Boolean)) throw new Error('В S нужно нарисовать оба глаза.');
    }
    const front = new PNG({ width: t.width, height: t.height });
    source.data.copy(front.data, 0, 0, t.width * t.height * 4);
    return { image: projectFront(front, t, n.slot), mask: undefined, westMirrored: false };
  }
  const expandedMask = mask ? transformed(mask, t.height, transforms) : undefined;
  if (expandedMask && n.compact === 'top' && transforms[3]!.mirror) {
    // A reflected right profile has the opposite anatomical near arm/hand.
    const swaps: Record<string, number[]> = {
      '0,255,0': [0, 0, 255],
      '0,0,255': [0, 255, 0],
      '0,255,255': [255, 0, 255],
      '255,0,255': [0, 255, 255],
    };
    for (let at = 3 * t.width * t.height * 4; at < expandedMask.data.length; at += 4) {
      const color =
        swaps[
          [expandedMask.data[at], expandedMask.data[at + 1], expandedMask.data[at + 2]].join(',')
        ];
      if (color && expandedMask.data[at + 3]) expandedMask.data.set(color, at);
    }
  }
  return {
    image: transformed(source, t.height, transforms),
    mask: expandedMask,
    westMirrored: transforms[3]!.mirror,
  };
}
const hasPixels = (image: PNG) => image.data.some((v, i) => i % 4 === 3 && v > 0);
const role = (parent: string): NonNullable<PartEntry['approved']>['kind'] =>
  parent === 'head'
    ? 'head'
    : parent === 'torso'
      ? 'torso'
      : parent === 'pelvis'
        ? 'pelvis'
        : parent.startsWith('arm')
          ? 'arm'
          : parent.startsWith('hand')
            ? 'hand'
            : parent.startsWith('leg')
              ? 'leg'
              : 'foot';
export function compileCompact(
  t: SourceTemplate,
  d: PartEntry,
  source: PNG,
  n: ParsedName,
  meta?: Metadata,
  mask?: PNG,
  westMirrored = false,
): CompiledSource[] {
  const genders: Record<string, 'male' | 'female'> = {
    male: 'male',
    female: 'female',
    мужская: 'male',
    женская: 'female',
  };
  const gender = meta?.reference ? genders[meta.reference] : 'male';
  if (!gender) throw new Error('Посадка: male/мужская или female/женская.');
  const referencePose = (direction: (typeof RUNTIME_VIEWS)[number]) => {
    const p = reviewPose('average', direction, 0, gender);
    if (direction === 'west' && westMirrored && ['top', 'bottom'].includes(n.compact!)) {
      const east = reviewPose('average', 'east', 0, gender),
        mirror = (pt: { x: number; y: number }) => ({ x: 96 - pt.x, y: pt.y });
      p.arms = [...east.arms].reverse().map((arm) => ({
        ...arm,
        root: mirror(arm.root),
        joint: mirror(arm.joint),
        end: mirror(arm.end),
      }));
      p.hands = [...east.hands].reverse().map(mirror);
      p.legs = [...east.legs].reverse().map((leg) => ({
        ...leg,
        root: mirror(leg.root),
        joint: mirror(leg.joint),
        end: mirror(leg.end),
      }));
      p.feet = [...east.feet].reverse().map(mirror);
    }
    return p;
  };
  const parts = new Map<
    string,
    {
      parent: PartEntry['parent'];
      pass: 'front' | 'back';
      kind: NonNullable<PartEntry['approved']>['kind'];
      image: PNG;
    }
  >();
  const add = (
    key: string,
    parent: PartEntry['parent'],
    pass: 'front' | 'back' = 'front',
    kind = role(parent),
  ) => {
    if (!parts.has(key))
      parts.set(key, {
        parent,
        pass,
        kind,
        image: new PNG({ width: t.width, height: t.height * 4 }),
      });
    return parts.get(key)!;
  };
  const put = (
    key: string,
    parent: PartEntry['parent'],
    row: number,
    x: number,
    y: number,
    pass: 'front' | 'back' = 'front',
    kind = role(parent),
  ) => {
    const part = add(key, parent, pass, kind),
      at = ((row * t.height + y) * t.width + x) * 4;
    source.data.copy(part.image.data, at, at, at + 4);
  };
  const maskColor = (row: number, x: number, y: number) => {
    const at = ((row * t.height + y) * t.width + x) * 4;
    if (!mask || mask.data[at + 3] !== 255)
      throw new Error(
        'В технической маске каждый видимый пиксель вещи должен иметь непрозрачную метку.',
      );
    return [mask.data[at], mask.data[at + 1], mask.data[at + 2]].join(',');
  };
  let band = false;
  const present = { arm: [false, false], hand: [false, false] };
  if (n.compact === 'top' && !mask) {
    // Presence is alpha in explicit exterior limb zones, never a colour/style guess.
    for (const row of [0, 2]) {
      const p = referencePose(RUNTIME_VIEWS[row]!);
      for (let y = 56; y < 96; y++)
        for (let x = 0; x < t.width; x++) {
          if (!source.data[((row * t.height + y) * t.width + x) * 4 + 3]) continue;
          for (let i = 0; i < 2; i++) {
            const outside =
              p.arms[i]!.root.x < 48 ? x < 48 - p.hipWidth / 2 : x >= 48 + p.hipWidth / 2;
            if (outside) present[y < 84 ? 'arm' : 'hand'][i] = true;
          }
        }
    }
  }
  if (n.compact === 'bottom' || n.compact === 'skirt') {
    const setting = meta?.belt || 'auto';
    if (!['auto', 'yes', 'no', 'да', 'нет'].includes(setting))
      throw new Error('Пояс: auto, yes/да или no/нет.');
    for (let row = 0; row < 4; row++)
      for (let y = BELT_ZONE.top; y < BELT_ZONE.bottom; y++)
        for (let x = 0; x < t.width; x++)
          if (source.data[((row * t.height + y) * t.width + x) * 4 + 3]) band = true;
    if (['yes', 'да'].includes(setting) && !band)
      throw new Error('Пояс запрошен явно, но верхняя поясная зона пуста.');
    if (['no', 'нет'].includes(setting)) band = false;
  }
  for (let row = 0; row < 4; row++) {
    const direction = RUNTIME_VIEWS[row]!,
      p = referencePose(direction),
      dims = editorDimensions('average', p.side, gender, direction);
    for (let y = 0; y < t.height; y++)
      for (let x = 0; x < t.width; x++) {
        if (!source.data[((row * t.height + y) * t.width + x) * 4 + 3]) continue;
        if (n.compact === 'hair') {
          const color = mask ? maskColor(row, x, y) : '';
          if (mask && !['255,0,0', '0,0,255'].includes(color))
            throw new Error('Маска волос: красный=перед, синий=зад.');
          const pass = mask
            ? color === '255,0,0'
              ? 'front'
              : 'back'
            : direction === 'north' ||
                y < 54 ||
                (direction === 'east'
                  ? x >= 48
                  : direction === 'west'
                    ? x < 48
                    : (x >= 28 && x < 40) || (x >= 56 && x < 68))
              ? 'front'
              : 'back';
          put('hair-' + pass, 'head', row, x, y, pass);
        } else if (n.compact === 'top') {
          if (!mask && y < 50)
            throw new Error(
              'TOP: выше y=50 зона головы; для необычного перекрытия используйте маску.',
            );
          const keys = new Set<string>();
          if (mask) {
            const labels: Record<string, string> = {
              '255,0,0': 'torso',
              '0,255,0': 'armLeft',
              '0,0,255': 'armRight',
              '0,255,255': 'handLeft',
              '255,0,255': 'handRight',
            };
            const label = labels[maskColor(row, x, y)];
            if (!label)
              throw new Error(
                'Маска TOP: красный корпус, зелёный/синий руки, бирюзовый/пурпурный кисти.',
              );
            keys.add(label);
            // Two-pixel technological overlaps copy existing artwork only; they never invent or recolour it.
            for (let dy = -2; dy <= 2; dy++)
              for (let dx = -2; dx <= 2; dx++) {
                if (x + dx < 0 || x + dx >= t.width || y + dy < 0 || y + dy >= t.height) continue;
                const at = ((row * t.height + y + dy) * t.width + x + dx) * 4;
                if (mask.data[at + 3] !== 255) continue;
                const other =
                  labels[[mask.data[at], mask.data[at + 1], mask.data[at + 2]].join(',')];
                if (
                  other &&
                  (label === 'torso' ||
                    other === 'torso' ||
                    label.replace('hand', 'arm') === other.replace('hand', 'arm'))
                )
                  keys.add(other);
              }
          } else {
            const near = direction === 'west' ? 0 : 1;
            for (const i of p.side ? [near] : [0, 1]) {
              const arm = p.arms[i]!.root,
                hand = p.hands[i]!;
              const outer = p.side
                ? Math.abs(x + 0.5 - arm.x) <= dims.armWidth / 2 + 1
                : arm.x < 48
                  ? x < 48 - dims.shoulderWidth / 2 + 2
                  : x >= 48 + dims.shoulderWidth / 2 - 2;
              if (present.arm[i] && outer && y >= 56 && y < 92)
                keys.add(i === 0 ? 'armLeft' : 'armRight');
              if (present.hand[i] && Math.abs(x + 0.5 - hand.x) <= 6 && y >= 84 && y < 96)
                keys.add(i === 0 ? 'handLeft' : 'handRight');
            }
            if (
              !keys.size ||
              (x >= 48 - dims.torsoWidth / 2 && x < 48 + dims.torsoWidth / 2 && y < 92)
            )
              keys.add('torso');
          }
          for (const key of keys) put(key, key as PartEntry['parent'], row, x, y);
        } else if (n.compact === 'bottom' || n.compact === 'skirt') {
          if (y < BELT_ZONE.top) throw new Error('BOTTOM: рисунок выше поясной зоны y=8.');
          if (mask)
            throw new Error(
              'Для BOTTOM используется граница пояса и геометрия ног, техническая маска не поддерживается.',
            );
          if (band && y < BELT_ZONE.bottom) put('belt', 'pelvis', row, x, y, 'front', 'belt');
          else if (n.compact === 'skirt' || y < BELT_ZONE.legSplit)
            put('main', 'pelvis', row, x, y);
          else {
            const index = p.side
              ? direction === 'west'
                ? 0
                : 1
              : direction === 'north'
                ? x < 40
                  ? 1
                  : 0
                : x < 40
                  ? 0
                  : 1;
            put(
              index === 0 ? 'legLeft' : 'legRight',
              index === 0 ? 'legLeft' : 'legRight',
              row,
              x,
              y,
            );
          }
        } else put('source', d.parent, row, x, y, d.pass);
      }
  }
  // In a profile the artist draws the visible limb once; supply the hidden partner locally.
  for (const family of n.compact === 'top'
    ? ['arm', 'hand']
    : n.compact === 'bottom'
      ? ['leg']
      : [])
    for (const direction of ['east', 'west'] as const) {
      const row = RUNTIME_VIEWS.indexOf(direction),
        nearName = family + (direction === 'east' ? 'Right' : 'Left'),
        farName = family + (direction === 'east' ? 'Left' : 'Right');
      const near = parts.get(nearName);
      if (!near) continue;
      const far = add(farName, farName as PartEntry['parent']);
      const start = row * t.width * t.height * 4,
        end = start + t.width * t.height * 4;
      if (far.image.data.subarray(start, end).some((v, i) => i % 4 === 3 && v > 0)) continue;
      const p = referencePose(direction),
        a = parentPoint(p, near.parent),
        b = parentPoint(p, far.parent),
        shiftX = b.x - a.x,
        shiftY = b.y - a.y;
      for (let y = 0; y < t.height; y++)
        for (let x = 0; x < t.width; x++) {
          const dx = x + shiftX,
            dy = y + shiftY;
          if (dx < 0 || dx >= t.width || dy < 0 || dy >= t.height) continue;
          const src = ((row * t.height + y) * t.width + x) * 4;
          near.image.data.copy(
            far.image.data,
            ((row * t.height + dy) * t.width + dx) * 4,
            src,
            src + 4,
          );
        }
    }
  const result: CompiledSource[] = [];
  for (const [key, part] of parts) {
    if (!hasPixels(part.image)) continue;
    const positions = RUNTIME_VIEWS.map((dir) => {
      const p = referencePose(dir),
        sourceParent = parentPoint(p, t.parent),
        targetParent = parentPoint(p, part.parent);
      return {
        x: sourceParent.x - t.anchor.x - targetParent.x,
        y: sourceParent.y - t.anchor.y - targetParent.y,
      };
    });
    let x0 = 128,
      y0 = 128,
      x1 = -128,
      y1 = -128;
    for (let row = 0; row < 4; row++)
      for (let y = 0; y < t.height; y++)
        for (let x = 0; x < t.width; x++)
          if (part.image.data[((row * t.height + y) * t.width + x) * 4 + 3]) {
            const pt = positions[row]!;
            x0 = Math.min(x0, x + pt.x);
            x1 = Math.max(x1, x + pt.x);
            y0 = Math.min(y0, y + pt.y);
            y1 = Math.max(y1, y + pt.y);
          }
    const width = x1 - x0 + 1,
      height = y1 - y0 + 1;
    if (width > 96 || height > 128)
      throw new Error('Модуль слишком велик для кадра; уточните техническую маску.');
    const image = new PNG({ width, height: height * 4 });
    for (let row = 0; row < 4; row++)
      for (let y = 0; y < t.height; y++)
        for (let x = 0; x < t.width; x++) {
          const at = ((row * t.height + y) * t.width + x) * 4;
          if (!part.image.data[at + 3]) continue;
          const pt = positions[row]!,
            to = ((row * height + y + pt.y - y0) * width + x + pt.x - x0) * 4;
          part.image.data.copy(image.data, to, at, at + 4);
        }
    const descriptor = PartEntrySchema.parse({
      ...d,
      parent: part.parent,
      pass: part.pass,
      frameWidth: width,
      frameHeight: height,
      anchor: { x: -x0, y: -y0 },
      fit: 'fixed',
      sync: part.parent === 'head' ? 'head' : 'body',
      referenceWidth: undefined,
      hideBase: part.kind === 'foot' || d.hideBase,
      approved: { version: 1, kind: part.kind, referenceGender: gender },
    });
    result.push({ descriptor, image, key });
    if (n.compact === 'shoes')
      result.push({
        descriptor: { ...descriptor, parent: 'footRight', pairMirror: true },
        image,
        key: 'right-shoe',
      });
  }
  return result;
}
