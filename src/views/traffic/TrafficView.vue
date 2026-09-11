<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { apiTraffic } from '@/api/traffic'
import { useReferenceStore } from '@/stores/reference'
import TrafficTrendChart from '@/components/TrafficTrendChart.vue'
import type { TrafficAggregateRow, TrafficRecord, TrafficStats } from '@/types/wire'
import { formatBytes, formatDateTime } from '@/utils/format'

const reference = useReferenceStore()
const users = computed(() => reference.users)
// Traffic rows are attributed to the real node by default, or to a virtual
// child when the client connected through that child's dedicated Reality
// short ID — so the filter picker and row labels list all nodes.
const nodes = computed(() => reference.nodes)

type Tab = 'detail' | 'user' | 'node'
const activeTab = ref<Tab>('detail')

const filterUserId = ref<string>('')
const filterNodeId = ref<string>('')
// Local [start of day, end of day] range; apiTraffic converts it to the
// backend's inclusive-from / exclusive-to hour bounds.
const filterRange = ref<[Date, Date] | null>(null)

// No picked range defaults to the full retention window (hourly rows are
// pruned after 30 days) so the summary, chart, tabs and export all cover the
// same data instead of mixing a 24h chart with an unbounded table.
const effectiveRange = computed<[Date, Date] | null>(() => {
  if (filterRange.value) return filterRange.value
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - 29)
  return [from, new Date()]
})

// Quick picks for the range filter.
const rangeShortcuts = [
  {
    text: 'Today',
    value: (): [Date, Date] => {
      const s = new Date()
      s.setHours(0, 0, 0, 0)
      const e = new Date()
      e.setHours(23, 59, 59, 999)
      return [s, e]
    },
  },
  {
    text: 'Last 7 days',
    value: (): [Date, Date] => {
      const s = new Date()
      s.setHours(0, 0, 0, 0)
      s.setDate(s.getDate() - 6)
      const e = new Date()
      e.setHours(23, 59, 59, 999)
      return [s, e]
    },
  },
  {
    text: 'Last 30 days',
    value: (): [Date, Date] => {
      const s = new Date()
      s.setHours(0, 0, 0, 0)
      s.setDate(s.getDate() - 29)
      const e = new Date()
      e.setHours(23, 59, 59, 999)
      return [s, e]
    },
  },
]

const stats = ref<TrafficStats | null>(null)
const statsLoading = ref(false)
const summary = computed(
  () => stats.value?.totals ?? { up: 0, down: 0, up_billed: 0, down_billed: 0 },
)

const rows = ref<TrafficRecord[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const aggRows = ref<TrafficAggregateRow[]>([])
const aggLoading = ref(false)
const aggPage = ref(1)
const aggPageSize = ref(20)
const aggTotal = ref(0)

const exporting = ref(false)

onMounted(async () => {
  await reference.get()
  loadStats()
  loadDetail()
})

watch([filterUserId, filterNodeId, filterRange], () => {
  page.value = 1
  aggPage.value = 1
  loadStats()
  loadDetail()
  if (activeTab.value !== 'detail') loadAggregate()
})

watch(activeTab, (tab) => {
  if (tab !== 'detail') {
    aggPage.value = 1
    loadAggregate()
  }
})

async function loadStats() {
  statsLoading.value = true
  try {
    const { data } = await apiTraffic.stats(filterUserId.value, filterNodeId.value, effectiveRange.value)
    stats.value = data
  } finally {
    statsLoading.value = false
  }
}

async function loadDetail() {
  loading.value = true
  try {
    const { data } = await apiTraffic.list(
      filterUserId.value,
      filterNodeId.value,
      effectiveRange.value,
      page.value,
      pageSize.value,
    )
    rows.value = data.items
    total.value = data.total
  } finally {
    loading.value = false
  }
}

async function loadAggregate() {
  aggLoading.value = true
  try {
    const { data } = await apiTraffic.aggregate(
      activeTab.value as 'user' | 'node',
      filterUserId.value,
      filterNodeId.value,
      effectiveRange.value,
      aggPage.value,
      aggPageSize.value,
    )
    aggRows.value = data.items
    aggTotal.value = data.total
  } finally {
    aggLoading.value = false
  }
}

function onReset() {
  filterUserId.value = ''
  filterNodeId.value = ''
  filterRange.value = null
}

function onSizeChange() {
  page.value = 1
  loadDetail()
}

function onAggSizeChange() {
  aggPage.value = 1
  loadAggregate()
}

async function exportCsv() {
  exporting.value = true
  try {
    const { data } = await apiTraffic.exportCsv(filterUserId.value, filterNodeId.value, effectiveRange.value)
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = `traffic-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}

function nodeLabel(id?: string): string {
  if (!id) return '—'
  const n = nodes.value.find((n) => n.id === id)
  if (!n) return id
  const label = `${n.name} (${n.address}:${n.port})`
  return n.parent_id ? `${label} · virtual` : label
}

function formatMultiplier(m: number): string {
  return `×${m.toFixed(2)}`
}
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">Traffic</h2>

    <el-card shadow="never" class="block">
      <el-form :inline="true" @submit.prevent>
        <el-form-item label="User">
          <el-select
            v-model="filterUserId"
            clearable
            filterable
            placeholder="All users"
            style="width: 220px"
          >
            <el-option v-for="u in users" :key="u.id" :label="u.email" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="Node">
          <el-select
            v-model="filterNodeId"
            clearable
            filterable
            placeholder="All nodes"
            style="width: 220px"
          >
            <el-option v-for="n in nodes" :key="n.id" :label="nodeLabel(n.id)" :value="n.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="Date">
          <el-date-picker
            v-model="filterRange"
            type="daterange"
            clearable
            :shortcuts="rangeShortcuts"
            start-placeholder="From"
            end-placeholder="To"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button @click="onReset">Reset</el-button>
        </el-form-item>
      </el-form>

      <!-- Totals for the current filters (raw bytes plus the multiplier-
           weighted billed bytes charged against quotas). -->
      <el-row :gutter="12" v-loading="statsLoading">
        <el-col :xs="12" :sm="6">
          <div class="stat">
            <div class="stat-label">Upload</div>
            <div class="stat-value">{{ formatBytes(summary.up) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat">
            <div class="stat-label">Download</div>
            <div class="stat-value">{{ formatBytes(summary.down) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat">
            <el-tooltip
              content="Bytes charged against quotas (raw usage × each node's multiplier)"
              placement="top"
            >
              <div class="stat-label">Billed total</div>
            </el-tooltip>
            <div class="stat-value">{{ formatBytes(summary.up_billed + summary.down_billed) }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat">
            <div class="stat-label">Detail rows</div>
            <div class="stat-value">{{ total }}</div>
          </div>
        </el-col>
      </el-row>

      <TrafficTrendChart
        v-if="stats"
        :series="stats.series"
        :bucket="stats.bucket"
        class="trend"
      />
    </el-card>

    <el-card shadow="never">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="Detail" name="detail">
          <div class="tab-toolbar">
            <el-button
              type="primary"
              size="small"
              :loading="exporting"
              @click="exportCsv"
            >
              Export CSV
            </el-button>
          </div>
          <!-- Hourly detail rows: raw reported bytes, the multiplier applied at
               write time, and the billed bytes charged against the quota. -->
          <el-table :data="rows" v-loading="loading" empty-text="No traffic data">
            <el-table-column label="Time" min-width="160">
              <template #default="{ row }">{{ formatDateTime(row.hour) }}</template>
            </el-table-column>
            <el-table-column prop="email" label="Email" width="180" />
            <el-table-column label="Node" min-width="180">
              <template #default="{ row }">{{ nodeLabel(row.node_id) }}</template>
            </el-table-column>
            <el-table-column label="Upload" min-width="110">
              <template #default="{ row }">{{ formatBytes(row.up_total) }}</template>
            </el-table-column>
            <el-table-column label="Download" min-width="110">
              <template #default="{ row }">{{ formatBytes(row.down_total) }}</template>
            </el-table-column>
            <el-table-column label="Multiplier" min-width="100">
              <template #default="{ row }">{{ formatMultiplier(row.multiplier) }}</template>
            </el-table-column>
            <el-table-column label="Billed Upload" min-width="120">
              <template #default="{ row }">{{ formatBytes(row.up_billed) }}</template>
            </el-table-column>
            <el-table-column label="Billed Download" min-width="120">
              <template #default="{ row }">{{ formatBytes(row.down_billed) }}</template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            class="pager"
            @size-change="onSizeChange"
            @current-change="loadDetail"
          />
        </el-tab-pane>

        <el-tab-pane label="By User" name="user">
          <!-- Usage summed per user over the filtered range, heaviest first. -->
          <el-table :data="aggRows" v-loading="aggLoading" empty-text="No traffic data">
            <el-table-column prop="email" label="Email" min-width="200" />
            <el-table-column label="Upload" min-width="110">
              <template #default="{ row }">{{ formatBytes(row.up) }}</template>
            </el-table-column>
            <el-table-column label="Download" min-width="110">
              <template #default="{ row }">{{ formatBytes(row.down) }}</template>
            </el-table-column>
            <el-table-column label="Billed Upload" min-width="120">
              <template #default="{ row }">{{ formatBytes(row.up_billed) }}</template>
            </el-table-column>
            <el-table-column label="Billed Download" min-width="120">
              <template #default="{ row }">{{ formatBytes(row.down_billed) }}</template>
            </el-table-column>
            <el-table-column label="Active Hours" min-width="110">
              <template #default="{ row }">{{ row.active_hours }}</template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="aggPage"
            v-model:page-size="aggPageSize"
            :total="aggTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            class="pager"
            @size-change="onAggSizeChange"
            @current-change="loadAggregate"
          />
        </el-tab-pane>

        <el-tab-pane label="By Node" name="node">
          <!-- Usage summed per entry point over the filtered range, heaviest first. -->
          <el-table :data="aggRows" v-loading="aggLoading" empty-text="No traffic data">
            <el-table-column label="Node" min-width="200">
              <template #default="{ row }">{{ nodeLabel(row.node_id) }}</template>
            </el-table-column>
            <el-table-column label="Upload" min-width="110">
              <template #default="{ row }">{{ formatBytes(row.up) }}</template>
            </el-table-column>
            <el-table-column label="Download" min-width="110">
              <template #default="{ row }">{{ formatBytes(row.down) }}</template>
            </el-table-column>
            <el-table-column label="Billed Upload" min-width="120">
              <template #default="{ row }">{{ formatBytes(row.up_billed) }}</template>
            </el-table-column>
            <el-table-column label="Billed Download" min-width="120">
              <template #default="{ row }">{{ formatBytes(row.down_billed) }}</template>
            </el-table-column>
            <el-table-column label="Active Hours" min-width="110">
              <template #default="{ row }">{{ row.active_hours }}</template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="aggPage"
            v-model:page-size="aggPageSize"
            :total="aggTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            class="pager"
            @size-change="onAggSizeChange"
            @current-change="loadAggregate"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style scoped>
.block {
  margin-bottom: 16px;
}
.stat {
  margin-bottom: 12px;
}
.stat-label {
  font-size: 13px;
  color: #909399;
}
.stat-value {
  margin-top: 4px;
  font-size: 22px;
  font-weight: 600;
}
.trend {
  margin-top: 8px;
}
.tab-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
