import { useEffect, useState } from 'react'

interface Props {
  value: string
  /** Called 300 ms after the user stops typing. */
  onSearch: (value: string) => void
  delay?: number
}

export function EmployeeSearchBar({ value, onSearch, delay = 300 }: Props) {
  const [text, setText] = useState(value)
  const [lastValue, setLastValue] = useState(value)

  // The URL changed from outside (back button, "Clear filters"): show it.
  if (value !== lastValue) {
    setLastValue(value)
    setText(value)
  }

  useEffect(() => {
    if (text.trim() === value) return
    const timer = setTimeout(() => onSearch(text.trim()), delay)
    return () => clearTimeout(timer)
  }, [text, value, onSearch, delay])

  return (
    <div className="search-bar">
      <label htmlFor="employee-search" className="visually-hidden">Search employees</label>
      <input id="employee-search" type="search" value={text} placeholder="Search name, employee number or work email…"
        autoComplete="off" onChange={(event) => setText(event.target.value)} />
    </div>
  )
}
