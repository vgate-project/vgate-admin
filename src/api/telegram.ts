import http from './http'

export interface TelegramBroadcastRequest {
  message: string
  create_announcement?: boolean
  title?: string
  pinned?: boolean
}

export interface TelegramBroadcastResult {
  message: string
  sent?: number
  total?: number
}

// Admin Telegram broadcast (free-form message or announcement).
export const apiTelegram = {
  broadcast: (b: TelegramBroadcastRequest) =>
    http.post<TelegramBroadcastResult>('/admin/telegram/broadcast', b),
}
