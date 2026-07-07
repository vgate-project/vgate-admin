<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

import { useAuthStore } from '@/stores/auth'
import { apiAuth } from '@/api/auth'
import type { AdminConfig } from '@/types/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = ref({ username: '', password: '' })
const loading = ref(false)

// Public login-page settings, fetched once so we know whether to render the
// captcha widget. Defaults to disabled when the fetch fails (non-critical).
const config = ref<AdminConfig | null>(null)
const captchaEnabled = ref(false)

async function loadConfig() {
  try {
    const { data } = await apiAuth.getConfig()
    config.value = data
    captchaEnabled.value = !!data.captcha_enabled
  } catch {
    config.value = null
    captchaEnabled.value = false
  }
}
onMounted(loadConfig)

// ---- Cloudflare Turnstile ----
// Only the login form is shown here, so we keep a single active widget and
// (re)mount it whenever captcha availability changes.
const captchaToken = ref('')
const captchaEl = ref<HTMLElement | null>(null)
let activeWidgetId: number | null = null

function resetCaptcha() {
  captchaToken.value = ''
  if (activeWidgetId !== null && (window as any).turnstile) {
    ;(window as any).turnstile.reset(activeWidgetId)
    activeWidgetId = null
  }
}

function renderCaptcha() {
  const el = captchaEl.value
  const sitekey = config.value?.captcha_site_key
  if (!el || !(window as any).turnstile || !sitekey) return
  activeWidgetId = (window as any).turnstile.render(el, {
    sitekey,
    callback: (token: string) => {
      captchaToken.value = token
    },
    'expired-callback': () => {
      captchaToken.value = ''
    },
    'error-callback': () => {
      captchaToken.value = ''
    },
  })
}

let turnstileLoading = false
function ensureTurnstile(cb: () => void) {
  if ((window as any).turnstile) {
    cb()
    return
  }
  if (turnstileLoading) return
  turnstileLoading = true
  const s = document.createElement('script')
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
  s.async = true
  s.defer = true
  s.onload = () => cb()
  document.head.appendChild(s)
}

// When captcha becomes enabled, mount the widget.
watch(captchaEnabled, async (enabled) => {
  captchaToken.value = ''
  activeWidgetId = null
  if (!enabled) return
  await nextTick()
  ensureTurnstile(renderCaptcha)
})

async function onSubmit() {
  if (!form.value.username || !form.value.password) {
    ElMessage.warning('Please enter your username and password')
    return
  }
  if (captchaEnabled.value && !captchaToken.value) {
    ElMessage.warning('Please complete the captcha')
    return
  }
  loading.value = true
  try {
    await auth.login(form.value.username, form.value.password, captchaToken.value || undefined)
    const redirect = (route.query.redirect as string) || '/dashboard'
    await router.push(redirect)
  } catch {
    // error already toasted by the http interceptor; force a fresh challenge.
    resetCaptcha()
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrapper">
    <el-card class="login-card">
      <h1 class="login-title">VGate Admin</h1>
      <el-form @submit.prevent="onSubmit" label-position="top">
        <el-form-item label="Username">
          <el-input v-model="form.username" placeholder="admin" autocomplete="username" />
        </el-form-item>
        <el-form-item label="Password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="••••••••"
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <div v-if="captchaEnabled" ref="captchaEl" class="captcha-box"></div>
        <el-button type="primary" :loading="loading" style="width: 100%" @click="onSubmit">
          Sign in
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f5f7fa;
}
.login-card {
  width: 360px;
}
.login-title {
  text-align: center;
  margin: 0 0 1.5rem;
  font-size: 1.5rem;
}
.captcha-box {
  margin-bottom: 18px;
  min-height: 10px;
}
</style>
