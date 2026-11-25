# ?page=&per_page= pagination with meta {page, per_page, total_count}.
# Requires QueryParams (included by Api::V1::BaseController).
module Paginated
  DEFAULT_PER_PAGE = 50
  MAX_PER_PAGE = 100

  private

  def paginate(relation)
    page = [ integer_param(:page, default: 1), 1 ].max
    per_page = integer_param(:per_page, default: DEFAULT_PER_PAGE).clamp(1, MAX_PER_PAGE)
    records = relation.offset((page - 1) * per_page).limit(per_page)
    [ records, { page: page, per_page: per_page, total_count: relation.unscope(:order).count } ]
  end
end
