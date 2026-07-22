<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiSystem } from '@/api/system'
import { apiEmail } from '@/api/email'
import TagListInput from '@/components/TagListInput.vue'

interface ConfigRow {
  key: string
  value: string
}

type FieldType = 'number' | 'text' | 'textarea' | 'select' | 'switch' | 'tags' | 'lines'

interface FieldDef {
  key: string
  label: string
  desc?: string
  type: FieldType
  options?: { label: string; value: string }[]
}

interface CategoryDef {
  key: string
  label: string
  hint: string
  fields: FieldDef[]
  children?: CategoryDef[] // when present, this category renders nested sub-tabs
}

// Each top-level tab is a parent CategoryDef with `children` sub-tabs. The
// `el-tabs` rendering loop (see template) handles parent → child nesting.
const systemCat: CategoryDef = {
  key: 'system',
  label: 'System',
  hint: 'Core runtime, networking, logging and authentication-token settings. Applied immediately after save.',
  fields: [],
  children: [
    {
      key: 'general',
      label: 'General',
      hint: 'Site-wide display settings.',
      fields: [
        {
          key: 'site.name',
          label: 'Site Name',
          desc: 'Display name shown on the admin & user portals (login page, sidebar brand, browser tab title).',
          type: 'text',
        },
        {
          key: 'site.base_url',
          label: 'User Base URL',
          desc: 'Public base URL of the user SPA (e.g. https://user.example.com). Used to build the clickable email-verification link; leave empty to send the raw token only.',
          type: 'text',
        },
      ],
    },
    {
      key: 'server',
      label: 'Server',
      hint: 'HTTP server timeouts and request handling.',
      fields: [
        {
          key: 'server.read_timeout_secs',
          label: 'Read Timeout',
          desc: 'Maximum duration for reading the entire request, including the body. Unit: seconds.',
          type: 'number',
        },
        {
          key: 'server.write_timeout_secs',
          label: 'Write Timeout',
          desc: 'Maximum duration before timing out writes of the response; reset whenever a new request header is read. Unit: seconds.',
          type: 'number',
        },
      ],
    },
    {
      key: 'logging',
      label: 'Logging',
      hint: 'Log verbosity and output format.',
      fields: [
        {
          key: 'log.level',
          label: 'Log Level',
          type: 'select',
          options: [
            { label: 'trace', value: 'trace' },
            { label: 'debug', value: 'debug' },
            { label: 'info', value: 'info' },
            { label: 'warn', value: 'warn' },
            { label: 'error', value: 'error' },
          ],
        },
        {
          key: 'log.format',
          label: 'Log Format',
          type: 'select',
          options: [
            { label: 'text', value: 'text' },
            { label: 'json', value: 'json' },
          ],
        },
      ],
    },
    {
      key: 'cors',
      label: 'CORS',
      hint: 'Cross-origin request policy for the API.',
      fields: [
        {
          key: 'cors.allowed_origins',
          label: 'Allowed Origins',
          desc: 'One domain per entry; use * to allow all origins.',
          type: 'tags',
        },
      ],
    },
    {
      key: 'auth_tokens',
      label: 'Auth Tokens',
      hint: 'JWT access/refresh token lifetimes.',
      fields: [
        { key: 'jwt.access_ttl_secs', label: 'Access Token TTL', desc: 'Unit: seconds', type: 'number' },
        { key: 'jwt.refresh_ttl_secs', label: 'Refresh Token TTL', desc: 'Unit: seconds', type: 'number' },
      ],
    },
  ],
}

const usersCat: CategoryDef = {
  key: 'users',
  label: 'Users',
  hint: 'Self-service registration, password policy, invites and traffic quotas. Applied immediately after save.',
  fields: [],
  children: [
    {
      key: 'registration',
      label: 'Registration',
      hint: 'Controls who may create accounts and under what conditions.',
      fields: [
        {
          key: 'user.register_enabled',
          label: 'Enable Registration',
          desc: 'When enabled, new users can create accounts via the registration page.',
          type: 'switch',
        },
        {
          key: 'user.register_require_invite',
          label: 'Require Invite Code',
          desc: 'When enabled, registration requires a valid invite code (public registration is invite-only).',
          type: 'switch',
        },
        {
          key: 'user.register_require_email_verify',
          label: 'Require Email Verification',
          desc: 'When enabled, new accounts stay inactive until the user verifies their email via the link we send.',
          type: 'switch',
        },
        {
          key: 'user.register_email_suffix_whitelist',
          label: 'Allowed Email Domains',
          desc: 'Restrict registration to these email domains (exact match, one domain per tag). Leave empty to allow any domain.',
          type: 'tags',
        },
      ],
    },
    {
      key: 'password_policy',
      label: 'Password Policy',
      hint: 'Enforced when an admin or user sets/changes a password.',
      fields: [
        {
          key: 'password.min_length',
          label: 'Password Min Length',
          desc: 'Minimum length enforced when an admin or user sets/changes a password.',
          type: 'number',
        },
        {
          key: 'password.require_complexity',
          label: 'Require Complexity',
          desc: 'When enabled, a password must contain uppercase, lowercase, and a digit.',
          type: 'switch',
        },
      ],
    },
    {
      key: 'invites',
      label: 'Invites',
      hint: 'Default invite sponsorship quota.',
      fields: [
        {
          key: 'invite.default_user_quota',
          label: 'Default User Invite Quota',
          desc: 'Max successful registrations each user may sponsor (0 = disabled). Users with a higher per-user max_invites override this.',
          type: 'number',
        },
      ],
    },
    {
      key: 'traffic',
      label: 'Traffic',
      hint: 'Global monthly traffic quota reset.',
      fields: [
        {
          key: 'quota.reset_day',
          label: 'Quota Reset Day',
          desc: 'Global monthly quota reset day (1-28). Applied to users with "Monthly reset" enabled. All opted-in users reset on this day.',
          type: 'number',
        },
      ],
    },
  ],
}

const securityCat: CategoryDef = {
  key: 'security',
  label: 'Security',
  hint: 'Anti-abuse and bot-challenge controls.',
  fields: [],
  children: [
    {
      key: 'captcha',
      label: 'Captcha',
      hint: 'Cloudflare Turnstile settings. When disabled (default), no challenge is required anywhere.',
      fields: [
        {
          key: 'captcha.turnstile_enabled',
          label: 'Enable Turnstile',
          desc: 'When enabled, the login, register, email-verify and admin-login endpoints require a solved Turnstile challenge.',
          type: 'switch',
        },
        {
          key: 'captcha.turnstile_site_key',
          label: 'Site Key',
          desc: 'Public Turnstile widget key (rendered in the user SPA).',
          type: 'text',
        },
        {
          key: 'captcha.turnstile_secret_key',
          label: 'Secret Key',
          desc: 'Server-side secret used to verify challenge tokens with Cloudflare. Keep this confidential.',
          type: 'text',
        },
      ],
    },
  ],
}

const emailCat: CategoryDef = {
  key: 'email',
  label: 'Email',
  hint: 'Outbound mail provider for registration verification and admin broadcast emails. Leave disabled if unused.',
  fields: [],
  children: [
    {
      key: 'general',
      label: 'General',
      hint: 'Pick the mail backend, the master switch, and the shared From address used by both SMTP and Resend. Applied after save.',
      fields: [
        {
          key: 'email.provider',
          label: 'Mail Provider',
          desc: 'smtp = traditional SMTP server; resend = Resend API. Applied after save.',
          type: 'select',
          options: [
            { label: 'SMTP', value: 'smtp' },
            { label: 'Resend', value: 'resend' },
          ],
        },
        {
          key: 'email.enabled',
          label: 'Enable Email',
          desc: 'Master switch for outbound mail (verification is skipped when disabled).',
          type: 'switch',
        },
        {
          key: 'email.from',
          label: 'From Address',
          desc: 'Sender address shown to recipients (e.g. noreply@vgate.io). Shared by SMTP and Resend; for Resend it must be a verified domain.',
          type: 'text',
        },
        {
          key: 'email.from_name',
          label: 'From Name',
          desc: 'Optional display name shown next to the address, e.g. "VGate" → "VGate" <noreply@vgate.io>.',
          type: 'text',
        },
      ],
    },
    {
      key: 'smtp',
      label: 'SMTP',
      hint: 'Outbound mail server configuration (used when Provider = SMTP).',
      fields: [
        { key: 'email.smtp_host', label: 'SMTP Host', type: 'text' },
        { key: 'email.smtp_port', label: 'SMTP Port', desc: '587 (starttls) / 465 (ssl) / 25 (none)', type: 'number' },
        {
          key: 'email.smtp_security',
          label: 'Security',
          type: 'select',
          options: [
            { label: 'none', value: 'none' },
            { label: 'starttls', value: 'starttls' },
            { label: 'ssl', value: 'ssl' },
          ],
        },
        { key: 'email.smtp_user', label: 'SMTP User', desc: 'Empty = no authentication', type: 'text' },
        { key: 'email.smtp_pass', label: 'SMTP Password', type: 'text' },
      ],
    },
    {
      key: 'resend',
      label: 'Resend',
      hint: 'Resend API configuration (used when Provider = Resend). Requires a verified From domain at resend.com.',
      fields: [
        {
          key: 'email.resend_api_key',
          label: 'Resend API Key',
          desc: 'API key from the Resend dashboard. Treated as a secret.',
          type: 'textarea',
        },
      ],
    },
  ],
}

const alipayCat: CategoryDef = {
  key: 'alipay',
  label: 'Alipay',
  hint: 'Alipay credentials and callback URLs; leave empty if unused.',
  fields: [
    { key: 'alipay.app_id', label: 'App ID', type: 'text' },
    { key: 'alipay.private_key', label: 'App Private Key', type: 'textarea' },
    { key: 'alipay.public_key', label: 'Alipay Public Key', type: 'textarea' },
    { key: 'alipay.notify_url', label: 'Notify URL', desc: 'Async payment-result callback. Alipay POSTs the signed transaction result here, so it must be a publicly reachable HTTPS URL — e.g. https://your-manager-domain.com/api/v1/billing/alipay/notify (no query string).', type: 'text' },
    { key: 'alipay.return_url', label: 'Return URL', desc: 'Front-end landing page the user is redirected to after paying on Alipay (e.g. https://your-user-portal.com/payment/result). It is only a visual landing page, NOT a reliable payment signal — entitlement is granted via the Notify URL above.', type: 'text' },
    { key: 'alipay.sandbox', label: 'Sandbox Mode', desc: 'Use Alipay sandbox environment when enabled', type: 'switch' },
  ],
}

const wechatCat: CategoryDef = {
  key: 'wechat',
  label: 'WeChat Pay',
  hint: 'WeChat Pay v3 (NATIVE) credentials; leave empty if unused.',
  fields: [
    { key: 'wechat.app_id', label: 'App ID', type: 'text' },
    { key: 'wechat.mch_id', label: 'Merchant ID (mchid)', type: 'text' },
    { key: 'wechat.api_v3_key', label: 'APIv3 Key', type: 'text' },
    { key: 'wechat.serial_no', label: 'API Certificate Serial No', type: 'text' },
    { key: 'wechat.private_key', label: 'Merchant Private Key (apiclient_key.pem)', type: 'textarea' },
    { key: 'wechat.notify_url', label: 'Notify URL', desc: 'Async payment-result callback. WeChat Pay pushes the NATIVE transaction result here, so it must be a publicly reachable HTTPS URL — e.g. https://your-manager-domain.com/api/v1/billing/wechat/notify.', type: 'text' },
  ],
}

const stripeCat: CategoryDef = {
  key: 'stripe',
  label: 'Stripe',
  hint: 'Stripe Checkout credentials; leave empty if unused.',
  fields: [
    { key: 'stripe.secret_key', label: 'Secret Key', type: 'text' },
    { key: 'stripe.webhook_secret', label: 'Webhook Signing Secret', type: 'text' },
    { key: 'stripe.success_url', label: 'Success Redirect URL', desc: 'Front-end URL Stripe redirects the user to after a successful checkout (e.g. https://your-user-portal.com/payment/success). You may append {CHECKOUT_SESSION_ID} to read the session id.', type: 'text' },
    { key: 'stripe.cancel_url', label: 'Cancel Redirect URL', desc: 'Front-end URL Stripe redirects the user to if they cancel checkout (e.g. https://your-user-portal.com/payment/cancel). Entitlement is still granted only via the webhook at /api/v1/billing/stripe/notify.', type: 'text' },
    { key: 'stripe.currency', label: 'Currency', desc: 'ISO currency, e.g. cny; defaults to cny when empty.', type: 'text' },
  ],
}

const paymentGeneralCat: CategoryDef = {
  key: 'payment_general',
  label: 'General',
  hint: 'Site-wide payment product-name fallback.',
  fields: [
    {
      key: 'payment.product_name_template',
      label: 'Product Name Template',
      desc: 'Fallback product name sent to the payment gateway when a plan/package has no explicit "Payment product name". Placeholders: {plan} = product name, {period} = billing period, {amount} = amount in yuan. Leave empty to use the built-in default.',
      type: 'text',
    },
  ],
}

const paymentCat: CategoryDef = {
  key: 'payment',
  label: 'Payment',
  hint: 'Payment provider configuration (Alipay / WeChat Pay / Stripe).',
  fields: [], // parent has no direct fields
  children: [paymentGeneralCat, alipayCat, wechatCat, stripeCat], // become sub-tabs
}

const subscriptionCat: CategoryDef = {
  key: 'subscription',
  label: 'Subscription',
  hint: 'Subscription link distribution. Applied immediately after save.',
  fields: [
    {
      key: 'sub.base_urls',
      label: 'Subscription Base URLs',
      desc: 'One base URL (origin, no path) per line, e.g. https://sub.example.com. Each time a user opens their subscription, a random entry is used to build the share/QR link (load distribution / anti-blocking). Leave empty to fall back to the request origin.',
      type: 'lines',
    },
  ],
}

const telegramGeneralCat: CategoryDef = {
  key: 'telegram_general',
  label: 'General',
  hint: 'Bot connection and master switch.',
  fields: [
    {
      key: 'telegram.enabled',
      label: 'Enable Telegram Bot',
      desc: 'Master switch for the bot. Requires a valid bot token to actually start.',
      type: 'switch',
    },
    { key: 'telegram.bot_token', label: 'Bot Token', desc: 'Token from @BotFather. Treated as a secret.', type: 'textarea' },
    { key: 'telegram.bot_username', label: 'Bot Username', desc: 'The bot @username (without the leading @). Used to build the bind deep link shown to users.', type: 'text' },
    { key: 'telegram.user_bot_enabled', label: 'Enable User Bot', desc: 'When enabled, users may link their Telegram and use /status and /sub commands.', type: 'switch' },
  ],
}

const telegramAlertsCat: CategoryDef = {
  key: 'telegram_alerts',
  label: 'Alerts',
  hint: 'Which events trigger admin notifications and user broadcasts.',
  fields: [
    { key: 'telegram.alert_new_registration', label: 'New Registration', desc: 'Notify admins when a new user registers.', type: 'switch' },
    { key: 'telegram.alert_order_paid', label: 'Order Paid', desc: 'Notify admins when an order is paid.', type: 'switch' },
    { key: 'telegram.alert_node_up', label: 'Node Online', desc: 'Notify admins when a node comes back online.', type: 'switch' },
    { key: 'telegram.alert_node_down', label: 'Node Offline', desc: 'Notify admins when a node goes offline.', type: 'switch' },
    { key: 'telegram.alert_traffic_exceeded', label: 'Traffic Exceeded', desc: 'Notify admins once when a user exceeds their traffic quota.', type: 'switch' },
    { key: 'telegram.alert_announcement', label: 'Announcement', desc: 'Broadcast new announcements to opted-in users via Telegram.', type: 'switch' },
    { key: 'telegram.alert_ticket', label: 'Ticket Activity', desc: 'Notify admins when a ticket is opened or a user replies, so they can reply from Telegram by quoting the message.', type: 'switch' },
  ],
}

const telegramCat: CategoryDef = {
  key: 'telegram',
  label: 'Telegram',
  hint: 'Telegram bot for admin alerts, user self-service, admin remote control and announcement broadcasts. Leave disabled if unused.',
  fields: [], // parent has no direct fields
  children: [telegramGeneralCat, telegramAlertsCat], // become sub-tabs
}

const categories: CategoryDef[] = [systemCat, usersCat, securityCat, emailCat, paymentCat, subscriptionCat, telegramCat]

// Default the active sub-tab of each parent category to its first child, so
// clicking a parent tab (e.g. Payment) opens its first sub-tab.
const subActive = reactive<Record<string, string>>({})
for (const c of categories) {
  if (c.children?.length) subActive[c.key] = c.children[0].key
}

const rows = ref<ConfigRow[]>([])
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const activeTab = ref<string>(categories[0].key)

function rowFor(key: string): ConfigRow | undefined {
  return rows.value.find((r) => r.key === key)
}

// Read a field's value converted to the control's expected type.
function fieldValue(f: FieldDef): any {
  const row = rowFor(f.key)
  if (!row) return f.type === 'number' ? 0 : f.type === 'switch' ? false : f.type === 'tags' ? [] : ''
  switch (f.type) {
    case 'number':
      return parseInt(row.value, 10) || 0
    case 'switch':
      return row.value === 'true'
    case 'tags':
      try {
        const v = JSON.parse(row.value)
        return Array.isArray(v) ? v : []
      } catch {
        return []
      }
    case 'lines':
      // r.value is either the stored JSON array (after load) or raw text
      // (during editing). Return newline-joined text either way; if it isn't a
      // JSON array, treat it as raw text so trailing newlines aren't lost.
      try {
        const v = JSON.parse(row.value)
        if (Array.isArray(v)) return v.join('\n')
      } catch {
        /* not JSON → raw text being edited */
      }
      return row.value
    default:
      return row.value
  }
}

// Write a control value back as the stored string.
function setFieldValue(f: FieldDef, val: any) {
  let row = rowFor(f.key)
  if (!row) {
    row = { key: f.key, value: '' }
    rows.value.push(row)
  }
  switch (f.type) {
    case 'number':
      row.value = String(val ?? 0)
      break
    case 'switch':
      row.value = val ? 'true' : 'false'
      break
    case 'tags':
      row.value = JSON.stringify(val ?? [])
      break
    case 'lines':
      // Store the raw multiline text while editing so the textarea keeps
      // trailing newlines (pressing Enter works naturally). It is normalized
      // into a JSON array only at save time (see saveAll).
      row.value = String(val ?? '')
      break
    default:
      row.value = val
  }
}

async function load() {
  loading.value = true
  try {
    const { data } = await apiSystem.get()
    const next: Record<string, string> = { ...data }

    // Ensure all known fields appear in the form so admins can discover and
    // edit them even before they have a value (nested children included).
    for (const cat of categories) {
      const all = cat.children ? [...cat.fields, ...cat.children.flatMap((c) => c.fields)] : cat.fields
      for (const f of all) {
        if (!(f.key in next)) next[f.key] = ''
      }
    }
    rows.value = Object.entries(next).map(([k, v]) => ({ key: k, value: v }))
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function saveAll() {
  // Build a key → field-def map so we can normalize the `lines` fields (which
  // hold raw multiline text during editing) into the JSON array the backend
  // expects, while passing every other field through unchanged.
  const fieldByKey: Record<string, FieldDef> = {}
  for (const cat of categories) {
    const all = cat.children ? [...cat.fields, ...cat.children.flatMap((c) => c.fields)] : cat.fields
    for (const f of all) fieldByKey[f.key] = f
  }

  const map: Record<string, string> = {}
  for (const r of rows.value) {
    if (!r.key.trim()) continue
    const def = fieldByKey[r.key.trim()]
    if (def?.type === 'lines') {
      // Already a JSON array (loaded but not edited) → keep as-is. Otherwise
      // normalize the raw multiline text: split, trim, drop empty lines.
      let normalized = r.value
      try {
        const parsed = JSON.parse(r.value)
        if (!Array.isArray(parsed)) normalized = JSON.stringify([])
      } catch {
        normalized = JSON.stringify(
          r.value.split('\n').map((s) => s.trim()).filter((s) => s.length > 0),
        )
      }
      map[r.key.trim()] = normalized
    } else {
      map[r.key.trim()] = r.value
    }
  }
  saving.value = true
  try {
    await apiSystem.update(map)
    ElMessage.success('Config saved')
    load()
  } finally {
    saving.value = false
  }
}

// testEmail sends a single test message to verify SMTP/Resend connectivity.
// It uses the currently saved configuration, so the admin should Save first
// after editing the email settings. The recipient defaults to the configured
// From address but can be overridden in the prompt.
async function testEmail() {
  const from = rowFor('email.from')?.value || ''
  let to = ''
  try {
    const { value } = await ElMessageBox.prompt(
      'Send a test email to which address? The currently saved email configuration will be used, so save first if you changed settings.',
      'Test Email',
      {
        confirmButtonText: 'Send',
        cancelButtonText: 'Cancel',
        inputValue: from,
        inputPattern: /.+@.+\..+/,
        inputErrorMessage: 'Please enter a valid email address',
      },
    )
    to = value.trim()
  } catch {
    return // user cancelled
  }

  testing.value = true
  try {
    const { data } = await apiEmail.test({ to })
    if (data.ok) {
      ElMessage.success(data.message || 'Test email sent')
    } else {
      ElMessage.error(data.error || 'Failed to send test email')
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || 'Failed to send test email')
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">System Config</h2>
    <el-card shadow="never">
      <el-tabs v-model="activeTab" v-loading="loading">
        <!-- Parent config tabs (System, Users, Security, Email, Payment): each
             renders nested sub-tabs via `children`. New categories only need an
             entry in the `categories` array. -->
        <el-tab-pane v-for="cat in categories" :key="cat.key" :name="cat.key" :label="cat.label">
          <el-text type="info" size="small">{{ cat.hint }}</el-text>

          <!-- Parent category: nested sub-tabs (one per child category). -->
          <el-tabs v-if="cat.children && cat.children.length" v-model="subActive[cat.key]">
            <el-tab-pane v-for="child in cat.children" :key="child.key" :name="child.key" :label="child.label">
              <el-text type="info" size="small">{{ child.hint }}</el-text>
              <el-form label-width="200px" style="margin-top: 12px" @submit.prevent>
                <el-form-item v-for="f in child.fields" :key="f.key" :label="f.label">
                  <el-input-number
                    v-if="f.type === 'number'"
                    :model-value="fieldValue(f)"
                    @update:model-value="(v: number | undefined) => setFieldValue(f, v)"
                    :min="0"
                    controls-position="right"
                  />
                  <el-select
                    v-else-if="f.type === 'select'"
                    :model-value="fieldValue(f)"
                    @update:model-value="(v: string) => setFieldValue(f, v)"
                    style="width: 240px"
                  >
                    <el-option v-for="o in f.options" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                  <el-switch
                    v-else-if="f.type === 'switch'"
                    :model-value="fieldValue(f)"
                    @update:model-value="(v: string | number | boolean) => setFieldValue(f, v)"
                  />
                  <TagListInput
                    v-else-if="f.type === 'tags'"
                    :model-value="fieldValue(f)"
                    @update:model-value="(v: string[]) => setFieldValue(f, v)"
                    placeholder="domain, press Enter to add"
                  />
                  <el-input
                    v-else-if="f.type === 'lines'"
                    type="textarea"
                    :rows="4"
                    :model-value="fieldValue(f)"
                    @update:model-value="(v: string) => setFieldValue(f, v)"
                    :placeholder="'https://sub1.example.com\nhttps://sub2.example.com'"
                    style="max-width: 560px"
                  />
                  <el-input
                    v-else-if="f.type === 'textarea'"
                    type="textarea"
                    :rows="3"
                    :model-value="fieldValue(f)"
                    @update:model-value="(v: string) => setFieldValue(f, v)"
                    style="max-width: 560px"
                  />
                  <el-input
                    v-else
                    :model-value="fieldValue(f)"
                    @update:model-value="(v: string) => setFieldValue(f, v)"
                    style="max-width: 560px"
                  />
                  <div v-if="f.desc" class="label-desc">
                    <el-text type="info" size="small">{{ f.desc }}</el-text>
                  </div>
                </el-form-item>
              </el-form>
            </el-tab-pane>
          </el-tabs>

          <!-- Leaf category: single-level form. -->
          <el-form v-else label-width="200px" style="margin-top: 12px" @submit.prevent>
            <el-form-item v-for="f in cat.fields" :key="f.key" :label="f.label">
              <el-input-number
                v-if="f.type === 'number'"
                :model-value="fieldValue(f)"
                @update:model-value="(v: number | undefined) => setFieldValue(f, v)"
                :min="0"
                controls-position="right"
              />
              <el-select
                v-else-if="f.type === 'select'"
                :model-value="fieldValue(f)"
                @update:model-value="(v: string) => setFieldValue(f, v)"
                style="width: 240px"
              >
                <el-option v-for="o in f.options" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <el-switch
                v-else-if="f.type === 'switch'"
                :model-value="fieldValue(f)"
                @update:model-value="(v: string | number | boolean) => setFieldValue(f, v)"
              />
              <TagListInput
                v-else-if="f.type === 'tags'"
                :model-value="fieldValue(f)"
                @update:model-value="(v: string[]) => setFieldValue(f, v)"
                placeholder="domain, press Enter to add"
              />
              <el-input
                v-else-if="f.type === 'lines'"
                type="textarea"
                :rows="4"
                :model-value="fieldValue(f)"
                @update:model-value="(v: string) => setFieldValue(f, v)"
                :placeholder="'https://sub1.example.com\nhttps://sub2.example.com'"
                style="max-width: 560px"
              />
              <el-input
                v-else-if="f.type === 'textarea'"
                type="textarea"
                :rows="3"
                :model-value="fieldValue(f)"
                @update:model-value="(v: string) => setFieldValue(f, v)"
                style="max-width: 560px"
              />
              <el-input
                v-else
                :model-value="fieldValue(f)"
                @update:model-value="(v: string) => setFieldValue(f, v)"
                style="max-width: 560px"
              />
              <div v-if="f.desc" class="label-desc">
                <el-text type="info" size="small">{{ f.desc }}</el-text>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div style="margin-top: 12px; display: flex; gap: 8px">
        <el-button type="primary" native-type="button" :loading="saving" @click="saveAll">Save All</el-button>
        <el-button v-if="activeTab === 'email' && subActive['email'] === 'general'" :loading="testing" @click="testEmail">Test Email</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.el-form {
  padding-top: 4px;
}
.el-form-item {
  margin-bottom: 26px;
}
.el-form-item:last-child {
  margin-bottom: 8px;
}
.el-divider {
  margin: 28px 0 22px;
}
.label-desc {
  margin-top: 6px;
  margin-left: 10px;
}
</style>
