import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { App } from './app'
import './index.css'
import { routes } from './routes'
import { createQueryClient, handleUnauthorized } from './setup'

const queryClient = createQueryClient()
const router = createBrowserRouter(routes)
handleUnauthorized(queryClient, router)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App queryClient={queryClient} router={router} />
  </StrictMode>,
)
