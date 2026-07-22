import http from './http'
import type { User, UserWithSubToken, UserRequest, Node, Page } from '@/types/api'

export interface UserListParams {
  search?: string
  enabled?: '' | 'true' | 'false'
  sort_by?: string
  order?: 'asc' | 'desc'
}

// ZombieFilter mirrors dto.ZombieFilterRequest on the backend. A user is a
// zombie only if it satisfies every selected criterion.
export interface ZombieFilter {
  never_used_proxy: boolean
  email_unverified: boolean
  no_paid_orders: boolean
  inactive_days: number // 0 disables the inactivity criterion
  min_account_days: number // 0 disables the guard; protects new signups
  protect_active_subs: boolean // never delete users with an unexpired subscription
}

export const apiUsers = {
  list: (page = 1, pageSize = 20, params: UserListParams = {}) => {
    const query: Record<string, unknown> = { page, page_size: pageSize }
    if (params.search) query.search = params.search
    if (params.enabled !== undefined && params.enabled !== '') query.enabled = params.enabled
    if (params.sort_by) query.sort_by = params.sort_by
    if (params.order) query.order = params.order
    return http.get<Page<User>>('/admin/users', { params: query })
  },
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
  previewZombies: (f: ZombieFilter) =>
    http.post<{ count: number }>('/admin/users/zombies/preview', f),
  cleanupZombies: (f: ZombieFilter) =>
    http.post<{ deleted: number }>('/admin/users/zombies/cleanup', f),
}
