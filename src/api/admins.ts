import http from './http'
import type { Admin, Page } from '@/types/api'

export const apiAdmins = {
  list: (page = 1, pageSize = 20) =>
    http.get<Page<Admin>>('/admin/admins', { params: { page, page_size: pageSize } }),
  create: (body: { username: string; password: string; role?: string }) =>
    http.post<Admin>('/admin/admins', body),
  updatePassword: (id: number, password: string) =>
    http.put(`/admin/admins/${id}/password`, { password }),
}
