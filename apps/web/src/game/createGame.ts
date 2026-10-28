import Phaser from 'phaser';
import type { AvatarConfig } from '@creative-factory/contracts';
import type { GameContent } from './content';
import { GameBridge } from './bridge';
import { FactoryScene } from './FactoryScene';
import { loadAvatarSheet } from '../avatar/art';
export async function createGame(
  parent: HTMLElement,
  content: GameContent,
  bridge: GameBridge,
  avatar?: AvatarConfig,
  signal: AbortSignal = new AbortController().signal,
) {
  const selected = avatar ?? content.avatars.defaultAvatar;
  const sheet = await loadAvatarSheet(content.avatars, selected, signal);
  signal.throwIfAborted();
  const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const scene = new FactoryScene(content, bridge, selected, sheet, pixelRatio);
  const game = new Phaser.Game({
    // The current orthogonal scene needs no shaders. Canvas also avoids software-WebGL
    // framebuffer failures on viewport resize in headless/cloud Chromium.
    type: Phaser.CANVAS,
    parent,
    backgroundColor: '#e0e4da',
    scene: [scene],
    scale: {
      mode: Phaser.Scale.NONE,
      width: parent.clientWidth * pixelRatio,
      height: parent.clientHeight * pixelRatio,
      zoom: 1 / pixelRatio,
    },
    callbacks: {
      postBoot: (instance: Phaser.Game) => {
        const resize = () => {
          const w = parent.clientWidth,
            h = parent.clientHeight;
          if (w <= 0 || h <= 0) return;
          if (instance.scale.width !== w * pixelRatio || instance.scale.height !== h * pixelRatio)
            instance.scale.resize(w * pixelRatio, h * pixelRatio);
          instance.canvas.style.width = w + 'px';
          instance.canvas.style.height = h + 'px';
        };
        const observer = new ResizeObserver(resize);
        observer.observe(parent);
        resize();
        instance.events.once(Phaser.Core.Events.DESTROY, () => observer.disconnect());
      },
    },
    render: { antialias: false, pixelArt: true, roundPixels: true },
    input: { keyboard: false },
    audio: { noAudio: true },
    banner: false,
  });
  return { game, scene };
}
