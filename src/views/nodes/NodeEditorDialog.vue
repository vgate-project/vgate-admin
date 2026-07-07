<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { apiNodes } from '@/api/nodes'
import type { Node, NodeRequest, Network, Security, Flow } from '@/types/api'
import type { TLSConfig, RealityConfig, VLESS } from '@/types/wire'
import TagListInput from '@/components/TagListInput.vue'
import {Refresh} from "@element-plus/icons-vue";

const props = defineProps<{ modelValue: boolean; node: Node | null; defaultParentId?: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [token?: string] }>()

const isEdit = computed(() => !!props.node)
const saving = ref(false)

const dialogTitle = computed(() => {
  if (form.isVirtual) return isEdit.value ? 'Edit Virtual Node' : 'New Virtual Node'
  return isEdit.value ? 'Edit Node' : 'New Node'
})

const form = reactive({
  isVirtual: false,
  parentId: null as string | null,
  name: '',
  address: '',
  port: 443,
  network: 'tcp' as Network,
  security: 'none' as Security,
  settingsJson: '',
  reality: {
    show: false, target: '', xver: 0, server_name: '',
    private_key: '', short_ids: [] as string[],
    min_client_ver: '', max_client_ver: '', max_time_diff: 0,
  } as RealityConfig,
  tls: {
    server_name: '', cert_file: '', key_file: '', cert_pem: '', key_pem: '',
    alpn: [] as string[], min_version: '', max_version: '', reject_unknown_sni: false,
  } as TLSConfig,
  vless: {
    decryption: '', xor_mode: 0, seconds_from: 300, seconds_to: 600, padding: '',
  } as VLESS,
  flow: '' as Flow,
  allow_insecure: false,
  traffic_multiplier: 1,
  enabled: true,
})

const parentNodes = ref<Node[]>([])

// Load real (parent-eligible) nodes for the parent dropdown. Virtual nodes are
// excluded so a child can never point at another child.
async function loadParents() {
  try {
    const { data } = await apiNodes.list(1, 1000)
    parentNodes.value = (data.items || []).filter((n) => !n.parent_id)
  } catch {
    parentNodes.value = []
  }
}

const v2Enabled = computed(() => !!form.vless.decryption && form.vless.decryption !== 'none')

watch(v2Enabled, (v2) => {
  if (v2) form.flow = '' // v2 and vision are mutually exclusive
})

watch(() => form.security, (sec) => {
  if (sec === 'none') form.flow = ''
})

watch(() => form.network, (net) => {
  if (net !== 'tcp') form.flow = ''
})

function resetForm() {
  form.isVirtual = false
  form.parentId = null
  form.name = ''
  form.address = ''
  form.port = 443
  form.network = 'tcp'
  form.security = 'none'
  form.settingsJson = ''
  form.reality = { show: false, target: '', xver: 0, server_name: '', private_key: '', short_ids: [], min_client_ver: '', max_client_ver: '', max_time_diff: 0 }
  form.tls = { server_name: '', cert_file: '', key_file: '', cert_pem: '', key_pem: '', alpn: [], min_version: '', max_version: '', reject_unknown_sni: false }
  form.vless = { decryption: '', xor_mode: 0, seconds_from: 300, seconds_to: 600, padding: '' }
  form.flow = ''
  form.allow_insecure = false
  form.traffic_multiplier = 1
  form.enabled = true
}

function prefillFromNode(node: Node) {
  if (node.parent_id) {
    // Virtual child: only identity fields are its own; transport is inherited.
    form.isVirtual = true
    form.parentId = node.parent_id
    form.name = node.name
    form.address = node.address
    form.port = node.port // 0 = inherit parent port
    form.enabled = node.enabled
    loadParents()
    return
  }
  form.isVirtual = false
  form.parentId = null
  form.name = node.name
  form.address = node.address
  form.port = node.port
  form.network = node.network
  form.security = node.security
  form.settingsJson = node.settings ? JSON.stringify(node.settings, null, 2) : ''
  if (node.reality_settings) {
    form.reality = { ...node.reality_settings }
  } else {
    form.reality = { show: false, target: "", xver: 0, server_name: "", private_key: "", short_ids: [], min_client_ver: "", max_client_ver: "", max_time_diff: 0 }
  }
  form.tls = node.tls_settings
    ? { ...node.tls_settings }
    : { server_name: '', cert_file: '', key_file: '', cert_pem: '', key_pem: '', alpn: [], min_version: '', max_version: '', reject_unknown_sni: false }
  form.vless = node.vless
    ? { ...node.vless }
    : { decryption: '', xor_mode: 0, seconds_from: 300, seconds_to: 600, padding: '' }
  form.flow = node.flow
  form.allow_insecure = node.allow_insecure
  form.traffic_multiplier = node.traffic_multiplier ?? 1
  form.enabled = node.enabled
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      resetForm()
      if (props.node) {
        prefillFromNode(props.node)
      } else if (props.defaultParentId) {
        // Opening from a real node's "Add child" action → virtual mode preset.
        form.isVirtual = true
        form.parentId = props.defaultParentId
        form.port = 0 // default: inherit parent port
        loadParents()
      } else {
        loadParents()
      }
    }
  },
)

// Lazily load the parent list the first time virtual mode is selected.
watch(
  () => form.isVirtual,
  (v) => {
    if (v && parentNodes.value.length === 0) loadParents()
  },
)

function buildRequest(): NodeRequest | null {
  if (form.isVirtual) {
    return {
      name: form.name,
      parent_id: form.parentId,
      address: form.address,
      port: form.port, // 0 = inherit parent port
      enabled: form.enabled,
    }
  }
  // Parse the settings JSON (may be empty).
  let settings: Record<string, any> | null = null
  const json = form.settingsJson.trim()
  if (json) {
    try {
      settings = JSON.parse(json)
    } catch (e) {
      ElMessage.error('Settings JSON is invalid: ' + (e as Error).message)
      return null
    }
  }

  return {
    name: form.name,
    address: form.address,
    port: form.port,
    network: form.network,
    security: form.security,
    settings,
    tls_settings: form.security === 'tls' ? { ...form.tls } : null,
    reality_settings: form.security === 'reality' ? { ...form.reality } : null,
    vless: v2Enabled.value ? { ...form.vless } : null,
    flow: v2Enabled.value ? '' : form.flow,
    allow_insecure: form.allow_insecure,
    traffic_multiplier: form.traffic_multiplier > 0 ? form.traffic_multiplier : 1,
    enabled: form.enabled,
  }
}

async function onSubmit() {
  if (form.isVirtual) {
    if (!form.name || !form.address || !form.parentId) {
      ElMessage.error('Name, address and parent node are required')
      return
    }
    const body = buildRequest()
    if (!body) return
    saving.value = true
    try {
      if (isEdit.value && props.node) {
        await apiNodes.update(props.node.id, body)
        emit('saved')
      } else {
        const { data } = await apiNodes.create(body)
        emit('saved', data.token)
      }
      } finally {
        saving.value = false
      }
      // Virtual nodes have no server, so their minted token is unused — don't
      // surface it as a "shown once" secret.
      emit('saved')
      return
    }

    if (!form.name || !form.address || !form.port || !form.security) {
    ElMessage.error('Name, address, port and security are required')
    return
  }

  // add required validation for Reality SNI
  if (form.security === 'reality' && !form.reality.server_name) {
    ElMessage.error('Server name (SNI) is required for Reality')
    return
  }

  const body = buildRequest()
  if (!body) return
  saving.value = true
  try {
    if (isEdit.value && props.node) {
      await apiNodes.update(props.node.id, body)
      emit('saved')
    } else {
      await apiNodes.create(body)
      emit('saved')
    }
  } finally {
    saving.value = false
  }
}

async function onGenerateRealityKey() {
  const { data } = await apiNodes.generateX25519Key()
  form.reality.private_key = data.private_key
  ElMessage.success('Generated new Reality keypair')
}

async function onGenerateVlessKey() {
  const { data } = await apiNodes.generateX25519Key()
  form.vless.decryption = data.private_key
  ElMessage.success("Generated new X25519 private key for VLESS v2")
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="760px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-width="160px" label-position="right">
      <el-divider content-position="left">Type</el-divider>
      <el-form-item label="Node type" required>
        <el-radio-group v-model="form.isVirtual">
          <el-radio :value="false">Real node</el-radio>
          <el-radio :value="true">Virtual child (multi-IP)</el-radio>
        </el-radio-group>
        <span v-if="form.isVirtual" class="hint">
          Inherits transport config (security / TLS / Reality / VLESS) from the parent; only the address — and optionally the port — differ.
        </span>
      </el-form-item>
      <el-form-item label="Parent node" v-if="form.isVirtual" required>
        <el-select v-model="form.parentId" placeholder="Select parent node" :disabled="isEdit" style="width: 100%">
          <el-option v-for="p in parentNodes" :key="p.id" :label="p.name + ' (' + p.address + ')'" :value="p.id" />
        </el-select>
      </el-form-item>

      <el-divider content-position="left">Basics</el-divider>
      <el-form-item label="Name" required>
        <el-input v-model="form.name" placeholder="hk-1" />
      </el-form-item>
      <el-form-item label="Address" required>
        <el-input v-model="form.address" :placeholder="form.isVirtual ? '1.2.3.4 (one of the parent IPs)' : 'hk.example.com:443'" />
      </el-form-item>
      <el-form-item label="Port" :required="!form.isVirtual">
        <el-input-number v-model="form.port" :min="form.isVirtual ? 0 : 1" :max="65535" />
        <span v-if="form.isVirtual" class="hint">0 = inherit parent port</span>
      </el-form-item>
      <template v-if="!form.isVirtual">
        <el-form-item label="Network">
          <el-select v-model="form.network">
            <el-option label="tcp" value="tcp" />
            <el-option label="ws" value="ws" />
            <el-option label="xhttp" value="xhttp" />
          </el-select>
        </el-form-item>
        <el-form-item label="Security" required>
          <el-select v-model="form.security">
            <el-option label="none" value="none" />
            <el-option label="tls" value="tls" />
            <el-option label="reality" value="reality" />
          </el-select>
        </el-form-item>
        <el-form-item label="Flow">
          <el-select v-model="form.flow" :disabled="v2Enabled || form.security === 'none' || form.network !== 'tcp'">
            <el-option label="none" value="" />
            <el-option label="xtls-rprx-vision" value="xtls-rprx-vision" />
          </el-select>
          <span v-if="v2Enabled" class="hint">disabled (v2 encryption active)</span>
          <span v-else-if="form.security === 'none'" class="hint">disabled (security is none)</span>
          <span v-else-if="form.network !== 'tcp'" class="hint">disabled (flow only supports tcp)</span>
        </el-form-item>
        <el-form-item label="Allow insecure">
          <el-switch v-model="form.allow_insecure" />
        </el-form-item>
        <el-form-item label="Traffic multiplier">
          <el-input-number v-model="form.traffic_multiplier" :min="0.01" :max="1000" :step="0.1" :precision="2" />
          <span class="hint">Scales reported traffic at aggregation time (1 = no change). &gt;1 inflates, &lt;1 deflates.</span>
        </el-form-item>
      </template>
      <el-form-item label="Enabled">
        <el-switch v-model="form.enabled" />
      </el-form-item>

      <template v-if="!form.isVirtual">
      <el-divider content-position="left">Transport settings (JSON)</el-divider>
      <el-form-item label="Settings">
        <el-input
          v-model="form.settingsJson"
          type="textarea"
          :rows="2"
          placeholder='{"path": "/xhttp"}'
        />
        <span class="hint">JSON map, e.g. ws/xhttp path. Leave empty for defaults.</span>
      </el-form-item>

      <template v-if="form.security === 'reality'">
        <el-divider content-position="left">Reality</el-divider>
        <el-form-item label="Show">
          <el-switch v-model="form.reality.show" />
        </el-form-item>
        <el-form-item label="Target">
          <el-input v-model="form.reality.target" placeholder="www.microsoft.com:443" />
        </el-form-item>
        <el-form-item label="xver">
          <el-input-number v-model="form.reality.xver" :min="0" :max="2" />
        </el-form-item>
        <el-form-item label="Server name (SNI)">
          <el-input v-model="form.reality.server_name" placeholder="www.microsoft.com" />
        </el-form-item>
        <el-form-item label="Private key">
          <div style="display: flex; gap: 8px; width: 100%">
            <el-input v-model="form.reality.private_key" readonly placeholder="base64url X25519" />
            <el-button @click="onGenerateRealityKey">
              <el-icon><Refresh /></el-icon><span>Generate</span>
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="Short IDs">
          <TagListInput v-model="form.reality.short_ids" placeholder="0123456789abcdef" />
        </el-form-item>
        <el-form-item label="Min client ver">
          <el-input v-model="form.reality.min_client_ver" placeholder="1.8.16" />
        </el-form-item>
        <el-form-item label="Max client ver">
          <el-input v-model="form.reality.max_client_ver" placeholder="1.8.16" />
        </el-form-item>
        <el-form-item label="Max time diff (ms)">
          <el-input-number v-model="form.reality.max_time_diff" :min="0" />
        </el-form-item>
      </template>

      <template v-if="form.security === 'tls'">
        <el-divider content-position="left">TLS</el-divider>
        <el-form-item label="Server name">
          <el-input v-model="form.tls.server_name" />
        </el-form-item>
        <el-form-item label="Cert file">
          <el-input v-model="form.tls.cert_file" placeholder="/path/to/cert.pem" />
        </el-form-item>
        <el-form-item label="Key file">
          <el-input v-model="form.tls.key_file" placeholder="/path/to/key.pem" />
        </el-form-item>
        <el-form-item label="Cert PEM">
          <el-input v-model="form.tls.cert_pem" type="textarea" :rows="3" placeholder="inline PEM (alternative to file)" />
        </el-form-item>
        <el-form-item label="Key PEM">
          <el-input v-model="form.tls.key_pem" type="textarea" :rows="3" placeholder="inline PEM (alternative to file)" />
        </el-form-item>
        <el-form-item label="ALPN">
          <TagListInput v-model="form.tls.alpn" placeholder="h2" />
        </el-form-item>
        <el-form-item label="Min version">
          <el-select v-model="form.tls.min_version" clearable>
            <el-option label="1.0" value="1.0" /><el-option label="1.1" value="1.1" />
            <el-option label="1.2" value="1.2" /><el-option label="1.3" value="1.3" />
          </el-select>
        </el-form-item>
        <el-form-item label="Max version">
          <el-select v-model="form.tls.max_version" clearable>
            <el-option label="1.0" value="1.0" /><el-option label="1.1" value="1.1" />
            <el-option label="1.2" value="1.2" /><el-option label="1.3" value="1.3" />
          </el-select>
        </el-form-item>
        <el-form-item label="Reject unknown SNI">
          <el-switch v-model="form.tls.reject_unknown_sni" />
        </el-form-item>
      </template>

      <el-divider content-position="left">VLESS v2 (optional)</el-divider>
      <el-form-item label="Decryption">
        <div style="display: flex; gap: 8px; width: 100%">
          <el-input v-model="form.vless.decryption" readonly placeholder="base64url NFS private key, or empty for v0" />
          <el-button @click="onGenerateVlessKey">
            <el-icon><Refresh /></el-icon><span>Generate</span>
          </el-button>
        </div>
        <span class="hint">Non-empty enables v2 AEAD encryption (disables Vision flow).</span>
      </el-form-item>
      <el-form-item label="XOR mode">
        <el-input-number v-model="form.vless.xor_mode" :min="0" :max="2" />
      </el-form-item>
      <el-form-item label="Seconds from">
        <el-input-number v-model="form.vless.seconds_from" :min="0" />
      </el-form-item>
      <el-form-item label="Seconds to">
        <el-input-number v-model="form.vless.seconds_to" :min="0" />
      </el-form-item>
        <el-form-item label="Padding">
          <el-input v-model="form.vless.padding" placeholder="spec string" />
        </el-form-item>
      </template>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">Cancel</el-button>
      <el-button type="primary" :loading="saving" @click="onSubmit">
        {{ isEdit ? 'Save' : 'Create' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
