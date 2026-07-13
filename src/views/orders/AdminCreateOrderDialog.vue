<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { apiOrders } from '@/api/orders'
import { apiPlans } from '@/api/plans'
import { apiUsers } from '@/api/users'
import { apiTrafficPackages } from '@/api/traffic'
import type { Plan, User, TrafficPackage, AdminCreateOrderRequest } from '@/types/api'
import { formatPrice, formatBytes } from '@/utils/format'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; created: [string] }>()

const saving = ref(false)
const users = ref<User[]>([])
const plans = ref<Plan[]>([])
const trafficPackages = ref<TrafficPackage[]>([])

type OrderKind = 'plan' | 'traffic' | 'reset'
const form = reactive({
  user_id: '' as string,
  kind: 'plan' as OrderKind,
  plan_price_id: '' as string,
  traffic_package_id: '' as string,
  plan_id: '' as string,
  channel: 'pc' as 'pc' | 'wap',
})

const PERIOD_LABELS: Record<string, string> = {
  month: 'Monthly',
  quarter: 'Quarterly',
  half_year: 'Half-year',
  year: 'Yearly',
}

// Each enabled plan's enabled prices flattened into one selectable list, so the
// admin picks an explicit billing period (month/quarter/year) for plan orders.
const planOptions = computed(() =>
  plans.value
    .filter((p) => p.enabled)
    .flatMap((p) =>
      (p.prices ?? [])
        .filter((pr) => pr.enabled !== false)
        .map((pr) => ({
          value: pr.id ?? '',
          plan_id: p.id,
          label: `${p.name} — ${PERIOD_LABELS[pr.period] ?? pr.period} — ${formatPrice(pr.price)}`,
        })),
    ),
)

// Plans that actually expose a traffic-reset package, for reset orders.
const resetPlans = computed(() =>
  plans.value.filter((p) => p.enabled && p.reset_enabled),
)

// Lazily load users + plans + traffic packages the first time the dialog opens.
async function ensureData() {
  if (users.value.length && plans.value.length && trafficPackages.value.length) return
  try {
    const [u, p, t] = await Promise.all([
      apiUsers.list(1, 200),
      apiPlans.list(),
      apiTrafficPackages.list(),
    ])
    users.value = u.data.items
    plans.value = p.data
    trafficPackages.value = t.data
  } catch {
    /* error surfaced via ElMessage in submit */
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    form.user_id = ''
    form.kind = 'plan'
    form.plan_price_id = ''
    form.traffic_package_id = ''
    form.plan_id = ''
    form.channel = 'pc'
    ensureData()
  },
)

// Switching kind clears the now-irrelevant selection.
watch(
  () => form.kind,
  () => {
    form.plan_price_id = ''
    form.traffic_package_id = ''
    form.plan_id = ''
  },
)

async function onSubmit() {
  if (!form.user_id) {
    ElMessage.error('Select a user')
    return
  }

  let body: AdminCreateOrderRequest
  if (form.kind === 'plan') {
    const opt = planOptions.value.find((o) => o.value === form.plan_price_id)
    if (!opt) {
      ElMessage.error('Select a plan & billing period')
      return
    }
    body = {
      user_id: form.user_id,
      kind: 'plan',
      plan_id: opt.plan_id,
      plan_price_id: opt.value,
      channel: form.channel,
    }
  } else if (form.kind === 'traffic') {
    if (!form.traffic_package_id) {
      ElMessage.error('Select a traffic package')
      return
    }
    body = {
      user_id: form.user_id,
      kind: 'traffic',
      traffic_package_id: form.traffic_package_id,
      channel: form.channel,
    }
  } else {
    if (!form.plan_id) {
      ElMessage.error('Select a plan to reset')
      return
    }
    body = {
      user_id: form.user_id,
      kind: 'reset',
      plan_id: form.plan_id,
      channel: form.channel,
    }
  }

  saving.value = true
  try {
    const { data } = await apiOrders.createForUser(body)
    ElMessage.success('Order created')
    emit('created', data.pay_url)
    emit('update:modelValue', false)
  } finally {
    saving.value = false
  }
}

function userLabel(u: User): string {
  return u.username ? `${u.email} (${u.username})` : u.email
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="New Order (on behalf of user)"
    width="560px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-width="120px">
      <el-form-item label="User" required>
        <el-select
          v-model="form.user_id"
          filterable
          placeholder="Select user"
          style="width: 100%"
        >
          <el-option v-for="u in users" :key="u.id" :label="userLabel(u)" :value="u.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="Type" required>
        <el-radio-group v-model="form.kind">
          <el-radio value="plan">Plan</el-radio>
          <el-radio value="traffic">Traffic Pkg</el-radio>
          <el-radio value="reset">Reset</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="form.kind === 'plan'" label="Plan" required>
        <el-select
          v-model="form.plan_price_id"
          filterable
          placeholder="Select plan & billing period"
          style="width: 100%"
        >
          <el-option v-for="o in planOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>

      <el-form-item v-else-if="form.kind === 'traffic'" label="Traffic Pkg" required>
        <el-select
          v-model="form.traffic_package_id"
          filterable
          placeholder="Select traffic package"
          style="width: 100%"
        >
          <el-option
            v-for="pkg in trafficPackages"
            :key="pkg.id"
            :label="`${pkg.name} — ${formatBytes(pkg.quota_bytes)} — ${formatPrice(pkg.price)}`"
            :value="pkg.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item v-else label="Plan" required>
        <el-select
          v-model="form.plan_id"
          filterable
          placeholder="Select plan to reset"
          style="width: 100%"
        >
          <el-option
            v-for="p in resetPlans"
            :key="p.id"
            :label="`${p.name} — ${formatPrice(p.reset_price ?? 0)}`"
            :value="p.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="Channel">
        <el-radio-group v-model="form.channel">
          <el-radio value="pc">PC (page.pay)</el-radio>
          <el-radio value="wap">Mobile (wap.pay)</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">Cancel</el-button>
      <el-button type="primary" :loading="saving" @click="onSubmit">Create Order</el-button>
    </template>
  </el-dialog>
</template>
