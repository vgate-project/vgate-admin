<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiPlans } from '@/api/plans'
import type { Plan } from '@/types/api'
import { formatBytes, formatPrice } from '@/utils/format'
import PlanEditorDialog from './PlanEditorDialog.vue'
import {Plus} from "@element-plus/icons-vue";

const periodLabels: Record<string, string> = {
  month: 'Monthly',
  quarter: 'Quarterly',
  half_year: 'Half-year',
  year: 'Yearly',
}
function periodLabel(p: string): string {
  return periodLabels[p] || p
}

const plans = ref<Plan[]>([])
const loading = ref(false)

const editorVisible = ref(false)
const editingPlan = ref<Plan | null>(null)

async function load() {
  loading.value = true
  try {
    const { data } = await apiPlans.list()
    plans.value = data
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openCreate() {
  editingPlan.value = null
  editorVisible.value = true
}
function openEdit(plan: Plan) {
  editingPlan.value = plan
  editorVisible.value = true
}
async function onDelete(plan: Plan) {
  try {
    await ElMessageBox.confirm(`Delete plan "${plan.name}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }
  await apiPlans.remove(plan.id)
  ElMessage.success('Plan deleted')
  load()
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Plans</h2>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon><span>New Plan</span>
      </el-button>
    </div>
    <el-card shadow="never">
      <el-table :data="plans" v-loading="loading" empty-text="No plans yet">
        <el-table-column prop="name" label="Name" width="160" />
        <el-table-column label="Prices" min-width="220">
          <template #default="{ row }">
            <div v-if="row.prices && row.prices.length" class="price-list">
              <div
                v-for="pr in row.prices"
                :key="pr.id"
                class="price-item"
                :class="{ disabled: !pr.enabled }"
              >
                <span class="price-period">{{ periodLabel(pr.period) }}</span>
                <span class="price-amount">{{ formatPrice(pr.price) }}</span>
                <span class="price-days">{{ pr.duration_days }}&nbsp;d</span>
              </div>
            </div>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="Quota" width="120">
          <template #default="{ row }">{{ formatBytes(row.quota_bytes) }}</template>
        </el-table-column>
        <el-table-column label="Reset" width="110">
          <template #default="{ row }">
            <span v-if="row.reset_enabled">{{ formatPrice(row.reset_price) }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="level" label="Level" width="80" />
        <el-table-column label="Enabled" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">
              {{ row.enabled ? 'on' : 'off' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="160" fixed="right">
          <template #default="{ row }">
            <div class="actions">
              <el-button size="small" @click="openEdit(row as Plan)">Edit</el-button>
              <el-popconfirm title="Delete this plan?" @confirm="onDelete(row as Plan)">
                <template #reference>
                  <el-button size="small" type="danger">Delete</el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <PlanEditorDialog v-model="editorVisible" :plan="editingPlan" @saved="load" />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.actions {
  display: flex;
  gap: 4px;
  align-items: center;
}
h2 {
  margin: 0;
}
.price-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.price-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  line-height: 1.2;
}
.price-item.disabled {
  opacity: 0.45;
  text-decoration: line-through;
}
.price-period {
  font-weight: 600;
  min-width: 64px;
}
.price-amount {
  color: #409eff;
}
.price-days {
  color: #909399;
  font-size: 12px;
}
</style>
