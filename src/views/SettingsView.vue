<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiAuth } from '@/api/auth'
import { apiTelegram } from '@/api/telegram'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const form = reactive({
  old_password: '',
  new_password: '',
  confirm: '',
})
const saving = ref(false)

function reset() {
  form.old_password = ''
  form.new_password = ''
  form.confirm = ''
}

async function onSubmit() {
  if (form.new_password.length < 8) {
    ElMessage.error('New password must be at least 8 characters')
    return
  }
  if (form.new_password !== form.confirm) {
    ElMessage.error('New passwords do not match')
    return
  }
  saving.value = true
  try {
    await apiAuth.changePassword({
      old_password: form.old_password,
      new_password: form.new_password,
    })
    ElMessage.success('Password updated. Please log in again.')
    reset()
    // Refresh tokens are revoked on password change — force a fresh login.
    auth.logout()
    window.location.href = '/login'
  } catch {
    // Error already surfaced by the http interceptor.
  } finally {
    saving.value = false
  }
}

// Telegram link state — mirrors the user-portal Settings experience.
const tg = reactive({
  available: false, // Telegram bot is enabled and the admin can bind
  bound: false,
  code: '', // one-time bind code (prefixed a_) to send via /astart
  deepLink: '', // https t.me link (copy fallback)
  tgLink: '', // native tg:// link that opens the Telegram app directly
  pending: false, // a bind code was issued, awaiting /astart confirmation
  linking: false,
  unbinding: false,
})

let pollTimer: ReturnType<typeof setInterval> | null = null
let pollAttempts = 0

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling() {
  stopPolling()
  pollAttempts = 0
  pollTimer = setInterval(async () => {
    pollAttempts++
    try {
      const { data } = await apiTelegram.selfStatus()
      if (data.bound) {
        tg.bound = true
        tg.pending = false
        tg.code = ''
        tg.deepLink = ''
        tg.tgLink = ''
        stopPolling()
      }
    } catch {
      // Ignore transient errors; the bot may still be confirming.
    }
    if (pollAttempts >= 40) {
      stopPolling()
      if (!tg.bound) {
        tg.pending = false
        ElMessage.warning('Telegram bind not confirmed yet. Send /astart in Telegram, then refresh.')
      }
    }
  }, 3000)
}

async function loadStatus() {
  try {
    const { data } = await apiTelegram.selfStatus()
    tg.available = data.available ?? false
    tg.bound = data.bound
  } catch {
    // Telegram is optional; ignore lookup failures.
  }
}

async function startLink() {
  tg.linking = true
  try {
    const { data } = await apiTelegram.selfBind()
    tg.code = data.code
    tg.deepLink = data.deep_link
    tg.tgLink = data.tg_link
    tg.pending = true
    ElMessage.success('Open the link in Telegram and send /astart to finish linking.')
    startPolling()
  } catch {
    // Error already surfaced by the http interceptor.
  } finally {
    tg.linking = false
  }
}

async function unlink() {
  tg.unbinding = true
  try {
    await apiTelegram.selfUnbind()
    tg.bound = false
    tg.pending = false
    tg.code = ''
    tg.deepLink = ''
    tg.tgLink = ''
    stopPolling()
    ElMessage.success('Telegram unlinked')
  } catch {
    // Error already surfaced by the http interceptor.
  } finally {
    tg.unbinding = false
  }
}

function copyLink() {
  navigator.clipboard.writeText(tg.deepLink)
  ElMessage.success('Link copied')
}

onMounted(loadStatus)
onUnmounted(stopPolling)
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">Account Settings</h2>
    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: stretch">
    <el-card shadow="never" style="max-width: 560px; flex: 1 1 360px">
      <el-descriptions :column="1" border label-width="140px">
        <el-descriptions-item label="Username">{{ auth.username }}</el-descriptions-item>
        <el-descriptions-item label="Role">
          <el-tag :type="auth.isSuperAdmin ? 'danger' : 'info'" size="small">{{ auth.role }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <el-divider />

      <template v-if="tg.available">
        <el-descriptions :column="1" border label-width="140px">
          <el-descriptions-item label="Telegram">
            <el-tag :type="tg.bound ? 'success' : 'info'" size="small">
              {{ tg.bound ? 'Linked' : 'Not linked' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="tg.pending && !tg.bound" style="margin-top: 16px">
          <el-alert
            type="warning"
            :closable="false"
            title="Open the link in Telegram (on the device with your admin account), then send /astart to finish linking."
          />
          <p v-if="tg.code" style="margin: 12px 0 0">
            Bind code: <code>{{ tg.code }}</code>
          </p>
          <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
            <el-link v-if="tg.tgLink" type="primary" :href="tg.tgLink" target="_blank">
              Open in Telegram
            </el-link>
            <el-input :model-value="tg.deepLink" readonly style="max-width: 420px" />
            <el-button @click="copyLink">Copy</el-button>
          </div>
        </div>

        <div v-else-if="!tg.bound" style="margin-top: 16px; display: flex; gap: 8px">
          <el-button type="primary" :loading="tg.linking" @click="startLink">Bind Telegram</el-button>
        </div>

        <div v-else style="margin-top: 16px; display: flex; gap: 8px">
          <el-button type="danger" :loading="tg.unbinding" @click="unlink">Unbind</el-button>
        </div>
      </template>
    </el-card>

    <el-card shadow="never" style="max-width: 560px; flex: 1 1 360px">
      <el-form label-position="left" label-width="140px" style="margin-top: 8px">
        <el-form-item label="Current password" required>
          <el-input
            v-model="form.old_password"
            type="password"
            show-password
            autocomplete="current-password"
            placeholder="Enter your current password"
          />
        </el-form-item>
        <el-form-item label="New password" required>
          <el-input
            v-model="form.new_password"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="At least 8 characters"
          />
        </el-form-item>
        <el-form-item label="Confirm" required>
          <el-input
            v-model="form.confirm"
            type="password"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSubmit">Update Password</el-button>
          <el-button @click="reset">Reset</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    </div>
  </div>
</template>
