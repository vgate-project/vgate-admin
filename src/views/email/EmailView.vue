<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiEmail } from '@/api/email'
import { apiUsers } from '@/api/users'
import type { User, EmailRecipients, SendEmailRequest } from '@/types/api'

const sending = ref(false)
const result = ref<{ message: string; sent: number; total: number; error?: string } | null>(null)

const recipientsOptions: { label: string; value: EmailRecipients }[] = [
  { label: 'All users', value: 'all' },
  { label: 'Active users only', value: 'active' },
  { label: 'Select users by ID', value: 'ids' },
]

const userOptions = ref<{ label: string; value: string }[]>([])

const form = reactive<SendEmailRequest>({
  recipients: 'all',
  user_ids: [],
  subject: '',
  body: '',
  create_announcement: false,
  pinned: false,
})

async function loadUsers() {
  try {
    const { data } = await apiUsers.list(1, 200)
    userOptions.value = data.items.map((u: User) => ({
      label: `${u.email}${u.username ? ` (${u.username})` : ''}`,
      value: u.id,
    }))
  } catch {
    userOptions.value = []
  }
}
onMounted(loadUsers)

function onRecipientsChange() {
  if (form.recipients !== 'ids') {
    form.user_ids = []
  }
}

async function onSubmit() {
  if (!form.subject.trim()) {
    ElMessage.error('Subject is required')
    return
  }
  if (!form.body.trim()) {
    ElMessage.error('Body is required')
    return
  }
  if (form.recipients === 'ids' && (!form.user_ids || form.user_ids.length === 0)) {
    ElMessage.error('Select at least one user for ID-targeted send')
    return
  }
  sending.value = true
  result.value = null
  try {
    const body: SendEmailRequest = {
      recipients: form.recipients,
      user_ids: form.recipients === 'ids' ? form.user_ids : undefined,
      subject: form.subject.trim(),
      body: form.body,
      create_announcement: form.create_announcement,
      pinned: form.pinned,
    }
    const { data } = await apiEmail.send(body)
    result.value = data
    if (data.sent === data.total || data.total === 0) {
      ElMessage.success(`Email sent to ${data.sent} recipient(s)`)
    } else {
      ElMessage.warning(`Sent ${data.sent} / ${data.total}. ${data.error || ''}`)
    }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">Send Email</h2>
    <el-card shadow="never" style="max-width: 880px">
      <el-form label-width="160px">
        <el-form-item label="Recipients" required>
          <el-radio-group v-model="form.recipients" @change="onRecipientsChange">
            <el-radio-button v-for="o in recipientsOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.recipients === 'ids'" label="Select users" required>
          <el-select
            v-model="form.user_ids"
            multiple
            filterable
            clearable
            style="width: 100%"
            placeholder="Choose users to email"
          >
            <el-option v-for="u in userOptions" :key="u.value" :label="u.label" :value="u.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="Subject" required>
          <el-input v-model="form.subject" placeholder="Email subject" maxlength="200" />
        </el-form-item>
        <el-form-item label="Body" required>
          <el-input
            v-model="form.body"
            type="textarea"
            :rows="10"
            placeholder="Email body (HTML supported)"
          />
        </el-form-item>
        <el-divider content-position="left">Also publish as announcement</el-divider>
        <el-form-item label="Create announcement">
          <el-switch v-model="form.create_announcement" />
          <span class="hint">Also save this message as a user-facing announcement.</span>
        </el-form-item>
        <el-form-item v-if="form.create_announcement" label="Pinned">
          <el-switch v-model="form.pinned" />
        </el-form-item>
      </el-form>

      <div style="display: flex; gap: 8px; margin-top: 8px">
        <el-button type="primary" :loading="sending" @click="onSubmit">Send</el-button>
      </div>

      <el-alert
        v-if="result"
        class="result"
        :type="result.sent === result.total ? 'success' : 'warning'"
        :closable="false"
        show-icon
      >
        <template #title>{{ result.message }}</template>
        <div>Sent {{ result.sent }} / {{ result.total }}.</div>
        <div v-if="result.error">{{ result.error }}</div>
      </el-alert>
    </el-card>
  </div>
</template>

<style scoped>
.result {
  margin-top: 16px;
}
.hint {
  display: inline-block;
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
