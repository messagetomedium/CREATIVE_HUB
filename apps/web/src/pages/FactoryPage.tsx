import { useEffect, useRef, useState } from 'react';
import type { AvatarConfig, Zone } from '@creative-factory/contracts';
import { GameBridge } from '../game/bridge';
import { loadContent, type GameContent } from '../game/content';
import { GameView } from '../GameView';
import { useAccount } from '../account/AccountProvider';
import { WorldStore } from '../game/world/storage';
import type { ContextInteraction } from '../game/interactions';
import { navigate } from '../router';

export function FactoryPage({
  avatar,
  location = 'island',
}: {
  avatar?: AvatarConfig;
  location?: 'island' | 'house';
}) {
  const { user, config } = useAccount();
  const [bridge] = useState(() => new GameBridge());
  const [loaded, setLoaded] = useState<{ content: GameContent; store: WorldStore }>();
  const [zone, setZone] = useState<Zone>();
  const [ready, setReady] = useState(false),
    [error, setError] = useState<string>();
  const [overview, setOverview] = useState(false);
  const [interaction, setInteraction] = useState<ContextInteraction>();
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const off = [
      bridge.on('zone', setZone),
      bridge.on('ready', () => setReady(true)),
      bridge.on('error', setError),
      bridge.on('interaction', setInteraction),
    ];
    void loadContent(controller.signal)
      .then((content) => {
        if (!controller.signal.aborted)
          setLoaded({ content, store: new WorldStore(user?.userId ?? 'guest') });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      });
    const outside = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        bridge.emit('dismissInteraction', undefined);
    };
    document.addEventListener('pointerdown', outside);
    return () => {
      controller.abort();
      off.forEach((fn) => fn());
      document.removeEventListener('pointerdown', outside);
    };
  }, [bridge, user?.userId]);
  function transition(target: 'island' | 'house') {
    try {
      loaded?.store.transition(target);
      navigate(target === 'house' ? '/house' : '/island');
    } catch {
      setError('Не удалось сохранить локацию. Проверьте доступное место в браузере.');
    }
  }
  return (
    <main className="factory-main island-main">
      <div className="factory-topline">
        <a href={config.mode === 'demo' ? '#/menu' : '#/'}>
          {config.mode === 'demo' ? '← Вернуться в меню' : '← На главную'}
        </a>
      </div>
      <div className="island-title">
        <h1>{location === 'island' ? 'Мой остров' : 'Мой дом'}</h1>
      </div>
      <section
        className="game-panel island-panel"
        aria-label={location === 'island' ? 'Игровая сцена острова' : 'Интерьер дома'}
        aria-busy={!ready && !error}
      >
        {loaded && !error && (
          <GameView
            content={loaded.content}
            avatar={avatar}
            bridge={bridge}
            overview={overview}
            store={loaded.store}
            location={location}
          />
        )}
        {!ready && !error && (
          <div className="loading-state" role="status">
            <strong>Открываем {location === 'island' ? 'остров' : 'дом'}…</strong>
          </div>
        )}
        {error && (
          <div className="loading-state error-state" role="alert">
            <strong>Не удалось открыть локацию</strong>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Попробовать снова</button>
          </div>
        )}
        {ready && !error && (
          <>
            <div className="zone-card" aria-live="polite">
              <span className="zone-dot" style={{ background: zone?.accent ?? '#83b86c' }} />
              <strong data-testid="current-zone">{zone?.name ?? 'Дом · проход'}</strong>
            </div>
            <button
              className="overview-button"
              aria-pressed={overview}
              onClick={() => setOverview(!overview)}
            >
              <span aria-hidden="true">{overview ? '⊙' : '⤢'}</span>
              {overview ? 'К персонажу' : location === 'island' ? 'Весь остров' : 'Весь дом'}
            </button>
            {interaction && (
              <div
                ref={menu}
                className="world-context"
                role="group"
                aria-label="Дом"
                style={{
                  left: `clamp(12px, ${interaction.x + 24}px, calc(100% - 176px))`,
                  top: `clamp(12px, ${interaction.y - 96}px, calc(100% - 110px))`,
                }}
              >
                <strong>{interaction.title}</strong>
                {interaction.actions.map((action) => (
                  <button key={action.id} onClick={() => transition(action.target)}>
                    {action.label}
                    <span aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>
      <footer className="controls-footer">
        <div className="key-hint">
          <span className="key-group">
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd>
          </span>
          <span className="or">или</span>
          <span className="key-group">
            <kbd>↑</kbd>
            <kbd>←</kbd>
            <kbd>↓</kbd>
            <kbd>→</kbd>
          </span>
          <span>Перемещение</span>
        </div>
      </footer>
    </main>
  );
}
