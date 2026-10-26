import { useEffect, useRef, useState } from 'react';
import type { AvatarConfig, Zone, World, Workshop } from '@creative-factory/contracts';
import { GameBridge } from '../game/bridge';
import { loadContent, type GameContent } from '../game/content';
import { GameView } from '../GameView';

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 9 9 3M3 3h6v6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
function FactoryMark() {
  return (
    <svg width="25" height="25" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M4 26V12l8 4V9l8 5V5h7v21H4Z" fill="currentColor" />
      <path d="M9 21h3m4 0h3m4 0h1" stroke="#263e33" strokeWidth="2" />
    </svg>
  );
}
function MiniMap({
  world,
  zone,
  destination,
  bridge,
  onSelect,
}: {
  world: World;
  zone?: Zone;
  destination?: string;
  bridge: GameBridge;
  onSelect: (id: string) => void;
}) {
  const dot = useRef<SVGCircleElement>(null);
  useEffect(
    () =>
      bridge.on('position', (p) => {
        dot.current?.setAttribute('cx', String(p.x / 32));
        dot.current?.setAttribute('cy', String(p.y / 32));
      }),
    [bridge],
  );
  return (
    <div className="map-card">
      <div className="eyebrow">
        ПЛАН ЗАВОДА{' '}
        <span>
          <ArrowIcon />
        </span>
      </div>
      <svg
        viewBox="0 0 64 48"
        role="img"
        aria-label="План четырёх цехов и центрального холла"
        className="mini-map"
      >
        <rect x="0" y="0" width="64" height="48" rx="2" fill="#eceee5" />
        <path d="M1 25h62M32 1v46" stroke="#d1d8c5" strokeWidth="5" />
        {world.workshops.map((w) => (
          <g key={w.id} onClick={() => onSelect(w.id)} className="map-room">
            <rect
              x={w.room.x}
              y={w.room.y}
              width={w.room.width}
              height={w.room.height}
              rx="1"
              fill={w.accent}
              fillOpacity={zone?.id === w.id ? 0.8 : 0.45}
              stroke={destination === w.id ? '#294c36' : '#637565'}
              strokeWidth={destination === w.id ? 0.7 : 0.25}
            />
            <text
              x={w.room.x + w.room.width / 2}
              y={w.room.y + w.room.height / 2 + 1}
              textAnchor="middle"
              fontSize="3.5"
              fill="#375340"
            >
              {w.code}
            </text>
          </g>
        ))}
        <circle
          ref={dot}
          cx={world.spawn.x / 32}
          cy={world.spawn.y / 32}
          r="1.3"
          fill="#2e5439"
          stroke="#f8faf0"
          strokeWidth=".6"
        />
      </svg>
      <div className="map-caption">
        <span>
          <i /> Вы здесь
        </span>
        <span>1 этаж</span>
      </div>
    </div>
  );
}
export function FactoryPage({ avatar }: { avatar?: AvatarConfig }) {
  const [bridge] = useState(() => new GameBridge());
  const [content, setContent] = useState<GameContent>();
  const [zone, setZone] = useState<Zone>();
  const [ready, setReady] = useState(false),
    [error, setError] = useState<string>();
  const [overview, setOverview] = useState(false),
    [destination, setDestination] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    const off = [
      bridge.on('zone', setZone),
      bridge.on('ready', () => setReady(true)),
      bridge.on('error', setError),
    ];
    void loadContent(controller.signal)
      .then(setContent)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      controller.abort();
      off.forEach((fn) => fn());
    };
  }, [bridge]);
  const selected: Workshop | undefined = content?.world.workshops.find((w) => w.id === destination);
  return (
    <div className="app-shell">
      <main className="factory-main">
        <div className="factory-topline">
          <a href="#/">← На главную</a>
          <span className="local-badge">
            <i />
            Локальная прогулка · без мультиплеера
          </span>
        </div>
        <section className="page-intro">
          <div>
            <div className="eyebrow">ВИРТУАЛЬНЫЙ ЗАВОД / ПЕРВЫЙ ЭТАЖ</div>
            <h1>
              Здесь идеи обретают форму<span>.</span>
            </h1>
            <p>Исследуйте цеха креативных индустрий. Найдите своё пространство.</p>
          </div>
          <div className="edition">
            <span>CF — 001</span>
            <span>ТЕХНИЧЕСКИЙ ПРОТОТИП</span>
          </div>
        </section>
        <div className="factory-layout">
          <aside className="sidebar" aria-label="Навигация по заводу">
            <div className="sidebar-title">
              <span className="eyebrow">ПРОСТРАНСТВА</span>
              <span className="count">04</span>
            </div>
            <button
              className={`hall-link ${zone?.id === 'hall' ? 'active' : ''}`}
              onClick={() => {
                setDestination(undefined);
                setOverview(false);
              }}
            >
              <span className="hall-icon">⌘</span>
              <span>
                Центральный холл<small>Место встречи идей</small>
              </span>
              <span className="link-arrow">
                <ArrowIcon />
              </span>
            </button>
            <div className="workshop-list">
              {content?.world.workshops.map((w) => (
                <button
                  key={w.id}
                  className={`workshop-link ${destination === w.id ? 'selected' : ''}`}
                  style={{ '--accent': w.accent } as React.CSSProperties}
                  aria-label={`Выбрать ориентир: ${w.name}`}
                  aria-pressed={destination === w.id}
                  onClick={() => {
                    setDestination(destination === w.id ? undefined : w.id);
                  }}
                >
                  <span className="workshop-code">{w.code}</span>
                  <span className="workshop-name">
                    {w.name}
                    <small>{w.discipline}</small>
                  </span>
                  <span className="link-arrow">
                    <ArrowIcon />
                  </span>
                </button>
              ))}
            </div>
            <div className="sidebar-bottom">
              {content && (
                <MiniMap
                  world={content.world}
                  zone={zone}
                  destination={destination}
                  bridge={bridge}
                  onSelect={setDestination}
                />
              )}
              <p className="sidebar-note">
                Одно пространство.
                <br />
                Много точек соприкосновения.
              </p>
            </div>
          </aside>
          <section
            className="game-panel"
            aria-label="Игровая сцена завода"
            aria-busy={!ready && !error}
          >
            {content && !error && (
              <GameView
                content={content}
                avatar={avatar}
                bridge={bridge}
                overview={overview}
                destination={destination}
              />
            )}
            {!ready && !error && (
              <div className="loading-state" role="status">
                <span className="loading-mark">
                  <FactoryMark />
                </span>
                <strong>Открываем завод</strong>
                <span>Готовим пространство для ваших идей…</span>
              </div>
            )}
            {error && (
              <div className="loading-state error-state" role="alert">
                <strong>Не удалось открыть завод</strong>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>Попробовать снова</button>
              </div>
            )}
            {ready && !error && (
              <>
                <div className="zone-card" aria-live="polite">
                  <span className="zone-dot" style={{ background: zone?.accent ?? '#d8e6a2' }} />
                  <div>
                    <span className="eyebrow">СЕЙЧАС ВЫ ЗДЕСЬ</span>
                    <strong data-testid="current-zone">{zone?.name ?? 'Коридоры завода'}</strong>
                  </div>
                </div>
                <button
                  className="overview-button"
                  aria-pressed={overview}
                  onClick={() => setOverview(!overview)}
                >
                  <span aria-hidden="true">{overview ? '⊙' : '⤢'}</span>
                  {overview ? 'К персонажу' : 'Весь завод'}
                </button>
                <div className="scene-caption">
                  <span className="you-chip">
                    <span /> Вы
                  </span>
                  <span>
                    {selected
                      ? `Ориентир: цех ${selected.code}. Вход отмечен на карте.`
                      : 'Нажмите на карту и начните движение'}
                  </span>
                </div>
              </>
            )}
          </section>
        </div>
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
          <span className="footer-note">Четыре цеха. Один завод. Ваш маршрут.</span>
          <span className="prototype-tag">
            PROTOTYPE 0.1 <i />
          </span>
        </footer>
      </main>
    </div>
  );
}
