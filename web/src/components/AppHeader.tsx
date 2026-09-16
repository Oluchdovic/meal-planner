import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/planning', label: 'Mon Planning', qt: 'nav-planning' },
  { to: '/plans', label: 'Mes Plans', qt: 'nav-plans' },
  { to: '/recipes', label: 'Mes Recettes', qt: 'nav-recipes' },
];

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="app-header__logo-icon">
      <path
        d="M12 3c-3.5 2-5.5 5-5.5 8.5A5.5 5.5 0 0 0 12 17a5.5 5.5 0 0 0 5.5-5.5C17.5 8 15.5 5 12 3Z"
        fill="currentColor"
      />
      <path d="M12 13.2V21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BurgerIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9a6 6 0 1 1 12 0c0 3.4 1 5 1.6 5.8.3.4 0 1-.5 1H4.9c-.5 0-.8-.6-.5-1C5 14 6 12.4 6 9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="app-header">
      <div className="app-header__bar">
        <div className="app-header__brand-group">
          <NavLink to="/recipes" className="app-header__brand" data-qt-id="nav-brand" onClick={closeMenu}>
            <span className="app-header__logo" aria-hidden="true">
              <LogoMark />
            </span>
            <span className="app-header__brand-text">
              Mijoté
              <span>planificateur de repas</span>
            </span>
          </NavLink>

          <button
            type="button"
            className="app-header__burger"
            aria-expanded={menuOpen}
            aria-controls="app-header-nav"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setMenuOpen((open) => !open)}
            data-qt-id="nav-burger-toggle"
          >
            <BurgerIcon open={menuOpen} />
          </button>
        </div>

        <nav
          id="app-header-nav"
          className={`app-header__nav${menuOpen ? ' app-header__nav--open' : ''}`}
          aria-label="Navigation principale"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `app-header__tab${isActive ? ' active' : ''}`}
              data-qt-id={item.qt}
              onClick={closeMenu}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-header__actions">
          <Link to="/recipes/new" className="app-header__cta" data-qt-id="nav-cta-new-recipe">
            <PlusIcon />
            <span className="app-header__cta-label">Nouvelle recette</span>
          </Link>
          <button type="button" className="app-header__icon-btn" aria-label="Notifications" data-qt-id="nav-notifications">
            <BellIcon />
            <span className="app-header__badge" aria-hidden="true" />
          </button>
          <div className="app-header__profile" data-qt-id="nav-profile">
            <span className="app-header__avatar" aria-hidden="true">
              MP
            </span>
            <span className="app-header__profile-name">Mon compte</span>
          </div>
        </div>
      </div>
    </header>
  );
}
