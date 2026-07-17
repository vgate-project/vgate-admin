<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiRedemption } from '@/api/redemption'
import { apiPlans } from '@/api/plans'
import type { RedemptionCode, GenerateRedemptionRequest, RedeemType, Plan } from '@/types/api'
import { formatDateTime, formatBytes } from '@/utils/format'
import CopyableTokenDialog from '@/components/CopyableTokenDialog.vue'
import QuotaInput from '@/components/QuotaInput.vue'

const codes = ref<RedemptionCode[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const editorVisible = ref(false)
const saving = ref(false)
const plans = ref<Plan[]>([])

// Local form shape: unlike GenerateRedemptionRequest, the numerics are
// required so v-model bindings (e.g. QuotaInput) stay type-safe.
interface RedemptionForm {
  type: RedeemType
  quota_bytes: number
  duration_days: number
  plan_id: string
  max_uses: number
  count: number
  expires_at: string | null
  note: string
}

const form = ref<RedemptionForm>({
  type: 'traffic',
  quota_bytes: 0,
  duration_days: 0,
  plan_id: '',
  max_uses: 1,
  count: 1,
  expires_at: null,
  note: '',
})

// Dialog that shows freshly generated codes so the admin can copy them.
const tokenDialog = ref(false)
const tokenItems = ref<{ label: string; value: string; mono?: boolean }[]>([])

const typeLabel: Record<RedeemType, string> = {
  traffic: 'Traffic',
  duration: 'Duration',
  plan: 'Plan',
  reset: 'Reset',
}

// Human-readable summary of what a code grants.
function benefitSummary(c: RedemptionCode): string {
  switch (c.type) {
    case 'traffic':
      return `+${formatBytes(c.quota_bytes || 0)} traffic`
    case 'duration':
      return `+${(c.duration_days || 0)} days`
    case 'plan':
      return `plan ${c.plan_id || ''}`
    case 'reset':
      return 'reset traffic'
  }
  return c.type
}

async function load() {
  loading.value = true
  try {
    const { data } = await apiRedemption.list(page.value, pageSize.value)
    codes.value = data.items
    total.value = data.total
  } finally {
    loading.value = false
  }
}

async function loadPlans() {
  if (plans.value.length > 0) return
  try {
    const { data } = await apiPlans.list()
    plans.value = data
  } catch {
    /* error toasted by interceptor */
  }
}
onMounted(() => {
  loadPlans()
  load()
})

function onSizeChange() {
  page.value = 1
  load()
}

function remaining(c: RedemptionCode): number {
  return Math.max(0, c.max_uses - c.used_count)
}

async function openCreate() {
  form.value = {
    type: 'traffic',
    quota_bytes: 0,
    duration_days: 0,
    plan_id: '',
    max_uses: 1,
    count: 1,
    expires_at: null,
    note: '',
  }
  // Plan codes need a plan picker; ensure plans are loaded.
  await loadPlans()
  editorVisible.value = true
}

async function onSubmit() {
  const f = form.value
  if (!f.count || f.count < 1) {
    ElMessage.error('Count must be at least 1')
    return
  }
  if (!f.max_uses || f.max_uses < 1) {
    ElMessage.error('Max uses must be at least 1')
    return
  }
  if (f.type === 'traffic' && (!f.quota_bytes || f.quota_bytes <= 0)) {
    ElMessage.error('Traffic codes require a positive quota')
    return
  }
  if (f.type === 'duration' && (!f.duration_days || f.duration_days <= 0)) {
    ElMessage.error('Duration codes require a positive number of days')
    return
  }
  if (f.type === 'plan' && !f.plan_id) {
    ElMessage.error('Plan codes require a plan')
    return
  }
  const body: GenerateRedemptionRequest = {
    type: f.type,
    max_uses: f.max_uses,
    count: f.count,
    expires_at: f.expires_at || null,
    note: f.note || '',
  }
  if (f.type === 'traffic') body.quota_bytes = f.quota_bytes
  if (f.type === 'duration') body.duration_days = f.duration_days
  if (f.type === 'plan') body.plan_id = f.plan_id

  saving.value = true
  try {
    const { data } = await apiRedemption.generate(body)
    editorVisible.value = false
    ElMessage.success(`Generated ${data.length} code(s)`)
    tokenItems.value = data.map((c, i) => ({
      label: `Redemption code #${i + 1} (${typeLabel[c.type]})`,
      value: c.code,
      mono: true,
    }))
    tokenDialog.value = true
    load()
  } finally {
    saving.value = false
  }
}

async function onDelete(c: RedemptionCode) {
  try {
    await ElMessageBox.confirm(`Delete redemption code "${c.code}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }
  await apiRedemption.remove(c.id)
  ElMessage.success('Redemption code deleted')
  load()
}

// Records (who redeemed) for a code.
const recordsVisible = ref(false)
const records = ref<{ user_id: string; redeemed_at: string }[]>([])
const recordsLoading = ref(false)
async function showRecords(c: RedemptionCode) {
  recordsLoading.value = true
  recordsVisible.value = true
  try {
    const { data } = await apiRedemption.records(c.id)
    records.value = data.items
  } finally {
    recordsLoading.value = false
  }
}

function planName(id?: string | null): string {
  if (!id) return '—'
  return plans.value.find((p) => p.id === id)?.name || id
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Redemption Codes</h2>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon><span>Generate Codes</span>
      </el-button>
    </div>
    <el-card shadow="never">
      <el-table :data="codes" v-loading="loading" empty-text="No redemption codes yet" max-height="calc(100vh - 20px)" show-overflow-tooltip>
        <el-table-column prop="code" label="Code" min-width="160">
          <template #default="{ row }"><code class="mono">{{ row.code }}</code></template>
        </el-table-column>
        <el-table-column label="Type" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ typeLabel[row.type as RedeemType] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Benefit" width="180">
          <template #default="{ row }">
            <el-tooltip
              v-if="(row as RedemptionCode).type === 'plan'"
              :content="(row as RedemptionCode).plan_id || ''"
              placement="top"
            >
              <span class="mono link">{{ planName((row as RedemptionCode).plan_id) }}</span>
            </el-tooltip>
            <span v-else>{{ benefitSummary(row as RedemptionCode) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="note" label="Note" width="180">
          <template #default="{ row }">{{ row.note || '—' }}</template>
        </el-table-column>
        <el-table-column label="Uses" width="90">
          <template #default="{ row }">{{ row.used_count }} / {{ row.max_uses }}</template>
        </el-table-column>
        <el-table-column label="Remaining" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="remaining(row as RedemptionCode) > 0 ? 'success' : 'info'">{{ remaining(row as RedemptionCode) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Expires" width="170">
          <template #default="{ row }">{{ formatDateTime(row.expires_at) || 'never' }}</template>
        </el-table-column>
        <el-table-column label="Created" width="170">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="Actions" min-width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="showRecords(row as RedemptionCode)">Records</el-button>
            <el-popconfirm title="Delete this code?" @confirm="onDelete(row as RedemptionCode)">
              <template #reference>
                <el-button size="small" type="danger">Delete</el-button>
              </template>
            </el-popconfirm>
          </template>
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

    <el-dialog v-model="editorVisible" title="Generate Redemption Codes" width="560px">
      <el-form label-width="150px">
        <el-form-item label="Benefit type" required>
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="Traffic (add quota)" value="traffic" />
            <el-option label="Duration (extend expiry)" value="duration" />
            <el-option label="Plan (free subscription)" value="plan" />
            <el-option label="Reset (zero usage)" value="reset" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.type === 'traffic'" label="Quota" required>
          <QuotaInput v-model="form.quota_bytes" />
          <span class="hint">{{ formatBytes(form.quota_bytes) }} (0 = no quota; required &gt; 0)</span>
        </el-form-item>
        <el-form-item v-if="form.type === 'duration'" label="Duration (days)" required>
          <el-input-number v-model="form.duration_days" :min="1" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="form.type === 'plan'" label="Plan" required>
          <el-select v-model="form.plan_id" placeholder="select a plan" style="width: 100%">
            <el-option v-for="p in plans" :key="p.id" :label="`${p.name} (${formatBytes(p.quota_bytes)})`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="Count" required>
          <el-input-number v-model="form.count" :min="1" :max="1000" controls-position="right" />
          <span class="hint">how many distinct codes to generate</span>
        </el-form-item>
        <el-form-item label="Max uses / code" required>
          <el-input-number v-model="form.max_uses" :min="1" controls-position="right" />
          <span class="hint">distinct users per code</span>
        </el-form-item>
        <el-form-item label="Expires at">
          <el-date-picker
            v-model="form.expires_at"
            type="datetime"
            clearable
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            placeholder="never"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="Note">
          <el-input v-model="form.note" placeholder="optional" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="saving" @click="onSubmit">Generate</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="recordsVisible" title="Redemption Records" width="520px">
      <el-table :data="records" v-loading="recordsLoading" empty-text="No redemptions yet">
        <el-table-column prop="user_id" label="User ID" min-width="200">
          <template #default="{ row }"><code class="mono">{{ row.user_id }}</code></template>
        </el-table-column>
        <el-table-column label="Redeemed" width="180">
          <template #default="{ row }">{{ formatDateTime(row.redeemed_at) }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <CopyableTokenDialog v-model="tokenDialog" title="Redemption Codes" :items="tokenItems"
      warning="Share these codes with users. They cannot be shown again." />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.mono {
  font-family: monospace;
}
.link {
  cursor: default;
  border-bottom: 1px dotted #c0c4cc;
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
h2 {
  margin: 0;
}
.hint {
  display: inline-block;
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
