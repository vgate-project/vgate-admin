import http from './http'
import type { TrafficRecord } from '@/types/wire'
import type { Page, TrafficPackage, TrafficPackageRequest } from '@/types/api'

export const apiTraffic = {
  // range is a local [start of day, end of day] pair; sent as RFC3339 bounds
  // (from inclusive, to exclusive on the hour bucket — the +1h nudge keeps
  // the last hour of the picked day inside the range).
  list: (userId?: string, nodeId?: string, range?: [Date, Date] | null, page = 1, pageSize = 20) => {
    const params: Record<string, string | number> = { page, page_size: pageSize }
    if (userId) params.user_id = userId
    if (nodeId) params.node_id = nodeId
    if (range?.[0]) params.from = range[0].toISOString()
    if (range?.[1]) params.to = new Date(range[1].getTime() + 3600_000).toISOString()
    return http.get<Page<TrafficRecord>>('/admin/traffic', { params })
  },
}

export const apiTrafficPackages = {
  // All traffic packages including disabled (admin view).
  list: () => http.get<TrafficPackage[]>('/admin/traffic-packages'),
  get: (id: string) => http.get<TrafficPackage>(`/admin/traffic-packages/${id}`),
  create: (b: TrafficPackageRequest) => http.post<TrafficPackage>('/admin/traffic-packages', b),
  update: (id: string, b: TrafficPackageRequest) => http.put<TrafficPackage>(`/admin/traffic-packages/${id}`, b),
  remove: (id: string) => http.delete(`/admin/traffic-packages/${id}`),
}
