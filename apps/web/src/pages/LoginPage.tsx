import { useEffect, useState, type FormEvent } from 'react';
import { EmailSchema } from '@creative-factory/contracts';
import { useAccount } from '../account/AccountProvider';
import { safeAccountError } from '../account/service';
import { Notice, PageHeading } from '../components';
interface Challenge {
  email: string;
  sentAt: number;
}
const challengeKey = 'creative-factory-email-challenge-v1';
function storedChallenge(): Challenge | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(challengeKey) ?? 'null') as Challenge | null;
    return value &&
      EmailSchema.safeParse(value.email).success &&
      Number.isFinite(value.sentAt) &&
      Date.now() - value.sentAt < 3600000 &&
      value.sentAt <= Date.now()
      ? value
      : null;
  } catch {
    return null;
  }
}
export function LoginPage() {
  const { config } = useAccount();
  const [challenge, setChallenge] = useState<Challenge | null>(storedChallenge);
  const [email, setEmail] = useState(challenge?.email ?? '');
  const [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const remaining = challenge
    ? Math.max(0, Math.ceil((challenge.sentAt + config.otpExpirySeconds * 1000 - now) / 1000))
    : 0;
  const resendIn = challenge ? Math.max(0, Math.ceil((challenge.sentAt + 60000 - now) / 1000)) : 0;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy || !config.service || (challenge && resendIn > 0)) return;
    const parsed = EmailSchema.safeParse(challenge?.email ?? email);
    if (!parsed.success) {
      setError('Проверьте адрес электронной почты.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await config.service.requestCode(parsed.data);
      const next = { email: parsed.data, sentAt: Date.now() };
      setChallenge(next);
      setCode('');
      setNow(next.sentAt);
      try {
        sessionStorage.setItem(challengeKey, JSON.stringify(next));
      } catch {
        /* Optional convenience only. */
      }
    } catch (e) {
      setError(safeAccountError(e).message);
    } finally {
      setBusy(false);
    }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !challenge || !config.service || !remaining) return;
    if (!new RegExp(`^\\d{${config.otpLength}}$`).test(code)) {
      setError(`Введите ${config.otpLength} цифр из письма.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await config.service.verifyCode(challenge.email, code);
      sessionStorage.removeItem(challengeKey);
    } catch (e) {
      setError(safeAccountError(e).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="narrow-main">
      <PageHeading tag="ПРОПУСК НА ЗАВОД" title="Рады встрече">
        Один email для регистрации и повторного входа. Пароль придумывать не нужно.
      </PageHeading>
      <section className="form-panel login-panel">
        <div className="step-label">
          {challenge ? '02 / ПОДТВЕРЖДЕНИЕ EMAIL' : '01 / ВАШ EMAIL'}
        </div>
        {!config.service && <Notice>{config.message}</Notice>}
        {challenge ? (
          <>
            <h2>Проверьте почту</h2>
            <p>
              Отправили одноразовый код на <strong>{challenge.email}</strong>.
            </p>
            <form onSubmit={verify} aria-busy={busy}>
              <label htmlFor="otp">Код из письма</label>
              <input
                id="otp"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern={`[0-9]{${config.otpLength}}`}
                minLength={config.otpLength}
                maxLength={config.otpLength}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                required
                disabled={busy || !remaining}
                className="otp-input"
              />
              <p className="field-hint" data-testid="otp-expiry">
                {remaining
                  ? `Действует ещё ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
                  : 'Срок действия кода истёк. Запросите новый.'}
              </p>
              {error && <Notice error>{error}</Notice>}
              <button
                className="button primary full-width"
                disabled={busy || !remaining || !config.service}
              >
                {busy ? 'Проверяем…' : 'Подтвердить и войти'}
              </button>
            </form>
            <button
              className="text-link resend-link"
              onClick={() => void send()}
              disabled={busy || resendIn > 0 || !config.service}
            >
              {resendIn ? `Новый код через ${resendIn} с` : 'Отправить код ещё раз'}
            </button>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => {
                setChallenge(null);
                setCode('');
                setError('');
                sessionStorage.removeItem(challengeKey);
              }}
            >
              Изменить email
            </button>
          </>
        ) : (
          <>
            <h2>Войдите в своё пространство</h2>
            <form onSubmit={send} aria-busy={busy}>
              <label htmlFor="email">Электронная почта</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                required
                disabled={busy || !config.service}
              />
              {error && <Notice error>{error}</Notice>}
              <button className="button primary full-width" disabled={busy || !config.service}>
                {busy ? 'Отправляем код…' : 'Получить код →'}
              </button>
            </form>
            <p className="field-hint">
              Если это ваш первый визит, после подтверждения email мы создадим аккаунт. Email не
              появится в публичном профиле.
            </p>
          </>
        )}
      </section>
      <a className="text-link login-local" href="#/factory">
        Пока просто прогуляться по заводу →
      </a>
    </main>
  );
}
