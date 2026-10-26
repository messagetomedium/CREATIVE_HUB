import Phaser from 'phaser';
import type { AvatarConfig } from '@creative-factory/contracts';
import type { GameContent } from './content';
import { GameBridge } from './bridge';
import { FactoryScene } from './FactoryScene';
export function createGame(
  parent: HTMLElement,
  content: GameContent,
  bridge: GameBridge,
  avatar?: AvatarConfig,
) {
  const scene = new FactoryScene(content, bridge, avatar);
  const game = new Phaser.Game({
    // The current orthogonal scene needs no shaders. Canvas also avoids software-WebGL
    // framebuffer failures on viewport resize in headless/cloud Chromium.
    type: Phaser.CANVAS,
    parent,
    backgroundColor: '#e0e4da',
    scene: [scene],
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    render: { antialias: true, roundPixels: true },
    input: { keyboard: false },
    audio: { noAudio: true },
    banner: false,
  });
  return { game, scene };
}
