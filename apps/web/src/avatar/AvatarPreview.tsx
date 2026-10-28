import { useEffect, useRef, useState } from 'react';
import type { AvatarConfig, Direction } from '@creative-factory/contracts';
import { loadAvatarSheet } from './art';
import { avatarCatalog } from './catalog';
import { createEditorRig, type EditorRig } from './editorReview';
import { FRAME, ANIMATION_FPS } from './modular/rig';
export function AvatarPreview({
  config,
  direction = 'south',
  size = 288,
  animation = 'static',
  mode = 'large',
  review = false,
}: {
  config: AvatarConfig;
  direction?: Direction;
  size?: number;
  animation?: 'static' | 'idle' | 'walk';
  mode?: 'large' | 'native' | 'atlas';
  review?: boolean;
}) {
  const ratio = mode === 'large' ? Math.min(2, Math.max(1, window.devicePixelRatio || 1)) : 1;
  const width =
      (mode === 'native' ? FRAME.width : mode === 'atlas' ? FRAME.width * 6 : size) * ratio,
    height =
      (mode === 'native' ? FRAME.height : mode === 'atlas' ? FRAME.height * 4 : size) * ratio;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [sheet, setSheet] = useState<HTMLCanvasElement>();
  const [rig, setRig] = useState<EditorRig>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    if (review) {
      void createEditorRig(config, controller.signal)
        .then((loaded) => {
          if (!controller.signal.aborted) setRig(loaded);
        })
        .catch(() => {
          if (!controller.signal.aborted) setError(true);
        });
    } else {
      void loadAvatarSheet(avatarCatalog, config, controller.signal)
        .then((loaded) => {
          if (!controller.signal.aborted) setSheet(loaded);
        })
        .catch(() => {
          if (!controller.signal.aborted) setError(true);
        });
    }
    return () => controller.abort();
  }, [config, review]);
  useEffect(() => {
    const node = canvas.current,
      ctx = node?.getContext('2d');
    if (!node || !ctx || (review ? !rig : !sheet)) return;
    const { frameWidth: w, frameHeight: h, animations } = avatarCatalog.sprite;
    const frames =
      animation === 'static' ? [animations[direction].idle[0]!] : animations[direction][animation];
    if (review && rig) {
      let request = 0;
      const started = performance.now();
      const draw = (time: number) => {
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = false;
        const seconds = (time - started) / 1000;
        if (mode === 'atlas') {
          for (const [row, dir] of (['north', 'east', 'south', 'west'] as const).entries())
            for (let f = 0; f < 6; f++) {
              ctx.save();
              ctx.translate(f * w, row * h);
              rig.draw(
                ctx,
                dir,
                f >= 2 ? 'walk' : f === 1 ? 'idle' : 'static',
                f >= 2 ? (f - 2) * 0.2 : f === 1 ? 1.5 : 0,
              );
              ctx.restore();
            }
        } else {
          const scale =
            mode === 'native' ? 1 : Math.max(0.5, Math.floor((size / 64) * 0.9) / 2) * ratio;
          ctx.save();
          ctx.translate((width - w * scale) / 2, (height - h * scale) / 2);
          ctx.scale(scale, scale);
          rig.draw(ctx, direction, animation, seconds);
          ctx.restore();
        }
        node.dataset.frame = String(Math.floor(seconds * (animation === 'walk' ? 8 : 2)));
        if (animation !== 'static' && mode !== 'atlas') request = requestAnimationFrame(draw);
      };
      draw(started);
      return () => cancelAnimationFrame(request);
    }
    if (!sheet) return;
    if (mode === 'atlas') {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(sheet, 0, 0);
      return;
    }
    const scale = mode === 'native' ? 1 : Math.max(0.5, Math.floor((size / 64) * 0.9) / 2) * ratio;
    let request = 0,
      previous = -1;
    const started = performance.now();
    const draw = (time: number) => {
      const frame =
        frames[
          Math.floor(
            Math.max(0, time - started) /
              (animation === 'walk' ? 1000 / ANIMATION_FPS.walk : 1000 / ANIMATION_FPS.idle),
          ) % frames.length
        ]!;
      if (frame !== previous) {
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          sheet,
          (frame % 6) * w,
          Math.floor(frame / 6) * h,
          w,
          h,
          (width - w * scale) / 2,
          (height - h * scale) / 2,
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
  }, [sheet, direction, size, animation, mode, width, height, ratio, review, rig]);
  return (
    <>
      <canvas
        ref={canvas}
        width={width}
        height={height}
        style={
          mode === 'large'
            ? { width: size, height: 'auto', maxWidth: '100%', imageRendering: 'pixelated' }
            : { width, height: 'auto', maxWidth: '100%', imageRendering: 'pixelated' }
        }
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
