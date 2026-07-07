<script setup lang="ts">
import { ref, watch } from 'vue'
import { apiNodes } from '@/api/nodes'
import type { User } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const props = defineProps<{ modelValue: boolean; nodeId: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const users = ref<User[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

async function load() {
  if (!props.nodeId) return
  loading.value = true
  try {
    const { data } = await apiNodes.users(props.nodeId, page.value, pageSize.value)
    users.value = data.items
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function onSizeChange() {
  page.value = 1
  load()
}

watch(
  () => props.modelValue,
  (v) => {
    if (v && props.nodeId) {
      page.value = 1
      load()
    } else {
      users.value = []
      total.value = 0
    }
  },
)
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    title="Assigned Users"
    width="640px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-table :data="users" v-loading="loading" size="small" empty-text="No users assigned">
      <el-table-column prop="email" label="Email" />
      <el-table-column prop="level" label="Level" width="80" />
      <el-table-column label="Enabled" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
            {{ row.enabled ? 'yes' : 'no' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Expire" width="170">
        <template #default="{ row }">{{ formatDateTime(row.expire_at) }}</template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      class="pager"
      @size-change="onSizeChange"
      @current-change="load"
    />
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">Close</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
