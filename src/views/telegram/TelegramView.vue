<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { apiTelegram } from '@/api/telegram'
import type { TelegramBroadcastResult } from '@/api/telegram'

// Telegram admin self-link (bind/unbind) now lives in the admin Settings
// page, mirroring the user portal. This view is the broadcast-only form.
const sending = ref(false)
const result = ref<TelegramBroadcastResult | null>(null)

const form = reactive({
  message: '',
  create_announcement: false,
  title: '',
  pinned: false,
})

async function onSubmit() {
  if (!form.message.trim()) {
    ElMessage.error('Message is required')
    return
  }
  if (form.create_announcement && !form.title.trim()) {
    ElMessage.error('Title is required when publishing as an announcement')
    return
  }
  sending.value = true
  result.value = null
  try {
    const { data } = await apiTelegram.broadcast({
      message: form.message,
      create_announcement: form.create_announcement,
      title: form.create_announcement ? form.title.trim() : undefined,
      pinned: form.pinned,
    })
    result.value = data
    if (data.total !== undefined && data.sent === data.total) {
      ElMessage.success(`Telegram message sent to ${data.sent} recipient(s)`)
    } else if (data.total !== undefined) {
      ElMessage.warning(`Sent ${data.sent} / ${data.total}.`)
    } else {
      ElMessage.success('Done')
    }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">Telegram Broadcast</h2>
    <el-card shadow="never" style="max-width: 880px">
      <el-alert
        type="info"
        :closable="false"
        style="margin-bottom: 16px"
        title="Delivers to every user who linked Telegram and opted into notifications. Requires the Telegram bot to be enabled with a valid token."
      />
      <el-form label-width="180px">
        <el-form-item label="Message" required>
          <el-input
            v-model="form.message"
            type="textarea"
            :rows="10"
            placeholder="Message sent to linked Telegram users"
          />
        </el-form-item>
        <el-divider content-position="left">Also publish as announcement</el-divider>
        <el-form-item label="Create announcement">
          <el-switch v-model="form.create_announcement" />
        </el-form-item>
        <el-form-item v-if="form.create_announcement" label="Title" required>
          <el-input v-model="form.title" placeholder="Announcement title" maxlength="200" />
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
        :type="result.total !== undefined && result.sent !== result.total ? 'warning' : 'success'"
        :closable="false"
        show-icon
      >
        <template #title>{{ result.message }}</template>
        <div v-if="result.total !== undefined">Sent {{ result.sent }} / {{ result.total }}.</div>
      </el-alert>
    </el-card>
  </div>
</template>

<style scoped>
.result {
  margin-top: 16px;
}
</style>
