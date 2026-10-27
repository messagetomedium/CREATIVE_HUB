import { useEffect, useRef, useState } from 'react';
import type { AvatarConfig, Direction } from '@creative-factory/contracts';
import { loadAvatarSheet } from './art';
import { avatarCatalog } from './catalog';
export function AvatarPreview({
  config,
  direction = 'south',
  size = 288,
  animation = 'static',
}: {
  config: AvatarConfig;
  direction?: Direction;
  size?: number;
  animation?: 'static' | 'idle' | 'walk';
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [sheet, setSheet] = useState<HTMLCanvasElement>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    void loadAvatarSheet(avatarCatalog, config, controller.signal)
      .then((loaded) => {
        if (!controller.signal.aborted) setSheet(loaded);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [config]);
  useEffect(() => {
    const node = canvas.current,
      ctx = node?.getContext('2d');
    if (!node || !ctx || !sheet) return;
    const { frameWidth: w, frameHeight: h, animations } = avatarCatalog.sprite;
    const frames =
      animation === 'static' ? [animations[direction].idle[0]!] : animations[direction][animation];
    const scale = Math.max(1, Math.floor((size / h) * 0.9));
    let request = 0,
      previous = -1;
    const started = performance.now();
    const draw = (time: number) => {
      const frame =
        frames[
          Math.floor((time - started) / (animation === 'walk' ? 1000 / 9 : 500)) % frames.length
        ]!;
      if (frame !== previous) {
        ctx.clearRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          sheet,
          (frame % 6) * w,
          Math.floor(frame / 6) * h,
          w,
          h,
          (size - w * scale) / 2,
          (size - h * scale) / 2,
          w * scale,
          h * scale,
        );
        node.dataset.frame = String(frame);
        previous = frame;
      }
      if (animation !== 'static') request = requestAnimationFrame(draw);
    };
    draw(started);
    return () => cancelAnimationFrame(request);
  }, [sheet, direction, size, animation]);
  return (
    <>
      <canvas
        ref={canvas}
        width={size}
        height={size}
        className="avatar-preview"
        role="img"
        aria-label="Предпросмотр вашего персонажа"
        data-direction={direction}
        data-animation={animation}
      />
      {error && <span role="alert">Не удалось загрузить изображение персонажа.</span>}
    </>
  );
}
