import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { ToastProvider } from './components/ui/toast'
import type { Router } from './setup'

export function App({ queryClient, router }: { queryClient: QueryClient; router: Router }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  )
}
