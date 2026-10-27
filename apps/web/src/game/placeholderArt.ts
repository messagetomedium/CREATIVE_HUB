import type Phaser from 'phaser';
import type { AvatarCatalog } from '@creative-factory/contracts';

/** Installs a composed procedural/PNG sheet using the same frames and feet as the editor. */
export function makeAvatar(
  scene: Phaser.Scene,
  catalog: AvatarCatalog,
  surface: HTMLCanvasElement,
): void {
  const { frameWidth: w, frameHeight: h } = catalog.sprite;
  const texture = scene.textures.addCanvas('avatar', surface);
  if (!texture) throw new Error('Не удалось создать атлас персонажа');
  for (let row = 0; row < 4; row++)
    for (let frame = 0; frame < 6; frame++)
      texture.add(row * 6 + frame, 0, frame * w, row * h, w, h);
}
