import http from './http'
import type { OverviewStats } from '@/types/api'

export const apiStats = {
  overview: () => http.get<OverviewStats>('/admin/stats/overview'),
}
