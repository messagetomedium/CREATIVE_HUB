/** Authoring-only contract. Never imported by the application or legacy importer. */
export const ARTIST_VERSION = 'approved-editor-2026-10-29';
export const ARTIST_BUILDS = ['very-slim', 'slim', 'average', 'sturdy'] as const;
export const ARTIST_VIEWS = {
  full: ['south', 'east', 'north', 'west'],
  pair: ['south', 'east', 'north'],
  front: ['south'],
  sym1: ['south'],
  sym2: ['south', 'east'],
} as const;
export type ArtistMode = keyof typeof ARTIST_VIEWS;
export interface ArtistTemplate {
  id: string;
  category: string;
  width: number;
  height: number;
  anchor: { x: number; y: number };
  parent: string;
  modes: ArtistMode[];
  gender?: 'female';
}
const template = (
  id: string,
  category: string,
  width: number,
  height: number,
  x: number,
  y: number,
  parent: string,
  modes: ArtistMode[] = ['full', 'pair'],
): ArtistTemplate => ({ id, category, width, height, anchor: { x, y }, parent, modes });
export const ARTIST_TEMPLATES: ArtistTemplate[] = [
  template('hair-short', 'hair', 96, 96, 48, 34, 'head'),
  template('hair-long', 'hair', 96, 112, 48, 34, 'head'),
  template('eyes', 'eyes', 64, 64, 32, 32, 'head', ['front']),
  template('mouth', 'mouth', 64, 64, 32, 32, 'head', ['front']),
  template('details', 'details', 64, 64, 32, 32, 'head', ['sym1', 'sym2', 'full']),
  template('body', 'body_features', 56, 52, 28, 24, 'torso'),
  template('body-arm', 'body_features', 24, 40, 12, 8, 'armLeft'),
  template('body-leg', 'body_features', 24, 36, 12, 4, 'legLeft'),
  template('top', 'tops', 56, 52, 28, 24, 'torso'),
  { ...template('top-female', 'tops', 56, 52, 28, 24, 'torso'), gender: 'female' },
  template('sleeve', 'tops', 24, 40, 12, 8, 'armLeft'),
  template('glove', 'tops', 20, 24, 10, 6, 'handLeft'),
  ...['pants', 'skirt', 'shorts'].flatMap((kind) =>
    ['high', 'low'].map((fit) => template(`${kind}-${fit}`, 'bottoms', 80, 64, 40, 20, 'pelvis')),
  ),
  template('shoe', 'footwear', 40, 18, 20, 8, 'footLeft', ['pair']),
  template('item', 'specials', 32, 40, 16, 8, 'handRight'),
];
export const templateFolder = (t: ArtistTemplate) => t.category.toUpperCase();
export const ARTIST_LOWER = { bandTop: 8, bandBottom: 16, legSplit: 24, shortHem: 34, maxHem: 50 };
export function artistLegX(direction: string, index: number) {
  if (direction === 'east' || direction === 'west') return 42;
  return direction === 'north' ? (index === 0 ? 48 : 32) : index === 0 ? 32 : 48;
}
export function artistHairLayer(x: number, y: number, direction: string) {
  if (direction === 'north' || y < 54) return 'front';
  if (direction === 'east') return x >= 48 ? 'front' : 'back';
  if (direction === 'west') return x < 48 ? 'front' : 'back';
  return (x >= 28 && x < 40) || (x >= 56 && x < 68) ? 'front' : 'back';
}
