<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiUsers } from '@/api/users'
import type { User } from '@/types/api'
import { formatBytes, formatDateTime } from '@/utils/format'
import UserEditorDialog from './UserEditorDialog.vue'
import UserPasswordDialog from './UserPasswordDialog.vue'
import UserNodesDialog from './UserNodesDialog.vue'
import CopyableTokenDialog from '@/components/CopyableTokenDialog.vue'

const users = ref<User[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const editorVisible = ref(false)
const editingUser = ref<User | null>(null)

const passwordVisible = ref(false)
const passwordUserId = ref<string | null>(null)

const nodesVisible = ref(false)
const nodesUserId = ref<string | null>(null)

const tokenDialog = ref(false)
const tokenTitle = ref('Sub Token')
const tokenItems = ref<{ label: string; value: string; mono?: boolean }[]>([])
const tokenWarning = ref('')
const tokenUserId = ref<string | null>(null)
const resetLabel = computed(() => (tokenUserId.value ? 'Reset Sub Token' : ''))

// Subscription address: displayed (and copyable) on click. The subscription URL
// is built client-side from the user's sub token and the configured API base.
const subDialog = ref(false)
const subTitle = ref('Subscription URL')
const subItems = ref<{ label: string; value: string; mono?: boolean }[]>([])

function subscriptionUrl(subToken: string): string {
  // Prefer an absolute API base URL (env.js) when set; otherwise derive the
  // origin from the page so the copied link is a usable absolute URL.
  const envBase = window.__ENV__?.API_BASE_URL
  const base =
    envBase && /^https?:\/\//.test(envBase) ? envBase : window.location.origin + '/api/v1'
  return `${base.replace(/\/+$/, '')}/sub/${subToken}`
}
const emptyText = computed(() =>
  tokenUserId.value ? 'Click "Reset Sub Token" to generate a new sub token.' : '',
)

async function load() {
  loading.value = true
  try {
    const { data } = await apiUsers.list(page.value, pageSize.value)
    users.value = data.items
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
  editingUser.value = null
  editorVisible.value = true
}
function openEdit(user: User) {
  editingUser.value = user
  editorVisible.value = true
}
function onSetPassword(user: User) {
  passwordUserId.value = user.id
  passwordVisible.value = true
}
function onManageNodes(user: User) {
  nodesUserId.value = user.id
  nodesVisible.value = true
}
function onShowSubTokenDialog(user: User) {
  tokenUserId.value = user.id
  tokenTitle.value = 'Subscription Token'
  // Backend returns the current sub token on every user payload now, so display
  // it directly — no need to regenerate just to see it.
  tokenItems.value = user.sub_token
    ? [{ label: 'Sub Token', value: user.sub_token, mono: true }]
    : []
  tokenWarning.value = ''
  tokenDialog.value = true
}
function onShowSubscription(user: User) {
  subTitle.value = 'Subscription URL'
  subItems.value = [{ label: 'Subscription URL', value: subscriptionUrl(user.sub_token), mono: true }]
  subDialog.value = true
}
async function onReset() {
  if (!tokenUserId.value) return
  try {
    await ElMessageBox.confirm(
      'Reset this sub token? The old token will stop working immediately.',
      'Confirm',
      { type: 'warning' },
    )
  } catch {
    return
  }
  const { data } = await apiUsers.regenerateSubToken(tokenUserId.value)
  tokenItems.value = [{ label: 'Sub Token (shown once)', value: data.sub_token, mono: true }]
  tokenWarning.value = 'This value is shown only once — copy it now.'
  ElMessage.success('Sub token reset')
}
async function onDelete(user: User) {
  try {
    await ElMessageBox.confirm(`Delete user "${user.email}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }
  await apiUsers.remove(user.id)
  ElMessage.success('User deleted')
  load()
}
async function onRotateCredential(user: User) {
  try {
    await ElMessageBox.confirm(
      `Rotate the VLESS credential for "${user.email}"? The old UUID is revoked immediately; tell the user to re-import their subscription.`,
      'Confirm',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await apiUsers.regenerateCredential(user.id)
  ElMessage.success('VLESS credential rotated. Tell the user to re-import their subscription.')
}
function onSaved(subToken?: string) {
  editorVisible.value = false
  load()
  if (subToken) {
    tokenUserId.value = null
    tokenTitle.value = 'Subscription Token'
    tokenItems.value = [{ label: 'Sub Token (shown once)', value: subToken, mono: true }]
    tokenWarning.value = 'This value is shown only once — copy it now.'
    tokenDialog.value = true
  }
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Users</h2>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon><span>New User</span>
      </el-button>
    </div>
    <el-card shadow="never">
      <el-table
        :data="users"
        v-loading="loading"
        empty-text="No users yet"
        max-height="calc(100vh - 20px)"
      >
        <el-table-column prop="email" label="Email" width="180" />
        <el-table-column prop="username" label="Username" width="120">
          <template #default="{ row }">{{ row.username ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="level" label="Level" width="80" />
        <el-table-column label="Enabled" width="80">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">
              {{ row.enabled ? 'on' : 'off' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Quota" width="100">
          <template #default="{ row }">{{ formatBytes(row.quota_bytes) }}</template>
        </el-table-column>
        <el-table-column label="Expire" width="160">
          <template #default="{ row }">{{ formatDateTime(row.expire_at) }}</template>
        </el-table-column>
        <el-table-column label="Upload" width="100">
          <template #default="{ row }">{{ formatBytes(row.up_total) }}</template>
        </el-table-column>
        <el-table-column label="Download" width="100">
          <template #default="{ row }">{{ formatBytes(row.down_total) }}</template>
        </el-table-column>
        <el-table-column label="Actions" min-width="470" fixed="right">
          <template #default="{ row }">
            <div class="actions">
              <el-button size="small" @click="openEdit(row as User)">Edit</el-button>
              <el-button size="small" @click="onSetPassword(row as User)">Password</el-button>
              <el-button size="small" @click="onManageNodes(row as User)">Nodes</el-button>
              <el-button size="small" @click="onShowSubTokenDialog(row as User)">Sub Token</el-button>
              <el-button size="small" @click="onShowSubscription(row as User)">Subscription</el-button>
              <el-button size="small" type="warning" @click="onRotateCredential(row as User)">
                Rotate Cred
              </el-button>
              <el-popconfirm title="Delete this user?" @confirm="onDelete(row as User)">
                <template #reference>
                  <el-button size="small" type="danger">Delete</el-button>
                </template>
              </el-popconfirm>
            </div>
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

    <UserEditorDialog v-model="editorVisible" :user="editingUser" @saved="onSaved" />
    <UserPasswordDialog v-model="passwordVisible" :user-id="passwordUserId" @saved="load" />
    <UserNodesDialog v-model="nodesVisible" :user-id="nodesUserId" @saved="load" />
    <CopyableTokenDialog
      v-model="tokenDialog"
      :title="tokenTitle"
      :items="tokenItems"
      :reset-label="resetLabel"
      :empty-text="emptyText"
      :warning="tokenWarning"
      @reset="onReset"
    />
    <CopyableTokenDialog
      v-model="subDialog"
      :title="subTitle"
      :items="subItems"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 4px;
  align-items: center;
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
h2 {
  margin: 0;
}
</style>
