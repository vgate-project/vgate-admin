import http from './http'
import type { TrafficAggregateRow, TrafficRecord, TrafficStats } from '@/types/wire'
import type { Page, TrafficPackage, TrafficPackageRequest } from '@/types/api'

// range is a local [start of day, end of day] pair; sent as RFC3339 bounds
// (from inclusive, to exclusive on the hour bucket — the +1h nudge keeps
// the last hour of the picked day inside the range). Shared by every
// /admin/traffic* endpoint so the table, chart and aggregations line up.
function rangeParams(userId?: string, nodeId?: string, range?: [Date, Date] | null) {
  const params: Record<string, string | number> = {}
  if (userId) params.user_id = userId
  if (nodeId) params.node_id = nodeId
  if (range?.[0]) params.from = range[0].toISOString()
  if (range?.[1]) params.to = new Date(range[1].getTime() + 3600_000).toISOString()
  return params
}

export const apiTraffic = {
  // GET /admin/traffic — hourly detail rows, paginated.
  list: (userId?: string, nodeId?: string, range?: [Date, Date] | null, page = 1, pageSize = 20) =>
    http.get<Page<TrafficRecord>>('/admin/traffic', {
      params: { page, page_size: pageSize, ...rangeParams(userId, nodeId, range) },
    }),

  // GET /admin/traffic/stats — totals, hour/day series and per-node breakdown
  // over the same filters (default last 24h when no range is picked).
  stats: (userId?: string, nodeId?: string, range?: [Date, Date] | null) =>
    http.get<TrafficStats>('/admin/traffic/stats', {
      params: rangeParams(userId, nodeId, range),
    }),

  // GET /admin/traffic/aggregate — usage summed per user or per node over the
  // same filters, sorted by total usage desc.
  aggregate: (
    groupBy: 'user' | 'node',
    userId?: string,
    nodeId?: string,
    range?: [Date, Date] | null,
    page = 1,
    pageSize = 20,
  ) =>
    http.get<Page<TrafficAggregateRow>>('/admin/traffic/aggregate', {
      params: { group_by: groupBy, page, page_size: pageSize, ...rangeParams(userId, nodeId, range) },
    }),

  // GET /admin/traffic/export — the filtered hourly detail rows as a CSV
  // download (UTF-8 with BOM, UTC hour stamps). Relaxed timeout: a wide range
  // can produce a large file.
  exportCsv: (userId?: string, nodeId?: string, range?: [Date, Date] | null) =>
    http.get<Blob>('/admin/traffic/export', {
      params: rangeParams(userId, nodeId, range),
      responseType: 'blob',
      timeout: 60_000,
    }),
}

export const apiTrafficPackages = {
  // All traffic packages including disabled (admin view).
  list: () => http.get<TrafficPackage[]>('/admin/traffic-packages'),
  get: (id: string) => http.get<TrafficPackage>(`/admin/traffic-packages/${id}`),
  create: (b: TrafficPackageRequest) => http.post<TrafficPackage>('/admin/traffic-packages', b),
  update: (id: string, b: TrafficPackageRequest) => http.put<TrafficPackage>(`/admin/traffic-packages/${id}`, b),
  remove: (id: string) => http.delete(`/admin/traffic-packages/${id}`),
}
