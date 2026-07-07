import http from './http'
import type { Announcement, AnnouncementRequest, Page } from '@/types/api'

// Admin-side announcement CRUD.
export const apiAnnouncements = {
  list: (page = 1, pageSize = 20) =>
    http.get<Page<Announcement>>('/admin/announcements', { params: { page, page_size: pageSize } }),
  create: (b: AnnouncementRequest) => http.post<Announcement>('/admin/announcements', b),
  update: (id: string, b: AnnouncementRequest) => http.put<Announcement>(`/admin/announcements/${id}`, b),
  remove: (id: string) => http.delete(`/admin/announcements/${id}`),
}
