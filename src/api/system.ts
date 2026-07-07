import http from './http'

export const apiSystem = {
  get: () => http.get<Record<string, string>>('/admin/system-config'),
  update: (values: Record<string, string>) =>
    http.put<Record<string, string>>('/admin/system-config', values),
}
