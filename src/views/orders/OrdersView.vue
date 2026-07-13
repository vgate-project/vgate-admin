<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {apiOrders} from '@/api/orders'
import {apiPlans} from '@/api/plans'
import {apiTrafficPackages} from '@/api/traffic'
import type {Order, OrderStatus} from '@/types/api'
import {formatDateTime, formatPrice} from '@/utils/format'
import AdminCreateOrderDialog from './AdminCreateOrderDialog.vue'
import CopyableTokenDialog from '@/components/CopyableTokenDialog.vue'

const orders = ref<Order[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

// Filter + sort state (applied server-side via /admin/orders query params).
const search = ref('')
const statusFilter = ref<'' | OrderStatus>('')
const sortBy = ref('')
const sortOrder = ref<'asc' | 'desc'>('desc')

const planMap = ref<Record<string, string>>({})
const packageMap = ref<Record<string, string>>({})

const createVisible = ref(false)

const tokenDialog = ref(false)
const tokenTitle = ref('Alipay Pay URL')
const tokenItems = ref<{ label: string; value: string; mono?: boolean }[]>([])

async function loadPlans() {
  try {
    const {data} = await apiPlans.list()
    const m: Record<string, string> = {}
    for (const p of data) m[p.id] = p.name
    planMap.value = m
  } catch {
    /* non-fatal: plan names just won't resolve */
  }
}

async function loadPackages() {
  try {
    const {data} = await apiTrafficPackages.list()
    const m: Record<string, string> = {}
    for (const p of data) m[p.id] = p.name
    packageMap.value = m
  } catch {
    /* non-fatal: package names just won't resolve */
  }
}

function productName(row: Order): string {
  if (row.kind === 'plan') return planMap.value[row.plan_id] ?? row.plan_id
  return packageMap.value[row.traffic_package_id] ?? row.traffic_package_id
}

async function load() {
  loading.value = true
  try {
    const {data} = await apiOrders.list(page.value, pageSize.value, {
      search: search.value.trim(),
      status: statusFilter.value,
      sort_by: sortBy.value,
      order: sortOrder.value,
    })
    orders.value = data.items
    total.value = data.total
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadPlans()
  loadPackages()
  load()
})

function onSizeChange() {
  page.value = 1
  load()
}

// Any filter change resets to the first page and reloads.
function onFilterChange() {
  page.value = 1
  load()
}

function resetFilters() {
  search.value = ''
  statusFilter.value = ''
  onFilterChange()
}

// Element Plus emits prop/order; map to server sort_by/order and reload.
function onSortChange({prop, order}: { prop: string | null; order: string | null }) {
  if (!order || !prop) {
    sortBy.value = ''
    sortOrder.value = 'desc'
  } else {
    sortBy.value = prop
    sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  }
  load()
}

function statusTag(status: OrderStatus): 'warning' | 'success' | 'info' {
  if (status === 'paid') return 'success'
  if (status === 'pending') return 'warning'
  return 'info'
}

function onOrderCreated(payUrl: string) {
  tokenItems.value = [
    {label: 'Alipay Pay URL (send to the user to pay)', value: payUrl, mono: true},
  ]
  tokenDialog.value = true
  load()
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Orders</h2>
      <el-button type="primary" @click="createVisible = true">
        <el-icon>
          <Plus/>
        </el-icon>
        <span>New Order</span>
      </el-button>
    </div>

    <div class="filters">
      <el-input
          v-model="search"
          placeholder="Search user ID or trade no."
          clearable
          class="filter-search"
          @keyup.enter="onFilterChange"
          @clear="onFilterChange"
      />
      <el-select
          v-model="statusFilter"
          placeholder="All statuses"
          class="filter-status"
          clearable
          @change="onFilterChange"
      >
        <el-option label="All" value=""/>
        <el-option label="Pending" value="pending"/>
        <el-option label="Paid" value="paid"/>
        <el-option label="Closed" value="closed"/>
      </el-select>
      <el-button @click="resetFilters">Reset</el-button>
    </div>

    <el-card shadow="never">
      <el-table
          :data="orders"
          v-loading="loading"
          empty-text="No orders yet"
          @sort-change="onSortChange"
      >
        <el-table-column label="ID" width="100">
          <template #default="{ row }">
            <el-tooltip :content="row.id" placement="top" :hide-after="0">
              <span class="mono id-suffix">{{ row.id.slice(-8) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="User" min-width="120" prop="user_id" sortable="custom">
          <template #default="{ row }">
            <span class="mono no-wrap">{{ row.user_id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Product" min-width="160">
          <template #default="{ row }">{{ productName(row as Order) }}</template>
        </el-table-column>
        <el-table-column label="Kind" width="90" prop="kind" sortable="custom">
          <template #default="{ row }">{{ row.kind }}</template>
        </el-table-column>
        <el-table-column label="Amount" width="120" prop="amount" sortable="custom">
          <template #default="{ row }">{{ formatPrice(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="Status" width="100" prop="status" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="channel" label="Channel" width="90"/>
        <el-table-column label="Created" width="170" prop="created_at" sortable="custom">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="Paid At" width="170" prop="paid_at" sortable="custom">
          <template #default="{ row }">{{ formatDateTime(row.paid_at) }}</template>
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
          @current-change="load"
      />
    </el-card>

    <AdminCreateOrderDialog v-model="createVisible" @created="onOrderCreated"/>

    <CopyableTokenDialog
        v-model="tokenDialog"
        :title="tokenTitle"
        :items="tokenItems"
        warning="This is the alipay payment URL for the user — send it to them to complete payment."
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.filter-search {
  width: 280px;
}

.filter-status {
  width: 180px;
}

.mono {
  font-family: monospace;
  font-size: 12px;
}

/* Keep long IDs/user_ids on a single line rather than wrapping across rows. */
.no-wrap {
  white-space: nowrap;
}

.id-suffix {
  cursor: default;
}

.pager {
  margin-top: 12px;
  justify-content: flex-end;
}

h2 {
  margin: 0;
}
</style>
