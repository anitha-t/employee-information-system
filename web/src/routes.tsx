import { Navigate, type RouteObject } from 'react-router'
import { AuthLayout } from './components/layout/AuthLayout'
import { RedirectIfSignedIn, RequireAuth, RequireRole } from './components/layout/guards'
import { AppLayout } from './pages/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { NewHirePage } from './pages/NewHirePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfilePage } from './pages/ProfilePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

/** Signed-out pages that must never trigger the sign-in redirect. */
export const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password']

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  {
    element: <RedirectIfSignedIn />,
    children: [{
      element: <AuthLayout />,
      children: [
        { path: '/login', element: <LoginPage /> },
        { path: '/forgot-password', element: <ForgotPasswordPage /> },
        { path: '/reset-password/:token', element: <ResetPasswordPage /> },
      ],
    }],
  },
  {
    element: <RequireAuth />,
    children: [{
      element: <AppLayout />,
      children: [
        { path: '/dashboard', element: <DashboardPage /> },
        { path: '/profile', element: <ProfilePage /> },
        { path: '/employees/new', element: <RequireRole role="hr"><NewHirePage /></RequireRole> },
      ],
    }],
  },
  { path: '*', element: <NotFoundPage /> },
]
