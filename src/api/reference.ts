import http from './http'
import type { AdminReference } from '@/types/api'

export const apiReference = {
  // GET /admin/reference — static lookup lists reused across admin views and
  // dialogs. The SPA caches this app-wide (see stores/reference) and only
  // re-fetches after a mutation.
  get: () => http.get<AdminReference>('/admin/reference'),
}
