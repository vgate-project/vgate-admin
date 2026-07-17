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
export interface TelegramStatus {
  bound: boolean
  notify?: boolean
  available?: boolean
}

export const apiTelegram = {
  broadcast: (b: TelegramBroadcastRequest) =>
    http.post<TelegramBroadcastResult>('/admin/telegram/broadcast', b),
  selfStatus: () => http.get<TelegramStatus>('/admin/me/telegram/status'),
  selfBind: () => http.post<{ code: string; deep_link: string; tg_link: string }>('/admin/me/telegram/bind'),
  selfUnbind: () => http.post<{ message: string }>('/admin/me/telegram/unbind'),
}
