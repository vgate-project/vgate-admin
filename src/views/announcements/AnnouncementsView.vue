<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiAnnouncements } from '@/api/announcements'
import type { Announcement, AnnouncementRequest } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const items = ref<Announcement[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const editorVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const form = reactive<AnnouncementRequest>({
  title: '',
  content: '',
  pinned: false,
  active: true,
})

function resetForm() {
  form.title = ''
  form.content = ''
  form.pinned = false
  form.active = true
}

async function load() {
  loading.value = true
  try {
    const { data } = await apiAnnouncements.list(page.value, pageSize.value)
    items.value = data.items
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
  isEdit.value = false
  editingId.value = null
  resetForm()
  editorVisible.value = true
}

function openEdit(a: Announcement) {
  isEdit.value = true
  editingId.value = a.id
  form.title = a.title
  form.content = a.content
  form.pinned = a.pinned
  form.active = a.active
  editorVisible.value = true
}

async function onSubmit() {
  if (!form.title.trim()) {
    ElMessage.error('Title is required')
    return
  }
  saving.value = true
  try {
    const body: AnnouncementRequest = {
      title: form.title.trim(),
      content: form.content,
      pinned: form.pinned,
      active: form.active,
    }
    if (isEdit.value && editingId.value) {
      await apiAnnouncements.update(editingId.value, body)
      ElMessage.success('Announcement updated')
    } else {
      await apiAnnouncements.create(body)
      ElMessage.success('Announcement created')
    }
    editorVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function onDelete(a: Announcement) {
  try {
    await ElMessageBox.confirm(`Delete announcement "${a.title}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }
  await apiAnnouncements.remove(a.id)
  ElMessage.success('Announcement deleted')
  load()
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Announcements</h2>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon><span>New Announcement</span>
      </el-button>
    </div>
    <el-card shadow="never">
      <el-table :data="items" v-loading="loading" empty-text="No announcements yet" max-height="calc(100vh - 20px)">
        <el-table-column prop="title" label="Title" min-width="200" />
        <el-table-column label="Pinned" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.pinned" size="small" type="danger">pinned</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="Active" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.active ? 'success' : 'info'">{{ row.active ? 'yes' : 'no' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Created" width="170">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="Actions" min-width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row as Announcement)">Edit</el-button>
            <el-popconfirm title="Delete this announcement?" @confirm="onDelete(row as Announcement)">
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

    <el-dialog v-model="editorVisible" :title="isEdit ? 'Edit Announcement' : 'New Announcement'" width="640px">
      <el-form label-width="120px">
        <el-form-item label="Title" required>
          <el-input v-model="form.title" placeholder="Announcement title" maxlength="120" />
        </el-form-item>
        <el-form-item label="Content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="6"
            placeholder="Markdown / plain text shown to users"
          />
        </el-form-item>
        <el-form-item label="Pinned">
          <el-switch v-model="form.pinned" />
          <span class="hint">Pinned announcements appear at the top for users.</span>
        </el-form-item>
        <el-form-item label="Active">
          <el-switch v-model="form.active" />
          <span class="hint">Inactive announcements are hidden from users.</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="saving" @click="onSubmit">
          {{ isEdit ? 'Save' : 'Create' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
h2 {
  margin: 0;
}
.hint {
  display: inline-block;
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
