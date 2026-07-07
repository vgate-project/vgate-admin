import { defineStore } from 'pinia'

import { apiAuth } from '@/api/auth'
import { decodeJwtPayload } from '@/utils/jwt'
import type { AdminLoginResponse, JwtClaims } from '@/types/auth'

export const AUTH_STORAGE_KEY = 'vgate_admin_auth'

interface StoredSession {
  token: string
  refresh_token: string
  expires_at: string
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    refreshToken: '' as string,
    expiresAt: '' as string,
    username: '' as string,
    role: '' as '' | 'admin' | 'super_admin',
  }),
  getters: {
    isAuthenticated: (s) => !!s.token,
    isSuperAdmin: (s) => s.role === 'super_admin',
  },
  actions: {
    async login(username: string, password: string, captchaToken?: string) {
      const { data } = await apiAuth.login({
        username,
        password,
        cf_turnstile_response: captchaToken,
      })
      this.setSession(data)
    },
    // refresh() is invoked by the http interceptor on 401. It uses the stored
    // refresh_token; the backend does not rotate it.
    async refresh() {
      const { data } = await apiAuth.refresh({ refresh_token: this.refreshToken })
      this.token = data.token
      this.expiresAt = data.expires_at
      this.applyClaims(data.token)
      this.persist()
    },
    logout() {
      this.token = ''
      this.refreshToken = ''
      this.expiresAt = ''
      this.username = ''
      this.role = ''
      localStorage.removeItem(AUTH_STORAGE_KEY)
    },
    // hydrate() loads any saved session on app boot.
    hydrate() {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!raw) return
      try {
        const s: StoredSession = JSON.parse(raw)
        this.token = s.token
        this.refreshToken = s.refresh_token
        this.expiresAt = s.expires_at
        this.applyClaims(s.token)
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    },
    setSession(data: AdminLoginResponse) {
      this.token = data.token
      this.refreshToken = data.refresh_token
      this.expiresAt = data.expires_at
      this.applyClaims(data.token)
      this.persist()
    },
    applyClaims(token: string) {
      const c = decodeJwtPayload<JwtClaims>(token)
      this.username = c.username ?? ''
      this.role = c.role ?? ''
    },
    persist() {
      const s: StoredSession = {
        token: this.token,
        refresh_token: this.refreshToken,
        expires_at: this.expiresAt,
      }
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(s))
    },
  },
})
