import { ArrowIcon } from '../components';
import { useAccount } from '../account/AccountProvider';
import { avatarCatalog } from '../avatar/catalog';
import { AvatarPreview } from '../avatar/AvatarPreview';
export function HomePage() {
  const { user, data } = useAccount();
  return (
    <main className="home-main">
      <section className="home-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-dot" /> ЛЮДИ. ИДЕИ. КРЕАТИВНЫЕ ИНДУСТРИИ.
          </div>
          <h1>
            {user ? (
              <>
                Ваше место
                <br />
                создавать<span> новое.</span>
              </>
            ) : (
              <>
                Здесь встречаются
                <br />
                те, кто <span>создаёт.</span>
              </>
            )}
          </h1>
          <p>
            Creative Factory — виртуальный завод для экспертов и педагогов креативных индустрий.
            Найдите своё пространство и придайте форму своим идеям.
          </p>
          <div className="hero-actions">
            {user ? (
              <a className="button primary" href={data.profile ? '#/factory' : '#/profile'}>
                {data.profile ? 'Войти на завод' : 'Заполнить профиль'}{' '}
                <span>
                  <ArrowIcon />
                </span>
              </a>
            ) : (
              <>
                <a className="button primary" href="#/login">
                  Войти по email{' '}
                  <span>
                    <ArrowIcon />
                  </span>
                </a>
                <a className="text-link" href="#/factory">
                  Прогуляться без аккаунта →
                </a>
              </>
            )}
          </div>
          <div className="hero-footnote">
            <span>01 ЗАВОД</span>
            <span>04 ЦЕХА</span>
            <span>МНОГО ИДЕЙ</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <svg viewBox="0 0 440 360" fill="none">
            <rect x="22" y="20" width="396" height="320" rx="30" fill="#e5ead8" />
            <path d="M46 180h348M220 44v272" stroke="#f8f7ed" strokeWidth="22" />
            <rect x="50" y="48" width="144" height="104" rx="10" fill="#c3d4b4" />
            <rect x="246" y="48" width="144" height="104" rx="10" fill="#e3c99d" />
            <rect x="50" y="208" width="144" height="104" rx="10" fill="#e0b4a5" />
            <rect x="246" y="208" width="144" height="104" rx="10" fill="#b8cbc1" />
            <path d="M74 119V76l27 14V69l30 17V58h35v61H74Z" fill="#3c5a42" />
            <path d="M270 92h96m-72-20v40m24-40v40m24-40v40" stroke="#816d4f" strokeWidth="3" />
            <path d="m78 259 34-28 34 28-34 29-34-29Z" stroke="#986553" strokeWidth="3" />
            <circle cx="318" cy="260" r="27" stroke="#607e6a" strokeWidth="3" />
            <path d="M284 260h68m-34-34v68" stroke="#607e6a" strokeWidth="2" />
            <circle cx="220" cy="180" r="34" fill="#2f4b3a" />
            <text
              x="220"
              y="187"
              textAnchor="middle"
              fill="#e7edc7"
              fontSize="20"
              fontFamily="Arial"
            >
              CF
            </text>
          </svg>
          <span className="art-label">
            МЕСТО ВСТРЕЧИ ИДЕЙ <ArrowIcon />
          </span>
        </div>
      </section>
      {user && (
        <section className="dashboard-section" aria-label="Ваши пространства">
          <div className="section-top">
            <div>
              <div className="eyebrow">ЛИЧНЫЙ МАРШРУТ</div>
              <h2>
                {data.profile
                  ? `${data.profile.firstName}, с чего начнём?`
                  : 'Добро пожаловать на завод'}
              </h2>
            </div>
            <a className="text-link" href="#/profile">
              Личный кабинет <ArrowIcon />
            </a>
          </div>
          {!data.profile && (
            <p className="onboarding-note">
              Укажите имя и фамилию для публичного профиля. Совпадение имён допустимо: ваш аккаунт
              связан с неизменяемым ID.
            </p>
          )}
          <div className="dashboard-grid">
            <a
              className="destination-card factory-card"
              href={data.profile ? '#/factory' : '#/profile'}
            >
              <span className="card-number">01 / ПРОСТРАНСТВО</span>
              <div className="card-symbol">⌘</div>
              <h3>
                Войти на завод{' '}
                <span>
                  <ArrowIcon />
                </span>
              </h3>
              <p>Четыре цеха, холл и ваш собственный маршрут.</p>
              <span className="card-tag">Локальная прогулка</span>
            </a>
            <a className="destination-card avatar-card" href="#/avatar">
              <span className="card-number">02 / ВНЕШНОСТЬ</span>
              <div className="card-avatar">
                <AvatarPreview config={data.avatar ?? avatarCatalog.defaultAvatar} size={96} />
              </div>
              <h3>
                Мой персонаж{' '}
                <span>
                  <ArrowIcon />
                </span>
              </h3>
              <p>Соберите образ, который расскажет о вас.</p>
              <span className="card-tag">Редактор персонажа</span>
            </a>
            <div className="destination-card soon-card">
              <span className="card-number">03 / СООБЩЕСТВО</span>
              <div className="card-symbol">◎</div>
              <h3>Эксперты ККИ</h3>
              <p>Люди, которые делятся знаниями и создают новое.</p>
              <span className="card-tag">Скоро</span>
            </div>
            <div className="destination-card soon-card">
              <span className="card-number">04 / ВСТРЕЧИ</span>
              <div className="card-symbol">✳</div>
              <h3>События завода</h3>
              <p>Поводы встретиться, обменяться опытом и идеями.</p>
              <span className="card-tag">Скоро</span>
            </div>
          </div>
        </section>
      )}
      <footer className="home-footer">
        <span>creativefactory / пространство для тех, кто создаёт</span>
        <span>Сейчас завод работает в режиме локальной прогулки.</span>
      </footer>
    </main>
  );
}
