import { useEffect, useRef } from 'react';
import type { AvatarConfig } from '@creative-factory/contracts';
import type { GameContent } from './game/content';
import type { GameBridge } from './game/bridge';
import type { FactoryScene } from './game/FactoryScene';
declare global {
  interface Window {
    __CF_DEBUG__?: { snapshot: () => ReturnType<FactoryScene['snapshot']> };
  }
}
export function GameView({
  content,
  bridge,
  overview,
  destination,
  avatar,
}: {
  content: GameContent;
  bridge: GameBridge;
  overview: boolean;
  destination?: string;
  avatar?: AvatarConfig;
}) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<FactoryScene | null>(null);
  const options = useRef({ overview, destination });
  options.current = { overview, destination };
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    let instance: Awaited<ReturnType<typeof import('./game/createGame').createGame>> | undefined;
    void import('./game/createGame')
      .then(async ({ createGame }) => {
        if (disposed || !container.current) return;
        instance = await createGame(container.current, content, bridge, avatar, controller.signal);
        if (disposed) {
          instance.game.destroy(true);
          return;
        }
        scene.current = instance.scene;
        instance.scene.setOverview(options.current.overview);
        instance.scene.selectWorkshop(options.current.destination);
        if (import.meta.env.DEV)
          window.__CF_DEBUG__ = { snapshot: () => instance!.scene.snapshot() };
      })
      .catch((error) => {
        if (!disposed) bridge.emit('error', String(error));
      });
    return () => {
      disposed = true;
      controller.abort();
      scene.current = null;
      if (import.meta.env.DEV) delete window.__CF_DEBUG__;
      instance?.game.destroy(true);
    };
  }, [content, bridge, avatar]);
  useEffect(() => {
    scene.current?.setOverview(overview);
  }, [overview]);
  useEffect(() => {
    scene.current?.selectWorkshop(destination);
  }, [destination]);
  return <div ref={container} className="game-canvas" data-testid="game-canvas" />;
}
