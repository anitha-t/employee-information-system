import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { apiError, employeeMe, hrMe, profile } from '../test/fixtures'
import { renderApp } from '../test/render'
import { API, server, signInAs } from '../test/server'

type Body = Record<string, unknown>

/** Accepts PATCH /me/profile, records the body and returns the saved profile. */
function acceptSave(path = `${API}/me/profile`) {
  const bodies: Body[] = []
  server.use(http.patch(path, async ({ request }) => {
    const body = await request.json() as Body
    bodies.push(body)
    return HttpResponse.json({ ...profile, lock_version: profile.lock_version + 1, preferred_name: body.preferred_name ?? null })
  }))
  return bodies
}

describe('edit my profile', () => {
  it('lets an employee change contact details, addresses and contacts, but not legal details', async () => {
    signInAs(employeeMe)
    const bodies = acceptSave()
    const { user, location } = renderApp('/dashboard')

    await user.click(await screen.findByRole('link', { name: 'Edit profile' }))
    expect(await screen.findByLabelText(/First name/)).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Gender')).toHaveValue('Female')

    const preferred = screen.getByLabelText('Preferred name')
    await user.clear(preferred)
    await user.type(preferred, 'Priya')
    await user.click(screen.getByRole('button', { name: '+ Add address' }))
    const added = screen.getByRole('group', { name: 'Address 2' })
    await user.selectOptions(within(added).getByLabelText(/Type/), 'Mailing')
    await user.type(within(added).getByLabelText(/Line 1/), 'PO Box 9')
    await user.type(within(added).getByLabelText(/City/), 'Bengaluru')
    expect(within(added).getByLabelText(/Country/)).toHaveValue('c-in') // preselected from the home address
    await user.click(screen.getByRole('button', { name: '+ Add contact' }))
    const contact = screen.getByRole('group', { name: 'Contact 2' })
    await user.type(within(contact).getByLabelText(/Name/), 'Meena')
    await user.type(within(contact).getByLabelText(/Phone/), '+911123456789')
    await user.click(within(contact).getByLabelText('Primary contact'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
    expect(location()).toBe('/profile')
    expect(bodies).toEqual([{
      lock_version: 3, preferred_name: 'Priya', email: 'anu@example.com', phone_number: '+919800000000',
      addresses: [
        { id: 'a1', address_type: 'home', line1: '12 MG Road', line2: null, city: 'Bengaluru', state: 'KA', postal_code: '560001', country_id: 'c-in' },
        { address_type: 'mailing', line1: 'PO Box 9', line2: null, city: 'Bengaluru', state: null, postal_code: null, country_id: 'c-in' },
      ],
      emergency_contacts: [
        { id: 'ec1', name: 'Ravi', relationship: 'spouse', phone_number: '+919811111111', is_primary: false },
        { name: 'Meena', relationship: null, phone_number: '+911123456789', is_primary: true },
      ],
    }])
  })

  it('removes rows with _destroy and lets HR edit their own legal details', async () => {
    signInAs(hrMe)
    const bodies = acceptSave()
    const { user } = renderApp('/profile/edit')

    const lastName = await screen.findByLabelText('Last name')
    expect(lastName).not.toHaveAttribute('readonly')
    await user.clear(lastName)
    await user.type(lastName, 'Rao')
    await user.click(screen.getByRole('button', { name: 'Remove address 1' }))
    await user.click(screen.getByRole('button', { name: 'Remove contact 1' }))
    expect(screen.getByText('No addresses yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toMatchObject({
      first_name: 'Priya', last_name: 'Rao', dob: '1990-05-01', gender: 'female',
      addresses: [{ id: 'a1', _destroy: true }], emergency_contacts: [{ id: 'ec1', _destroy: true }],
    })
  })

  it('validates on the client', async () => {
    signInAs(employeeMe)
    const { user } = renderApp('/profile/edit')

    const phone = await screen.findByLabelText('Phone', { selector: 'input[autocomplete="tel"]' })
    await user.clear(phone)
    await user.type(phone, '98000')
    await user.clear(screen.getByLabelText(/Line 1/))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Use international format, e.g. +919800000000')).toBeInTheDocument()
    expect(screen.getByText('Enter the first line')).toBeInTheDocument()
  })

  it('shows server errors on the row they belong to', async () => {
    signInAs(employeeMe)
    server.use(http.patch(`${API}/me/profile`, () => HttpResponse.json(apiError('validation_failed', 'Validation failed', {
      'addresses[0].postal_code': ['is invalid'],
      emergency_contacts: ['can have only one primary contact'],
    }), { status: 422 })))
    const { user } = renderApp('/profile/edit')

    await user.click(await screen.findByRole('button', { name: 'Save' }))

    const address = await screen.findByRole('group', { name: 'Address 1' })
    expect(await within(address).findByText('is invalid')).toBeInTheDocument()
    expect(screen.getByText('Emergency contacts can have only one primary contact')).toBeInTheDocument()
  })

  it('offers a reload when someone else saved first', async () => {
    signInAs(employeeMe)
    server.use(http.patch(`${API}/me/profile`, () => HttpResponse.json(apiError('stale_object', 'Changed'), { status: 409 })))
    const { user } = renderApp('/profile/edit')

    const preferred = await screen.findByLabelText('Preferred name')
    await user.clear(preferred)
    await user.type(preferred, 'Mine')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/Someone else changed this profile/)).toBeInTheDocument()

    server.use(http.get(`${API}/me/profile`, () => HttpResponse.json({ ...profile, lock_version: 7, preferred_name: 'Theirs' })))
    await user.click(screen.getByRole('button', { name: /Reload their changes/ }))

    await waitFor(() => expect(screen.getByLabelText('Preferred name')).toHaveValue('Theirs'))
    expect(screen.queryByText(/Someone else changed this profile/)).not.toBeInTheDocument()
  })

  it('asks before discarding changes', async () => {
    signInAs(employeeMe)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user, location } = renderApp('/profile/edit')

    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(confirm).not.toHaveBeenCalled() // nothing changed
    await waitFor(() => expect(location()).toBe('/profile'))
  })
})
