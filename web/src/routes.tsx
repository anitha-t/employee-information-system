import { Navigate, type RouteObject } from 'react-router'
import { AuthLayout } from './components/layout/AuthLayout'
import { RedirectIfSignedIn, RequireAuth, RequireRole } from './components/layout/guards'
import { AppLayout } from './pages/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { EmployeeDetailPage } from './pages/EmployeeDetailPage'
import { EmployeeEditPage } from './pages/EmployeeEditPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { NewHirePage } from './pages/NewHirePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfileEditPage } from './pages/ProfileEditPage'
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
        { path: '/profile/edit', element: <ProfileEditPage /> },
        {
          element: <RequireRole role="hr" />,
          children: [
            { path: '/employees/new', element: <NewHirePage /> },
            { path: '/employees/:employmentId', element: <EmployeeDetailPage /> },
            { path: '/employees/:employmentId/edit', element: <EmployeeEditPage /> },
          ],
        },
      ],
    }],
  },
  { path: '*', element: <NotFoundPage /> },
]
