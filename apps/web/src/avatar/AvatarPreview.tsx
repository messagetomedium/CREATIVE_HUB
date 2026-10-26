import { useEffect, useRef } from 'react';
import type { AvatarConfig, Direction } from '@creative-factory/contracts';
import { drawAvatarFrame } from './art';
export function AvatarPreview({
  config,
  direction = 'south',
  size = 288,
}: {
  config: AvatarConfig;
  direction?: Direction;
  size?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale((size / 48) * 0.85, (size / 48) * 0.85);
    drawAvatarFrame(ctx, config, direction, 0);
    ctx.restore();
  }, [config, direction, size]);
  return (
    <canvas
      ref={canvas}
      width={size}
      height={size}
      className="avatar-preview"
      role="img"
      aria-label="Предпросмотр вашего персонажа"
      data-direction={direction}
    />
  );
}
