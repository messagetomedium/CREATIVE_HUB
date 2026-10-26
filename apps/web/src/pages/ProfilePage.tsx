import { useState, type FormEvent } from 'react';
import { EMPTY_PROFILE, ProfileInputSchema, type ProfileInput } from '@creative-factory/contracts';
import { useAccount } from '../account/AccountProvider';
import { safeAccountError } from '../account/service';
import { ArrowIcon, Notice, PageHeading } from '../components';
export function ProfilePage() {
  const account = useAccount();
  // Project identity/revision out of editable fields.
  const [form, setForm] = useState<ProfileInput>(() =>
    account.data.profile
      ? ProfileInputSchema.strip().parse(account.data.profile)
      : { ...EMPTY_PROFILE },
  );
  const [revision, setRevision] = useState(account.data.profile?.revision ?? 0);
  const [competencies, setCompetencies] = useState(form.competencies.join(', '));
  const [links, setLinks] = useState(form.portfolioLinks.join('\n'));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [conflict, setConflict] = useState(false);
  const field = (key: keyof ProfileInput, value: string) => {
    setForm((old) => ({ ...old, [key]: value }));
    setSaved(false);
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setSaved(false);
    setConflict(false);
    const result = ProfileInputSchema.safeParse({
      ...form,
      competencies: competencies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      portfolioLinks: links
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    if (!result.success) {
      const issue = result.error.issues[0];
      const names: Record<string, string> = {
        firstName: 'Имя',
        lastName: 'Фамилия',
        role: 'Роль',
        specialization: 'Специализация',
        organization: 'Организация',
        competencies: 'Компетенции',
        bio: 'О себе',
        portfolioLinks: 'Портфолио',
      };
      setError(
        `${names[String(issue?.path[0])] ?? 'Профиль'}: ${issue?.message ?? 'проверьте значение'}.`,
      );
      return;
    }
    setBusy(true);
    try {
      const profile = await account.saveProfile(result.data, revision);
      setRevision(profile.revision);
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
      <PageHeading tag="ЛИЧНЫЙ КАБИНЕТ" title="Расскажите о себе">
        Ваш профессиональный профиль. Имя и фамилия обязательны; остальные поля можно заполнить
        позже.
      </PageHeading>
      <div className="profile-layout">
        <aside className="profile-aside">
          <div className="profile-initials">
            {form.firstName[0] ?? 'C'}
            {form.lastName[0] ?? 'F'}
          </div>
          <h2>
            Ваше место
            <br />в сообществе
          </h2>
          <p>Профиль виден зарегистрированным участникам. Совпадения имён допустимы.</p>
          <div className="private-email">
            <span className="eyebrow">ТОЛЬКО ДЛЯ ВАС</span>
            <strong>{account.user?.email}</strong>
            <p>Email используется для входа и не публикуется.</p>
          </div>
          <a className="text-link" href="#/avatar">
            Перейти к персонажу <ArrowIcon />
          </a>
        </aside>
        <form className="form-panel profile-form" onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy}>
            <legend className="form-section-title">01 / ЗНАКОМСТВО</legend>
            <div className="form-grid">
              <label>
                Имя <span>*</span>
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={(e) => field('firstName', e.target.value)}
                  autoComplete="given-name"
                  maxLength={60}
                  required
                />
              </label>
              <label>
                Фамилия <span>*</span>
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={(e) => field('lastName', e.target.value)}
                  autoComplete="family-name"
                  maxLength={60}
                  required
                />
              </label>
            </div>
            <label>
              Профессиональная роль
              <select name="role" value={form.role} onChange={(e) => field('role', e.target.value)}>
                <option value="expert">Эксперт</option>
                <option value="educator">Педагог</option>
              </select>
            </label>
            <p className="field-hint">
              Роль описывает вашу деятельность и не предоставляет прав администратора.
            </p>
            <div className="form-grid">
              <label>
                Специализация
                <input
                  name="specialization"
                  placeholder="Например, графический дизайн"
                  value={form.specialization}
                  onChange={(e) => field('specialization', e.target.value)}
                  maxLength={100}
                />
              </label>
              <label>
                Организация
                <input
                  name="organization"
                  value={form.organization}
                  onChange={(e) => field('organization', e.target.value)}
                  autoComplete="organization"
                  maxLength={120}
                />
              </label>
            </div>
          </fieldset>
          <fieldset disabled={busy}>
            <legend className="form-section-title">02 / ОПЫТ И ИДЕИ</legend>
            <label>
              Компетенции
              <input
                name="competencies"
                value={competencies}
                onChange={(e) => {
                  setCompetencies(e.target.value);
                  setSaved(false);
                }}
                maxLength={976}
                placeholder="Иллюстрация, типографика, арт-дирекшн"
              />
            </label>
            <p className="field-hint">Через запятую. До 16 компетенций, каждая до 60 символов.</p>
            <label>
              О себе
              <textarea
                name="bio"
                value={form.bio}
                onChange={(e) => field('bio', e.target.value)}
                maxLength={1000}
                rows={5}
                placeholder="Чем занимаетесь, что вам интересно и каким опытом готовы делиться?"
              />
            </label>
            <div className="character-count">{form.bio.length} / 1000</div>
            <label>
              Ссылки на портфолио
              <textarea
                name="portfolioLinks"
                value={links}
                onChange={(e) => {
                  setLinks(e.target.value);
                  setSaved(false);
                }}
                maxLength={1505}
                rows={3}
                placeholder="https://example.com/my-work"
              />
            </label>
            <p className="field-hint">
              Одна HTTPS-ссылка на строку, максимум 5. До 300 символов каждая.
            </p>
          </fieldset>
          {error && <Notice error>{error}</Notice>}
          {conflict && (
            <button type="button" className="text-link" onClick={() => void account.refresh()}>
              Загрузить сохранённую версию
            </button>
          )}
          {saved && <Notice>Профиль сохранён.</Notice>}
          <div className="form-actions">
            <button className="button primary" disabled={busy}>
              {busy ? 'Сохраняем…' : 'Сохранить профиль'}
            </button>
            {account.data.profile && (
              <a className="text-link" href="#/factory">
                Войти на завод →
              </a>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
