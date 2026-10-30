export interface Terrain {
  id: number;
  name: string;
  walkable: boolean;
  source: { kind: 'placeholder'; color: string } | { kind: 'image'; url: string };
  joins: 'shore' | 'soft' | 'floor';
  variants: readonly string[];
}
/** Stable saved IDs; rendering and collision metadata are independent of movement. */
export const TERRAINS: Readonly<Record<number, Terrain>> = {
  0: {
    id: 0,
    name: 'Вода',
    walkable: false,
    source: { kind: 'placeholder', color: '#70b8bd' },
    joins: 'shore',
    variants: ['#75bdc1', '#6eb5bb'],
  },
  1: {
    id: 1,
    name: 'Песок',
    walkable: true,
    source: { kind: 'placeholder', color: '#ead2a0' },
    joins: 'soft',
    variants: ['#dfc591', '#f1dcaf'],
  },
  2: {
    id: 2,
    name: 'Трава',
    walkable: true,
    source: { kind: 'placeholder', color: '#83b86c' },
    joins: 'soft',
    variants: ['#7aaf64', '#90c078'],
  },
  3: {
    id: 3,
    name: 'Земля',
    walkable: true,
    source: { kind: 'placeholder', color: '#cdb28c' },
    joins: 'soft',
    variants: ['#bfa582', '#ddc59e'],
  },
  4: {
    id: 4,
    name: 'Пол',
    walkable: true,
    source: { kind: 'placeholder', color: '#d9b78e' },
    joins: 'floor',
    variants: ['#ceb087', '#e1c39c'],
  },
};
export function terrainAt(id: number): Terrain {
  const terrain = TERRAINS[id];
  if (!terrain) throw new Error(`Неизвестная поверхность: ${id}`);
  return terrain;
}
