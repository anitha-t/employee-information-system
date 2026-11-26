export function ReportSkeleton() {
  return (
    <div className="card-grid" aria-busy="true" aria-label="Loading report">
      {[0, 1, 2].map((index) => <div key={index} className="card skeleton-card"><span className="skeleton" /></div>)}
    </div>
  )
}
