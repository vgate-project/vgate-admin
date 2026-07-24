import { defineStore } from 'pinia'
import { apiReference } from '@/api/reference'
import type { User, Node, Plan, TrafficPackage, PaymentMethodInfo } from '@/types/api'

// Caches the static admin lookup lists (users, nodes, plans, traffic packages,
// payment methods) app-wide. Instead of each view/dialog re-fetching these on
// every mount/open, they read from this store and call refresh() only after a
// mutation. Concurrent calls share a single in-flight request.
let inflight: Promise<void> | null = null

export const useReferenceStore = defineStore('reference', {
  state: () => ({
    users: [] as User[],
    nodes: [] as Node[],
    plans: [] as Plan[],
    trafficPackages: [] as TrafficPackage[],
    paymentMethods: [] as PaymentMethodInfo[],
    loaded: false,
    loading: false,
  }),
  actions: {
    // Load once; subsequent calls are no-ops until refresh() invalidates.
    async get() {
      if (this.loaded || inflight) return inflight
      return this._fetch()
    },
    // Force a re-fetch after a mutation (plan/pkg/user/node create, update,
    // delete, or payment-method config change).
    async refresh() {
      this.loaded = false
      return this._fetch()
    },
    _fetch() {
      if (inflight) return inflight
      this.loading = true
      inflight = (async () => {
        const { data } = await apiReference.get()
        this.users = data.users.items
        this.nodes = data.nodes.items
        this.plans = data.plans
        this.trafficPackages = data.traffic_packages
        this.paymentMethods = data.payment_methods
        this.loaded = true
      })()
      const p = inflight
      p.then(
        () => {
          if (inflight === p) inflight = null
          this.loading = false
        },
        () => {
          if (inflight === p) inflight = null
          this.loading = false
        },
      )
      return p
    },
  },
})
