import http from './http'
import type { SendEmailRequest } from '@/types/api'

export interface SendEmailResult {
  message: string
  sent: number
  total: number
  error?: string
}

export interface TestEmailRequest {
  to: string
  subject?: string
  body?: string
}

export interface TestEmailResult {
  ok: boolean
  message?: string
  error?: string
}

// Admin broadcast email to users (optionally persisted as an announcement).
export const apiEmail = {
  send: (b: SendEmailRequest) => http.post<SendEmailResult>('/admin/email/send', b),
  // Send a single test email to verify SMTP/Resend connectivity. Uses the
  // currently saved email configuration.
  test: (b: TestEmailRequest) => http.post<TestEmailResult>('/admin/email/test', b),
}
