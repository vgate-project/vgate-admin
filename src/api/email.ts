import http from './http'
import type { SendEmailRequest } from '@/types/api'

export interface SendEmailResult {
  message: string
  sent: number
  total: number
  error?: string
}

// Admin broadcast email to users (optionally persisted as an announcement).
export const apiEmail = {
  send: (b: SendEmailRequest) => http.post<SendEmailResult>('/admin/email/send', b),
}
