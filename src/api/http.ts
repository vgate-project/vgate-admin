import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosError,
} from 'axios'
import type { Router } from 'vue-router'
import { ElMessage } from 'element-plus'

import { useAuthStore } from '@/stores/auth'
import { extractApiError } from '@/utils/error'

const STORAGE_KEY = 'vgate_admin_auth'

// Use the runtime-configured API base URL (see public/env.js) when provided;
// otherwise fall back to the relative "/api/v1" (dev proxy / same-origin).
const http: AxiosInstance = axios.create({
  baseURL: window.__ENV__?.API_BASE_URL || '/api/v1',
  timeout: 15000,
})

// Router is bound after creation (setRouter) to avoid a http→router→views→api
// import cycle. The interceptor uses it for auth-failure redirects.
let router: Router | null = null
export function setRouter(r: Router) {
  router = r
}

let isRefreshing = false
let pending: Array<(token: string) => void> = []

// Request interceptor: attach the bearer token from localStorage (avoids a
// store call per request and the import cycle).
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const sess = JSON.parse(raw)
      if (sess.token) config.headers.Authorization = `Bearer ${sess.token}`
    } catch {
      /* ignore malformed session */
    }
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
    const url = config?.url ?? ''

    const auth = useAuthStore()

    // 401 on /admin/refresh itself → session is dead, no retry.
    if (status === 401 && url.includes('/admin/refresh')) {
      auth.logout()
      router?.push({ name: 'login' })
      return Promise.reject(error)
    }

    // 401 elsewhere → refresh once, then retry the original request. Concurrent
    // 401s queue until the refresh completes.
    if (status === 401 && config && !config._retried && auth.refreshToken) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pending.push((token) => {
            config.headers.Authorization = `Bearer ${token}`
            config._retried = true
            http(config).then(resolve).catch(reject)
          })
        })
      }
      isRefreshing = true
      try {
        await auth.refresh()
        const token = auth.token
        isRefreshing = false
        pending.forEach((cb) => cb(token))
        pending = []
        config.headers.Authorization = `Bearer ${token}`
        config._retried = true
        return http(config)
      } catch {
        isRefreshing = false
        pending = []
        auth.logout()
        router?.push({ name: 'login' })
        return Promise.reject(error)
      }
    }

    // 403 → forbidden; bounce to dashboard unless already there.
    if (status === 403) {
      ElMessage.error(extractApiError(error))
      if (router && router.currentRoute.value.name !== 'dashboard') {
        router.push({ name: 'dashboard' })
      }
      return Promise.reject(error)
    }

    // Everything else (400/404/409/429/500…) → toast the backend message.
    ElMessage.error(extractApiError(error))
    return Promise.reject(error)
  },
)

export default http
