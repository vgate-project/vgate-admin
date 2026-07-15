import http from './http'
import type { Node, NodeWithToken, NodeRequest, RealityKeyResponse, User, Page } from '@/types/api'

export const apiNodes = {
  list: (page = 1, pageSize = 20, type: 'all' | 'real' | 'virtual' = 'all') =>
    http.get<Page<Node>>('/admin/nodes', { params: { page, page_size: pageSize, type } }),
  create: (b: NodeRequest) => http.post<NodeWithToken>('/admin/nodes', b),
  get: (id: string) => http.get<Node>(`/admin/nodes/${id}`),
  update: (id: string, b: NodeRequest) => http.put<Node>(`/admin/nodes/${id}`, b),
  remove: (id: string) => http.delete(`/admin/nodes/${id}`),
  regenerateToken: (id: string) => http.post<{ token: string }>(`/admin/nodes/${id}/regenerate-token`),
  generateX25519Key: () =>
    http.post<RealityKeyResponse>("/admin/utils/generate-x25519"),
  users: (id: string, page = 1, pageSize = 20) =>
    http.get<Page<User>>(`/admin/nodes/${id}/users`, { params: { page, page_size: pageSize } }),
}
