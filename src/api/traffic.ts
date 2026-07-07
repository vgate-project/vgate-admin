import http from './http'
import type { TrafficRow } from '@/types/wire'
import type { Page, TrafficPackage, TrafficPackageRequest } from '@/types/api'

export const apiTraffic = {
  list: (userId?: string, nodeId?: string, page = 1, pageSize = 20) => {
    const params: Record<string, string | number> = { page, page_size: pageSize }
    if (userId) params.user_id = userId
    if (nodeId) params.node_id = nodeId
    return http.get<Page<TrafficRow>>('/admin/traffic', { params })
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
