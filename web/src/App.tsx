import { Route, Routes } from 'react-router-dom';
import AppHeader from './components/AppHeader';
import RecipeLibraryPage from './pages/RecipeLibraryPage';
import RecipeFormPage from './pages/RecipeFormPage';
import PlanListPage from './pages/PlanListPage';
import PlanDetailPage from './pages/PlanDetailPage';
import ShoppingListPage from './pages/ShoppingListPage';
import MealPlanningPage from './pages/MealPlanningPage';

export default function App() {
  return (
    <div className="app-shell">
      <AppHeader />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<RecipeLibraryPage />} />
          <Route path="/recipes" element={<RecipeLibraryPage />} />
          <Route path="/recipes/new" element={<RecipeFormPage />} />
          <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
          <Route path="/planning" element={<MealPlanningPage />} />
          <Route path="/plans" element={<PlanListPage />} />
          <Route path="/plans/:id" element={<PlanDetailPage />} />
          <Route path="/plans/:id/shopping-list" element={<ShoppingListPage />} />
        </Routes>
      </main>
    </div>
  );
}
