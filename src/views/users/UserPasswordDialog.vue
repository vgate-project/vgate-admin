<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiUsers } from '@/api/users'

const props = defineProps<{ modelValue: boolean; userId: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [] }>()

const password = ref('')
const confirm = ref('')
const saving = ref(false)

watch(() => props.modelValue, (v) => {
  if (!v) return
  password.value = ''
  confirm.value = ''
})

async function onSubmit() {
  if (!password.value) {
    ElMessage.error('Password is required')
    return
  }
  if (password.value !== confirm.value) {
    ElMessage.error('Passwords do not match')
    return
  }
  saving.value = true
  try {
    await apiUsers.setPassword(props.userId!, password.value)
    ElMessage.success('Password updated')
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
    title="Set Password"
    width="400px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-width="130px">
      <el-form-item label="New password" required>
        <el-input v-model="password" type="password" show-password autocomplete="new-password" />
      </el-form-item>
      <el-form-item label="Confirm password" required>
        <el-input v-model="confirm" type="password" show-password autocomplete="new-password" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">Cancel</el-button>
      <el-button type="primary" :loading="saving" @click="onSubmit">Save</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.el-form :deep(.el-form-item__label) {
  white-space: nowrap;
}
</style>
