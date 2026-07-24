import http from './http'
import type { PaymentMethodInfo } from '@/types/api'

export const apiPayment = {
  // GET /admin/payment-methods — admin view of enabled/configured channels.
  getMethods: () => http.get<PaymentMethodInfo[]>('/admin/payment-methods'),
}
