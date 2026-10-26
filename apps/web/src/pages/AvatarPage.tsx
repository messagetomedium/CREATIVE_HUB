import { useState, type FormEvent } from 'react';
import type { AvatarConfig, Direction } from '@creative-factory/contracts';
import { useAccount } from '../account/AccountProvider';
import { safeAccountError } from '../account/service';
import { avatarCatalog } from '../avatar/catalog';
import { AvatarPreview } from '../avatar/AvatarPreview';
import { Notice, PageHeading } from '../components';
const colors = {
  skin: ['#f4d4b0', '#dcae86', '#b98058', '#805436', '#503727'],
  hair: ['#273a36', '#75513a', '#c19a60', '#e3d9ca', '#9e5140'],
  outfit: ['#cf6546', '#577a66', '#6e7da4', '#c2a653', '#a57e99'],
  shoes: ['#f1e9d8', '#253e37', '#7e5140', '#7b8797', '#bc9e6e'],
};
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
  const [config, setConfig] = useState<AvatarConfig>(() =>
    structuredClone(account.data.avatar ?? avatarCatalog.defaultAvatar),
  );
  const [direction, setDirection] = useState<Direction>('south');
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(''),
    [conflict, setConflict] = useState(false);
  const part = (key: keyof AvatarConfig['parts'], value: string | null) => {
    setConfig((old) => ({ ...old, parts: { ...old.parts, [key]: value } }));
    setSaved(false);
  };
  const color = (key: keyof AvatarConfig['palette'], value: string) => {
    setConfig((old) => ({ ...old, palette: { ...old.palette, [key]: value } }));
    setSaved(false);
  };
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
      setSaved(true);
    } catch (e) {
      const error = safeAccountError(e);
      setError(error.message);
      setConflict(error.kind === 'conflict');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-main">
      <PageHeading tag="МОЙ ПЕРСОНАЖ" title="Ваша творческая сторона">
        Небольшие детали делают образ вашим. Сохранённый персонаж появится на заводе.
      </PageHeading>
      <div className="avatar-layout">
        <section className="avatar-stage" aria-label="Просмотр персонажа">
          <div className="eyebrow">СОБСТВЕННЫЙ ОБРАЗ / ВИД СВЕРХУ</div>
          <div className="avatar-platform">
            <AvatarPreview config={config} direction={direction} />
          </div>
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
          <p>Четыре направления. Один характер.</p>
          <span className="card-tag">Оригинальная временная графика</span>
        </section>
        <form className="form-panel avatar-form" onSubmit={save} aria-busy={busy}>
          <fieldset disabled={busy}>
            <legend className="form-section-title">01 / ФОРМА И ДЕТАЛИ</legend>
            <div className="form-grid">
              {(['body', 'hair', 'outfit'] as const).map((key) => (
                <label key={key}>
                  {{ body: 'Тело', hair: 'Причёска', outfit: 'Одежда' }[key]}
                  <select
                    name={key}
                    value={config.parts[key]}
                    onChange={(e) => part(key, e.target.value)}
                  >
                    {avatarCatalog.parts[key]?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Аксессуар
                <select
                  name="accessory"
                  value={config.parts.accessory ?? ''}
                  onChange={(e) => part('accessory', e.target.value || null)}
                >
                  <option value="">Без аксессуара</option>
                  {avatarCatalog.parts.accessory?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset disabled={busy}>
            <legend className="form-section-title">02 / ВАША ПАЛИТРА</legend>
            <div className="palette-grid">
              {(Object.keys(colors) as (keyof typeof colors)[]).map((key) => (
                <div className="palette-field" key={key}>
                  <span>{labels[key]}</span>
                  <div className="swatch-row">
                    {colors[key].map((value, i) => (
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
              ))}
            </div>
          </fieldset>
          {error && <Notice error>{error}</Notice>}
          {conflict && (
            <button type="button" className="text-link" onClick={() => void account.refresh()}>
              Загрузить сохранённую версию
            </button>
          )}
          {saved && <Notice>Персонаж сохранён. Можно отправляться на завод.</Notice>}
          <div className="form-actions">
            <button className="button primary" disabled={busy}>
              {busy ? 'Сохраняем…' : 'Сохранить персонажа'}
            </button>
            <a className="text-link" href="#/factory">
              На завод →
            </a>
          </div>
          <p className="field-hint">
            В игру передаётся последняя сохранённая версия. Настройки хранятся в вашем аккаунте.
          </p>
        </form>
      </div>
    </main>
  );
}
