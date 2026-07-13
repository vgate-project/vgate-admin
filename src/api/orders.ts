import http from './http'
import type { Order, OrderStatus, Page, AdminCreateOrderRequest } from '@/types/api'

export interface OrderListParams {
  search?: string
  status?: '' | OrderStatus
  sort_by?: string
  order?: 'asc' | 'desc'
}

export const apiOrders = {
  // All orders (admin), paginated, with optional server-side filter/sort.
  list: (page = 1, pageSize = 20, params: OrderListParams = {}) => {
    const query: Record<string, unknown> = { page, page_size: pageSize }
    if (params.search) query.search = params.search
    if (params.status) query.status = params.status
    if (params.sort_by) query.sort_by = params.sort_by
    if (params.order) query.order = params.order
    return http.get<Page<Order>>('/admin/orders', { params: query })
  },
  get: (id: string) => http.get<Order>(`/admin/orders/${id}`),
  // Admin creates an order on behalf of a user; returns { order, pay_url }.
  createForUser: (b: AdminCreateOrderRequest) =>
    http.post<{ order: Order; pay_url: string }>('/admin/orders', b),
}
