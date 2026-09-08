<script setup lang="ts">
import { ref, computed, onMounted, defineComponent, h } from 'vue'
import { apiStats } from '@/api/stats'
import { useReferenceStore } from '@/stores/reference'
import { formatBytes, formatPrice, formatRelative } from '@/utils/format'
import type { HourlyStat } from '@/types/api'
import router from "@/router";
import TrafficBarChart from '@/components/TrafficBarChart.vue'

const reference = useReferenceStore()
const nodeCount = ref(0)
const onlineCount = ref(0)
const userCount = ref(0)
const onlineUsers24h = ref(0)
const up24h = ref(0)
const down24h = ref(0)
const series = ref<HourlyStat[]>([])
// Node Status table reads the shared reference store (cached app-wide) instead
// of a second dedicated node-list request on every dashboard load.
const nodes = computed(() => reference.nodes)
// Split into real vs virtual so the two panes each show the right subset.
// Virtual children (parent_id IS NOT NULL) inherit liveness from their real
// parent — they're surfaced separately so admins can see them, but they don't
// affect the dashboard aggregates above.
const realNodes = computed(() => nodes.value.filter((n) => !n.parent_id))
const virtualNodes = computed(() => nodes.value.filter((n) => n.parent_id))
const activeNodeTab = ref<'real' | 'virtual'>('real')
const activeNodeCount = computed(() =>
  activeNodeTab.value === 'real' ? realNodes.value.length : virtualNodes.value.length,
)
const orderCount24h = ref(0)
const orderAmount24h = ref(0)
const loading = ref(true)

// User health + pending orders
const expiringUsers7d = ref(0)
const quotaExhaustedUsers = ref(0)
const unverifiedUsers = ref(0)
const newUsersToday = ref(0)
const newUsersYesterday = ref(0)
const orderPendingCount = ref(0)

// Previous 24h (for day-over-day trend)
const up24hPrev = ref(0)
const down24hPrev = ref(0)
const onlineUsers24hPrev = ref(0)
const orderCount24hPrev = ref(0)

// trend returns a day-over-day direction and percentage given the current and
// previous-24h value. dir is 'up' | 'down' | 'flat'.
function trend(curr: number, prev: number) {
  if (prev <= 0) return { dir: 'flat' as const, pct: 0 }
  const diff = curr - prev
  if (diff === 0) return { dir: 'flat' as const, pct: 0 }
  return {
    dir: diff > 0 ? ('up' as const) : ('down' as const),
    pct: Math.abs((diff / prev) * 100),
  }
}

// TrendBadge renders a day-over-day delta as ▲/▼ + percentage, colored by
// direction. Flat (no previous data or no change) shows a dash.
const TrendBadge = defineComponent({
  name: 'TrendBadge',
  props: {
    curr: { type: Number, required: true },
    prev: { type: Number, required: true },
    compact: { type: Boolean, default: false },
  },
  setup(props) {
    const t = computed(() => trend(props.curr, props.prev))
    return () => {
      if (t.value.dir === 'flat') {
        return h('span', { class: 'trend flat' }, '—')
      }
      const icon = t.value.dir === 'up' ? '▲' : '▼'
      return h(
        'span',
        { class: `trend ${t.value.dir}${props.compact ? ' compact' : ''}` },
        `${icon} ${t.value.pct.toFixed(1)}%`,
      )
    }
  },
})

// Node filter for the traffic chart / 24h traffic card ('' = all nodes).
// Backend semantics: only the traffic series and up_24h/down_24h narrow to
// the selected entry point; every other card stays global.
const filterNodeId = ref('')

function nodeLabel(id: string): string {
  const n = nodes.value.find((n) => n.id === id)
  if (!n) return id
  const label = `${n.name} (${n.address}:${n.port})`
  return n.parent_id ? `${label} · virtual` : label
}

async function loadOverview() {
  loading.value = true
  try {
    const { data } = await apiStats.overview(filterNodeId.value || undefined)
    nodeCount.value = data.node_count
    onlineCount.value = data.node_online
    userCount.value = data.user_count
    onlineUsers24h.value = data.online_users_24h
    up24h.value = data.up_24h
    down24h.value = data.down_24h
    series.value = data.series
    orderCount24h.value = data.order_count_24h
    orderAmount24h.value = data.order_amount_24h
    expiringUsers7d.value = data.expiring_users_7d
    quotaExhaustedUsers.value = data.quota_exhausted_users
    unverifiedUsers.value = data.unverified_users
    newUsersToday.value = data.new_users_today
    newUsersYesterday.value = data.new_users_yesterday
    orderPendingCount.value = data.order_pending_count
    up24hPrev.value = data.up_24h_prev
    down24hPrev.value = data.down_24h_prev
    onlineUsers24hPrev.value = data.online_users_24h_prev
    orderCount24hPrev.value = data.order_count_24h_prev
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    await loadOverview()
    try {
      await reference.get()
    } catch (e) {
      console.error('failed to load node status', e)
    }
  } catch (e) {
    console.error('failed to load overview', e)
  }
})
</script>

<template>
  <div v-loading="loading">
    <h2 style="margin: 0 0 16px">Dashboard</h2>
    <el-row :gutter="16">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" @click="router.push('/nodes')">
          <div class="stat-title">Nodes</div>
          <div class="stat-value">{{ nodeCount }}</div>
          <div class="stat-sub">{{ onlineCount }} online</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" @click="router.push('/users')">
          <div class="stat-title">Active Users (24h)</div>
          <div class="stat-value">
            {{ onlineUsers24h }}
            <TrendBadge :curr="onlineUsers24h" :prev="onlineUsers24hPrev" />
          </div>
          <div class="stat-sub">Total: {{ userCount }} · New today: {{ newUsersToday }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" @click="router.push('/traffic')">
          <div class="stat-title">Traffic (24h)</div>
          <div class="stat-value">
            {{ formatBytes(up24h + down24h) }}
          </div>
          <div class="stat-sub traffic-sub">
            <span>
              ↑ {{ formatBytes(up24h) }}
              <TrendBadge :curr="up24h" :prev="up24hPrev" compact />
            </span>
            <span class="traffic-sep"></span>
            <span>
              ↓ {{ formatBytes(down24h) }}
              <TrendBadge :curr="down24h" :prev="down24hPrev" compact />
            </span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" @click="router.push('/orders')">
          <div class="stat-title">Orders Paid (24h)</div>
          <div class="stat-value">
            {{ orderCount24h }}
            <TrendBadge :curr="orderCount24h" :prev="orderCount24hPrev" />
          </div>
          <div class="stat-sub">
            {{ formatPrice(orderAmount24h) }} · {{ orderPendingCount }} pending
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16" class="health-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" @click="router.push('/users')">
          <div class="stat-title">New Users (Today)</div>
          <div class="stat-value">
            {{ newUsersToday }}
            <TrendBadge :curr="newUsersToday" :prev="newUsersYesterday" />
          </div>
          <div class="stat-sub">Registered since midnight</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" @click="router.push('/users')">
          <div class="stat-title">Expiring (≤7d)</div>
          <div class="stat-value" :class="{ warn: expiringUsers7d > 0 }">
            {{ expiringUsers7d }}
          </div>
          <div class="stat-sub">Subscriptions ending soon</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" @click="router.push('/users')">
          <div class="stat-title">Quota Exhausted</div>
          <div class="stat-value" :class="{ warn: quotaExhaustedUsers > 0 }">
            {{ quotaExhaustedUsers }}
          </div>
          <div class="stat-sub">Out of traffic allowance</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" @click="router.push('/users')">
          <div class="stat-title">Unverified</div>
          <div class="stat-value" :class="{ warn: unverifiedUsers > 0 }">
            {{ unverifiedUsers }}
          </div>
          <div class="stat-sub">Emails not verified</div>
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16" class="bottom-row">
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <div class="chart-filter">
            <el-select
              v-model="filterNodeId"
              clearable
              filterable
              placeholder="All nodes"
              size="small"
              style="width: 260px"
              @change="loadOverview"
            >
              <el-option v-for="n in nodes" :key="n.id" :label="nodeLabel(n.id)" :value="n.id" />
            </el-select>
          </div>
          <TrafficBarChart :data="series" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="node-card">
          <div class="chart-header">
            <span class="chart-title">Node Status</span>
            <span class="node-count">{{ activeNodeCount }}</span>
          </div>
          <el-tabs v-model="activeNodeTab" class="node-tabs">
            <el-tab-pane label="Real" name="real">
              <el-table :data="realNodes" size="small" empty-text="No real nodes" max-height="220">
                <el-table-column label="Name" min-width="160">
                  <template #default="{ row }">
                    <span class="node-name">{{ row.name }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="Address" min-width="160">
                  <template #default="{ row }">
                    <span class="node-addr">{{ row.address }}:{{ row.port }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="Status" width="110">
                  <template #default="{ row }">
                    <el-tag :type="row.online ? 'success' : 'info'" size="small">
                      {{ row.online ? 'Online' : 'Offline' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="Multiplier" width="100">
                  <template #default="{ row }">
                    <span>{{ (row.traffic_multiplier ?? 1).toFixed(2) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="Last seen" min-width="120">
                  <template #default="{ row }">
                    {{ formatRelative(row.last_seen_at) }}
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="Virtual" name="virtual">
              <el-table :data="virtualNodes" size="small" empty-text="No virtual nodes" max-height="220">
                <el-table-column label="Name" min-width="160">
                  <template #default="{ row }">
                    <span class="node-name">{{ row.name }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="Address" min-width="160">
                  <template #default="{ row }">
                    <span class="node-addr">{{ row.address }}:{{ row.port }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="Parent" min-width="140">
                  <template #default="{ row }">
                    <span style="color: #909399">{{ row.parent_name || row.parent_id || '—' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="Status" width="110">
                  <template #default="{ row }">
                    <el-tag :type="row.online ? 'success' : 'info'" size="small">
                      {{ row.online ? 'Online' : 'Offline' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="Multiplier" width="100">
                  <template #default="{ row }">
                    <span style="color: #909399">inherit</span>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.stat-card {
  height: 100%;
}
.stat-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}
.stat-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}
.stat-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  min-height: 18px;
}
.traffic-sub {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.traffic-sep {
  width: 1px;
  height: 12px;
  background: #dcdfe6;
}
.bottom-row {
  margin-top: 16px;
}
.bottom-row :deep(.el-col) {
  display: flex;
}
.chart-card,
.node-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
}
.chart-filter {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
.node-card {
  min-height: 100%;
}
.node-count {
  font-size: 12px;
  color: #909399;
}
/* Keep the dashboard's Node Status tabs compact so the table sits high in
   the card. Default el-tabs brings a 16px top margin we don't want here. */
.node-tabs {
  margin-top: -8px;
}
.node-tabs :deep(.el-tabs__header) {
  margin-bottom: 8px;
}
.node-name {
  font-weight: 500;
  color: #303133;
}
.node-addr {
  font-size: 12px;
  color: #909399;
}
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.el-card:hover {
  cursor: pointer;
}
.health-row {
  margin-top: 16px;
}
.trend {
  font-size: 12px;
  font-weight: 500;
  margin-left: 6px;
  vertical-align: middle;
}
.trend.up {
  color: #67c23a;
}
.trend.down {
  color: #f56c6c;
}
.trend.flat {
  color: #c0c4cc;
}
.trend.compact {
  font-size: 11px;
  margin-left: 2px;
}
.stat-value.warn {
  color: #e6a23c;
}
</style>
