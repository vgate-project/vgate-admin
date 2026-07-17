import http from './http'
import type { Ticket, TicketDetail, Page, TicketStatus, TicketPriority } from '@/types/api'

// Admin-side ticket operations: list all tickets, view a thread, reply as an
// admin (notifies the user), and change status.
export const apiTickets = {
  list: (params: { status?: TicketStatus; q?: string; page?: number; page_size?: number }) =>
    http.get<Page<Ticket>>('/admin/tickets', { params }),
  get: (id: string) => http.get<TicketDetail>(`/admin/tickets/${id}`),
  reply: (id: string, content: string) =>
    http.post<Ticket>(`/admin/tickets/${id}/messages`, { content }),
  setStatus: (id: string, status: TicketStatus) =>
    http.put<Ticket>(`/admin/tickets/${id}/status`, { status }),
}

export type { TicketPriority }
