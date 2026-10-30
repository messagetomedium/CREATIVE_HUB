import { useAccount } from '../account/AccountProvider';
import { AvatarPreview } from '../avatar/AvatarPreview';
import { avatarCatalog } from '../avatar/catalog';
import { ArrowIcon, FactoryMark } from '../components';
export function MenuPage() {
  const { data, config } = useAccount();
  return (
    <main className="menu-main">
      <section className="menu-intro">
        <div className="eyebrow">CREATIVE FACTORY / ВАШЕ ПРОСТРАНСТВО</div>
        <h1>
          С чего начнём<span> сегодня?</span>
        </h1>
        <p>Создайте свой образ. Исследуйте остров. Найдите место для новых идей.</p>
      </section>
      <nav className="menu-grid" aria-label="Главное меню">
        <a className="destination-card avatar-card" href="#/avatar">
          <span className="card-number">01 / ВАШ ОБРАЗ</span>
          <div className="menu-card-art">
            <AvatarPreview config={data.avatar ?? avatarCatalog.defaultAvatar} size={160} />
          </div>
          <h2>
            Редактировать персонажа <ArrowIcon />
          </h2>
          <p>Причёска, одежда и детали, которые делают образ вашим.</p>
          <span className="card-tag">Открыть конструктор</span>
        </a>
        <a className="destination-card factory-card" href="#/island">
          <span className="card-number">02 / ВАШ МАРШРУТ</span>
          <div className="menu-card-art factory-door" aria-hidden="true">
            <FactoryMark />
            <span>CF / 01</span>
          </div>
          <h2>
            Войти на остров <ArrowIcon />
          </h2>
          <p>Небольшой остров, ваш дом и пространство для прогулки.</p>
          <span className="card-tag">Локальная прогулка</span>
        </a>
        <a className="destination-card profile-menu-card" href="#/profile">
          <span className="card-number">03 / ВАША ИСТОРИЯ</span>
          <div className="menu-card-art profile-symbol" aria-hidden="true">
            ◎
          </div>
          <h2>
            Личный кабинет <ArrowIcon />
          </h2>
          <p>
            {config.mode === 'demo'
              ? 'Здесь скоро появится ваш профессиональный профиль.'
              : 'Расскажите о себе и своём опыте.'}
          </p>
          <span className="card-tag">{config.mode === 'demo' ? 'Скоро' : 'Открыть профиль'}</span>
        </a>
      </nav>
      <p className="menu-footnote">
        {config.mode === 'demo'
          ? 'Демонстрационная сессия · персонаж хранится на этом устройстве'
          : 'Одно пространство. Много точек соприкосновения.'}
      </p>
    </main>
  );
}
