<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiTraffic } from '@/api/traffic'
import { apiUsers } from '@/api/users'
import { apiNodes } from '@/api/nodes'
import type { User, Node } from '@/types/api'
import type { TrafficRow } from '@/types/wire'
import { formatBytes } from '@/utils/format'

const rows = ref<TrafficRow[]>([])
const users = ref<User[]>([])
const nodes = ref<Node[]>([])
const loading = ref(false)
const filterUserId = ref<string>('')
const filterNodeId = ref<string>('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

onMounted(async () => {
  const [usersRes, nodesRes] = await Promise.all([apiUsers.list(1, 1000), apiNodes.list(1, 1000)])
  users.value = usersRes.data.items
  nodes.value = nodesRes.data.items
  await loadTraffic()
})

async function loadTraffic() {
  loading.value = true
  try {
    const { data } = await apiTraffic.list(filterUserId.value, filterNodeId.value, page.value, pageSize.value)
    rows.value = data.items
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function onSizeChange() {
  page.value = 1
  loadTraffic()
}

function onFilter() {
  page.value = 1
  loadTraffic()
}

function nodeLabel(id: string): string {
  const n = nodes.value.find((n) => n.id === id)
  return n ? `${n.name} (${n.address}:${n.port})` : id
}
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">Traffic</h2>
    <el-card shadow="never">
      <el-form :inline="true" style="margin-bottom: 12px">
        <el-form-item label="User">
          <el-select v-model="filterUserId" clearable placeholder="All users" style="width: 200px">
            <el-option v-for="u in users" :key="u.id" :label="u.email" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="Node">
          <el-select v-model="filterNodeId" clearable placeholder="All nodes" style="width: 200px">
            <el-option v-for="n in nodes" :key="n.id" :label="`${n.name} (${n.address}:${n.port})`" :value="n.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onFilter">Filter</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="rows" v-loading="loading" empty-text="No traffic data">
        <el-table-column prop="email" label="Email" width="180" />
        <el-table-column label="Node" min-width="180">
          <template #default="{ row }">{{ nodeLabel(row.node_id) }}</template>
        </el-table-column>
        <el-table-column label="Upload" min-width="120">
          <template #default="{ row }">{{ formatBytes(row.up_total) }}</template>
        </el-table-column>
        <el-table-column label="Download" min-width="120">
          <template #default="{ row }">{{ formatBytes(row.down_total) }}</template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        class="pager"
        @size-change="onSizeChange"
        @current-change="loadTraffic"
      />
    </el-card>
  </div>
</template>

<style scoped>
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
