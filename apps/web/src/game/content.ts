import {
  AvatarCatalogSchema,
  ManifestSchema,
  WorldSchema,
  SceneArtSchema,
  type SceneArt,
  type AvatarCatalog,
  type ContentManifest,
  type World,
} from '@creative-factory/contracts';
import { contentPath } from './contentPath';
export interface GameContent {
  world: World;
  avatars: AvatarCatalog;
  manifest: ContentManifest;
  sceneArt: SceneArt;
}
async function verifiedJson(url: string, expected: string, signal: AbortSignal): Promise<unknown> {
  // Keep the content same-origin AND inside the configured project base path.
  const response = await fetch(contentPath(url, import.meta.env.BASE_URL), { signal });
  if (!response.ok) throw new Error(`Не удалось загрузить контент (${response.status})`);
  const bytes = await response.arrayBuffer();
  if (!crypto.subtle)
    throw new Error('Для проверки карты откройте приложение через HTTPS или localhost.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
  if (hash !== expected) throw new Error('Версия контента изменилась. Обновите страницу.');
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function loadContent(signal: AbortSignal): Promise<GameContent> {
  const response = await fetch(contentPath('/content/manifest.json', import.meta.env.BASE_URL), {
    signal,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Карта не найдена. Выполните npm run content:build.');
  const manifest = ManifestSchema.parse(await response.json());
  const [world, avatars, sceneArt] = await Promise.all([
    verifiedJson(manifest.worldUrl, manifest.worldHash, signal),
    verifiedJson(manifest.avatarsUrl, manifest.avatarsHash, signal),
    verifiedJson(manifest.sceneArtUrl, manifest.sceneArtHash, signal),
  ]);
  return {
    world: WorldSchema.parse(world),
    avatars: AvatarCatalogSchema.parse(avatars),
    sceneArt: SceneArtSchema.parse(sceneArt),
    manifest: {
      ...manifest,
      worldUrl: contentPath(manifest.worldUrl, import.meta.env.BASE_URL),
      avatarsUrl: contentPath(manifest.avatarsUrl, import.meta.env.BASE_URL),
      tilesUrl: contentPath(manifest.tilesUrl, import.meta.env.BASE_URL),
      sceneArtUrl: contentPath(manifest.sceneArtUrl, import.meta.env.BASE_URL),
    },
  };
}
