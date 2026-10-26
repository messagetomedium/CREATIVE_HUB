import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccountProvider, useAccount } from './account/AccountProvider';
import { safeAccountError, type AuthConfig } from './account/service';
import { ArrowIcon, FactoryMark, Notice } from './components';
import { navigate, parseRoute, useRoute, type Route } from './router';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { AvatarPage } from './pages/AvatarPage';
import { FactoryPage } from './pages/FactoryPage';
function Redirect({ to, from }: { to: Route; from: Route }) {
  // A completed Auth request must not overwrite a newer hash navigation.
  useEffect(() => {
    if (parseRoute(window.location.hash) === from) navigate(to, true);
  }, [to, from]);
  return null;
}
function Application() {
  const route = useRoute(),
    account = useAccount();
  const previousUser = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (previousUser.current && !account.user) navigate('/', true);
    previousUser.current = account.user?.userId ?? null;
  }, [account.user]);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    const titles: Record<Route, string> = {
      '/': 'Главная',
      '/login': 'Вход',
      '/profile': 'Личный кабинет',
      '/avatar': 'Мой персонаж',
      '/factory': 'Завод',
    };
    document.title = `${route ? titles[route] : 'Страница не найдена'} — Creative Factory`;
    window.scrollTo(0, 0);
  }, [route]);
  async function logout() {
    navigate('/', true);
    setLoggingOut(true);
    setLogoutError('');
    try {
      await account.logout();
    } catch (e) {
      setLogoutError(safeAccountError(e).message);
    } finally {
      setLoggingOut(false);
    }
  }
  let screen;
  if (loggingOut || account.status === 'loading')
    screen = (
      <main className="narrow-main">
        <Notice>{loggingOut ? 'Выходим из аккаунта…' : 'Открываем ваше пространство…'}</Notice>
      </main>
    );
  else if (account.status === 'error')
    screen = (
      <main className="narrow-main">
        <Notice error>{account.error}</Notice>
        <button
          className="button primary"
          onClick={() => (account.user ? void account.refresh() : window.location.reload())}
        >
          Попробовать снова
        </button>
      </main>
    );
  else if (route === '/login' && account.user)
    screen = <Redirect to={account.data.profile ? '/' : '/profile'} from="/login" />;
  else if ((route === '/profile' || route === '/avatar') && !account.user)
    screen = <Redirect to="/login" from={route} />;
  else if ((route === '/factory' || route === '/avatar') && account.user && !account.data.profile)
    screen = <Redirect to="/profile" from={route} />;
  else
    switch (route) {
      case '/':
        screen = <HomePage />;
        break;
      case '/login':
        screen = <LoginPage />;
        break;
      case '/profile':
        screen = <ProfilePage />;
        break;
      case '/avatar':
        screen = <AvatarPage />;
        break;
      case '/factory':
        screen = <FactoryPage avatar={account.data.avatar ?? undefined} />;
        break;
      default:
        screen = (
          <main className="narrow-main">
            <h1>Такого пространства пока нет</h1>
            <a className="button primary" href="#/">
              На главную
            </a>
          </main>
        );
    }
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        К содержимому
      </a>
      <header className="site-header">
        <a className="brand" href="#/" aria-label="Creative Factory — начало">
          <span className="brand-mark">
            <FactoryMark />
          </span>
          <span>
            creative<span className="brand-light">factory</span>
          </span>
        </a>
        <span className="header-note">ПРОСТРАНСТВО ДЛЯ ТЕХ, КТО СОЗДАЁТ</span>
        <nav className="account-nav" aria-label="Личная навигация">
          {account.user ? (
            <>
              <a className={route === '/profile' ? 'active' : ''} href="#/profile">
                <span className="user-dot" />
                <span className="header-username">
                  {account.data.profile?.firstName ?? 'Личный кабинет'}
                </span>
              </a>
              <button className="logout-button" onClick={() => void logout()} disabled={loggingOut}>
                Выйти
              </button>
            </>
          ) : (
            <a className="header-login" href="#/login">
              Вход / регистрация{' '}
              <span>
                <ArrowIcon />
              </span>
            </a>
          )}
        </nav>
      </header>
      {logoutError && <Notice error>{logoutError}</Notice>}
      <div id="main-content" tabIndex={-1}>
        {screen}
      </div>
    </div>
  );
}
export function App({ config }: { config: AuthConfig }) {
  return (
    <AccountProvider config={config}>
      <Application />
    </AccountProvider>
  );
}
