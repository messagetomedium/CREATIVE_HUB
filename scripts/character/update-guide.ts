import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import {
  SOURCE_TEMPLATES,
  VIEW_MODES,
  templateFolder,
  type ViewMode,
} from '../../apps/web/src/avatar/modular/templates';
async function table(file: string, key: string, value: string) {
  const text = await readFile(file, 'utf8'),
    start = text.indexOf(`<!-- ${key}:start -->`),
    end = text.indexOf(`<!-- ${key}:end -->`);
  if (start < 0 || end < 0) throw new Error('Missing guide marker');
  await writeFile(
    file,
    await format(
      text.slice(0, start) +
        `<!-- ${key}:start -->\n${value}\n<!-- ${key}:end -->` +
        text.slice(end + `<!-- ${key}:end -->`.length),
      { parser: 'markdown' },
    ),
  );
}
interface Row {
  id: string;
  mode: ViewMode;
  name: string;
  category: string;
  logic: string;
  templateMode?: ViewMode;
}
const rows: Row[] = [
  {
    id: 'hair-short',
    mode: 'full',
    name: 'hair_short_full_01.png',
    category: 'hair',
    logic: 'Цельная причёска → перед/зад по цветным зонам',
  },
  {
    id: 'hair-long',
    mode: 'full',
    name: 'hair_long_full_01.png',
    category: 'hair',
    logic: 'Один лист головы/шеи/груди → перед/зад; pair = 3 вида',
  },
  {
    id: 'eyes',
    mode: 'front',
    name: 'eyes_basic_front_01.png',
    category: 'eyes',
    logic: 'Два глаза фронтом; для E/W берётся соответствующий глаз, N пусто',
  },
  {
    id: 'mouth',
    mode: 'front',
    name: 'mouth_basic_front_01.png',
    category: 'mouth',
    logic: 'Один фронтальный рот; профиль из половины рисунка, N пусто',
  },
  {
    id: 'details',
    mode: 'front',
    templateMode: 'sym1',
    name: 'face_detail_front_01.png',
    category: 'face_features',
    logic: 'Фронтальная маска → соответствующие половины лица E/W; N пусто',
  },
  {
    id: 'details',
    mode: 'sym1',
    name: 'hat_detail_sym1_01.png',
    category: 'hats',
    logic: 'Один вид без изменений для N/E/S/W',
  },
  {
    id: 'details',
    mode: 'sym2',
    name: 'accessory_detail_sym2_01.png',
    category: 'jewelry',
    logic: 'Фронт + правый бок; W отражается из E, N повторяет фронт',
  },
  {
    id: 'details',
    mode: 'full',
    name: 'accessory_detail_full_01.png',
    category: 'jewelry',
    logic: 'Все четыре вида художника, без отражения',
  },
  ...(['pants', 'skirt', 'shorts'] as const).flatMap((kind) =>
    (['high', 'low'] as const).map((fit) => ({
      id: `${kind}-${fit}`,
      mode: 'full' as const,
      name: `${kind}_${fit}_full_01.png`,
      category: 'bottoms',
      logic:
        fit === 'high'
          ? kind === 'skirt'
            ? 'Цельная юбка → верхний пояс + цельная нижняя часть'
            : 'Цельная вещь → верхний пояс + нижняя часть; штанины выделяет код'
          : 'Цельная вещь без верхней полосы → только нижний модуль',
    })),
  ),
  {
    id: 'shoe',
    mode: 'pair',
    name: 'shoes_basic_pair_01.png',
    category: 'footwear',
    logic: 'Один ботинок: фронт/бок/спина; W и второй ботинок формируются кодом',
  },
  {
    id: 'top',
    mode: 'pair',
    name: 'top_body_pair_01.png',
    category: 'tops',
    logic: 'Корпус верха; рукав необязателен для безрукавки',
  },
  {
    id: 'sleeve',
    mode: 'pair',
    name: 'top_sleeve_pair_01.png',
    category: 'tops',
    logic: 'Один рукав → две руки; same number as body',
  },
  {
    id: 'glove',
    mode: 'pair',
    name: 'top_glove_pair_01.png',
    category: 'tops',
    logic: 'Одна цельная перчатка/манжета → две кисти',
  },
  {
    id: 'body',
    mode: 'full',
    name: 'body_torso_full_01.png',
    category: 'body_features',
    logic: 'Накладка корпуса; тело не рисовать',
  },
  {
    id: 'body-arm',
    mode: 'full',
    name: 'body_arm_full_01.png',
    category: 'body_features',
    logic: 'Накладка руки; тело не рисовать',
  },
  {
    id: 'body-leg',
    mode: 'full',
    name: 'body_leg_full_01.png',
    category: 'body_features',
    logic: 'Накладка ноги; тело не рисовать',
  },
  {
    id: 'item',
    mode: 'full',
    name: 'item_hand_full_01.png',
    category: 'specials',
    logic: 'Предмет на кисти; не верхняя деталь головы',
  },
];
const header = [
  '| Имя файла / тип | Папка CHARACTER | Рисунков | Готовый PNG | Шаблон | Что делает программа |',
  '| --- | --- | ---: | --- | --- | --- |',
];
const lines = rows.map((row) => {
  const t = SOURCE_TEMPLATES.find((t) => t.id === row.id)!,
    mode = row.templateMode ?? row.mode,
    folder = templateFolder(t),
    stem = `TEMPLATES/${folder}/${t.id.replaceAll('-', '_')}_${mode}`,
    count = VIEW_MODES[row.mode].length;
  return `| \`${row.name}\` | ${row.category} | ${count} | ${t.width}×${t.height * count} | [TEMPLATE](${stem}_TEMPLATE.png) · [EMPTY](${stem}_EMPTY.png) | ${row.logic.replace('same number as body', 'тот же номер, что у корпуса')} |`;
});
await table('TECH_DOCS/CHARACTER/README.md', 'character-sizes', [...header, ...lines].join('\n'));
const rootLines = rows.map((row) => {
  const t = SOURCE_TEMPLATES.find((t) => t.id === row.id)!,
    count = VIEW_MODES[row.mode].length,
    stem = `CHARACTER/TEMPLATES/${templateFolder(t)}/${t.id.replaceAll('-', '_')}_${row.templateMode ?? row.mode}`;
  return `| \`${row.name}\` | ${count} | ${t.width}×${t.height * count} | [Шаблон](${stem}_TEMPLATE.png) | [${row.category}](../CHARACTER/${row.category}) |`;
});
await table(
  'TECH_DOCS/README.md',
  'character-categories',
  [
    '| Файл-пример | Рисунков | PNG | Шаблон | Куда загрузить |',
    '| --- | ---: | --- | --- | --- |',
    ...rootLines,
  ].join('\n'),
);
