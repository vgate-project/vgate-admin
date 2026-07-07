<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { apiPlans } from '@/api/plans'
import type { Plan, PlanPrice, PlanRequest } from '@/types/api'
import { formatBytes, formatPrice } from '@/utils/format'
import QuotaInput from '@/components/QuotaInput.vue'

const props = defineProps<{ modelValue: boolean; plan: Plan | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [] }>()

const isEdit = computed(() => !!props.plan)
const saving = ref(false)

const PERIODS = [
  { value: 'month', label: 'Monthly (30 days)' },
  { value: 'quarter', label: 'Quarterly (90 days)' },
  { value: 'half_year', label: 'Half-year (180 days)' },
  { value: 'year', label: 'Yearly (365 days)' },
]
const DEFAULT_DAYS: Record<string, number> = {
  month: 30,
  quarter: 90,
  half_year: 180,
  year: 365,
}

const form = reactive({
  name: '',
  quota_bytes: 0,
  description: '',
  level: 0,
  enabled: true,
  reset_enabled: false,
  reset_price: 0,
  prices: [] as PlanPrice[],
})

function blankPrice(): PlanPrice {
  return { period: 'month', price: 0, duration_days: 30, enabled: true, sort: 0 }
}

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    form.name = ''
    form.quota_bytes = 0
    form.description = ''
    form.level = 0
    form.enabled = true
    form.reset_enabled = false
    form.reset_price = 0
    form.prices = [blankPrice()]
    if (props.plan) {
      form.name = props.plan.name
      form.quota_bytes = props.plan.quota_bytes
      form.description = props.plan.description
      form.level = props.plan.level
      form.enabled = props.plan.enabled
      form.reset_enabled = props.plan.reset_enabled ?? false
      form.reset_price = props.plan.reset_price ?? 0
      form.prices = (props.plan.prices && props.plan.prices.length ? props.plan.prices : [blankPrice()]).map(
        (p) => ({ ...p, duration_days: p.duration_days || DEFAULT_DAYS[p.period] || 30 }),
      )
    }
  },
)

function addPrice() {
  form.prices.push(blankPrice())
}
function removePrice(idx: number) {
  form.prices.splice(idx, 1)
  if (form.prices.length === 0) form.prices.push(blankPrice())
}
function onPeriodChange(p: PlanPrice) {
  p.duration_days = DEFAULT_DAYS[p.period] || 30
}

function buildRequest(): PlanRequest {
  return {
    name: form.name.trim(),
    quota_bytes: form.quota_bytes,
    description: form.description.trim() || undefined,
    level: form.level,
    enabled: form.enabled,
    reset_enabled: form.reset_enabled,
    reset_price: form.reset_price,
    prices: form.prices.map((p, i) => ({
      id: p.id,
      period: p.period,
      price: p.price,
      duration_days: p.duration_days || DEFAULT_DAYS[p.period] || 30,
      sort: i,
      enabled: p.enabled !== false,
    })),
  }
}

async function onSubmit() {
  if (!form.name) {
    ElMessage.error('Name is required')
    return
  }
  if (form.prices.length === 0) {
    ElMessage.error('At least one billing price is required')
    return
  }
  for (const p of form.prices) {
    if (p.price < 0) {
      ElMessage.error('Price must be >= 0')
      return
    }
  }
  saving.value = true
  try {
    const body = buildRequest()
    if (isEdit.value && props.plan) {
      await apiPlans.update(props.plan.id, body)
    } else {
      await apiPlans.create(body)
    }
    ElMessage.success(isEdit.value ? 'Plan updated' : 'Plan created')
    emit('saved')
    emit('update:modelValue', false)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? 'Edit Plan' : 'New Plan'"
    width="680px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-width="140px">
      <el-form-item label="Name" required>
        <el-input v-model="form.name" placeholder="e.g. Premium" />
      </el-form-item>
      <el-form-item label="Quota">
        <QuotaInput v-model="form.quota_bytes" />
        <span class="hint">{{ formatBytes(form.quota_bytes) }} (0 = unlimited)</span>
      </el-form-item>
      <el-form-item label="Level">
        <el-input-number v-model="form.level" :min="0" />
        <span class="hint">Level applied after subscription</span>
      </el-form-item>
      <el-form-item label="Description">
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="(optional)" />
      </el-form-item>
      <el-form-item label="Enabled">
        <el-switch v-model="form.enabled" />
      </el-form-item>

      <el-divider>Billing</el-divider>
      <div v-for="(p, idx) in form.prices" :key="idx" class="price-row">
        <el-select v-model="p.period" class="col-period" @change="onPeriodChange(p)">
          <el-option v-for="opt in PERIODS" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <div class="col-price">
          <el-input-number v-model="p.price" :min="0" :step="100"  />
          <span class="hint">{{ formatPrice(p.price) }}</span>
        </div>
        <div class="col-duration">
          <el-input-number v-model="p.duration_days" :min="1" :controls="false" />
          <span class="hint">days</span>
        </div>
        <el-switch v-model="p.enabled" />
        <el-button type="danger" link @click="removePrice(idx)">Remove</el-button>
      </div>
      <el-button type="primary" plain @click="addPrice">+ Add billing option</el-button>

      <el-divider>Traffic Reset</el-divider>
      <el-form-item label="Enabled">
        <el-switch v-model="form.reset_enabled" />
        <span class="hint">Let users self-reset used traffic after exhausting the plan quota.</span>
      </el-form-item>
      <el-form-item label="Reset price">
        <el-input-number v-model="form.reset_price" :min="0" :step="100" />
        <span class="hint">{{ formatPrice(form.reset_price) }}</span>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">Cancel</el-button>
      <el-button type="primary" :loading="saving" @click="onSubmit">
        {{ isEdit ? 'Save' : 'Create' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  display: inline-block;
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
.price-row {
  display: grid;
  grid-template-columns: 200px minmax(170px, 1fr) auto auto auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.price-row :deep(.el-select) {
  width: 100%;
}
.col-price,
.col-duration {
  display: flex;
  align-items: center;
  gap: 6px;
}
.col-price :deep(.el-input-number) {
  width: 140px;
}
.col-duration :deep(.el-input-number) {
  width: 70px;
}
.muted {
  color: #909399;
}
</style>
