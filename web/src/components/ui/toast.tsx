import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ToastContext, type ShowToast, type Toast } from './toastContext'

/** Global, short-lived messages (e.g. "Hired Priya as E000123"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])
  const show = useCallback<ShowToast>((toast) => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { ...toast, id }])
    // Warnings stay until dismissed; they usually need reading.
    if (toast.tone === 'success') setTimeout(() => dismiss(id), 6000)
  }, [dismiss])
  const value = useMemo(() => show, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`} role="status">
            <div>
              <strong>{toast.title}</strong>
              {toast.details && <ul>{toast.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
            </div>
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
