import { useEffect, useRef, useState } from 'react';
import type { AvatarConfig, Direction } from '@creative-factory/contracts';
import { DIRECTIONS, loadAvatarSheet } from './art';
import { avatarCatalog } from './catalog';
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
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    void loadAvatarSheet(avatarCatalog, config, controller.signal)
      .then((sheet) => {
        if (controller.signal.aborted) return;
        const ctx = canvas.current?.getContext('2d');
        if (!ctx) return;
        const { frameWidth: w, frameHeight: h } = avatarCatalog.sprite;
        const scale = (size / h) * 0.9;
        ctx.clearRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          sheet,
          0,
          DIRECTIONS.indexOf(direction) * h,
          w,
          h,
          (size - w * scale) / 2,
          (size - h * scale) / 2,
          w * scale,
          h * scale,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [config, direction, size]);
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
      />
      {error && <span role="alert">Не удалось загрузить изображение персонажа.</span>}
    </>
  );
}
