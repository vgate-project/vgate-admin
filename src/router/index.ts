import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore, AUTH_STORAGE_KEY } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { requiresAuth: true } },
      { path: 'nodes', name: 'nodes', component: () => import('@/views/nodes/NodesView.vue'), meta: { requiresAuth: true } },
      { path: 'users', name: 'users', component: () => import('@/views/users/UsersView.vue'), meta: { requiresAuth: true } },
      { path: 'traffic', name: 'traffic', component: () => import('@/views/traffic/TrafficView.vue'), meta: { requiresAuth: true } },
      { path: 'system-config', name: 'system-config', component: () => import('@/views/system/SystemConfigView.vue'), meta: { requiresAuth: true, requiresSuperAdmin: true } },
      { path: 'admins', name: 'admins', component: () => import('@/views/admins/AdminsView.vue'), meta: { requiresAuth: true, requiresSuperAdmin: true } },
      { path: 'plans', name: 'plans', component: () => import('@/views/products/ProductsView.vue'), meta: { requiresAuth: true, requiresSuperAdmin: true } },
      { path: 'traffic-packages', redirect: 'plans', meta: { requiresAuth: true, requiresSuperAdmin: true } },
      { path: 'orders', name: 'orders', component: () => import('@/views/orders/OrdersView.vue'), meta: { requiresAuth: true } },
      { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { requiresAuth: true } },
      { path: 'invites', name: 'invites', component: () => import('@/views/invites/InviteCodesView.vue'), meta: { requiresAuth: true } },
      { path: 'redemption-codes', name: 'redemption-codes', component: () => import('@/views/redemption/RedemptionCodesView.vue'), meta: { requiresAuth: true } },
      { path: 'announcements', name: 'announcements', component: () => import('@/views/announcements/AnnouncementsView.vue'), meta: { requiresAuth: true } },
      { path: 'email', name: 'email', component: () => import('@/views/email/EmailView.vue'), meta: { requiresAuth: true } },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  // Read persisted state directly (mirrors http.ts request interceptor pattern)
  // to avoid reactivity timing issues where Pinia getters haven't yet propagated.
  let isAuthenticated = auth.isAuthenticated
  if (!isAuthenticated) {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (raw) {
      try {
        const sess = JSON.parse(raw)
        if (sess.token) {
          isAuthenticated = true
        }
      } catch { /* ignore malformed */ }
    }
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresSuperAdmin && !auth.isSuperAdmin) {
    return { name: 'dashboard' }
  }
  if (to.name === 'login' && isAuthenticated) {
    return { name: 'dashboard' }
  }
  return true
})

export default router
