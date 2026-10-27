import { useState, type FormEvent } from 'react';
import type { AvatarConfig, Direction } from '@creative-factory/contracts';
import { useAccount } from '../account/AccountProvider';
import { safeAccountError } from '../account/service';
import { avatarCatalog } from '../avatar/catalog';
import { AvatarPreview } from '../avatar/AvatarPreview';
import { appearanceKey, AVATAR_PALETTES, randomAvatar } from '../avatar/editor';
import { useUnsavedChanges } from '../router';
import { Notice, PageHeading } from '../components';
const labels = {
  skin: 'Цвет кожи',
  hair: 'Цвет волос',
  outfit: 'Цвет одежды',
  shoes: 'Цвет обуви',
};
const directions: [Direction, string, string][] = [
  ['north', 'Север', '↑'],
  ['east', 'Восток', '→'],
  ['south', 'Юг', '↓'],
  ['west', 'Запад', '←'],
];
export function AvatarPage() {
  const account = useAccount();
  const [baseline, setBaseline] = useState<AvatarConfig>(() =>
    structuredClone(account.data.avatar ?? avatarCatalog.defaultAvatar),
  );
  const [config, setConfig] = useState<AvatarConfig>(() => structuredClone(baseline));
  const [direction, setDirection] = useState<Direction>('south');
  const [animation, setAnimation] = useState<'idle' | 'walk'>('idle');
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(''),
    [conflict, setConflict] = useState(false);
  const dirty = appearanceKey(config) !== appearanceKey(baseline);
  useUnsavedChanges(dirty);
  const change = (next: AvatarConfig) => {
    setConfig(next);
    setSaved(false);
    setError('');
  };
  const part = (key: keyof AvatarConfig['parts'], value: string | null) =>
    change({ ...config, parts: { ...config.parts, [key]: value } });
  const color = (key: keyof AvatarConfig['palette'], value: string) =>
    change({ ...config, palette: { ...config.palette, [key]: value } });
  const rotate = (offset: number) =>
    setDirection(
      directions[(directions.findIndex(([id]) => id === direction) + offset + 4) % 4]![0],
    );
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setSaved(false);
    setConflict(false);
    try {
      const result = await account.saveAvatar(config);
      setConfig(result);
      setBaseline(structuredClone(result));
      setSaved(true);
    } catch (e) {
      const error = safeAccountError(e);
      setError(error.message);
      setConflict(error.kind === 'conflict');
    } finally {
      setBusy(false);
    }
  }
  const swatches = (key: keyof typeof labels) => (
    <div className="palette-field">
      <span>{labels[key]}</span>
      <div className="swatch-row">
        {AVATAR_PALETTES[key].map((value, i) => (
          <button
            type="button"
            key={value}
            aria-label={`${labels[key]}: вариант ${i + 1}`}
            aria-pressed={config.palette[key] === value}
            style={{ background: value }}
            onClick={() => color(key, value)}
          />
        ))}
        <label className="custom-color">
          <span className="sr-only">{labels[key]}: свой цвет</span>
          <input
            aria-label={`${labels[key]}: свой цвет`}
            type="color"
            value={config.palette[key]}
            onChange={(e) => color(key, e.target.value)}
          />
        </label>
      </div>
    </div>
  );
  const choices = (key: keyof AvatarConfig['parts'], label: string) => (
    <div className="part-choices" role="group" aria-label={label}>
      {[
        ...(key === 'accessory' ? [{ id: '', label: 'Без аксессуара' }] : []),
        ...(avatarCatalog.parts[key] ?? []),
      ].map((p) => (
        <button
          type="button"
          key={p.id}
          aria-label={`${label}: ${p.label}`}
          aria-pressed={(config.parts[key] ?? '') === p.id}
          onClick={() => part(key, p.id || null)}
        >
          <AvatarPreview
            config={{ ...config, parts: { ...config.parts, [key]: p.id || null } }}
            size={72}
          />
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  );
  return (
    <main className="account-main editor-main">
      <PageHeading tag="КОНСТРУКТОР ПЕРСОНАЖА" title="Ваш образ. Ваш характер">
        Выберите детали, проверьте образ в движении и сохраните перед прогулкой.
      </PageHeading>
      <div className="avatar-layout">
        <section className="avatar-stage" aria-label="Просмотр персонажа">
          <div className="eyebrow">ВАШ ПЕРСОНАЖ / РАКУРС 3/4</div>
          <div className="avatar-platform">
            <AvatarPreview config={config} direction={direction} size={384} animation={animation} />
          </div>
          <div className="rotate-controls">
            <button type="button" aria-label="Повернуть влево" onClick={() => rotate(-1)}>
              ↶
            </button>
            <div className="direction-controls" aria-label="Направление персонажа">
              {directions.map(([id, label, icon]) => (
                <button
                  key={id}
                  aria-label={`Повернуть: ${label}`}
                  aria-pressed={direction === id}
                  onClick={() => setDirection(id)}
                >
                  {icon}
                </button>
              ))}
            </div>
            <button type="button" aria-label="Повернуть вправо" onClick={() => rotate(1)}>
              ↷
            </button>
          </div>
          <div className="animation-controls" aria-label="Анимация предпросмотра">
            <button aria-pressed={animation === 'idle'} onClick={() => setAnimation('idle')}>
              Ожидание
            </button>
            <button aria-pressed={animation === 'walk'} onClick={() => setAnimation('walk')}>
              Ходьба
            </button>
          </div>
          <p className="editor-dirty" role="status">
            {dirty ? 'Есть несохранённые изменения' : 'Сохранённый образ'}
          </p>
          <button
            className="text-link"
            onClick={() => change(randomAvatar(avatarCatalog, config))}
            disabled={busy}
          >
            Случайный персонаж
          </button>
        </section>
        <form className="form-panel avatar-form" onSubmit={save} aria-busy={busy}>
          <fieldset disabled={busy}>
            <section className="editor-category">
              <h2>
                <span>01</span> Тело
              </h2>
              <p>Выберите силуэт персонажа.</p>
              {choices('body', 'Тело')}
            </section>
            <section className="editor-category">
              <h2>
                <span>02</span> Кожа
              </h2>
              {swatches('skin')}
            </section>
            <section className="editor-category">
              <h2>
                <span>03</span> Причёска
              </h2>
              {choices('hair', 'Причёска')}
              {swatches('hair')}
            </section>
            <section className="editor-category">
              <h2>
                <span>04</span> Одежда
              </h2>
              {choices('outfit', 'Одежда')}
              {swatches('outfit')}
            </section>
            <section className="editor-category">
              <h2>
                <span>05</span> Обувь
              </h2>
              {swatches('shoes')}
              <p className="field-hint">
                Сейчас доступна базовая модель. Другие модели добавим позже.
              </p>
            </section>
            <section className="editor-category">
              <h2>
                <span>06</span> Аксессуары
              </h2>
              {choices('accessory', 'Аксессуар')}
            </section>
          </fieldset>
          {error && <Notice error>{error}</Notice>}
          {conflict && (
            <button type="button" className="text-link" onClick={() => void account.refresh()}>
              Загрузить сохранённую версию
            </button>
          )}
          {saved && <Notice>Персонаж сохранён. Можно отправляться на завод.</Notice>}
          <div className="editor-actions">
            <button className="button primary" disabled={busy}>
              {busy ? 'Сохраняем…' : 'Сохранить персонажа'}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy || !dirty}
              onClick={() => {
                change(structuredClone(baseline));
                setConflict(false);
              }}
            >
              Сбросить изменения
            </button>
          </div>
          <div className="editor-navigation">
            <a className="text-link" href={account.config.mode === 'demo' ? '#/menu' : '#/'}>
              Вернуться в меню
            </a>
            <a className="text-link" href="#/factory">
              Войти на завод →
            </a>
          </div>
          <p className="field-hint editor-storage-note">
            {account.config.mode === 'demo'
              ? 'Сохранение только в этом браузере. Выход из деморежима не удаляет персонажа.'
              : 'Настройки хранятся в вашем аккаунте.'}
          </p>
        </form>
      </div>
    </main>
  );
}
