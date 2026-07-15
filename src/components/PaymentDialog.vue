<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import QRCode from 'qrcode'

const props = defineProps<{
  modelValue: boolean
  payUrl: string
  payMode?: string
  title?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const qr = ref('')
const error = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.payUrl)
    ElMessage.success('Copied')
  } catch {
    ElMessage.error('Copy failed')
  }
}

watch(
  () => [props.modelValue, props.payUrl, props.payMode],
  async () => {
    error.value = false
    qr.value = ''
    if (props.modelValue && props.payMode === 'qr' && props.payUrl) {
      try {
        qr.value = await QRCode.toDataURL(props.payUrl)
      } catch {
        error.value = true
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="title || 'Payment details'"
    width="420px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="payMode === 'qr'">
      <p style="margin-top: 0">Scan this QR code with WeChat to pay.</p>
      <div v-if="qr" style="text-align: center">
        <img :src="qr" alt="payment qr" style="width: 240px; height: 240px" />
      </div>
      <el-alert v-else-if="error" type="error" :closable="false" title="Failed to render QR code" />
      <div style="margin-top: 8px">
        <code style="word-break: break-all; font-size: 12px">{{ payUrl }}</code>
      </div>
    </div>
    <div v-else>
      <p style="margin-top: 0">
        Send this payment link to the user to complete the purchase.
      </p>
      <el-input :model-value="payUrl" type="textarea" :rows="3" readonly />
      <el-button
        style="margin-top: 8px"
        @click="copy"
      >
        Copy link
      </el-button>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">Close</el-button>
    </template>
  </el-dialog>
</template>
