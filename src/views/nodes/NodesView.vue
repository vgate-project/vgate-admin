<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiNodes } from '@/api/nodes'
import type { Node } from '@/types/api'
import { formatRelative, formatDateTime } from '@/utils/format'
import NodeEditorDialog from './NodeEditorDialog.vue'
import NodeUsersDialog from './NodeUsersDialog.vue'
import CopyableTokenDialog from '@/components/CopyableTokenDialog.vue'
import {Plus, ArrowDown, Right} from "@element-plus/icons-vue";

const nodes = ref<Node[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const typeFilter = ref<'all' | 'real' | 'virtual'>('all')

const editorVisible = ref(false)
const editingNode = ref<Node | null>(null)
const usersDialog = ref(false)
const usersNodeId = ref<string | null>(null)

const tokenDialog = ref(false)
const tokenTitle = ref('Token')
const tokenItems = ref<{ label: string; value: string; mono?: boolean }[]>([])
const tokenWarning = ref('')

// When set, the editor opens in virtual-child mode preset to this parent.
const childParentId = ref<string | null>(null)

// Node config file: displayed (and copyable) on click, built from the node
// payload the admin already has — no backend round-trip.
const configDialog = ref(false)
const configTitle = ref('Node Config')
const configItems = ref<{ label: string; value: string; mono?: boolean }[]>([])
const tokenNodeId = ref<string | null>(null)
const tokenMode = ref<'token' | 'reality' | null>(null)
const resetLabel = computed(() => {
  if (!tokenNodeId.value || !tokenMode.value) return ''
  return 'Reset Token'
})
const emptyText = computed(() =>
  tokenMode.value === 'token'
    ? 'Click "Reset Token" to generate a new token.'
    : '',
)

async function load() {
  loading.value = true
  try {
    const { data } = await apiNodes.list(page.value, pageSize.value, typeFilter.value)
    nodes.value = data.items
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

function onTypeChange() {
  page.value = 1
  load()
}

function openCreate() {
  editingNode.value = null
  childParentId.value = null
  editorVisible.value = true
}
function openCreateChild(parent: Node) {
  editingNode.value = null
  childParentId.value = parent.id
  editorVisible.value = true
}
function openEdit(node: Node) {
  editingNode.value = node
  editorVisible.value = true
}
async function onDelete(node: Node) {
  try {
    await ElMessageBox.confirm(`Delete node "${node.name}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }
  await apiNodes.remove(node.id)
  ElMessage.success('Node deleted')
  load()
}
function onShowTokenDialog(node: Node) {
  tokenNodeId.value = node.id
  tokenMode.value = 'token'
  tokenTitle.value = 'Node Token'
  // Backend returns the current token on every node payload now, so display it
  // directly — no need to regenerate just to see it.
  tokenItems.value = node.token
    ? [{ label: 'Node Token', value: node.token, mono: true }]
    : []
  tokenWarning.value = ''
  tokenDialog.value = true
}
async function onReset() {
  if (!tokenNodeId.value || !tokenMode.value) return
  const id = tokenNodeId.value
  if (tokenMode.value === 'token') {
    try {
      await ElMessageBox.confirm(
        'Reset this node token? The old token will stop working immediately.',
        'Confirm',
        { type: 'warning' },
      )
    } catch {
      return
    }
    const { data } = await apiNodes.regenerateToken(id)
    tokenItems.value = [{ label: 'Node Token (shown once)', value: data.token, mono: true }]
    tokenWarning.value = 'This value is shown only once — copy it now.'
    ElMessage.success('Token reset')
  }
}
function onViewUsers(node: Node) {
  usersNodeId.value = node.id
  usersDialog.value = true
}
function onShowConfig(node: Node) {
  configTitle.value = `Node Config — ${node.name}`
  // Show the node agent's LocalConfig (server/config/config.go) — the YAML the
  // node operator deploys. Built from the node's id + token and the admin API
  // base, so it is a usable, multi-line config file.
  const envBase = window.__ENV__?.API_BASE_URL
  const adminApi =
    envBase && /^https?:\/\//.test(envBase)
      ? envBase.replace(/\/api\/v1\/?$/, '')
      : window.location.origin
  const cfg = [
    'admin_api: ' + adminApi,
    'node_id: ' + node.id,
    'node_token: ' + node.token,
    'sync_interval: 60',
  ].join('\n')
  configItems.value = [{ label: 'config.yml (LocalConfig)', value: cfg, mono: true }]
  configDialog.value = true
}
function onCommand(cmd: string, row: Node) {
  switch (cmd) {
    case 'addchild':
      openCreateChild(row)
      return
    case 'users':
      onViewUsers(row)
      return
    case 'token':
      onShowTokenDialog(row)
      return
    case 'config':
      onShowConfig(row)
      return
    case 'delete':
      onDelete(row)
      return
  }
}
function onSaved() {
  editorVisible.value = false
  load()
}
async function copyId(id: string) {
  try {
    await navigator.clipboard.writeText(id)
    ElMessage.success('ID copied')
  } catch {
    ElMessage.warning('Copy failed')
  }
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Nodes</h2>
      <div class="toolbar-right">
        <el-radio-group v-model="typeFilter" size="small" @change="onTypeChange">
          <el-radio-button value="all">All</el-radio-button>
          <el-radio-button value="real">Real</el-radio-button>
          <el-radio-button value="virtual">Virtual</el-radio-button>
        </el-radio-group>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon><span>New Node</span>
        </el-button>
      </div>
    </div>
    <el-card shadow="never">
      <el-table
        :data="nodes"
        v-loading="loading"
        empty-text="No nodes yet"
        max-height="calc(100vh - 200px)"
      >
        <el-table-column label="ID" width="110">
          <template #default="{ row }">
            <el-tooltip :content="row.id" placement="top" :hide-after="0">
              <span class="id-cell" @click="copyId(row.id)">{{ row.id.slice(-8) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="Name" min-width="140">
          <template #default="{ row }">
            <el-tooltip v-if="row.parent_id" placement="top" :hide-after="0">
              <span class="virtual-name">
                <el-icon class="virtual-caret"><Right /></el-icon>{{ row.name }}
              </span>
              <template #content>
                <div>Parent: {{ row.parent_name || '(unknown)' }}</div>
                <div>ID: {{ row.parent_id }}</div>
              </template>
            </el-tooltip>
            <span v-else>{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Type" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.parent_id" type="warning" size="small">Virtual</el-tag>
            <el-tag v-else type="success" size="small">Real</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Address" min-width="180">
          <template #default="{ row }">{{ row.address }}<span v-if="row.port" class="muted">:{{ row.port }}</span></template>
        </el-table-column>
        <el-table-column label="Transport / Security" min-width="150">
          <template #default="{ row }">
            <span>{{ row.network }}</span><span v-if="row.security && row.security !== 'none'" class="muted"> / {{ row.security }}</span>
            <span v-if="row.parent_id" class="muted"> (inherit)</span>
          </template>
        </el-table-column>
        <el-table-column prop="level" label="Level" width="70" />
        <el-table-column label="Mult." width="70">
          <template #default="{ row }">
            <span v-if="!row.parent_id">{{ (row.traffic_multiplier ?? 1).toFixed(2) }}<span v-if="(row.traffic_multiplier ?? 1) !== 1" class="muted">×</span></span>
            <span v-else class="muted">inherit</span>
          </template>
        </el-table-column>
        <el-table-column label="Online" width="120">
          <template #default="{ row }">
            <el-tag :type="row.online ? 'success' : 'info'" size="small">
              {{ formatRelative(row.last_seen_at) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Enabled" width="80">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">
              {{ row.enabled ? 'on' : 'off' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Created" width="160">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="Actions" min-width="180" fixed="right">
          <template #default="{ row }">
            <div class="actions">
              <el-button size="small" @click="openEdit(row as Node)">Edit</el-button>
              <el-button v-if="!row.parent_id" size="small" @click="onShowConfig(row as Node)">Config</el-button>
              <el-dropdown trigger="click" @command="(c: string) => onCommand(c, row as Node)">
                <el-button size="small">
                  More<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="!row.parent_id" command="addchild">Add child</el-dropdown-item>
                    <el-dropdown-item command="users">Users</el-dropdown-item>
                    <el-dropdown-item :disabled="!!row.parent_id" command="token">Token</el-dropdown-item>
                    <el-dropdown-item v-if="!!row.parent_id" :disabled="true" command="config">Config</el-dropdown-item>
                    <el-dropdown-item divided command="delete">Delete</el-dropdown-item>
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

    <NodeEditorDialog v-model="editorVisible" :node="editingNode" :default-parent-id="childParentId" @saved="onSaved" />
    <NodeUsersDialog v-model="usersDialog" :node-id="usersNodeId" />
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
      v-model="configDialog"
      :title="configTitle"
      :items="configItems"
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
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.virtual-name {
  display: inline-flex;
  align-items: center;
  padding-left: 16px;
  color: #e6a23c;
}
.virtual-caret {
  margin-right: 4px;
  font-size: 12px;
  color: #c0c4cc;
}
.muted {
  color: #909399;
}
.id-cell {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #606266;
  cursor: pointer;
  user-select: none;
}
.id-cell:hover {
  color: #409eff;
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
</style>
