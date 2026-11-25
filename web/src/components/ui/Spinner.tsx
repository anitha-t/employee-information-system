export function Spinner({ size = 'medium', label }: { size?: 'small' | 'medium'; label?: string }) {
  return (
    <span className={`spinner spinner-${size}`} role={label ? 'status' : undefined} aria-label={label}>
      <span className="visually-hidden">{label}</span>
    </span>
  )
}

export function PageSpinner() {
  return (
    <div className="page-spinner">
      <Spinner label="Loading" />
    </div>
  )
}
