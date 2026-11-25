import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { label } from '../../lib/format'
import type { Me } from '../../types/me'

interface Props {
  me: Me
  onSignOut: () => void
  signingOut: boolean
}

export function UserMenu({ me, onSignOut, signingOut }: Props) {
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="user-menu" ref={menu}>
      <button type="button" className="user-menu-button" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>
        <span>{me.person.displayName}</span>
        <span className="badge">{label('role', me.user.role)}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="user-menu-list" role="menu">
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)}>My profile</Link>
          <button role="menuitem" type="button" onClick={onSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
