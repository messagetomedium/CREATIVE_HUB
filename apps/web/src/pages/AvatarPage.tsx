import { useState, type FormEvent, type ReactNode } from 'react';
import type { AvatarConfig, AvatarCustomization, Direction } from '@creative-factory/contracts';
import { useAccount } from '../account/AccountProvider';
import { safeAccountError } from '../account/service';
import { avatarCatalog } from '../avatar/catalog';
import { turnPreview } from '../avatar/editorMotion';
import { EDITOR_SKIN_PALETTE } from '../avatar/editorReview';
import { AvatarPreview } from '../avatar/AvatarPreview';
import { ConstructorIcon, type ConstructorIconName } from '../avatar/ConstructorIcon';
import {
  appearanceKey,
  AVATAR_PALETTES,
  FABRIC_PALETTE,
  randomAvatar,
  constructorChoices,
  updateConstructor,
  CONSTRUCTOR_TABS,
  TAB_LABELS,
  FACE_FEATURES,
  SLOTS,
  type ConstructorTab,
} from '../avatar/editor';
import { useUnsavedChanges } from '../router';
import hairAtlasUrl from '../../../../content/avatars/modular/hair-indexed.png?url&no-inline';
import { Notice } from '../components';
import { importedChoice, importedThumbnail } from '../avatar/imported';

function EditorSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="constructor-section">
      <h2>
        <span>{number}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
function ChoiceGrid({
  label,
  icon,
  options,
}: {
  label: string;
  icon: ConstructorIconName;
  options: {
    id: string | number;
    name: string;
    caption?: string;
    selected: boolean;
    preview?: ReactNode;
    disabled?: boolean;
    choose(): void;
  }[];
}) {
  return (
    <div className="choice-grid" role="group" aria-label={label}>
      {options.map((option, i) => (
        <div className="choice-cell" key={option.id}>
          <button
            type="button"
            className="choice-button"
            aria-label={`${label}: ${option.name}`}
            title={option.name}
            aria-pressed={option.selected}
            disabled={option.disabled}
            onClick={option.choose}
          >
            {option.preview ?? <ConstructorIcon name={icon} />}
            <span className="choice-number" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
          </button>
          {option.caption && <span className="choice-caption">{option.caption}</span>}
        </div>
      ))}
    </div>
  );
}
function ColorRow({
  label,
  colors,
  value,
  choose,
}: {
  label: string;
  colors: string[];
  value: string;
  choose(color: string): void;
}) {
  return (
    <div className="constructor-colors" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="constructor-swatches">
        {colors.map((color, i) => (
          <button
            type="button"
            key={color}
            aria-label={`${label}: вариант ${i + 1}`}
            aria-pressed={value.toLowerCase() === color.toLowerCase()}
            title={`${label}: ${i + 1}`}
            style={{ backgroundColor: color }}
            onClick={() => choose(color)}
          />
        ))}
      </div>
    </div>
  );
}
export function AvatarPage() {
  const account = useAccount();
  const [baseline, setBaseline] = useState<AvatarConfig>(() =>
    structuredClone(account.data.avatar ?? avatarCatalog.defaultAvatar),
  );
  const [config, setConfig] = useState<AvatarConfig>(() => structuredClone(baseline));
  const [tab, setTab] = useState<ConstructorTab>('body');
  const [previewMode, setPreviewMode] = useState<'large' | 'native' | 'atlas'>('large');
  const [direction, setDirection] = useState<Direction>('south');
  const [animation, setAnimation] = useState<'idle' | 'walk'>('idle');
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(''),
    [conflict, setConflict] = useState(false);
  const dirty = appearanceKey(config) !== appearanceKey(baseline);
  useUnsavedChanges(dirty);
  const c = constructorChoices(config);
  const change = (next: AvatarConfig) => {
    setConfig(next);
    setSaved(false);
    setError('');
    setConflict(false);
  };
  const customize = (patch: Partial<AvatarCustomization>) =>
    change(updateConstructor(config, patch));
  const color = (key: keyof AvatarConfig['palette'], value: string) =>
    change({ ...config, palette: { ...config.palette, [key]: value } });
  const extraColor = (key: keyof AvatarCustomization['colors'], value: string) =>
    customize({ colors: { ...c.colors, [key]: value } });
  const rotate = (turn: 'left' | 'right') => setDirection((value) => turnPreview(value, turn));
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
  const palette = (key: keyof AvatarConfig['palette'], label: string) => (
    <ColorRow
      label={label}
      colors={key === 'skin' ? EDITOR_SKIN_PALETTE : AVATAR_PALETTES[key]}
      value={config.palette[key]}
      choose={(value) => color(key, value)}
    />
  );
  const detailPalette = (key: keyof AvatarCustomization['colors'], label: string) => (
    <ColorRow
      label={label}
      colors={FABRIC_PALETTE}
      value={c.colors[key]}
      choose={(value) => extraColor(key, value)}
    />
  );
  const importedPreview = (key: string, id: number) => {
    const item = importedChoice(key, id, c.gender);
    return item ? (
      <img
        src={importedThumbnail(item.thumbnail)}
        alt=""
        aria-hidden="true"
        style={{ width: 32, height: 32, objectFit: 'contain', imageRendering: 'pixelated' }}
      />
    ) : undefined;
  };
  const slots = (
    key: 'mouth' | 'eyes' | 'top' | 'bottom' | 'footwear' | 'hat' | 'jewelry' | 'special',
    label: string,
    icon: ConstructorIconName,
  ) => (
    <ChoiceGrid
      label={label}
      icon={icon}
      options={SLOTS.map((id) => ({
        id,
        name: `Вариант ${id}`,
        preview: importedPreview(key, id),
        selected: c[key] === id,
        choose: () =>
          customize({
            [key]: ['hat', 'jewelry', 'special'].includes(key) && c[key] === id ? null : id,
          }),
      }))}
    />
  );
  const features = (key: 'bodyFeatures' | 'faceFeatures', label: string) => (
    <ChoiceGrid
      label={label}
      icon="features"
      options={Array.from({ length: key === 'bodyFeatures' ? 12 : 6 }, (_, i) => i + 1).map(
        (id) => ({
          id,
          name: key === 'faceFeatures' ? FACE_FEATURES[id - 1]! : `Вариант ${id}`,
          preview: importedPreview(key, id),
          selected: c[key].includes(id),
          choose: () =>
            customize({
              [key]: c[key].includes(id)
                ? c[key].filter((v) => v !== id)
                : [...c[key], id].sort((a, b) => a - b),
            }),
        }),
      )}
    />
  );
  return (
    <main className="account-main editor-main">
      <h1 className="constructor-heading">Конструктор персонажа</h1>
      <form className="avatar-layout" onSubmit={save} aria-busy={busy}>
        <section className="form-panel avatar-form" aria-label="Каталог персонажа">
          <div className="constructor-tabs" role="tablist" aria-label="Настройки персонажа">
            {CONSTRUCTOR_TABS.map((id, index) => (
              <button
                type="button"
                role="tab"
                key={id}
                id={`tab-${id}`}
                aria-controls={`panel-${id}`}
                aria-selected={tab === id}
                tabIndex={tab === id ? 0 : -1}
                disabled={busy}
                onClick={() => setTab(id)}
                onKeyDown={(event) => {
                  const next =
                    event.key === 'ArrowRight'
                      ? (index + 1) % 4
                      : event.key === 'ArrowLeft'
                        ? (index + 3) % 4
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? 3
                            : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  setTab(CONSTRUCTOR_TABS[next]!);
                  document.getElementById(`tab-${CONSTRUCTOR_TABS[next]}`)?.focus();
                }}
              >
                <ConstructorIcon name={id} />
                <span>{TAB_LABELS[id]}</span>
              </button>
            ))}
          </div>
          <fieldset disabled={busy}>
            <legend className="sr-only">Варианты внешности</legend>
            {CONSTRUCTOR_TABS.map((id) => (
              <div
                role="tabpanel"
                key={id}
                id={`panel-${id}`}
                aria-labelledby={`tab-${id}`}
                hidden={tab !== id}
                tabIndex={0}
              >
                {id === 'body' && (
                  <>
                    <EditorSection number="01" title="Персонаж">
                      <ChoiceGrid
                        label="Пол и возраст"
                        icon="body"
                        options={(
                          [
                            ['female', 'adult', 'Женщина'],
                            ['male', 'adult', 'Мужчина'],
                          ] as const
                        ).map(([gender, age, name]) => ({
                          id: `${gender}-${age}`,
                          name,
                          caption: name,
                          selected: c.gender === gender && c.age === age,
                          choose: () => customize({ gender, age }),
                        }))}
                      />
                    </EditorSection>
                    <EditorSection number="02" title="Телосложение">
                      <ChoiceGrid
                        label="Телосложение"
                        icon="body"
                        options={(
                          [
                            ['slim', 'Худое'],
                            ['average', 'Среднее'],
                            ['sturdy', 'Плотное'],
                          ] as const
                        ).map(([build, name]) => ({
                          id: build,
                          name,
                          caption: name,
                          selected: c.build === build,
                          choose: () => customize({ build }),
                        }))}
                      />
                      {palette('skin', 'Цвет кожи')}
                    </EditorSection>
                    <EditorSection number="03" title="Особенности">
                      {features('bodyFeatures', 'Особенности тела')}
                    </EditorSection>
                  </>
                )}
                {id === 'head' && (
                  <>
                    <EditorSection number="01" title="Рот">
                      {slots('mouth', 'Рот', 'mouth')}
                    </EditorSection>
                    <EditorSection number="02" title="Глаза">
                      {slots('eyes', 'Глаза', 'eyes')}
                    </EditorSection>
                    <EditorSection number="03" title="Особенности">
                      {features('faceFeatures', 'Особенности лица')}
                    </EditorSection>
                    <EditorSection number="04" title="Причёска">
                      <ChoiceGrid
                        label="Причёска"
                        icon="hair"
                        options={SLOTS.map((id) => ({
                          id,
                          name: `${c.gender === 'male' ? 'Мужская' : 'Женская'} ${id}`,
                          selected: c.hair[c.gender] === id,
                          disabled:
                            c.gender === 'female' &&
                            id > 4 &&
                            !importedChoice('hair', id, c.gender),
                          preview:
                            importedPreview('hair', id) ??
                            (c.gender === 'female' && id <= 4 ? (
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 32,
                                  height: 32,
                                  backgroundImage: `url(${hairAtlasUrl})`,
                                  backgroundSize: '128px 128px',
                                  backgroundPosition: `-${(id - 1) * 32}px -64px`,
                                  imageRendering: 'pixelated',
                                }}
                              />
                            ) : undefined),
                          choose: () => customize({ hair: { ...c.hair, [c.gender]: id } }),
                        }))}
                      />
                      {palette('hair', 'Цвет волос')}
                    </EditorSection>
                  </>
                )}
                {id === 'clothes' && (
                  <>
                    <EditorSection number="01" title="Верх">
                      {slots('top', 'Верх', 'top')}
                      {palette('outfit', 'Цвет верха')}
                    </EditorSection>
                    <EditorSection number="02" title="Низ">
                      {slots('bottom', 'Низ', 'bottom')}
                      {detailPalette('bottom', 'Цвет низа')}
                    </EditorSection>
                    <EditorSection number="03" title="Обувь">
                      {slots('footwear', 'Обувь', 'shoes')}
                      {palette('shoes', 'Цвет обуви')}
                    </EditorSection>
                  </>
                )}
                {id === 'details' && (
                  <>
                    <EditorSection number="01" title="Шапки">
                      {slots('hat', 'Шапка', 'hat')}
                      {detailPalette('hat', 'Цвет шапки')}
                    </EditorSection>
                    <EditorSection number="02" title="Украшения">
                      {slots('jewelry', 'Украшение', 'jewelry')}
                      {detailPalette('jewelry', 'Цвет украшения')}
                    </EditorSection>
                    <EditorSection number="03" title="Особые предметы">
                      {slots('special', 'Особый предмет', 'special')}
                      {detailPalette('special', 'Цвет особого предмета')}
                    </EditorSection>
                  </>
                )}
              </div>
            ))}
          </fieldset>
        </section>
        <div className="avatar-preview-column">
          <section className="avatar-stage" aria-label="Просмотр персонажа">
            <div className="avatar-platform">
              <AvatarPreview
                review
                config={config}
                direction={direction}
                size={384}
                mode={previewMode}
                animation={animation}
              />
            </div>
            <div className="preview-controls" role="group" aria-label="Управление предпросмотром">
              <button
                type="button"
                aria-label="Повернуть влево"
                title="Повернуть влево"
                onClick={() => rotate('left')}
              >
                <ConstructorIcon name="left" />
              </button>
              <button
                type="button"
                aria-label="Стоит"
                title="Стоит"
                aria-pressed={animation === 'idle'}
                onClick={() => setAnimation('idle')}
              >
                <ConstructorIcon name="idle" />
              </button>
              <button
                type="button"
                aria-label="Идёт"
                title="Идёт"
                aria-pressed={animation === 'walk'}
                onClick={() => setAnimation('walk')}
              >
                <ConstructorIcon name="walk" />
              </button>
              <button
                type="button"
                aria-label="Повернуть вправо"
                title="Повернуть вправо"
                onClick={() => rotate('right')}
              >
                <ConstructorIcon name="right" />
              </button>
            </div>
            <details className="art-tools">
              <summary>Проверка графики</summary>
              <div className="preview-controls" aria-label="Формат предпросмотра">
                {(
                  [
                    ['large', 'Крупно'],
                    ['native', '1×'],
                    ['atlas', 'A24'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    style={{ width: 56 }}
                    type="button"
                    key={id}
                    aria-pressed={previewMode === id}
                    onClick={() => setPreviewMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </details>
          </section>
          <div className="constructor-actions" role="group" aria-label="Действия с внешностью">
            <button
              type="button"
              className="button secondary reset-action"
              disabled={busy || !dirty}
              onClick={() => change(structuredClone(baseline))}
            >
              Сбросить вид
            </button>
            <button
              type="button"
              className="button secondary random-action"
              disabled={busy}
              onClick={() => change(randomAvatar(avatarCatalog, config))}
            >
              Случайный вид
            </button>
            <button className="button save-action" disabled={busy}>
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
          <nav className="constructor-navigation" aria-label="Переходы из конструктора">
            <a
              className={`button secondary${busy ? ' is-disabled' : ''}`}
              href={account.config.mode === 'demo' ? '#/menu' : '#/'}
              aria-disabled={busy}
              onClick={(e) => {
                if (busy) e.preventDefault();
              }}
            >
              <span aria-hidden="true">←</span> Вернуться в меню
            </a>
            <a
              className={`button primary${busy ? ' is-disabled' : ''}`}
              href="#/factory"
              aria-disabled={busy}
              onClick={(e) => {
                if (busy) e.preventDefault();
              }}
            >
              Войти на завод <span aria-hidden="true">→</span>
            </a>
          </nav>
          {error && <Notice error>{error}</Notice>}
          {conflict && (
            <button type="button" className="text-link" onClick={() => void account.refresh()}>
              Загрузить сохранённую версию
            </button>
          )}
          {saved && <Notice>Персонаж сохранён. Можно отправляться на завод.</Notice>}
        </div>
      </form>
    </main>
  );
}
