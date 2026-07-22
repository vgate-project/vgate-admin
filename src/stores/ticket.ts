import { defineStore } from 'pinia'
import { apiTickets } from '@/api/tickets'

// Tracks how many tickets have an unread user reply, powering the red dot on
// the Tickets sidebar item. The read state is global across all admins.
export const useTicketStore = defineStore('ticket', {
  state: () => ({
    unreadCount: 0 as number,
  }),
  actions: {
    async refresh() {
      try {
        const { data } = await apiTickets.unread()
        this.unreadCount = data.count
      } catch {
        /* non-fatal: a transient failure must not break the app shell */
      }
    },
  },
})
