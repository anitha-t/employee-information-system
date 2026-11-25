import { Button } from './Button'

interface Props {
  page: number
  perPage: number
  totalCount: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, perPage, totalCount, onPageChange }: Props) {
  const pages = Math.max(1, Math.ceil(totalCount / perPage))
  const first = totalCount === 0 ? 0 : (page - 1) * perPage + 1
  const last = Math.min(page * perPage, totalCount)
  const number = new Intl.NumberFormat('en')

  return (
    <nav className="pagination" aria-label="Pagination">
      <span>Showing {number.format(first)}–{number.format(last)} of {number.format(totalCount)}</span>
      <div className="pagination-buttons">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
        <span aria-current="page">Page {page} of {number.format(pages)}</span>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</Button>
      </div>
    </nav>
  )
}
