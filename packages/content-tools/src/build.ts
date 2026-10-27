import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { AvatarCatalogSchema, SceneArtSchema, findPropArt } from '@creative-factory/contracts';
import { compileMap } from './compile.js';
const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));
const world = compileMap(
  await readJson('content/maps/factory.tmj'),
  await readJson('content/maps/workshops.json'),
);
const avatars = AvatarCatalogSchema.parse(await readJson('content/avatars/catalog.json'));
const sceneArt = SceneArtSchema.parse(await readJson('content/art/scene-art.json'));
for (const prop of world.props)
  findPropArt(sceneArt, prop.assetId, prop.bounds.width, prop.bounds.height);
const destination = 'apps/web/public/content';
await mkdir(destination, { recursive: true });
async function emit(prefix: string, bytes: string | Buffer, extension = 'json') {
  const hash = createHash('sha256').update(bytes).digest('hex');
  const name = `${prefix}-${hash.slice(0, 16)}.${extension}`;
  await writeFile(`${destination}/${name}`, bytes);
  return { url: `/content/${name}`, hash };
}
const w = await emit('world', JSON.stringify(world)),
  a = await emit('avatars', JSON.stringify(avatars)),
  art = await emit('scene-art', JSON.stringify(sceneArt)),
  tiles =
    sceneArt.floors.source.kind === 'procedural'
      ? await emit('tiles', await readFile('content/maps/placeholder-tiles.svg'), 'svg')
      : await emit(
          'tiles',
          await readFile(`content/art/${sceneArt.floors.source.url.slice('/content/'.length)}`),
          'png',
        );
await writeFile(
  `${destination}/manifest.json`,
  JSON.stringify(
    {
      version: 1,
      worldUrl: w.url,
      worldHash: w.hash,
      avatarsUrl: a.url,
      avatarsHash: a.hash,
      tilesUrl: tiles.url,
      sceneArtUrl: art.url,
      sceneArtHash: art.hash,
    },
    null,
    2,
  ),
);
// Optional replacement PNGs: versioned names stay identical in the bundled editor catalog
// and the verified runtime catalog. No file is required in procedural mode.
const replacementFiles = new Set<string>();
const sources = [
  sceneArt.floors.source,
  sceneArt.props.source,
  sceneArt.walls.source,
  avatars.sprite.source,
];
const imageUrls = sources.flatMap((s) =>
  s.kind === 'spritesheet'
    ? [s.url]
    : s.kind === 'layered-sheets'
      ? s.layers.map((l) => l.url)
      : [],
);
for (const url of imageUrls) {
  if (!/^\/content\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(url) || url.includes('..'))
    throw new Error('Недопустимый путь PNG');
  const name = url.slice('/content/'.length),
    path = `content/art/${name}`;
  await writeFile(`${destination}/${name}`, await readFile(path));
  replacementFiles.add(path);
}
const originals = [
  'content/maps/factory.tmj',
  'content/maps/workshops.json',
  'content/maps/placeholder-tiles.svg',
  'content/avatars/catalog.json',
  'content/art/scene-art.json',
  'apps/web/src/game/sceneArt.ts',
  'apps/web/src/game/placeholderArt.ts',
  'apps/web/src/avatar/art.ts',
  'apps/web/src/pages/HomePage.tsx',
  'apps/web/src/components.tsx',
  'apps/web/src/App.tsx',
  'apps/web/public/favicon.svg',
  ...replacementFiles,
];
const provenance = await Promise.all(
  originals.map(async (path) => ({
    path,
    sha256: createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
    origin: 'Original Creative Factory placeholder; created for this project',
  })),
);
await writeFile(`${destination}/provenance.json`, JSON.stringify(provenance, null, 2));
// Ship permissive-license notices alongside the web distribution, not only in node_modules.
const browserLicenses = [
  ['react', 'LICENSE'],
  ['react-dom', 'LICENSE'],
  ['scheduler', 'LICENSE'],
  ['phaser', 'LICENSE.md'],
  ['eventemitter3', 'LICENSE'],
  ['zod', 'LICENSE'],
  ['@supabase/supabase-js', 'LICENSE'],
  ['@supabase/auth-js', 'LICENSE'],
  ['@supabase/functions-js', 'LICENSE'],
  ['@supabase/postgrest-js', 'LICENSE'],
  ['@supabase/realtime-js', 'LICENSE'],
  ['@supabase/storage-js', 'LICENSE'],
  ['iceberg-js', 'LICENSE'],
] as const;
const notices = await Promise.all(
  browserLicenses.map(async ([name, filename]) => {
    const pkg = JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8')) as {
      version: string;
    };
    return `${name} ${pkg.version}\n${await readFile(`node_modules/${name}/${filename}`, 'utf8')}`;
  }),
);
await writeFile(
  `${destination}/third-party-licenses.txt`,
  notices.join('\n\n----------------------------------------\n\n'),
);
console.log(
  `Content verified: ${world.width}×${world.height}, ${world.workshops.length} workshops, ${world.props.length} props; ${w.hash.slice(0, 16)}`,
);
