import http from './http'
import type { AdminLoginResponse, AdminConfig, RefreshResponse } from '@/types/auth'

export const apiAuth = {
  // GET /admin/config — public login-page settings (no auth). Currently the
  // captcha knobs, so the SPA can decide whether to render Turnstile.
  getConfig: () => http.get<AdminConfig>('/admin/config'),
  // POST /admin/login — username/password → JWT. cf_turnstile_response is
  // required by the backend only when captcha is enabled.
  login: (body: { username: string; password: string; cf_turnstile_response?: string }) =>
    http.post<AdminLoginResponse>('/admin/login', body),
  refresh: (body: { refresh_token: string }) =>
    http.post<RefreshResponse>('/admin/refresh', body),
  changePassword: (body: { old_password: string; new_password: string }) =>
    http.post('/admin/change-password', body),
}
