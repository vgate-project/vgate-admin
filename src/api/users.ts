import http from './http'
import type { User, UserWithSubToken, UserRequest, Node, Page } from '@/types/api'

export const apiUsers = {
  list: (page = 1, pageSize = 20) =>
    http.get<Page<User>>('/admin/users', { params: { page, page_size: pageSize } }),
  create: (b: UserRequest) => http.post<UserWithSubToken>('/admin/users', b),
  get: (id: string) => http.get<User>(`/admin/users/${id}`),
  update: (id: string, b: UserRequest) => http.put<User>(`/admin/users/${id}`, b),
  remove: (id: string) => http.delete(`/admin/users/${id}`),
  regenerateSubToken: (id: string) =>
    http.post<{ sub_token: string }>(`/admin/users/${id}/regenerate-sub-token`),
  regenerateCredential: (id: string) =>
    http.post<{ credential: string }>(`/admin/users/${id}/regenerate-credential`),
  setPassword: (id: string, password: string) =>
    http.put(`/admin/users/${id}/password`, { password }),
  nodes: (id: string) => http.get<Node[]>(`/admin/users/${id}/nodes`),
  setNodes: (id: string, nodeIds: string[]) =>
    http.put(`/admin/users/${id}/nodes`, { node_ids: nodeIds }),
}
