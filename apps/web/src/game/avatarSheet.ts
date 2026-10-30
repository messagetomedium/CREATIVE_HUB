import type { AvatarConfig, Direction } from '@creative-factory/contracts';
import { loadEditorReview } from '../avatar/editorReview';
import { EDITOR_WALK_FRAME_MS } from '../avatar/editorMotion';
import { DIRECTIONS } from '../avatar/modular/rig';
export const GAME_AVATAR = {
  width: 96,
  height: 128,
  anchor: { x: 48, y: 112 },
  scale: 0.5,
} as const;
export const avatarAnimation = (direction: Direction, mode: 'idle' | 'walk') => {
  const row = DIRECTIONS.indexOf(direction) * 6;
  return mode === 'idle'
    ? [
        { frame: row, duration: 500 },
        { frame: row + 1, duration: 500 },
      ]
    : EDITOR_WALK_FRAME_MS.map((duration, i) => ({ frame: row + 2 + i, duration }));
};
// Share the baked result between locations, never retain more than four appearances.
const cache = new Map<string, HTMLCanvasElement>();
export async function loadGameAvatar(config: AvatarConfig, signal: AbortSignal) {
  const key = JSON.stringify(config),
    cached = cache.get(key);
  signal.throwIfAborted();
  if (cached) return cached;
  const sheet = await loadEditorReview(config, signal);
  signal.throwIfAborted();
  cache.set(key, sheet);
  if (cache.size > 4) cache.delete(cache.keys().next().value!);
  return sheet;
}
