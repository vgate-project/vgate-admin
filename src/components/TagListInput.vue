<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  modelValue?: string[]
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const inputValue = ref('')
// Coalesce undefined → [] so optional backend arrays (string[]?) work.
const list = computed(() => props.modelValue ?? [])

function add() {
  const v = inputValue.value.trim()
  if (!v) return
  if (!list.value.includes(v)) {
    emit('update:modelValue', [...list.value, v])
  }
  inputValue.value = ''
}

function remove(idx: number) {
  const next = [...list.value]
  next.splice(idx, 1)
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="tag-list">
    <el-tag
      v-for="(tag, idx) in list"
      :key="idx"
      closable
      @close="remove(idx)"
      class="tag-item"
    >
      {{ tag }}
    </el-tag>
    <el-input
      v-model="inputValue"
      class="tag-input"
      :placeholder="props.placeholder ?? 'Add + Enter'"
      @keyup.enter="add"
    />
  </div>
</template>

<style scoped>
.tag-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 6px 8px;
  min-height: 40px;
  width: 100%;
}
.tag-item {
  margin: 2px;
  max-width: 100%;
}
.tag-input {
  flex: 1 1 240px;
  min-width: 180px;
}
.tag-input :deep(.el-input__wrapper) {
  box-shadow: none !important;
}
</style>
