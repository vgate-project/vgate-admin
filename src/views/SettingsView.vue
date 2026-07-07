<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { apiAuth } from '@/api/auth'
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
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">Account Settings</h2>
    <el-card shadow="never" style="max-width: 560px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="Username">{{ auth.username }}</el-descriptions-item>
        <el-descriptions-item label="Role">
          <el-tag :type="auth.isSuperAdmin ? 'danger' : 'info'" size="small">{{ auth.role }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <el-divider />

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
</template>
