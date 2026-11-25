import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { App } from '../app'
import { routes } from '../routes'
import { createQueryClient, handleUnauthorized } from '../setup'

/** Renders the whole app at `path`, with fresh query cache and router. */
export function renderApp(path: string) {
  const queryClient = createQueryClient()
  queryClient.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  handleUnauthorized(queryClient, router)
  const user = userEvent.setup()
  const view = render(<App queryClient={queryClient} router={router} />)
  const location = () => `${router.state.location.pathname}${router.state.location.search}`
  return { ...view, user, router, queryClient, location }
}
