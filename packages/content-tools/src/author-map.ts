// Original, deterministic layout authoring helper. Ordinary builds never overwrite the Tiled source.
import { readFile, writeFile } from 'node:fs/promises';
import { WorkshopsSchema } from '@creative-factory/contracts';
const workshops = WorkshopsSchema.parse(
  JSON.parse(await readFile('content/maps/workshops.json', 'utf8')),
);
const width = 64,
  height = 48,
  tile = 32;
const ground = Array<number>(width * height).fill(1);
const solids = Array<number>(width * height).fill(0);
function wall(x: number, y: number) {
  solids[y * width + x] = 8;
}
for (let x = 0; x < width; x++) {
  wall(x, 0);
  wall(x, height - 1);
}
for (let y = 0; y < height; y++) {
  wall(0, y);
  wall(width - 1, y);
}
for (const workshop of workshops) {
  const r = workshop.room;
  for (let y = r.y; y < r.y + r.height; y++)
    for (let x = r.x; x < r.x + r.width; x++) {
      ground[y * width + x] = workshop.floorTile + 1;
      if (x === r.x || y === r.y || x === r.x + r.width - 1 || y === r.y + r.height - 1) wall(x, y);
    }
  const doorY = workshop.door.side === 'north' ? r.y : r.y + r.height - 1;
  for (
    let x = r.x + workshop.door.offset;
    x < r.x + workshop.door.offset + workshop.door.width;
    x++
  ) {
    solids[doorY * width + x] = 0;
    ground[doorY * width + x] = 2;
  }
}
for (let y = 1; y < height - 1; y++)
  for (let x = 1; x < width - 1; x++) {
    if ((x >= 26 && x <= 37 && y >= 16 && y <= 31) || (y >= 22 && y <= 27) || (x >= 29 && x <= 34))
      ground[y * width + x] = 2;
  }
let nextId = 1;
const object = (
  name: string,
  type: string,
  x: number,
  y: number,
  w: number,
  h: number,
  values: Record<string, string | boolean | number> = {},
) => ({
  id: nextId++,
  name,
  type,
  x: x * tile,
  y: y * tile,
  width: w * tile,
  height: h * tile,
  rotation: 0,
  visible: true,
  properties: Object.entries(values).map(([name, value]) => ({
    name,
    type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'int' : 'string',
    value,
  })),
});
const props = [
  object('design-table-1', 'prop', 6, 8, 3, 2, {
    assetId: 'worktable',
    accent: '#a69acb',
    solid: true,
  }),
  object('design-table-2', 'prop', 15, 8, 4, 2, {
    assetId: 'worktable',
    accent: '#a69acb',
    solid: true,
  }),
  object('design-table-3', 'prop', 6, 15, 3, 2, {
    assetId: 'worktable',
    accent: '#a69acb',
    solid: true,
  }),
  object('design-table-4', 'prop', 19, 15, 3, 2, {
    assetId: 'worktable',
    accent: '#a69acb',
    solid: true,
  }),
  object('media-console-1', 'prop', 43, 8, 4, 2, {
    assetId: 'console',
    accent: '#dc9d77',
    solid: true,
  }),
  object('media-console-2', 'prop', 53, 8, 4, 2, {
    assetId: 'console',
    accent: '#dc9d77',
    solid: true,
  }),
  object('media-console-3', 'prop', 43, 15, 3, 2, {
    assetId: 'console',
    accent: '#dc9d77',
    solid: true,
  }),
  object('media-console-4', 'prop', 55, 15, 3, 2, {
    assetId: 'console',
    accent: '#dc9d77',
    solid: true,
  }),
  object('textile-table-1', 'prop', 6, 33, 4, 2, {
    assetId: 'cutting-table',
    accent: '#8faf91',
    solid: true,
  }),
  object('textile-table-2', 'prop', 16, 33, 4, 2, {
    assetId: 'cutting-table',
    accent: '#8faf91',
    solid: true,
  }),
  object('textile-table-3', 'prop', 6, 40, 3, 2, {
    assetId: 'cutting-table',
    accent: '#8faf91',
    solid: true,
  }),
  object('textile-table-4', 'prop', 19, 40, 3, 2, {
    assetId: 'cutting-table',
    accent: '#8faf91',
    solid: true,
  }),
  object('architecture-table-1', 'prop', 43, 34, 4, 2, {
    assetId: 'model-table',
    accent: '#8caabd',
    solid: true,
  }),
  object('architecture-table-2', 'prop', 53, 34, 4, 2, {
    assetId: 'model-table',
    accent: '#8caabd',
    solid: true,
  }),
  object('architecture-table-3', 'prop', 43, 41, 3, 2, {
    assetId: 'model-table',
    accent: '#8caabd',
    solid: true,
  }),
  object('architecture-table-4', 'prop', 55, 41, 3, 2, {
    assetId: 'model-table',
    accent: '#8caabd',
    solid: true,
  }),
  object('hall-bench-west', 'prop', 27, 20, 2, 1, {
    assetId: 'bench',
    accent: '#a8af94',
    solid: true,
  }),
  object('hall-bench-east', 'prop', 35, 20, 2, 1, {
    assetId: 'bench',
    accent: '#a8af94',
    solid: true,
  }),
  ...[
    [3, 3],
    [23, 3],
    [39, 3],
    [59, 3],
    [3, 43],
    [23, 43],
    [39, 43],
    [59, 43],
    [27, 17],
    [36, 17],
    [27, 30],
    [36, 30],
  ].map(([x, y], i) =>
    object('plant-' + i, 'prop', x!, y!, 1, 1, {
      assetId: 'plant',
      accent: '#829c78',
      solid: true,
    }),
  ),
];
const zones = [
  object('corridors', 'zone', 1, 1, 62, 46, {
    name: 'Коридоры завода',
    description: 'Четыре направления — десятки новых идей.',
    accent: '#b3baa7',
    priority: 0,
  }),
  object('hall', 'zone', 26, 16, 12, 16, {
    name: 'Центральный холл',
    description: 'Здесь встречаются идеи и люди.',
    accent: '#d8e6a2',
    priority: 1,
  }),
  ...workshops.map((w) =>
    object(w.id, 'zone', w.room.x + 1, w.room.y + 1, w.room.width - 2, w.room.height - 2, {
      name: w.name,
      description: w.description,
      accent: w.accent,
      priority: 10,
    }),
  ),
];
const map = {
  compressionlevel: -1,
  infinite: false,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  type: 'map',
  version: '1.10',
  tiledversion: '1.11.2',
  width,
  height,
  tilewidth: tile,
  tileheight: tile,
  nextlayerid: 6,
  nextobjectid: nextId,
  layers: [
    {
      id: 1,
      name: 'ground',
      type: 'tilelayer',
      width,
      height,
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      data: ground,
    },
    {
      id: 2,
      name: 'solids',
      type: 'tilelayer',
      width,
      height,
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      data: solids,
    },
    {
      id: 3,
      name: 'world-props',
      type: 'objectgroup',
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      objects: props,
    },
    {
      id: 4,
      name: 'interactions',
      type: 'objectgroup',
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      objects: zones,
    },
    {
      id: 5,
      name: 'spawns',
      type: 'objectgroup',
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      objects: [object('entrance', 'spawn', 32, 26, 1, 1)],
    },
  ],
  tilesets: [
    {
      firstgid: 1,
      name: 'factory-placeholder',
      tilewidth: 32,
      tileheight: 32,
      tilecount: 8,
      columns: 8,
      image: 'placeholder-tiles.svg',
      imagewidth: 256,
      imageheight: 32,
      margin: 0,
      spacing: 0,
    },
  ],
};
await writeFile('content/maps/factory.tmj', JSON.stringify(map));
console.log('Authored original Tiled map: 64 × 48 cells');
