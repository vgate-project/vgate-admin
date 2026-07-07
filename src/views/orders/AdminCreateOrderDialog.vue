<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { apiOrders } from '@/api/orders'
import { apiPlans } from '@/api/plans'
import { apiUsers } from '@/api/users'
import type { Plan, User } from '@/types/api'
import { formatPrice } from '@/utils/format'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; created: [string] }>()

const saving = ref(false)
const users = ref<User[]>([])
const plans = ref<Plan[]>([])

const form = reactive({
  user_id: '' as string,
  plan_id: '' as string,
  channel: 'pc' as 'pc' | 'wap',
})

const enabledPlans = computed(() => plans.value.filter((p) => p.enabled))

// Lazily load users + plans the first time the dialog opens.
async function ensureData() {
  if (users.value.length && plans.value.length) return
  try {
    const [u, p] = await Promise.all([apiUsers.list(1, 200), apiPlans.list()])
    users.value = u.data.items
    plans.value = p.data
  } catch {
    /* error surfaced via ElMessage in submit */
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    form.user_id = ''
    form.plan_id = ''
    form.channel = 'pc'
    ensureData()
  },
)

async function onSubmit() {
  if (!form.user_id) {
    ElMessage.error('Select a user')
    return
  }
  if (!form.plan_id) {
    ElMessage.error('Select a plan')
    return
  }
  saving.value = true
  try {
    const { data } = await apiOrders.createForUser({
      user_id: form.user_id,
      kind: 'plan',
      plan_id: form.plan_id,
      channel: form.channel,
    })
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
      <el-form-item label="Plan" required>
        <el-select
          v-model="form.plan_id"
          filterable
          placeholder="Select plan"
          style="width: 100%"
        >
          <el-option
            v-for="p in enabledPlans"
            :key="p.id"
            :label="`${p.name} — ${formatPrice(p.prices?.[0]?.price ?? 0)}`"
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
