<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {ElMessage, ElMessageBox} from 'element-plus'
import {apiUsers} from '@/api/users'
import type {User} from '@/types/api'
import {formatBytes, formatDateTime} from '@/utils/format'
import UserEditorDialog from './UserEditorDialog.vue'
import UserPasswordDialog from './UserPasswordDialog.vue'
import UserNodesDialog from './UserNodesDialog.vue'
import CopyableTokenDialog from '@/components/CopyableTokenDialog.vue'
import {ArrowDown} from '@element-plus/icons-vue'

const users = ref<User[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

// Filter + sort state (applied server-side via /admin/users query params).
const search = ref('')
const enabledFilter = ref<'' | 'true' | 'false'>('')
const sortBy = ref('')
const sortOrder = ref<'asc' | 'desc'>('desc')

function usedBytes(u: User): number {
  return (u.up_total || 0) + (u.down_total || 0)
}

const usagePercent = (u: User): number => {
  if (u.quota_bytes === -1) return -1 // -1 => unlimited
  if (!u.quota_bytes) return -2 // 0 => no quota (blocked)
  const used = usedBytes(u)
  const pct = (used / u.quota_bytes) * 100
  return Math.min(100, Math.max(0, pct))
}

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
    const {data} = await apiUsers.list(page.value, pageSize.value, {
      search: search.value.trim(),
      enabled: enabledFilter.value,
      sort_by: sortBy.value,
      order: sortOrder.value,
    })
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

// Any filter change resets to the first page and reloads.
function onFilterChange() {
  page.value = 1
  load()
}

function resetFilters() {
  search.value = ''
  enabledFilter.value = ''
  onFilterChange()
}

// Element Plus emits prop/order; map to server sort_by/order and reload.
function onSortChange({prop, order}: { prop: string | null; order: string | null }) {
  if (!order || !prop) {
    sortBy.value = ''
    sortOrder.value = 'desc'
  } else {
    sortBy.value = prop
    sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  }
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
      ? [{label: 'Sub Token', value: user.sub_token, mono: true}]
      : []
  tokenWarning.value = ''
  tokenDialog.value = true
}

function onShowSubscription(user: User) {
  subTitle.value = 'Subscription URL'
  subItems.value = [{label: 'Subscription URL', value: subscriptionUrl(user.sub_token), mono: true}]
  subDialog.value = true
}

async function onReset() {
  if (!tokenUserId.value) return
  try {
    await ElMessageBox.confirm(
        'Reset this sub token? The old token will stop working immediately.',
        'Confirm',
        {type: 'warning'},
    )
  } catch {
    return
  }
  const {data} = await apiUsers.regenerateSubToken(tokenUserId.value)
  tokenItems.value = [{label: 'Sub Token (shown once)', value: data.sub_token, mono: true}]
  tokenWarning.value = 'This value is shown only once — copy it now.'
  ElMessage.success('Sub token reset')
}

async function onDelete(user: User) {
  try {
    await ElMessageBox.confirm(`Delete user "${user.email}"?`, 'Confirm', {type: 'warning'})
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
        {type: 'warning'},
    )
  } catch {
    return
  }
  await apiUsers.regenerateCredential(user.id)
  ElMessage.success('VLESS credential rotated. Tell the user to re-import their subscription.')
}

function onSaved() {
  editorVisible.value = false
  load()
  ElMessage.success('User saved')
}

// Map an action dropdown command to its handler.
function onCommand(cmd: string, row: User) {
  switch (cmd) {
    case 'password':
      onSetPassword(row)
      return
    case 'nodes':
      onManageNodes(row)
      return
    case 'subtoken':
      onShowSubTokenDialog(row)
      return
    case 'subscription':
      onShowSubscription(row)
      return
    case 'rotate':
      onRotateCredential(row)
      return
    case 'delete':
      onDelete(row)
      return
  }
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Users</h2>
      <el-button type="primary" @click="openCreate">
        <el-icon>
          <Plus/>
        </el-icon>
        <span>New User</span>
      </el-button>
    </div>

    <div class="filters">
      <el-input
          v-model="search"
          placeholder="Search email or username"
          clearable
          class="filter-search"
          @keyup.enter="onFilterChange"
          @clear="onFilterChange"
      />
      <el-select
          v-model="enabledFilter"
          placeholder="Status"
          class="filter-status"
          @change="onFilterChange"
      >
        <el-option label="All" value=""/>
        <el-option label="Enabled" value="true"/>
        <el-option label="Disabled" value="false"/>
      </el-select>
      <el-button @click="resetFilters">Reset</el-button>
    </div>

    <el-card shadow="never">
      <el-table
          :data="users"
          v-loading="loading"
          empty-text="No users yet"
          max-height="calc(100vh - 20px)"
          @sort-change="onSortChange"
      >
        <el-table-column prop="email" label="Email" width="180" sortable="custom"/>
        <el-table-column prop="username" label="Username" width="120" sortable="custom">
          <template #default="{ row }">{{ row.username ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="level" label="Level" width="100" sortable="custom"/>
        <el-table-column label="Enabled" width="80">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">
              {{ row.enabled ? 'on' : 'off' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Quota" width="100" prop="quota_bytes" sortable="custom">
          <template #default="{ row }">
            <span v-if="row.quota_bytes === -1">Unlimited</span>
            <span v-else-if="!row.quota_bytes">No quota</span>
            <span v-else>{{ formatBytes(row.quota_bytes) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Usage" width="180" prop="used" sortable="custom">
          <template #default="{ row }">
            <span v-if="usagePercent(row as User) === -1" class="usage-cell">Unlimited</span>
            <span v-else-if="usagePercent(row as User) === -2" class="usage-cell">No quota</span>
            <el-progress
                v-else
                class="usage-cell"
                :percentage="usagePercent(row as User)"
                :format="(p: number) => p.toFixed(1) + '%'"
                :color="usagePercent(row as User) >= 100 ? '#f56c6c' : undefined"
                :stroke-width="10"
            />
          </template>
        </el-table-column>
        <el-table-column label="Upload" width="120" prop="up_total" sortable="custom">
          <template #default="{ row }">{{ formatBytes(row.up_total) }}</template>
        </el-table-column>
        <el-table-column label="Download" width="120" prop="down_total" sortable="custom">
          <template #default="{ row }">{{ formatBytes(row.down_total) }}</template>
        </el-table-column>
        <el-table-column label="Expire" width="160" prop="expire_at" sortable="custom">
          <template #default="{ row }">{{ formatDateTime(row.expire_at) }}</template>
        </el-table-column>
        <el-table-column label="Actions" min-width="50" fixed="right">
          <template #default="{ row }">
            <div class="actions">
              <el-button size="small" @click="openEdit(row as User)">Edit</el-button>
              <el-dropdown trigger="click" @command="(c: string) => onCommand(c, row as User)">
                <el-button size="small">
                  More
                  <el-icon class="el-icon--right">
                    <ArrowDown/>
                  </el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="password">Password</el-dropdown-item>
                    <el-dropdown-item command="nodes">Nodes</el-dropdown-item>
                    <el-dropdown-item command="subtoken">Sub Token</el-dropdown-item>
                    <el-dropdown-item command="subscription">Subscription</el-dropdown-item>
                    <el-dropdown-item command="rotate" divided>Rotate Cred</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>Delete</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
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

    <UserEditorDialog v-model="editorVisible" :user="editingUser" @saved="onSaved"/>
    <UserPasswordDialog v-model="passwordVisible" :user-id="passwordUserId" @saved="load"/>
    <UserNodesDialog v-model="nodesVisible" :user-id="nodesUserId" @saved="load"/>
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

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.filter-search {
  width: 260px;
}

.filter-status {
  width: 140px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
}

/* Element Plus adds margin-left:12px between adjacent el-buttons; neutralize
   it so the flex gap is uniform across buttons and the dropdown trigger. */
.actions .el-button + .el-button,
.actions .el-dropdown {
  margin-left: 0;
}

.pager {
  margin-top: 12px;
  justify-content: flex-end;
}

h2 {
  margin: 0;
}

/* Smaller font for the Usage column text and progress percentage. */
.usage-cell {
  font-size: 12px;
}

.usage-cell :deep(.el-progress__text) {
  font-size: 12px !important;
}
</style>
