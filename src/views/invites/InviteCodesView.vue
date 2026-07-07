<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiInvites } from '@/api/invites'
import type { InviteCode, InviteRequest } from '@/types/api'
import { formatDateTime } from '@/utils/format'
import CopyableTokenDialog from '@/components/CopyableTokenDialog.vue'

const codes = ref<InviteCode[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const editorVisible = ref(false)
const form = ref<InviteRequest>({ max_uses: 1, expires_at: null, note: '' })

// Dialog that shows a freshly generated code so the admin can copy it.
const tokenDialog = ref(false)
const tokenItems = ref<{ label: string; value: string; mono?: boolean }[]>([])

async function load() {
  loading.value = true
  try {
    const { data } = await apiInvites.list(page.value, pageSize.value)
    codes.value = data.items
    total.value = data.total
  } finally {
    loading.value = false
  }
}
onMounted(load)

function onSizeChange() {
  page.value = 1
  load()
}

function openCreate() {
  form.value = { max_uses: 1, expires_at: null, note: '' }
  editorVisible.value = true
}

function remaining(c: InviteCode): number {
  return Math.max(0, c.max_uses - c.used_count)
}

async function onSubmit() {
  if (!form.value.max_uses || form.value.max_uses < 1) {
    ElMessage.error('Max uses must be at least 1')
    return
  }
  const body: InviteRequest = {
    max_uses: form.value.max_uses,
    expires_at: form.value.expires_at || null,
    note: form.value.note || '',
  }
  const { data } = await apiInvites.create(body)
  editorVisible.value = false
  ElMessage.success('Invite code created')
  tokenItems.value = [{ label: 'Invite Code (share with the new user)', value: data.code, mono: true }]
  tokenDialog.value = true
  load()
}

async function onDelete(c: InviteCode) {
  try {
    await ElMessageBox.confirm(`Delete invite code "${c.code}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }
  await apiInvites.remove(c.id)
  ElMessage.success('Invite code deleted')
  load()
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Invite Codes</h2>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon><span>New Invite Code</span>
      </el-button>
    </div>
    <el-card shadow="never">
      <el-table :data="codes" v-loading="loading" empty-text="No invite codes yet" max-height="calc(100vh - 20px)">
        <el-table-column prop="code" label="Code" width="160">
          <template #default="{ row }"><code class="mono">{{ row.code }}</code></template>
        </el-table-column>
        <el-table-column prop="note" label="Note" width="160">
          <template #default="{ row }">{{ row.note || '—' }}</template>
        </el-table-column>
        <el-table-column label="Uses" width="90">
          <template #default="{ row }">{{ row.used_count }} / {{ row.max_uses }}</template>
        </el-table-column>
        <el-table-column label="Remaining" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="remaining(row as InviteCode) > 0 ? 'success' : 'info'">{{ remaining(row as InviteCode) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Source" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.created_by_admin_id" size="small" type="warning">admin</el-tag>
            <el-tag v-else size="small" type="info">user</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Expires" width="170">
          <template #default="{ row }">{{ formatDateTime(row.expires_at) || 'never' }}</template>
        </el-table-column>
        <el-table-column label="Created" width="170">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="Actions" min-width="100" fixed="right">
          <template #default="{ row }">
            <el-popconfirm title="Delete this code?" @confirm="onDelete(row as InviteCode)">
              <template #reference>
                <el-button size="small" type="danger">Delete</el-button>
              </template>
            </el-popconfirm>
          </template>
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
        @current-change="load"
      />
    </el-card>

    <el-dialog v-model="editorVisible" title="New Invite Code" width="520px">
      <el-form label-width="140px">
        <el-form-item label="Max uses" required>
          <el-input-number v-model="form.max_uses" :min="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="Expires at">
          <el-date-picker
            v-model="form.expires_at"
            type="datetime"
            clearable
            value-format="YYYY-MM-DDTHH:mm:ssZ"
            placeholder="never"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="Note">
          <el-input v-model="form.note" placeholder="optional" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">Cancel</el-button>
        <el-button type="primary" @click="onSubmit">Create</el-button>
      </template>
    </el-dialog>

    <CopyableTokenDialog v-model="tokenDialog" title="Invite Code" :items="tokenItems"
      warning="Share this code with the new user. It cannot be shown again." />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.mono {
  font-family: monospace;
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
h2 {
  margin: 0;
}
</style>
