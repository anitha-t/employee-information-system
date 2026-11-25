# ?page=&per_page= pagination with meta {page, per_page, total_count}.
module Paginated
  DEFAULT_PER_PAGE = 50
  MAX_PER_PAGE = 100

  private

  def paginate(relation)
    page = [ params.fetch(:page, 1).to_i, 1 ].max
    per_page = params.fetch(:per_page, DEFAULT_PER_PAGE).to_i.clamp(1, MAX_PER_PAGE)
    records = relation.offset((page - 1) * per_page).limit(per_page)
    [ records, { page: page, per_page: per_page, total_count: relation.count } ]
  end
end
