<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiUsers } from '@/api/users'
import { useReferenceStore } from '@/stores/reference'
import type { Node } from '@/types/api'

const props = defineProps<{ modelValue: boolean; userId: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [] }>()

const reference = useReferenceStore()
const allNodes = computed<Node[]>(() => reference.nodes)
const selectedIds = ref<string[]>([])
const userLevel = ref(0)
const loading = ref(false)
const saving = ref(false)

// Only nodes above the user's level need an explicit grant (the level tier
// already grants every node with level <= user.level), so the transfer lists
// just those.
const transferData = computed(() =>
  allNodes.value
    .filter((n) => n.level > userLevel.value)
    .map((n) => ({ key: n.id, label: `${n.name} (${n.address}:${n.port})` })),
)

watch(() => props.modelValue, async (v) => {
  if (!v || !props.userId) return
  loading.value = true
  try {
    const [userRes, userNodesRes] = await Promise.all([
      apiUsers.get(props.userId),
      apiUsers.nodes(props.userId),
    ])
    // Node list comes from the shared reference store (cached app-wide).
    await reference.get()
    userLevel.value = userRes.data.level
    // Only above-level nodes are managed here; within-level ones are auto-granted.
    selectedIds.value = userNodesRes.data
      .filter((n) => n.level > userLevel.value)
      .map((n) => n.id)
  } finally {
    loading.value = false
  }
})

async function onSubmit() {
  saving.value = true
  try {
    await apiUsers.setNodes(props.userId!, selectedIds.value)
    ElMessage.success('Node access updated')
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
    title="Manage Node Access"
    width="640px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="hint">
      Only nodes above the user's level (level {{ userLevel }}) need assignment;
      lower-level nodes are granted automatically.
    </p>
    <el-transfer
      v-model="selectedIds"
      :data="transferData"
      :titles="['Available', 'Assigned']"
      v-loading="loading"
      filterable
    />
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">Cancel</el-button>
      <el-button type="primary" :loading="saving" @click="onSubmit">Save</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  margin: 0 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
