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

// Real and virtual node lists are paginated independently so switching tabs
// preserves each tab's scroll position and pagination state. Both tabs fetch
// from the same /admin/nodes endpoint with the matching `type` filter.
const realNodes = ref<Node[]>([])
const realLoading = ref(false)
const realPage = ref(1)
const realPageSize = ref(20)
const realTotal = ref(0)

const virtualNodes = ref<Node[]>([])
const virtualLoading = ref(false)
const virtualPage = ref(1)
const virtualPageSize = ref(20)
const virtualTotal = ref(0)

const activeTab = ref<'real' | 'virtual'>('real')

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
  // Load whichever tab is currently active. The other tab keeps its previous
  // items so we don't pay the network round-trip just to display the heading.
  if (activeTab.value === 'real') {
    await loadReal()
  } else {
    await loadVirtual()
  }
}
async function loadReal() {
  realLoading.value = true
  try {
    const { data } = await apiNodes.list(realPage.value, realPageSize.value, 'real')
    realNodes.value = data.items
    realTotal.value = data.total
  } finally {
    realLoading.value = false
  }
}
async function loadVirtual() {
  virtualLoading.value = true
  try {
    const { data } = await apiNodes.list(virtualPage.value, virtualPageSize.value, 'virtual')
    virtualNodes.value = data.items
    virtualTotal.value = data.total
  } finally {
    virtualLoading.value = false
  }
}
onMounted(load)

function onRealSizeChange() {
  realPage.value = 1
  loadReal()
}
function onVirtualSizeChange() {
  virtualPage.value = 1
  loadVirtual()
}
function onTabChange() {
  // Switching to a tab we haven't loaded yet triggers a first fetch. If the
  // tab already has items (the user has visited it before), no-op so we keep
  // their scroll / page state.
  if (activeTab.value === 'real' && realNodes.value.length === 0 && realTotal.value === 0) {
    loadReal()
  } else if (activeTab.value === 'virtual' && virtualNodes.value.length === 0 && virtualTotal.value === 0) {
    loadVirtual()
  }
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
  // Refetch both tabs so a delete that crosses tab boundaries (e.g. removing
  // a real parent that had virtual children shown) leaves the UI consistent.
  await Promise.all([loadReal(), loadVirtual()])
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
  // A save can move a node across tabs (e.g. creating a virtual child from a
  // real parent) or update cross-tab fields like the parent's name, so refetch
  // both tabs to keep them in sync.
  Promise.all([loadReal(), loadVirtual()])
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
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon><span>New Node</span>
        </el-button>
      </div>
    </div>
    <el-card shadow="never">
      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <el-tab-pane label="Real" name="real">
          <el-table
            :data="realNodes"
            v-loading="realLoading"
            size="small"
            empty-text="No real nodes yet"
            max-height="calc(100vh - 240px)"
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
                <span>{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column label="Address" min-width="180">
              <template #default="{ row }">{{ row.address }}<span v-if="row.port" class="muted">:{{ row.port }}</span></template>
            </el-table-column>
            <el-table-column label="Transport / Security" min-width="150">
              <template #default="{ row }">
                <span>{{ row.network }}</span><span v-if="row.security && row.security !== 'none'" class="muted"> / {{ row.security }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="level" label="Level" width="70" />
            <el-table-column label="Mult." width="70">
              <template #default="{ row }">
                {{ (row.traffic_multiplier ?? 1).toFixed(2) }}<span v-if="(row.traffic_multiplier ?? 1) !== 1" class="muted">×</span>
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
                  <el-button size="small" @click="onShowConfig(row as Node)">Config</el-button>
                  <el-dropdown trigger="click" @command="(c: string) => onCommand(c, row as Node)">
                    <el-button size="small">
                      More<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="addchild">Add child</el-dropdown-item>
                        <el-dropdown-item command="users">Users</el-dropdown-item>
                        <el-dropdown-item command="token">Token</el-dropdown-item>
                        <el-dropdown-item divided command="delete">Delete</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="realPage"
            v-model:page-size="realPageSize"
            :total="realTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            class="pager"
            @size-change="onRealSizeChange"
            @current-change="loadReal"
          />
        </el-tab-pane>
        <el-tab-pane label="Virtual" name="virtual">
          <el-table
            :data="virtualNodes"
            v-loading="virtualLoading"
            size="small"
            empty-text="No virtual nodes yet"
            max-height="calc(100vh - 240px)"
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
                <span class="virtual-name">
                  <el-icon class="virtual-caret"><Right /></el-icon>{{ row.name }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="Parent" min-width="140">
              <template #default="{ row }">
                <span class="muted">{{ row.parent_name || row.parent_id || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="Address" min-width="180">
              <template #default="{ row }">{{ row.address }}<span v-if="row.port" class="muted">:{{ row.port }}</span></template>
            </el-table-column>
            <el-table-column label="Transport / Security" min-width="150">
              <template #default="{ row }">
                <span>{{ row.network }}</span><span v-if="row.security && row.security !== 'none'" class="muted"> / {{ row.security }}</span>
                <span class="muted"> (inherit)</span>
              </template>
            </el-table-column>
            <el-table-column prop="level" label="Level" width="70" />
            <el-table-column label="Mult." width="70">
              <template #default="{ row }">
                <span class="muted">inherit</span>
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
            <el-table-column label="Actions" min-width="160" fixed="right">
              <template #default="{ row }">
                <div class="actions">
                  <el-button size="small" @click="openEdit(row as Node)">Edit</el-button>
                  <el-dropdown trigger="click" @command="(c: string) => onCommand(c, row as Node)">
                    <el-button size="small">
                      More<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="users">Users</el-dropdown-item>
                        <el-dropdown-item divided command="delete">Delete</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="virtualPage"
            v-model:page-size="virtualPageSize"
            :total="virtualTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            class="pager"
            @size-change="onVirtualSizeChange"
            @current-change="loadVirtual"
          />
        </el-tab-pane>
      </el-tabs>
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
/* The nodes card wraps the two tabs; tighten the default el-tabs top spacing
   so the table sits high inside the card. */
:deep(.el-tabs__header) {
  margin-bottom: 12px;
}
:deep(.el-tabs--card > .el-tabs__header) {
  margin-bottom: 12px;
}
h2 {
  margin: 0;
}
</style>
