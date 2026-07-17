<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiAdmins } from '@/api/admins'
import { useAuthStore } from '@/stores/auth'
import type { Admin } from '@/types/api'
import { formatDateTime } from '@/utils/format'

const auth = useAuthStore()
const admins = ref<Admin[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

// Create dialog
const createVisible = ref(false)
const createForm = ref({ username: '', password: '', role: 'admin' })
const creating = ref(false)

async function load() {
  if (!auth.isSuperAdmin) return
  loading.value = true
  try {
    const { data } = await apiAdmins.list(page.value, pageSize.value)
    admins.value = data.items
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

async function onCreate() {
  if (!createForm.value.username || !createForm.value.password) {
    ElMessage.error('Username and password are required')
    return
  }
  creating.value = true
  try {
    await apiAdmins.create(createForm.value)
    ElMessage.success('Admin created')
    createVisible.value = false
    load()
  } finally {
    creating.value = false
  }
}

// Edit dialog (username + role + optional password)
const editVisible = ref(false)
const editSaving = ref(false)
const editForm = ref({ id: 0, username: '', role: 'admin', password: '' })

function openEdit(admin: Admin) {
  editForm.value = { id: admin.id, username: admin.username, role: admin.role, password: '' }
  editVisible.value = true
}

async function onUpdate() {
  if (!editForm.value.username) {
    ElMessage.error('Username is required')
    return
  }
  editSaving.value = true
  try {
    await apiAdmins.update(editForm.value.id, {
      username: editForm.value.username,
      role: editForm.value.role,
    })
    // Only update the password when one was entered; leave it unchanged otherwise.
    if (editForm.value.password) {
      await apiAdmins.updatePassword(editForm.value.id, editForm.value.password)
    }
    ElMessage.success('Admin updated')
    editVisible.value = false
    load()
  } finally {
    editSaving.value = false
  }
}

async function onDelete(admin: Admin) {
  if (admin.id === auth.adminId) return
  try {
    await ElMessageBox.confirm(`Delete admin "${admin.username}"? This cannot be undone.`, 'Confirm', {
      type: 'warning',
    })
  } catch {
    return
  }
  await apiAdmins.remove(admin.id)
  ElMessage.success('Admin deleted')
  load()
}
</script>

<template>
  <div>
    <template v-if="!auth.isSuperAdmin">
      <h2 style="margin: 0 0 16px">Admins</h2>
      <el-card shadow="never">
        <el-empty description="Requires super admin role" />
      </el-card>
    </template>
    <template v-else>
      <div class="toolbar">
        <h2>Admins</h2>
        <el-button type="primary" @click="createVisible = true; createForm = { username: '', password: '', role: 'admin' }">
          <el-icon><Plus /></el-icon><span>New Admin</span>
        </el-button>
      </div>
      <el-card shadow="never">
        <el-table :data="admins" v-loading="loading" empty-text="No admins">
          <el-table-column prop="username" label="Username" width="180" />
          <el-table-column label="Role" width="140">
            <template #default="{ row }">
              <el-tag :type="row.role === 'super_admin' ? 'warning' : 'info'" size="small">
                {{ row.role }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Created" width="160">
            <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="Actions" min-width="240" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openEdit(row as Admin)">Edit</el-button>
              <el-button
                size="small"
                type="danger"
                :disabled="row.id === auth.adminId"
                @click="onDelete(row as Admin)"
              >
                Delete
              </el-button>
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

      <!-- Create dialog -->
      <el-dialog v-model="createVisible" title="New Admin" width="400px">
        <el-form label-width="120px">
          <el-form-item label="Username" required>
            <el-input v-model="createForm.username" />
          </el-form-item>
          <el-form-item label="Password" required>
            <el-input v-model="createForm.password" type="password" show-password />
          </el-form-item>
          <el-form-item label="Role">
            <el-select v-model="createForm.role">
              <el-option label="admin" value="admin" />
              <el-option label="super_admin" value="super_admin" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="createVisible = false">Cancel</el-button>
          <el-button type="primary" :loading="creating" @click="onCreate">Create</el-button>
        </template>
      </el-dialog>

      <!-- Edit dialog (username + role + optional password) -->
      <el-dialog v-model="editVisible" title="Edit Admin" width="400px">
        <el-form label-width="120px">
          <el-form-item label="Username" required>
            <el-input v-model="editForm.username" />
          </el-form-item>
          <el-form-item label="Role">
            <el-select v-model="editForm.role">
              <el-option label="admin" value="admin" />
              <el-option label="super_admin" value="super_admin" />
            </el-select>
          </el-form-item>
          <el-form-item label="New password">
            <el-input v-model="editForm.password" type="password" show-password autocomplete="new-password" />
            <div style="margin-top: 4px">
              <el-text type="info" size="small">Leave empty to keep the current password.</el-text>
            </div>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="editVisible = false">Cancel</el-button>
          <el-button type="primary" :loading="editSaving" @click="onUpdate">Save</el-button>
        </template>
      </el-dialog>
    </template>
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
</style>
