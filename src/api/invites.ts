import http from './http'
import type { InviteCode, InviteRequest, InviteStatus, Page } from '@/types/api'

// Admin-side invite management (no quota; mint / list / delete any code).
export const apiInvites = {
  list: (page = 1, pageSize = 20) =>
    http.get<Page<InviteCode>>('/admin/invites', { params: { page, page_size: pageSize } }),
  create: (b: InviteRequest) => http.post<InviteCode>('/admin/invites', b),
  remove: (id: string) => http.delete(`/admin/invites/${id}`),
}
