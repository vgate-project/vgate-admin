import http from './http'
import type { RedemptionCode, GenerateRedemptionRequest, RedemptionRecord, Page } from '@/types/api'

// Admin-side redemption code management (batch-generate / list / delete / records).
export const apiRedemption = {
  list: (page = 1, pageSize = 20) =>
    http.get<Page<RedemptionCode>>('/admin/redemption-codes', { params: { page, page_size: pageSize } }),
  generate: (b: GenerateRedemptionRequest) =>
    http.post<RedemptionCode[]>('/admin/redemption-codes', b),
  remove: (id: string) => http.delete(`/admin/redemption-codes/${id}`),
  records: (id: string) =>
    http.get<{ items: RedemptionRecord[]; total: number }>(`/admin/redemption-codes/${id}/records`),
}
