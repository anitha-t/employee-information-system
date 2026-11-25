import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiError, employeeMe, hrMe } from '../test/fixtures'
import { renderApp } from '../test/render'
import { API, server, signInAs } from '../test/server'

/** POST /session succeeds and, from then on, /me returns `me` (the cookie is set). */
function acceptSignIn(me: typeof hrMe | typeof employeeMe) {
  server.use(http.post(`${API}/session`, () => {
    signInAs(me)
    return HttpResponse.json({ token: 'ignored', expires_at: '2026-12-09T00:00:00Z', user: me.user }, { status: 201 })
  }))
}

describe('sign in', () => {
  it('sends a signed-out visitor to /login, then back to where they were going', async () => {
    acceptSignIn(hrMe)
    const { user, location } = renderApp('/employees/new')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(location()).toBe('/login?next=%2Femployees%2Fnew')

    await user.type(screen.getByLabelText('Work email'), 'hr@acme.example')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'New hire' })).toBeInTheDocument()
    expect(location()).toBe('/employees/new')
  })

  it('lands on the dashboard by default', async () => {
    acceptSignIn(employeeMe)
    const { user, location } = renderApp('/login')

    await user.type(await screen.findByLabelText('Work email'), 'priya@acme.example')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: /Anu/ })).toBeInTheDocument()
    expect(location()).toBe('/dashboard')
  })

  it('validates the fields before calling the API', async () => {
    const { user } = renderApp('/login')

    await user.click(await screen.findByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Enter your password')).toBeInTheDocument()
  })

  it('explains a wrong password and clears the password field', async () => {
    server.use(http.post(`${API}/session`, () =>
      HttpResponse.json(apiError('invalid_credentials', 'Email or password is incorrect'), { status: 401 })))
    const { user, location } = renderApp('/login')

    await user.type(await screen.findByLabelText('Work email'), 'hr@acme.example')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(location()).toBe('/login')
  })

  it('explains rate limiting', async () => {
    server.use(http.post(`${API}/session`, () => HttpResponse.json(apiError('rate_limited', 'Too many'), { status: 429 })))
    const { user } = renderApp('/login')

    await user.type(await screen.findByLabelText('Work email'), 'hr@acme.example')
    await user.type(screen.getByLabelText('Password'), 'x')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText(/Too many sign-in attempts/)).toBeInTheDocument()
  })

  it('sends a signed-in user from /login to the dashboard', async () => {
    signInAs(employeeMe)
    const { location } = renderApp('/login')

    await waitFor(() => expect(location()).toBe('/dashboard'))
  })

  it('shows a retry when the server is unreachable', async () => {
    server.use(http.get(`${API}/me`, () => HttpResponse.json(apiError('internal', 'Boom'), { status: 500 })))
    const { user } = renderApp('/dashboard')

    expect(await screen.findByText("We couldn't reach the server.")).toBeInTheDocument()
    signInAs(employeeMe)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: /Anu/ })).toBeInTheDocument()
  })
})

describe('sign out and expired sessions', () => {
  it('signs out from the user menu', async () => {
    signInAs(hrMe)
    server.use(http.delete(`${API}/session`, () => {
      server.use(http.get(`${API}/me`, () => HttpResponse.json(apiError('unauthenticated', 'x'), { status: 401 })))
      return new HttpResponse(null, { status: 204 })
    }))
    const { user, location } = renderApp('/dashboard')

    await user.click(await screen.findByRole('button', { name: /Hema Rao/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(location()).toBe('/login')
  })

  it('sends the user to /login when the session expires mid-use', async () => {
    signInAs(hrMe)
    server.use(http.get(`${API}/employees`, () => HttpResponse.json(apiError('unauthenticated', 'x'), { status: 401 })))
    const { location } = renderApp('/dashboard?q=pri')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(location()).toBe('/login?next=%2Fdashboard%3Fq%3Dpri')
  })
})

describe('password reset', () => {
  it('always shows the same message after requesting a link', async () => {
    let sent: unknown
    server.use(http.post(`${API}/passwords`, async ({ request }) => {
      sent = await request.json()
      return new HttpResponse(null, { status: 202 })
    }))
    const { user } = renderApp('/login')

    await user.click(await screen.findByRole('link', { name: 'Forgot password?' }))
    await user.type(screen.getByLabelText('Work email'), 'anyone@acme.example')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText(/If an account exists for that email/)).toBeInTheDocument()
    expect(sent).toEqual({ email_address: 'anyone@acme.example' })
  })

  it('explains rate limiting on reset requests', async () => {
    server.use(http.post(`${API}/passwords`, () => HttpResponse.json(apiError('rate_limited', 'x'), { status: 429 })))
    const { user } = renderApp('/forgot-password')

    await user.type(await screen.findByLabelText('Work email'), 'anyone@acme.example')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Too many requests. Try again later.')).toBeInTheDocument()
  })

  it('sets a new password and returns to sign in', async () => {
    let sent: unknown
    server.use(http.put(`${API}/passwords/tok123`, async ({ request }) => {
      sent = await request.json()
      return new HttpResponse(null, { status: 204 })
    }))
    const { user, location } = renderApp('/reset-password/tok123')

    await user.type(await screen.findByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('Confirm new password'), 'different')
    await user.click(screen.getByRole('button', { name: 'Set password' }))
    expect(await screen.findByText('Use at least 12 characters')).toBeInTheDocument()
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument()

    await user.clear(screen.getByLabelText('New password'))
    await user.type(screen.getByLabelText('New password'), 'a-much-longer-password')
    await user.clear(screen.getByLabelText('Confirm new password'))
    await user.type(screen.getByLabelText('Confirm new password'), 'a-much-longer-password')
    await user.click(screen.getByRole('button', { name: 'Set password' }))

    expect(await screen.findByText('Password updated. Sign in with your new password.')).toBeInTheDocument()
    expect(location()).toBe('/login?reset=1')
    expect(sent).toEqual({ password: 'a-much-longer-password' })
  })

  it('explains an expired link', async () => {
    server.use(http.put(`${API}/passwords/old`, () =>
      HttpResponse.json(apiError('invalid_token', 'This reset link is invalid or has expired'), { status: 422 })))
    const { user } = renderApp('/reset-password/old')

    await user.type(await screen.findByLabelText('New password'), 'a-much-longer-password')
    await user.type(screen.getByLabelText('Confirm new password'), 'a-much-longer-password')
    await user.click(screen.getByRole('button', { name: 'Set password' }))

    expect(await screen.findByText('This reset link is invalid or has expired.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Send a new link' })).toHaveAttribute('href', '/forgot-password')
  })

  it('shows a server-side password error under the field', async () => {
    server.use(http.put(`${API}/passwords/tok`, () =>
      HttpResponse.json(apiError('validation_failed', 'Validation failed', { password: ['is too common'] }), { status: 422 })))
    const { user } = renderApp('/reset-password/tok')

    await user.type(await screen.findByLabelText('New password'), 'password1234')
    await user.type(screen.getByLabelText('Confirm new password'), 'password1234')
    await user.click(screen.getByRole('button', { name: 'Set password' }))

    expect(await screen.findByText('is too common')).toBeInTheDocument()
  })
})

it('shows a not-found page for unknown routes', async () => {
  renderApp('/nope')
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
})
