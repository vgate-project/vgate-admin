export interface AdminLoginResponse {
  token: string
  refresh_token: string
  expires_at: string
}

// AdminConfig mirrors dto.AdminConfigResponse (manager/internal/api/dto/admin.go).
// Public, unauthenticated settings consumed by the admin login page.
export interface AdminConfig {
  captcha_enabled: boolean
  captcha_site_key: string
  site_name: string
}

export interface RefreshResponse {
  token: string
  expires_at: string
}

// JwtClaims mirrors the manager's service.Claims (HS256, type=admin|user).
export interface JwtClaims {
  type?: 'admin' | 'user'
  admin_id?: number
  username?: string
  role?: 'super_admin' | 'admin'
  user_id?: string
  exp?: number
  iat?: number
}
