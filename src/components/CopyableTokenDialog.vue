<script setup lang="ts">
import { ElMessage } from 'element-plus'

interface TokenItem {
  label: string
  value: string
  mono?: boolean
}

const props = defineProps<{
  modelValue: boolean
  title?: string
  items: TokenItem[]
  warning?: string
  resetLabel?: string
  emptyText?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean]; reset: [] }>()

function close() {
  emit('update:modelValue', false)
}

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    ElMessage.success('Copied')
  } catch {
    ElMessage.error('Copy failed')
  }
}
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    :title="props.title ?? 'Token'"
    width="560px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-alert
      v-if="props.warning && props.items.length"
      type="warning"
      :title="props.warning"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    />
    <p v-if="!props.items.length && props.emptyText" class="empty-hint">{{ props.emptyText }}</p>
    <div v-for="item in props.items" :key="item.label" class="token-row">
      <label class="token-label">{{ item.label }}</label>
      <template v-if="item.value.includes('\n')">
        <el-input
          :model-value="item.value"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 16 }"
          readonly
          :class="{ mono: item.mono }"
        />
        <el-button class="copy-btn" @click="copy(item.value)">
          <el-icon><CopyDocument /></el-icon><span>Copy</span>
        </el-button>
      </template>
      <el-input v-else :model-value="item.value" readonly :class="{ mono: item.mono }">
        <template #append>
          <el-button @click="copy(item.value)">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
        </template>
      </el-input>
    </div>
    <template #footer>
      <el-button v-if="props.resetLabel" @click="emit('reset')">{{ props.resetLabel }}</el-button>
      <el-button type="primary" @click="close">Done</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.token-row {
  margin-bottom: 12px;
}
.copy-btn {
  margin-top: 8px;
}
.empty-hint {
  color: #909399;
  margin: 0;
}
.token-label {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.mono :deep(input) {
  font-family: monospace;
}
</style>
