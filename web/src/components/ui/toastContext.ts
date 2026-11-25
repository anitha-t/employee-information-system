import { createContext, useContext } from 'react'

export interface Toast {
  id: number
  tone: 'success' | 'warning' | 'error'
  title: string
  details?: string[]
}

export type ShowToast = (toast: Omit<Toast, 'id'>) => void

export const ToastContext = createContext<ShowToast | null>(null)

export function useToast(): ShowToast {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside <ToastProvider>')
  return show
}
