import http from './http'
import type { Plan, PlanRequest } from '@/types/api'

export const apiPlans = {
  // All plans including disabled (admin view).
  list: () => http.get<Plan[]>('/admin/plans'),
  get: (id: string) => http.get<Plan>(`/admin/plans/${id}`),
  create: (b: PlanRequest) => http.post<Plan>('/admin/plans', b),
  update: (id: string, b: PlanRequest) => http.put<Plan>(`/admin/plans/${id}`, b),
  remove: (id: string) => http.delete(`/admin/plans/${id}`),
}
