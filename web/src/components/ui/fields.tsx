import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface FieldProps {
  label: string
  error?: string
  hint?: ReactNode
  required?: boolean
}

function FieldFrame({ id, label, error, hint, required, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="required" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <div className="field-hint" id={`${id}-hint`}>{hint}</div>}
      {error && <div className="field-error" id={`${id}-error`} role="alert">{error}</div>}
    </div>
  )
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  if (error) return `${id}-error`
  return hint ? `${id}-hint` : undefined
}

type InputProps = FieldProps & InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }

/** A labelled input. Spread React Hook Form's register() into it. */
export function TextField({ label, error, hint, required, ...input }: InputProps) {
  const id = useId()
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint} required={required}>
      <input id={id} aria-invalid={error ? true : undefined} aria-required={required || undefined}
        aria-describedby={describedBy(id, error, hint)} {...input} />
    </FieldFrame>
  )
}

type SelectProps = FieldProps & SelectHTMLAttributes<HTMLSelectElement> & {
  ref?: Ref<HTMLSelectElement>
  options: { value: string; label: string }[]
  placeholder?: string
}

export function SelectField({ label, error, hint, required, options, placeholder, ...select }: SelectProps) {
  const id = useId()
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint} required={required}>
      <select id={id} aria-invalid={error ? true : undefined} aria-required={required || undefined}
        aria-describedby={describedBy(id, error, hint)} {...select}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </FieldFrame>
  )
}

type TextAreaProps = FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }

export function TextAreaField({ label, error, hint, required, ...textarea }: TextAreaProps) {
  const id = useId()
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint} required={required}>
      <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...textarea} />
    </FieldFrame>
  )
}
