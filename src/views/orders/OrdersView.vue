<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiOrders } from '@/api/orders'
import { apiPlans } from '@/api/plans'
import { apiTrafficPackages } from '@/api/traffic'
import type { Order, OrderStatus } from '@/types/api'
import { formatPrice, formatDateTime } from '@/utils/format'
import AdminCreateOrderDialog from './AdminCreateOrderDialog.vue'
import CopyableTokenDialog from '@/components/CopyableTokenDialog.vue'

const orders = ref<Order[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

// Client-side status filter. The admin orders list endpoint has no status
// param, so we filter the currently loaded page (frontend-only change).
const statusFilter = ref<'' | OrderStatus>('')

const planMap = ref<Record<string, string>>({})
const packageMap = ref<Record<string, string>>({})

const createVisible = ref(false)

const tokenDialog = ref(false)
const tokenTitle = ref('Alipay Pay URL')
const tokenItems = ref<{ label: string; value: string; mono?: boolean }[]>([])

const filteredOrders = computed(() => {
  if (!statusFilter.value) return orders.value
  return orders.value.filter((o) => o.status === statusFilter.value)
})

async function loadPlans() {
  try {
    const { data } = await apiPlans.list()
    const m: Record<string, string> = {}
    for (const p of data) m[p.id] = p.name
    planMap.value = m
  } catch {
    /* non-fatal: plan names just won't resolve */
  }
}

async function loadPackages() {
  try {
    const { data } = await apiTrafficPackages.list()
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
    const { data } = await apiOrders.list(page.value, pageSize.value)
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

function statusTag(status: OrderStatus): 'warning' | 'success' | 'info' {
  if (status === 'paid') return 'success'
  if (status === 'pending') return 'warning'
  return 'info'
}

function onOrderCreated(payUrl: string) {
  tokenItems.value = [
    { label: 'Alipay Pay URL (send to the user to pay)', value: payUrl, mono: true },
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
        <el-icon><Plus /></el-icon><span>New Order</span>
      </el-button>
    </div>

    <div class="filter">
      <el-select v-model="statusFilter" placeholder="All statuses" clearable style="width: 180px">
        <el-option label="All" value="" />
        <el-option label="Pending" value="pending" />
        <el-option label="Paid" value="paid" />
        <el-option label="Closed" value="closed" />
      </el-select>
    </div>

    <el-card shadow="never">
      <el-table :data="filteredOrders" v-loading="loading" empty-text="No orders yet">
        <el-table-column label="ID" width="220">
          <template #default="{ row }">
            <span class="mono">{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="User" width="240">
          <template #default="{ row }">
            <span class="mono">{{ row.user_id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Product" min-width="160">
          <template #default="{ row }">{{ productName(row as Order) }}</template>
        </el-table-column>
        <el-table-column label="Kind" width="90">
          <template #default="{ row }">{{ row.kind }}</template>
        </el-table-column>
        <el-table-column label="Amount" width="120">
          <template #default="{ row }">{{ formatPrice(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="Status" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="channel" label="Channel" width="90" />
        <el-table-column label="Created" width="170">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="Paid At" width="170">
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

    <AdminCreateOrderDialog v-model="createVisible" @created="onOrderCreated" />

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
.filter {
  margin-bottom: 12px;
}
.mono {
  font-family: monospace;
  font-size: 12px;
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
h2 {
  margin: 0;
}
</style>
