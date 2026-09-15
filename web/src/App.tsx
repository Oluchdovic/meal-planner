import { NavLink, Route, Routes } from 'react-router-dom';
import RecipeLibraryPage from './pages/RecipeLibraryPage';
import RecipeFormPage from './pages/RecipeFormPage';
import PlanListPage from './pages/PlanListPage';
import PlanDetailPage from './pages/PlanDetailPage';
import ShoppingListPage from './pages/ShoppingListPage';

export default function App() {
  return (
    <div className="app-shell">
      <nav className="app-nav">
        <NavLink to="/recipes" className="app-nav__brand" data-qt-id="nav-brand">
          Mijoté
          <span>planificateur de repas</span>
        </NavLink>
        <div className="app-nav__links">
          <NavLink
            to="/recipes"
            className={({ isActive }) => `app-nav__link${isActive ? ' active' : ''}`}
            data-qt-id="nav-recipes"
          >
            Recettes
          </NavLink>
          <NavLink
            to="/plans"
            className={({ isActive }) => `app-nav__link${isActive ? ' active' : ''}`}
            data-qt-id="nav-plans"
          >
            Plans de repas
          </NavLink>
        </div>
      </nav>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<RecipeLibraryPage />} />
          <Route path="/recipes" element={<RecipeLibraryPage />} />
          <Route path="/recipes/new" element={<RecipeFormPage />} />
          <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
          <Route path="/plans" element={<PlanListPage />} />
          <Route path="/plans/:id" element={<PlanDetailPage />} />
          <Route path="/plans/:id/shopping-list" element={<ShoppingListPage />} />
        </Routes>
      </main>
    </div>
  );
}
