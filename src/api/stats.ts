import http from './http'
import type { OverviewStats } from '@/types/api'

export const apiStats = {
  // nodeId narrows the traffic series / 24h totals to one entry point (real
  // node or virtual child); omit it for all-node totals.
  overview: (nodeId?: string) =>
    http.get<OverviewStats>('/admin/stats/overview', { params: nodeId ? { node_id: nodeId } : {} }),
}
