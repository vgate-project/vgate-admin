import { defineStore } from 'pinia'
import { apiAuth } from '@/api/auth'

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebarCollapsed: false as boolean,
    siteName: 'VGate' as string,
    configLoaded: false as boolean,
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    // Loads the configured site name from the public admin config endpoint.
    // Falls back to "VGate" on any failure so the UI always has a label.
    // Cached: repeated calls are no-ops unless the first load failed.
    async loadSiteName() {
      if (this.configLoaded) return
      try {
        const { data } = await apiAuth.getConfig()
        this.siteName = data.site_name || 'VGate'
        this.configLoaded = true
      } catch {
        this.siteName = 'VGate'
        // Leave configLoaded false so a later call can retry.
      }
    },
  },
})
