<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{ modelValue: number }>()
const emit = defineEmits<{ 'update:modelValue': [number] }>()

type Unit = 'B' | 'KB' | 'MB' | 'GB'
const factors: Record<Unit, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }
const unit = ref<Unit>('GB')

// Display the quota in the selected unit; source of truth stays in bytes.
const display = computed({
  get: () => (props.modelValue === 0 ? 0 : props.modelValue / factors[unit.value]),
  set: (v: number) => emit('update:modelValue', Math.round((v || 0) * factors[unit.value])),
})
</script>

<template>
  <div class="quota-input">
    <el-input-number v-model="display" :min="0" :precision="2" controls-position="right" />
    <el-select v-model="unit" class="quota-unit">
      <el-option label="GB" value="GB" />
      <el-option label="MB" value="MB" />
      <el-option label="KB" value="KB" />
      <el-option label="B" value="B" />
    </el-select>
  </div>
</template>

<style scoped>
.quota-input {
  display: flex;
  gap: 8px;
  align-items: center;
}
.quota-unit {
  width: 90px;
}
</style>
