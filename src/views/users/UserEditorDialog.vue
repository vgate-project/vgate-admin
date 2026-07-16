<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { apiUsers } from '@/api/users'
import type { User, UserRequest } from '@/types/api'
import { formatDateTime } from '@/utils/format'
import { formatBytes } from '@/utils/format'
import QuotaInput from '@/components/QuotaInput.vue'

const props = defineProps<{ modelValue: boolean; user: User | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [subToken?: string] }>()

// 1 Mbps = 125000 bytes/sec. The backend stores speed limits in bytes/sec
// (0 = unlimited); the UI presents them in Mbps for operator convenience.
const BPS_PER_MBPS = 125000

const isEdit = computed(() => !!props.user)
const saving = ref(false)

const form = reactive({
  email: '',
  username: '',
  level: 0,
  expire_at: null as string | null,
  quota_bytes: 0,
  quota_reset_enabled: false,
  speed_limit_up_mbps: 0,
  speed_limit_down_mbps: 0,
  enabled: true,
  max_invites: null as number | null,
})

function resetForm() {
  form.email = ''
  form.username = ''
  form.level = 0
  form.expire_at = null
  form.quota_bytes = 0
  form.quota_reset_enabled = false
  form.speed_limit_up_mbps = 0
  form.speed_limit_down_mbps = 0
  form.enabled = true
  form.max_invites = null
}

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    resetForm()
    if (props.user) {
      form.email = props.user.email
      form.username = props.user.username ?? ''
      form.level = props.user.level
      form.expire_at = props.user.expire_at ?? null
      form.quota_bytes = props.user.quota_bytes
      form.quota_reset_enabled = props.user.quota_reset_enabled
      form.speed_limit_up_mbps = Math.round((props.user.speed_limit_up_bps ?? 0) / BPS_PER_MBPS)
      form.speed_limit_down_mbps = Math.round((props.user.speed_limit_down_bps ?? 0) / BPS_PER_MBPS)
      form.enabled = props.user.enabled
      form.max_invites = props.user.max_invites ?? null
    }
  },
)

function buildRequest(): UserRequest {
  return {
    email: form.email,
    username: form.username.trim() || null,
    level: form.level,
    expire_at: form.expire_at,
    quota_bytes: form.quota_bytes,
    quota_reset_enabled: form.quota_reset_enabled,
    speed_limit_up_bps: Math.round(form.speed_limit_up_mbps * BPS_PER_MBPS),
    speed_limit_down_bps: Math.round(form.speed_limit_down_mbps * BPS_PER_MBPS),
    enabled: form.enabled,
    max_invites: form.max_invites,
  }
}

async function onSubmit() {
  if (!form.email) {
    ElMessage.error('Email is required')
    return
  }
  saving.value = true
  try {
    const body = buildRequest()
    if (isEdit.value && props.user) {
      await apiUsers.update(props.user.id, body)
      emit('saved')
    } else {
      const { data } = await apiUsers.create(body)
      emit('saved', data.sub_token)
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? 'Edit User' : 'New User'"
    width="560px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-width="140px">
      <el-form-item label="Email" required>
        <el-input v-model="form.email" placeholder="user@example.com" />
      </el-form-item>
      <el-form-item label="Username">
        <el-input v-model="form.username" placeholder="(optional, enables /user/login)" />
      </el-form-item>
      <el-form-item label="Level">
        <el-input-number v-model="form.level" :min="0" />
      </el-form-item>
      <el-form-item label="Expire at">
        <el-date-picker
          v-model="form.expire_at"
          type="datetime"
          clearable
          value-format="YYYY-MM-DDTHH:mm:ssZ"
          placeholder="never"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="Quota">
        <QuotaInput v-model="form.quota_bytes" />
        <span class="hint">0 = unlimited. Used: {{ formatBytes(form.quota_bytes) }}</span>
      </el-form-item>
      <el-form-item label="Monthly reset">
        <el-switch v-model="form.quota_reset_enabled" />
        <span class="hint">Participates in the global monthly reset (reset day set by system config quota.reset_day).</span>
      </el-form-item>
      <el-form-item label="Upload speed limit">
        <el-input-number v-model="form.speed_limit_up_mbps" :min="0" :max="10000" :step="10" />
        <span class="hint">Mbps per-user cap (0 = unlimited). Effective rate is min of this and the node's global limit.</span>
      </el-form-item>
      <el-form-item label="Download speed limit">
        <el-input-number v-model="form.speed_limit_down_mbps" :min="0" :max="10000" :step="10" />
        <span class="hint">Mbps per-user cap (0 = unlimited). Effective rate is min of this and the node's global limit.</span>
      </el-form-item>
      <el-form-item label="Enabled">
        <el-switch v-model="form.enabled" />
      </el-form-item>
      <el-form-item label="Invite quota">
        <el-input-number v-model="form.max_invites" :min="0" :value-on-clear="null" controls-position="right" />
        <span class="hint">Max successful registrations this user may sponsor (overrides the default). Empty = use system default.</span>
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
</style>
