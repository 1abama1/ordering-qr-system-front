import { Component, Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from './providers/query';
import { AuthLifecycle } from './providers/AuthLifecycle';
import { Guard } from '../features/auth/Guard';
import { Loading } from '../shared/components/feedback/Feedback';
const GuestLayout = lazy(() => import('../pages/guest/GuestLayout'));
const MenuPage = lazy(() => import('../pages/guest/MenuPage'));
const CartPage = lazy(() => import('../pages/guest/CartPage'));
const SuccessPage = lazy(() => import('../pages/guest/SuccessPage'));
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const StaffLayout = lazy(() => import('../pages/kitchen/StaffLayout'));
const KitchenPage = lazy(() => import('../pages/kitchen/KitchenPage'));
const StopListPage = lazy(() => import('../pages/kitchen/StopListPage'));
const AdminLayout = lazy(() => import('../pages/admin/AdminLayout'));
const OverviewPage = lazy(() => import('../pages/admin/OverviewPage'));
const MenuManagementPage = lazy(
  () => import('../pages/admin/MenuManagementPage'),
);
const CategoriesPage = lazy(() => import('../pages/admin/CategoriesPage'));
const TablesPage = lazy(() => import('../pages/admin/TablesPage'));
const StaffPage = lazy(() => import('../pages/admin/StaffPage'));
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (
      <div className="state">
        <h1>Не удалось открыть приложение</h1>
        <p>
          Перезагрузите страницу. Сохранённая попытка заказа останется в текущей
          вкладке.
        </p>
        <button
          className="button button-primary"
          onClick={() => location.reload()}
        >
          Перезагрузить
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthLifecycle />
          <Suspense fallback={<Loading label="Открываем…" />}>
            <Routes>
              <Route element={<GuestLayout />}>
                <Route index element={<MenuPage />} />
                <Route path="menu" element={<MenuPage />} />
                <Route path="cart" element={<CartPage />} />
                <Route path="order/success" element={<SuccessPage />} />
              </Route>
              <Route path="staff/login" element={<LoginPage />} />
              <Route element={<Guard />}>
                <Route element={<StaffLayout />}>
                  <Route path="kitchen" element={<KitchenPage />} />
                  <Route path="kitchen/stop-list" element={<StopListPage />} />
                </Route>
              </Route>
              <Route element={<Guard admin />}>
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<OverviewPage />} />
                  <Route path="menu" element={<MenuManagementPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="tables" element={<TablesPage />} />
                  <Route path="staff" element={<StaffPage />} />
                </Route>
              </Route>
              <Route
                path="403"
                element={
                  <div className="state">
                    <h1>Доступ ограничен</h1>
                    <p>Эта страница доступна администратору.</p>
                    <Link className="button button-primary" to="/kitchen">
                      На кухню
                    </Link>
                  </div>
                }
              />
              <Route
                path="*"
                element={
                  <div className="state">
                    <h1>Страница не найдена</h1>
                    <Link className="button button-primary" to="/">
                      На главную
                    </Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
          <Toaster richColors position="top-center" />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
