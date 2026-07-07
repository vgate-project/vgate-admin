<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiTrafficPackages } from '@/api/traffic'
import type { TrafficPackage, TrafficPackageRequest } from '@/types/api'
import { formatBytes, formatPrice } from '@/utils/format'
import QuotaInput from '@/components/QuotaInput.vue'

const packages = ref<TrafficPackage[]>([])
const loading = ref(false)
const editorVisible = ref(false)
const editing = ref<TrafficPackage | null>(null)
const saving = ref(false)

const form = ref<TrafficPackageRequest>({
  name: '',
  price: 0,
  quota_bytes: 0,
  validity_days: 0,
  description: '',
  enabled: true,
})

async function load() {
  loading.value = true
  try {
    const { data } = await apiTrafficPackages.list()
    packages.value = data
  } finally {
    loading.value = false
  }
}
onMounted(load)

function openCreate() {
  editing.value = null
  form.value = { name: '', price: 0, quota_bytes: 0, validity_days: 0, description: '', enabled: true }
  editorVisible.value = true
}
function openEdit(pkg: TrafficPackage) {
  editing.value = pkg
  form.value = {
    name: pkg.name,
    price: pkg.price,
    quota_bytes: pkg.quota_bytes,
    validity_days: pkg.validity_days,
    description: pkg.description,
    enabled: pkg.enabled,
  }
  editorVisible.value = true
}

async function onSave() {
  if (!form.value.name) {
    ElMessage.error('Name is required')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await apiTrafficPackages.update(editing.value.id, form.value)
    } else {
      await apiTrafficPackages.create(form.value)
    }
    ElMessage.success(editing.value ? 'Updated' : 'Created')
    editorVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function onDelete(pkg: TrafficPackage) {
  try {
    await ElMessageBox.confirm(`Delete traffic package "${pkg.name}"?`, 'Confirm', { type: 'warning' })
  } catch {
    return
  }
  await apiTrafficPackages.remove(pkg.id)
  ElMessage.success('Deleted')
  load()
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Traffic Packages</h2>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon><span>New Package</span>
      </el-button>
    </div>

    <el-card shadow="never">
      <el-table :data="packages" v-loading="loading" empty-text="No traffic packages yet">
        <el-table-column prop="name" label="Name" min-width="160" />
        <el-table-column label="Price" width="120">
          <template #default="{ row }">{{ formatPrice(row.price) }}</template>
        </el-table-column>
        <el-table-column label="Traffic" width="140">
          <template #default="{ row }">{{ formatBytes(row.quota_bytes) }}</template>
        </el-table-column>
        <el-table-column label="Validity" width="120">
          <template #default="{ row }">{{ row.validity_days > 0 ? row.validity_days + ' days' : 'No expiry' }}</template>
        </el-table-column>
        <el-table-column label="Enabled" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'danger'" size="small">
              {{ row.enabled ? 'on' : 'off' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="160" fixed="right">
          <template #default="{ row }">
            <div class="actions">
              <el-button size="small" @click="openEdit(row as TrafficPackage)">Edit</el-button>
              <el-popconfirm title="Delete this package?" @confirm="onDelete(row as TrafficPackage)">
                <template #reference>
                  <el-button size="small" type="danger">Delete</el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      :model-value="editorVisible"
      :title="editing ? 'Edit Traffic Package' : 'New Traffic Package'"
      width="560px"
      @update:model-value="editorVisible = $event"
    >
      <el-form label-width="140px">
        <el-form-item label="Name" required>
          <el-input v-model="form.name" placeholder="e.g. 100GB Add-on" />
        </el-form-item>
        <el-form-item label="Price (cents)" required>
          <el-input-number v-model="form.price" :min="0" :step="100" />
          <span class="hint">{{ formatPrice(form.price) }}</span>
        </el-form-item>
        <el-form-item label="Traffic">
          <QuotaInput v-model="form.quota_bytes" />
          <span class="hint">{{ formatBytes(form.quota_bytes) }}</span>
        </el-form-item>
        <el-form-item label="Validity (days)">
          <el-input-number v-model="form.validity_days" :min="0" />
          <span class="hint">0 = no expiry</span>
        </el-form-item>
        <el-form-item label="Description">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="(optional)" />
        </el-form-item>
        <el-form-item label="Enabled">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">
          {{ editing ? 'Save' : 'Create' }}
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
.actions {
  display: flex;
  gap: 4px;
  align-items: center;
}
.hint {
  display: inline-block;
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
h2 {
  margin: 0;
}
</style>
