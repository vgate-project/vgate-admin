import http from './http'
import type { Order, Page, AdminCreateOrderRequest } from '@/types/api'

export const apiOrders = {
  // All orders (admin), paginated.
  list: (page = 1, pageSize = 20) =>
    http.get<Page<Order>>('/admin/orders', { params: { page, page_size: pageSize } }),
  get: (id: string) => http.get<Order>(`/admin/orders/${id}`),
  // Admin creates an order on behalf of a user; returns { order, pay_url }.
  createForUser: (b: AdminCreateOrderRequest) =>
    http.post<{ order: Order; pay_url: string }>('/admin/orders', b),
}
