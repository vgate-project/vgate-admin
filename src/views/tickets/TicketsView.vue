<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { apiTickets } from '@/api/tickets'
import { useTicketStore } from '@/stores/ticket'
import type { Ticket, TicketDetail, TicketStatus, TicketPriority } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const ticketStore = useTicketStore()
const items = ref<Ticket[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const statusFilter = ref<TicketStatus | ''>('')
const search = ref('')

// Drawer (conversation view).
const drawerVisible = ref(false)
const activeTicket = ref<Ticket | null>(null)
const messages = ref<TicketDetail['messages']>([])
const detailLoading = ref(false)
const replyText = ref('')
const sending = ref(false)

// Live polling while the drawer is open. The thread refreshes every few
// seconds so admin replies and new user messages show up without a manual
// refresh. Only the conversation is re-fetched; the list is refreshed on
// reply/status changes by the action handlers.
const POLL_INTERVAL_MS = 5000
let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (activeTicket.value && !detailLoading.value && !sending.value) {
      void refreshTicket()
    }
  }, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function refreshTicket() {
  if (!activeTicket.value) return
  try {
    const { data } = await apiTickets.get(activeTicket.value.id)
    activeTicket.value = data.ticket
    messages.value = data.messages
  } catch {
    // Keep the current view on a transient error; polling will retry.
  }
}

const priorityMeta: Record<TicketPriority, { type?: 'info' | 'warning' | 'danger'; label: string }> = {
  low: { type: 'info', label: 'low' },
  normal: { label: 'normal' },
  high: { type: 'warning', label: 'high' },
  urgent: { type: 'danger', label: 'urgent' },
}

const statusMeta: Record<TicketStatus, { type?: 'success' | 'info' | 'warning' | 'danger'; label: string }> = {
  open: { type: 'danger', label: 'open' },
  in_progress: { type: 'warning', label: 'in progress' },
  resolved: { type: 'success', label: 'resolved' },
  closed: { type: 'info', label: 'closed' },
}

async function load() {
  loading.value = true
  try {
    const { data } = await apiTickets.list({
      status: statusFilter.value || undefined,
      q: search.value || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    items.value = data.items
    total.value = data.total
  } catch {
    ElMessage.error('Failed to load tickets')
  } finally {
    loading.value = false
  }
}
onMounted(load)
onUnmounted(stopPolling)

function onSizeChange() {
  page.value = 1
  load()
}

function statusType(s: TicketStatus) {
  return statusMeta[s]?.type
}
function statusLabel(s: TicketStatus) {
  return statusMeta[s]?.label || s
}
function priorityType(p: TicketPriority) {
  return priorityMeta[p]?.type
}
function priorityLabel(p: TicketPriority) {
  return priorityMeta[p]?.label || p
}

async function openTicket(t: Ticket) {
  activeTicket.value = t
  drawerVisible.value = true
  detailLoading.value = true
  replyText.value = ''
  startPolling()
  try {
    const { data } = await apiTickets.get(t.id)
    activeTicket.value = data.ticket
    messages.value = data.messages
    // Opening the ticket marks it read on the backend; refresh the dot so it
    // clears immediately rather than on the next navigation.
    ticketStore.refresh()
  } catch {
    ElMessage.error('Failed to load ticket')
  } finally {
    detailLoading.value = false
  }
}

function onDrawerClose() {
  stopPolling()
}

async function sendReply() {
  if (!activeTicket.value) return
  if (!replyText.value.trim()) {
    ElMessage.error('Reply cannot be empty')
    return
  }
  sending.value = true
  try {
    const tk = await apiTickets.reply(activeTicket.value.id, replyText.value.trim())
    activeTicket.value = tk.data
    replyText.value = ''
    ElMessage.success('Reply sent')
    await openTicket(tk.data)
    load()
  } catch {
    // error toast handled by http interceptor
  } finally {
    sending.value = false
  }
}

async function changeStatus(status: TicketStatus) {
  if (!activeTicket.value) return
  try {
    const tk = await apiTickets.setStatus(activeTicket.value.id, status)
    activeTicket.value = tk.data
    ElMessage.success(`Status set to ${statusLabel(status)}`)
    if (status === 'closed') {
      drawerVisible.value = false
    }
    load()
  } catch {
    // error toast handled by http interceptor
  }
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Tickets</h2>
      <div class="filters">
        <el-input
          v-model="search"
          placeholder="Search subject or email"
          clearable
          style="width: 220px"
          @keyup.enter="load"
          @clear="load"
        />
        <el-select
          v-model="statusFilter"
          placeholder="All statuses"
          clearable
          style="width: 150px"
          @change="load"
        >
          <el-option label="open" value="open" />
          <el-option label="in progress" value="in_progress" />
          <el-option label="resolved" value="resolved" />
          <el-option label="closed" value="closed" />
        </el-select>
        <el-button @click="load">Search</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-table :data="items" v-loading="loading" empty-text="No tickets" max-height="calc(100vh - 180px)">
        <el-table-column prop="subject" label="Subject" min-width="220" />
        <el-table-column label="User" min-width="200">
          <template #default="{ row }">{{ row.user_email || row.user_id }}</template>
        </el-table-column>
        <el-table-column label="Priority" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="priorityType(row.priority)">{{ priorityLabel(row.priority) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Status" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Created" width="170">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="Actions" width="100" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openTicket(row as Ticket)">View</el-button>
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

    <el-drawer v-model="drawerVisible" :title="activeTicket ? activeTicket.subject : 'Ticket'" size="520px" @close="onDrawerClose">
      <div v-loading="detailLoading">
        <div v-if="activeTicket" class="ticket-meta">
          <el-tag size="small" :type="priorityType(activeTicket.priority)">
            {{ priorityLabel(activeTicket.priority) }}
          </el-tag>
          <el-tag size="small" :type="statusType(activeTicket.status)">
            {{ statusLabel(activeTicket.status) }}
          </el-tag>
          <span class="meta-user">{{ activeTicket.user_email || activeTicket.user_id }}</span>
        </div>

        <div class="thread">
          <div
            v-for="m in messages"
            :key="m.id"
            class="bubble"
            :class="m.sender === 'admin' ? 'bubble-admin' : 'bubble-user'"
          >
            <div class="bubble-head">
              <span>{{ m.sender === 'admin' ? 'Admin' : 'User' }}</span>
              <span class="bubble-time">{{ formatDateTime(m.created_at) }}</span>
            </div>
            <div class="bubble-body">{{ m.content }}</div>
          </div>
          <el-empty v-if="messages.length === 0" description="No messages yet" />
        </div>
      </div>

      <template #footer>
        <div v-if="activeTicket" class="drawer-footer">
          <div class="status-actions">
            <el-button
              size="small"
              :disabled="activeTicket.status === 'resolved'"
              @click="changeStatus('resolved')"
            >
              Resolve
            </el-button>
            <el-button
              size="small"
              :disabled="activeTicket.status === 'closed'"
              @click="changeStatus('closed')"
            >
              Close
            </el-button>
            <el-button
              size="small"
              :disabled="activeTicket.status === 'in_progress'"
              @click="changeStatus('in_progress')"
            >
              Reopen
            </el-button>
          </div>
          <el-input
            v-model="replyText"
            type="textarea"
            :rows="3"
            placeholder="Reply to the user (they will be notified)"
            :disabled="sending"
          />
          <el-button
            type="primary"
            :loading="sending"
            :disabled="!replyText.trim()"
            @click="sendReply"
          >
            Send reply
          </el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
  flex-wrap: wrap;
}
.filters {
  display: flex;
  gap: 8px;
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
h2 {
  margin: 0;
}
.ticket-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.meta-user {
  margin-left: auto;
  color: #909399;
  font-size: 13px;
}
.thread {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
  max-height: 50vh;
  overflow-y: auto;
}
.bubble {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
}
.bubble-user {
  align-self: flex-start;
  background: #f4f4f5;
}
.bubble-admin {
  align-self: flex-end;
  background: #ecf5ff;
}
.bubble-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.bubble-body {
  white-space: pre-wrap;
  word-break: break-word;
}
.drawer-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.status-actions {
  display: flex;
  gap: 8px;
}
</style>
