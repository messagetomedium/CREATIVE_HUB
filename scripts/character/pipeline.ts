import { readFile, writeFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { format } from 'prettier';
import { compileSource } from './compile-source';
import {
  CATEGORIES,
  SOURCE_TEMPLATES,
  LEGACY_SOURCE_TEMPLATES,
  VIEW_MODES,
  templateDescriptor,
  type Category,
  type ViewMode,
  type SourceTemplate,
} from '../../apps/web/src/avatar/modular/templates';
import { RIG_VERSION, pose, parentPoint } from '../../apps/web/src/avatar/modular/rig';
import { PartEntrySchema, type PartEntry } from '../../apps/web/src/avatar/modular/parts';
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const exists = async (p: string) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};
async function writeChanged(p: string, bytes: string | Buffer) {
  await mkdir(path.dirname(p), { recursive: true });
  try {
    if ((await readFile(p)).equals(Buffer.from(bytes))) return;
  } catch {}
  const temp = p + '.tmp';
  await writeFile(temp, bytes);
  await rename(temp, p);
}
const blankItems =
  '# Предметы\n\nСтандартный PNG достаточно назвать по FILE_NAMING.md. Заполняйте строку только для названия или исключений.\n\n| Файл/ID | Название | Симметрия | Крепление | Наложение | Материал | Особенности |\n| --- | --- | --- | --- | --- | --- | --- |\n';
export async function initCharacterFolders(root: string) {
  for (const category of CATEGORIES) {
    const folder = path.join(root, 'CHARACTER', category);
    await mkdir(folder, { recursive: true });
    for (const [name, value] of [
      ['ITEMS.md', blankItems],
      ['DEBUG_REPORT.md', '# Критические ошибки импорта\n'],
    ])
      if (!(await exists(path.join(folder, name!))))
        await writeFile(path.join(folder, name!), value!);
  }
}
export interface Metadata {
  key: string;
  label: string;
  symmetry: string;
  parent: string;
  pass: string;
  material: string;
  notes: string;
}
export function readItems(markdown: string): Metadata[] {
  const result: Metadata[] = [];
  let columns: string[] = [];
  const names: Record<string, string> = {
    'файл/id': 'key',
    файл: 'key',
    id: 'key',
    название: 'label',
    симметрия: 'symmetry',
    крепление: 'parent',
    наложение: 'pass',
    материал: 'material',
    особенности: 'notes',
  };
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((v) => v.trim());
    if (cells.every((v) => /^:?-+:?$/.test(v))) continue;
    if (cells.some((v) => ['файл/id', 'файл', 'id'].includes(v.toLowerCase()))) {
      columns = cells.map((v) => names[v.toLowerCase()] ?? '');
      continue;
    }
    if (!columns.length || !cells.some(Boolean)) continue;
    const row = { key: '', label: '', symmetry: '', parent: '', pass: '', material: '', notes: '' };
    cells.forEach((v, i) => {
      const key = columns[i];
      if (key && key in row) row[key as keyof Metadata] = v;
    });
    if (row.key) result.push(row);
  }
  return result;
}
export interface ParsedName {
  id: string;
  slot: number;
  gender?: 'male' | 'female';
  mode: ViewMode;
  module?: string;
  pass?: 'back' | 'front';
  fixed: boolean;
  template?: string;
  simple?: boolean;
}
export function parseName(name: string, category: Category): ParsedName {
  if (!name.includes('__')) return parseSimpleName(name, category);
  if (!/^[a-z0-9_]+(?:__[A-Z_]+)+\.png$/.test(name))
    throw new Error('Имя: нужен латинский ID_01 и суффикс __FULL, __SYM_NES или __SYM_ES.png.');
  const [id, ...tokens] = name.slice(0, -4).split('__'),
    match = id!.match(/_([0-9]{2})$/);
  if (!match)
    throw new Error('В ID отсутствует номер слота _01…_06 (для особенностей тела до _12).');
  const slot = Number(match[1]);
  if (slot < 1 || slot > (category === 'body_features' ? 12 : 6))
    throw new Error('Номер слота вне существующего конструктора.');
  const modes = tokens.filter((v) => v in VIEW_MODES);
  if (modes.length !== 1) throw new Error('Нужно указать ровно один режим ракурсов.');
  const allowed = [
    'FULL',
    'SYM_NES',
    'SYM_ES',
    'BODY',
    'SLEEVE',
    'GLOVE',
    'BELT',
    'LEG',
    'HEAD',
    'TORSO',
    'ARM',
    'HAND',
    'FOOT',
    'BACK',
    'FRONT',
    'FIXED',
    'MALE',
    'FEMALE',
  ];
  if (tokens.some((v) => !allowed.includes(v))) throw new Error('Неизвестный суффикс имени файла.');
  const modules = tokens.filter((v) =>
    ['BODY', 'SLEEVE', 'GLOVE', 'BELT', 'LEG', 'HEAD', 'TORSO', 'ARM', 'HAND', 'FOOT'].includes(v),
  );
  if (modules.length > 1) throw new Error('У файла несколько несовместимых модулей.');
  const genders = tokens.filter((v) => v === 'MALE' || v === 'FEMALE');
  if (genders.length > 1 || (tokens.includes('FRONT') && tokens.includes('BACK')))
    throw new Error('Противоречивые суффиксы.');
  const gender = (genders[0]?.toLowerCase() ??
    (/_female_/.test(id!)
      ? 'female'
      : /_male_/.test(id!)
        ? 'male'
        : undefined)) as ParsedName['gender'];
  return {
    id: id!,
    slot,
    gender,
    mode: modes[0] as ViewMode,
    module: modules[0],
    pass: tokens.includes('BACK') ? 'back' : tokens.includes('FRONT') ? 'front' : undefined,
    fixed: tokens.includes('FIXED'),
  };
}
function parseSimpleName(name: string, category: Category): ParsedName {
  if (!/^[a-z][a-z0-9_]*_[0-9]{2}\.png$/.test(name))
    throw new Error('Имя: category_template_symmetry_01.png, маленькие латинские буквы.');
  const tokens = name.slice(0, -4).split('_'),
    slot = Number(tokens.pop()),
    prefix = tokens.shift()!;
  if (slot < 1 || slot > (category === 'body_features' ? 12 : 6))
    throw new Error(
      'Номер вне существующих слотов. У низа общая нумерация pants/skirt/shorts 01…06.',
    );
  const aliases: Record<string, Category> = {
    hair: 'hair',
    eyes: 'eyes',
    mouth: 'mouth',
    face: 'face_features',
    skin: 'face_features',
    body: 'body_features',
    top: 'tops',
    pants: 'bottoms',
    skirt: 'bottoms',
    shorts: 'bottoms',
    bottom: 'bottoms',
    shoes: 'footwear',
    shoe: 'footwear',
    hat: 'hats',
    jewelry: 'jewelry',
    accessory: 'jewelry',
    detail: 'jewelry',
    item: 'specials',
    special: 'specials',
  };
  if (aliases[prefix] !== category)
    throw new Error('Категория имени не соответствует папке CHARACTER.');
  const modes = tokens.filter((t) => ['full', 'pair', 'sym1', 'sym2', 'front'].includes(t));
  if (modes.length > 1) throw new Error('Укажите только один режим симметрии.');
  const mode = (modes[0] ??
    (['eyes', 'mouth', 'face_features'].includes(category)
      ? 'front'
      : category === 'footwear'
        ? 'pair'
        : 'full')) as ViewMode;
  const genders: string[] = tokens.filter((t) => t === 'female' || t === 'male');
  if (genders.length > 1) throw new Error('Противоречивый пол набора.');
  const fixed = tokens.includes('fixed'),
    rest = tokens.filter((t) => !modes.includes(t) && !genders.includes(t) && t !== 'fixed');
  if (rest.length > 1) throw new Error('Неизвестный тип шаблона.');
  const type =
    rest[0] ??
    (['eyes', 'mouth', 'footwear'].includes(category)
      ? 'basic'
      : ['hats', 'jewelry', 'face_features'].includes(category)
        ? 'detail'
        : category === 'tops'
          ? 'body'
          : category === 'body_features'
            ? 'torso'
            : category === 'specials'
              ? 'hand'
              : '');
  let template = '';
  if (category === 'bottoms') {
    if (!['pants', 'skirt', 'shorts'].includes(prefix) || !['high', 'low'].includes(type))
      throw new Error('Для низа нужны pants/skirt/shorts и high/low.');
    template = prefix + '-' + type;
  } else if (category === 'hair') {
    if (!['short', 'long'].includes(type) || !['full', 'pair'].includes(mode))
      throw new Error('Причёска: short/long и full/pair.');
    template = 'hair-' + type;
  } else if (category === 'eyes' || category === 'mouth') {
    if (type !== 'basic' || mode !== 'front')
      throw new Error('Глаза/рот: basic_front, только фронтальный рисунок.');
    template = category;
  } else if (['hats', 'jewelry', 'face_features'].includes(category)) {
    if (type !== 'detail') throw new Error('Для верхних деталей используется общий тип detail.');
    if (
      category === 'face_features'
        ? !['front', 'full'].includes(mode)
        : !['sym1', 'sym2', 'full'].includes(mode)
    )
      throw new Error('Деталь: sym1/sym2/full; лицевая накладка: front.');
    template = 'details';
  } else if (category === 'tops') {
    const map: Record<string, string> = { body: 'top', sleeve: 'sleeve', glove: 'glove' };
    template = map[type] ?? '';
  } else if (category === 'body_features') {
    const map: Record<string, string> = { torso: 'body', arm: 'body-arm', leg: 'body-leg' };
    template = map[type] ?? '';
  } else if (category === 'footwear') {
    if (type !== 'basic' || mode !== 'pair')
      throw new Error('Обувь: shoes_basic_pair_01.png, front/side/back одного ботинка.');
    template = 'shoe';
  } else if (category === 'specials') {
    if (type === 'hand') template = 'item';
  }
  if (!template || !SOURCE_TEMPLATES.some((t) => t.id === template))
    throw new Error('Неизвестный тип шаблона.');
  if (
    !['hats', 'jewelry', 'face_features', 'eyes', 'mouth'].includes(category) &&
    !['full', 'pair'].includes(mode)
  )
    throw new Error('Для этого объёмного предмета нужны full/pair.');
  return {
    id: `${prefix}_${type}_${String(slot).padStart(2, '0')}`,
    slot,
    gender: genders[0] as ParsedName['gender'],
    mode,
    fixed,
    template,
    simple: true,
  };
}
function chooseTemplate(category: Category, n: ParsedName, parent?: string): SourceTemplate {
  if (n.simple) {
    const source = SOURCE_TEMPLATES.find((t) => t.id === n.template)!;
    const fields: Record<Category, string> = {
      hair: 'hair',
      eyes: 'eyes',
      mouth: 'mouth',
      face_features: 'faceFeatures',
      body_features: 'bodyFeatures',
      tops: 'top',
      bottoms: 'bottom',
      footwear: 'footwear',
      hats: 'hat',
      jewelry: 'jewelry',
      specials: 'special',
    };
    const materials: Record<Category, string> = {
      hair: 'hair',
      eyes: 'fixed',
      mouth: 'fixed',
      face_features: 'skin',
      body_features: 'skin',
      tops: 'top',
      bottoms: 'bottom',
      footwear: 'footwear',
      hats: 'hat',
      jewelry: 'jewelry',
      specials: 'special',
    };
    return { ...source, category, field: fields[category], material: materials[category] };
  }

  const byModule: Record<string, string> = {
    BODY: category === 'tops' ? 'top' : 'body',
    TORSO: category === 'jewelry' ? 'jewelry-body' : category === 'tops' ? 'top' : 'body',
    SLEEVE: 'sleeve',
    GLOVE: 'glove',
    BELT: 'bottom',
    LEG: category === 'bottoms' ? 'pant' : 'body-leg',
    ARM: 'body-arm',
    HEAD:
      category === 'jewelry'
        ? 'jewelry'
        : category === 'body_features'
          ? 'face'
          : category === 'hats'
            ? 'hat'
            : 'hair',
    HAND: category === 'jewelry' ? 'jewelry-hand' : 'glove',
    FOOT: 'shoe',
  };
  const defaults: Record<Category, string> = {
    hair: 'hair',
    eyes: 'eyes',
    mouth: 'mouth',
    face_features: 'face',
    body_features: 'body',
    tops: 'top',
    bottoms: 'bottom',
    footwear: 'shoe',
    hats: 'hat',
    jewelry: 'jewelry',
    specials: 'item',
  };
  let id = n.module ? byModule[n.module] : defaults[category];
  if (!n.module && category === 'jewelry' && parent?.startsWith('torso')) id = 'jewelry-body';
  if (!n.module && category === 'jewelry' && parent?.startsWith('hand')) id = 'jewelry-hand';
  const t = LEGACY_SOURCE_TEMPLATES.find((v) => v.id === id && v.category === category);
  if (!t) throw new Error('Модуль не соответствует категории/креплению.');
  return t;
}
const parentNames: Record<string, string> = {
  голова: 'head',
  лицо: 'head',
  'голова / лицо': 'head',
  корпус: 'torso',
  туловище: 'torso',
  таз: 'pelvis',
  'левая рука': 'armLeft',
  'правая рука': 'armRight',
  'левая кисть': 'handLeft',
  'правая кисть': 'handRight',
  'левая нога': 'legLeft',
  'правая нога': 'legRight',
  'левая стопа': 'footLeft',
  'правая стопа': 'footRight',
};
function metadataFor(rows: Metadata[], name: string, n: ParsedName): Metadata | undefined {
  const exact = rows.filter((r) => r.key === name),
    fallback = rows.filter((r) => r.key === n.id),
    found = exact.length ? exact : fallback;
  if (found.length > 1) throw new Error('Несколько строк ITEMS.md для одного файла/ID.');
  return found[0];
}
export function validatePixels(
  png: PNG,
  t: SourceTemplate,
  n: ParsedName,
  material: string,
  skinEffect: boolean,
) {
  const rows = VIEW_MODES[n.mode];
  if (png.width !== t.width || png.height !== t.height * rows.length)
    throw new Error(
      `Неверный размер: нужен ${t.width}×${t.height * rows.length} PNG (${rows.join('/')}), получен ${png.width}×${png.height}.`,
    );
  const levels = [32, 80, 128, 184, 240];
  let visible = 0,
    transparent = 0;
  const activeRows = Array(rows.length).fill(0) as number[];
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4,
        a = png.data[i + 3]!;
      if (a === 0) {
        transparent++;
        continue;
      }
      visible++;
      activeRows[Math.floor(y / t.height)]!++;
      if (x === 0 || x === png.width - 1 || y % t.height === 0 || y % t.height === t.height - 1)
        throw new Error(
          `Рисунок касается границы клетки (${rows[Math.floor(y / t.height)]}); оставьте хотя бы 1 прозрачный пиксель до края.`,
        );
      if (!skinEffect && a !== 255)
        throw new Error(
          'Полупрозрачная граница: для обычного слоя используйте alpha 0/255. Полутона alpha допустимы для кожных эффектов.',
        );
      if (
        material !== 'fixed' &&
        (png.data[i] !== png.data[i + 1] ||
          png.data[i] !== png.data[i + 2] ||
          !levels.includes(png.data[i]!))
      )
        throw new Error(
          `Недопустимый цвет RGB ${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}; нужны пять технических индексов.`,
        );
    }
  if (!visible) throw new Error('PNG полностью пустой.');
  if (n.mode === 'front' && t.field === 'eyes') {
    const halves = [false, false];
    for (let y = 0; y < png.height; y++)
      for (let x = 0; x < png.width; x++)
        if (png.data[(y * png.width + x) * 4 + 3]) halves[x < t.anchor.x ? 0 : 1] = true;
    if (!halves.every(Boolean))
      throw new Error(
        'Фронтальный набор глаз должен содержать оба глаза по сторонам от центра головы.',
      );
  }
  if (!transparent) throw new Error('PNG не имеет прозрачного фона.');
  const nInvisible = ['eyes', 'mouth', 'face_features', 'jewelry'].includes(t.category);
  for (let row = 0; row < rows.length; row++)
    if (
      !activeRows[row] &&
      !(rows[row] === 'north' && nInvisible) &&
      !skinEffect &&
      material !== 'fixed' &&
      !n.pass &&
      ['hair', 'tops', 'bottoms', 'footwear', 'hats'].includes(t.category)
    )
      throw new Error(`Отсутствует обязательный вид ${rows[row]}.`);
  if (material !== 'fixed' && !skinEffect) {
    const ink = (x: number, y: number) =>
      x >= 0 &&
      x < png.width &&
      y >= 0 &&
      y < png.height &&
      png.data[(y * png.width + x) * 4 + 3] === 255 &&
      png.data[(y * png.width + x) * 4] === 32;
    // Only diagnose an unambiguous two-pixel flat external contour, not tiny corners/internal shading.
    for (let y = 2; y < png.height - 3; y++)
      for (let x = 2; x < png.width - 9; x++) {
        if (
          Array.from(
            { length: 8 },
            (_, dx) =>
              ink(x + dx, y) &&
              ink(x + dx, y + 1) &&
              png.data[((y - 1) * png.width + x + dx) * 4 + 3] === 0 &&
              png.data[((y + 2) * png.width + x + dx) * 4 + 3] === 255,
          ).every(Boolean)
        )
          throw new Error('Внешний горизонтальный контур имеет толщину не менее 2 px; нужен 1 px.');
      }
    for (let x = 2; x < png.width - 3; x++)
      for (let y = 2; y < png.height - 9; y++) {
        if (
          Array.from(
            { length: 8 },
            (_, dy) =>
              ink(x, y + dy) &&
              ink(x + 1, y + dy) &&
              png.data[((y + dy) * png.width + x - 1) * 4 + 3] === 0 &&
              png.data[((y + dy) * png.width + x + 2) * 4 + 3] === 255,
          ).every(Boolean)
        )
          throw new Error('Внешний вертикальный контур имеет толщину не менее 2 px; нужен 1 px.');
      }
  }
}
export function expandViews(png: PNG, t: SourceTemplate, mode: ViewMode, slot = 1): PNG {
  const out = new PNG({ width: t.width, height: t.height * 4 }),
    rows = VIEW_MODES[mode] as readonly string[];
  if (mode === 'front') return projectFront(png, t, slot);
  for (const [dest, view] of ['north', 'east', 'south', 'west'].entries()) {
    const repeated = mode === 'sym1' || (mode === 'sym2' && view === 'north');
    const mirror = view === 'west' && !['FULL', 'full', 'sym1'].includes(mode);
    const source = rows.indexOf(repeated ? 'south' : mirror ? 'east' : view);
    if (source < 0) continue;
    for (let y = 0; y < t.height; y++)
      for (let x = 0; x < t.width; x++) {
        const a = ((source * t.height + y) * t.width + (mirror ? t.width - 1 - x : x)) * 4,
          b = ((dest * t.height + y) * t.width + x) * 4;
        png.data.copy(out.data, b, a, a + 4);
      }
  }
  return out;
}
export function projectFront(png: PNG, t: SourceTemplate, slot = 1) {
  const out = new PNG({ width: t.width, height: t.height * 4 }),
    cx = t.anchor.x;
  png.data.copy(out.data, 2 * t.width * t.height * 4);
  let minX = t.width,
    maxX = -1;
  for (let y = 0; y < t.height; y++)
    for (let x = 0; x < t.width; x++)
      if (png.data[(y * t.width + x) * 4 + 3]) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
  const mouthMid = Math.floor((minX + maxX) / 2);
  for (const [row, right] of [
    [1, true],
    [3, false],
  ] as const)
    for (let y = 0; y < t.height; y++)
      for (let x = 0; x < t.width; x++) {
        const at = (y * t.width + x) * 4;
        if (!png.data[at + 3]) continue;
        let accept = right ? x >= cx : x < cx,
          shift = right ? 4 : -4;
        if (t.field === 'mouth') {
          accept = right ? x >= mouthMid : x <= mouthMid;
          const mid = right ? Math.floor((mouthMid + maxX) / 2) : Math.floor((minX + mouthMid) / 2);
          shift = (right ? cx + 14 : cx - 16) - mid;
        } else if (t.field === 'faceFeatures') {
          if (slot === 6) {
            accept = Math.abs(x - cx) <= 4;
            shift = right ? 14 : -14;
          } else shift = right ? 2 : -2;
        }
        const dx = x + shift;
        if (!accept || dx < 1 || dx >= t.width - 1) continue;
        png.data.copy(out.data, ((row * t.height + y) * t.width + dx) * 4, at, at + 4);
      }
  return out;
}
interface ItemRecord {
  id: string;
  category: Category;
  slot: number;
  gender?: 'male' | 'female';
  label: string;
  hash: string;
  files: string[];
  sources: { name: string; sha256: string; mode: ViewMode; module: string }[];
  parts: PartEntry[];
  thumbnail: string;
}
interface Manifest {
  version: string;
  items: ItemRecord[];
}
export async function importCharacters(root = process.cwd()) {
  await initCharacterFolders(root);
  const destination = path.join(root, 'content/art'),
    registryPath = path.join(root, 'content/avatars/modular/parts.json'),
    manifestPath = path.join(root, 'content/avatars/modular/import-manifest.json');
  await mkdir(destination, { recursive: true });
  let previous: Manifest = { version: RIG_VERSION, items: [] };
  try {
    previous = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
  } catch {}
  const accepted: ItemRecord[] = [],
    errors: { category: Category; name: string; problem: string }[] = [];
  let updated = 0,
    unchanged = 0;
  for (const category of CATEGORIES) {
    const folder = path.join(root, 'CHARACTER', category),
      rows = readItems(await readFile(path.join(folder, 'ITEMS.md'), 'utf8'));
    const groups = new Map<string, { name: string; parsed: ParsedName }[]>();
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name, 'en'),
    )) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.png')) continue;
      try {
        const parsed = parseName(entry.name, category),
          key = `${category}-${parsed.gender ?? 'any'}-${parsed.slot}`,
          items = groups.get(key) ?? [];
        items.push({ name: entry.name, parsed });
        groups.set(key, items);
      } catch (e) {
        errors.push({ category, name: entry.name, problem: (e as Error).message });
      }
    }
    // Unknown metadata rows usually indicate a typo and must not silently attach to another item.
    const allNames = [...groups.values()].flatMap((g) => g.flatMap((v) => [v.name, v.parsed.id]));
    for (const row of rows)
      if (!allNames.includes(row.key))
        errors.push({
          category,
          name: 'ITEMS.md: ' + row.key,
          problem: 'Строка не соответствует имени PNG или ID в этой категории.',
        });
    for (const [id, files] of groups) {
      const old = previous.items.find((v) => v.id === id);
      try {
        if (errors.some((e) => e.category === category && e.name.startsWith('ITEMS.md')))
          throw new Error('Исправьте несопоставленные строки ITEMS.md этой категории.');
        const prepared = [];
        let label = '';
        const occupancy = new Set<string>();
        for (const f of files) {
          const meta = metadataFor(rows, f.name, f.parsed);
          if (meta?.symmetry && meta.symmetry !== f.parsed.mode)
            throw new Error('Симметрия в ITEMS.md противоречит имени PNG.');
          const parent = meta?.parent
            ? (parentNames[meta.parent.toLowerCase()] ?? meta.parent)
            : undefined;
          const t = chooseTemplate(category, f.parsed, parent),
            descriptor = templateDescriptor(t, f.parsed.slot);
          if (parent) {
            const family = (s: string) => s.replace(/Left|Right$/, '');
            if (family(parent) !== family(t.parent))
              throw new Error('Крепление в ITEMS.md не соответствует выбранному шаблону.');
            descriptor.parent = parent as PartEntry['parent'];
          }
          const explicitPass = meta?.pass
            ? ({
                сзади: 'back',
                перед: 'front',
                спереди: 'front',
                'перед глазами': 'front',
                'за телом': 'back',
                'перед телом': 'front',
              }[meta.pass.toLowerCase()] ?? meta.pass)
            : undefined;
          if (explicitPass && !['back', 'front'].includes(explicitPass))
            throw new Error('Наложение: используйте front/спереди или back/сзади.');
          if (f.parsed.pass && explicitPass && explicitPass !== f.parsed.pass)
            throw new Error('Наложение в ITEMS.md противоречит суффиксу PNG.');
          descriptor.pass = (explicitPass ?? f.parsed.pass ?? 'front') as PartEntry['pass'];
          const materials: Record<string, string> = {
            фиксированный: 'fixed',
            маска: t.material,
            кожа: 'skin',
            волосы: 'hair',
            верх: 'top',
            низ: 'bottom',
            обувь: 'footwear',
            шапка: 'hat',
            украшение: 'jewelry',
            предмет: 'special',
          };
          const material = meta?.material
            ? (materials[meta.material.toLowerCase()] ?? meta.material)
            : f.parsed.fixed
              ? 'fixed'
              : t.material;
          if (f.parsed.fixed && material !== 'fixed')
            throw new Error('FIXED в имени противоречит материалу ITEMS.md.');
          if (!['fixed', t.material].includes(material))
            throw new Error('Материал не соответствует категории.');
          descriptor.material = material as PartEntry['material'];
          descriptor.selection.gender = f.parsed.gender;
          const key = [descriptor.parent, descriptor.pass, descriptor.material, t.id].join('/');
          if (occupancy.has(key)) throw new Error('Два PNG занимают один и тот же модуль/слот.');
          occupancy.add(key);
          const bytes = await readFile(path.join(folder, f.name));
          if (bytes.length > 8 * 1024 * 1024) throw new Error('PNG превышает 8 MiB.');
          if (bytes.length < 33 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
            throw new Error('Повреждённый PNG.');
          if (
            bytes.readUInt32BE(16) !== t.width ||
            bytes.readUInt32BE(20) !== t.height * VIEW_MODES[f.parsed.mode].length
          )
            throw new Error(
              `Неверный размер: ${t.width}×${t.height * VIEW_MODES[f.parsed.mode].length} для ${t.id}/${f.parsed.mode}.`,
            );
          const png = PNG.sync.read(bytes, { checkCRC: true }),
            skinEffect = category === 'face_features' || category === 'body_features';
          validatePixels(png, t, f.parsed, material, skinEffect);
          const expanded = expandViews(png, t, f.parsed.mode, f.parsed.slot);
          prepared.push({ f, t, descriptor, expanded, sourceHash: sha(bytes), meta });
          if (meta?.label) label = meta.label;
        }
        if (['hair', 'tops', 'bottoms', 'footwear', 'hats'].includes(category))
          for (let direction = 0; direction < 4; direction++) {
            if (
              !prepared.some((v) =>
                v.expanded.data
                  .subarray(
                    direction * v.t.width * v.t.height * 4,
                    (direction + 1) * v.t.width * v.t.height * 4,
                  )
                  .some((value, index) => index % 4 === 3 && value > 0),
              )
            )
              throw new Error(
                'У основного объёма предмета отсутствует вид ' +
                  ['N', 'E', 'S', 'W'][direction] +
                  '; дополните основной слой, SYM_ES подходит для дополнительного переднего слоя.',
              );
          }
        const whole = prepared.filter(
          (v) =>
            v.f.parsed.simple &&
            (v.t.id.startsWith('hair-') || /^(pants|skirt|shorts)-/.test(v.t.id)) &&
            v.descriptor.material !== 'fixed',
        );
        if (whole.length > 1)
          throw new Error(
            'Несколько цельных вещей занимают один слот: нумеруйте варианты низа/волос в пределах общей категории.',
          );
        const fingerprint = sha(
          json({
            version: RIG_VERSION,
            prepared: prepared.map((v) => ({
              file: v.f.name,
              hash: v.sourceHash,
              descriptor: v.descriptor,
              meta: v.meta,
            })),
          }),
        );
        if (
          old?.hash === fingerprint &&
          old.files.every((v) => requireSafeOutput(v)) &&
          (await Promise.all(old.files.map((v) => exists(path.join(destination, v))))).every(
            Boolean,
          )
        ) {
          accepted.push(old);
          unchanged++;
          continue;
        }
        const parts: PartEntry[] = [],
          outputs: string[] = [];
        const images = new Map<string, PNG>();
        let thumbnail = '';
        for (const v of prepared)
          for (const piece of compileSource(
            v.t,
            v.descriptor,
            v.expanded,
            Boolean(v.f.parsed.simple),
            v.descriptor.material === 'fixed' &&
              prepared.some(
                (other) =>
                  other !== v && other.t.id === v.t.id && other.descriptor.material !== 'fixed',
              ),
          )) {
            const bytes = PNG.sync.write(piece.image),
              name = `character-${sha(bytes).slice(0, 20)}.png`;
            await writeChanged(path.join(destination, name), bytes);
            outputs.push(name);
            const d = PartEntrySchema.parse({
              ...piece.descriptor,
              id: `character-${id.replaceAll('_', '-')}-${v.t.id}-${piece.key}-${piece.descriptor.parent.toLowerCase()}-${piece.descriptor.pass}-${piece.descriptor.material}`,
              source: `/content/${name}`,
            });
            parts.push(d);
            images.set(d.source!, piece.image);
            if (['sleeve', 'glove', 'pant', 'shoe'].includes(v.t.id) && !v.meta?.parent)
              parts.push({
                ...d,
                id: d.id + '-right',
                parent: d.parent.replace('Left', 'Right') as PartEntry['parent'],
                pairMirror: !['FULL', 'full'].includes(v.f.parsed.mode),
              });
          }
        const small = makeThumbnail(parts, images),
          thumbBytes = PNG.sync.write(small),
          thumbName = `character-thumb-${sha(thumbBytes).slice(0, 20)}.png`;
        await writeChanged(path.join(destination, thumbName), thumbBytes);
        outputs.push(thumbName);
        thumbnail = `/content/${thumbName}`;
        accepted.push({
          id,
          category,
          slot: files[0]!.parsed.slot,
          gender: files[0]!.parsed.gender,
          label: label || files[0]!.parsed.id,
          hash: fingerprint,
          files: [...new Set(outputs)],
          sources: prepared.map((v) => ({
            name: v.f.name,
            sha256: v.sourceHash,
            mode: v.f.parsed.mode,
            module: v.t.id,
          })),
          parts,
          thumbnail,
        });
        updated++;
      } catch (e) {
        for (const f of files)
          errors.push({ category, name: f.name, problem: (e as Error).message });
        if (old) accepted.push(old);
      }
    }
    if (errors.some((e) => e.category === category))
      for (const old of previous.items.filter((v) => v.category === category))
        if (!accepted.some((v) => v.id === old.id)) accepted.push(old);
  }
  accepted.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  // A universal item and gender-specific override must have distinct intentional slots.
  for (const item of accepted)
    for (const other of accepted)
      if (
        item !== other &&
        item.category === other.category &&
        item.slot === other.slot &&
        (!item.gender || !other.gender)
      )
        errors.push({
          category: item.category,
          name: item.id,
          problem:
            'Универсальный и гендерный предметы конфликтуют в одном слоте. Выберите один набор или отдельные MALE/FEMALE.',
        });
  const conflictIds = new Set(
    errors.filter((e) => e.problem.startsWith('Универсальный')).map((e) => e.name),
  );
  const final = accepted.filter((i) => !conflictIds.has(i.id));
  for (const id of conflictIds) {
    const old = previous.items.find((v) => v.id === id);
    if (old && !final.some((v) => v.id === id)) final.push(old);
  }
  let manual: PartEntry[] = [];
  try {
    manual = (JSON.parse(await readFile(registryPath, 'utf8')) as PartEntry[]).filter(
      (v) => !v.id.startsWith('character-'),
    );
  } catch {}
  await writeChanged(
    registryPath,
    await format(json([...manual, ...final.flatMap((v) => v.parts)]), { parser: 'json' }),
  );
  await writeChanged(
    manifestPath,
    await format(json({ version: RIG_VERSION, items: final }), { parser: 'json' }),
  );
  const used = new Set([
    ...final.flatMap((v) => v.files),
    ...manual.flatMap((v) => (v.source ? [v.source.slice('/content/'.length)] : [])),
  ]);
  for (const name of await readdir(destination))
    if (requireSafeOutput(name) && !used.has(name))
      await rm(path.join(destination, name), { force: true });
  for (const category of CATEGORIES) {
    const rows = errors.filter((e) => e.category === category),
      unique = [...new Map(rows.map((e) => [e.name + '\n' + e.problem, e])).values()];
    const report =
      '# Критические ошибки импорта\n' +
      unique
        .map(
          (e) =>
            `\n## ${e.name}\n\nПроблема: ${e.problem}\n\nСтатус: требует исправления. Исправьте исходный PNG/ITEMS.md и повторите npm run character:import. Последняя принятая версия, если была, сохранена.\n`,
        )
        .join('');
    await writeChanged(path.join(root, 'CHARACTER', category, 'DEBUG_REPORT.md'), report);
  }
  return { updated, unchanged, errors, items: final.length };
}
function requireSafeOutput(name: string) {
  return /^character-(?:thumb-)?[a-f0-9]{20}\.png$/.test(name);
}

function makeThumbnail(parts: PartEntry[], images: Map<string, PNG>) {
  const p = pose('average', 'south', 0),
    canvas = new PNG({ width: 96, height: 128 });
  const sorted = [...parts].sort((a, b) => Number(a.pass === 'front') - Number(b.pass === 'front'));
  for (const d of sorted) {
    const source = images.get(d.source!)!,
      pt = parentPoint(p, d.parent),
      left = pt.x - d.anchor.x + d.offset.x,
      top = pt.y - d.anchor.y + d.offset.y;
    for (let y = 0; y < d.frameHeight; y++)
      for (let x = 0; x < d.frameWidth; x++) {
        const dx = left + x,
          dy = top + y;
        if (dx < 0 || dx >= 96 || dy < 0 || dy >= 128) continue;
        const sx = d.mirrorX !== d.pairMirror ? d.frameWidth - 1 - x : x,
          src = ((2 * d.frameHeight + y) * d.frameWidth + sx) * 4,
          dst = (dy * 96 + dx) * 4,
          a = source.data[src + 3]! / 255,
          old = canvas.data[dst + 3]! / 255,
          alpha = a + old * (1 - a);
        if (!a) continue;
        for (let ch = 0; ch < 3; ch++)
          canvas.data[dst + ch] = Math.round(
            (source.data[src + ch]! * a + canvas.data[dst + ch]! * old * (1 - a)) / alpha,
          );
        canvas.data[dst + 3] = Math.round(alpha * 255);
      }
  }
  let minX = 96,
    minY = 128,
    maxX = 0,
    maxY = 0;
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 96; x++)
      if (canvas.data[(y * 96 + x) * 4 + 3]) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  if (minX > maxX) return new PNG({ width: 1, height: 1 });
  const out = new PNG({ width: maxX - minX + 1, height: maxY - minY + 1 });
  for (let y = 0; y < out.height; y++) {
    const at = ((minY + y) * 96 + minX) * 4;
    canvas.data.copy(out.data, y * out.width * 4, at, at + out.width * 4);
  }
  return out;
}
