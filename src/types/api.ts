import type { TLSConfig, RealityConfig, VLESS } from './wire'

export type Network = 'tcp' | 'ws' | 'xhttp' | ''
export type Security = 'none' | 'tls' | 'reality'
export type Flow = '' | 'xtls-rprx-vision'

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface HourlyStat {
  hour: string
  up: number
  down: number
}

export interface OverviewStats {
  node_count: number
  node_online: number
  user_count: number
  online_users_24h: number
  up_24h: number
  down_24h: number
  series: HourlyStat[]
  order_count_24h: number
  order_amount_24h: number // cents

  // User health (cheap conditional counts)
  expiring_users_7d: number // expire_at set and within next 7d (incl. expired)
  quota_exhausted_users: number // quota_bytes>0 and used>=quota
  unverified_users: number // email_verified=false
  new_users_today: number // created since local midnight
  new_users_yesterday: number // created in [−48h, −24h) for DoD

  // Pending orders (status=pending)
  order_pending_count: number

  // Previous 24h values, for day-over-day (DoD) trend comparison
  up_24h_prev: number
  down_24h_prev: number
  online_users_24h_prev: number
  order_count_24h_prev: number
  order_amount_24h_prev: number
}

export interface Node {
  id: string
  name: string
  parent_id?: string | null
  parent_name?: string | null
  address: string
  port: number
  network: Network
  security: Security
  settings: Record<string, any> | null
  tls_settings?: TLSConfig | null
  reality_settings?: RealityConfig | null
  vless?: VLESS | null
  flow: Flow
  allow_insecure: boolean
  level: number
  traffic_multiplier?: number
  token: string
  last_seen_at?: string
  online?: boolean
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface NodeWithToken extends Node {
  token: string
}

export interface NodeRequest {
  name: string
  parent_id?: string | null
  address: string
  port?: number
  network?: Network
  security?: Security
  settings?: Record<string, any> | null
  tls_settings?: TLSConfig | null
  reality_settings?: RealityConfig | null
  vless?: VLESS | null
  flow?: Flow
  allow_insecure?: boolean
  traffic_multiplier?: number
  enabled?: boolean // *bool on backend: omit = default true on create
}

export interface RealityKeyResponse {
  private_key: string
  public_key: string
}

export interface User {
  id: string
  credential: string // rotatable VLESS UUID in the subscription link / node push
  email: string
  username?: string
  level: number
  expire_at?: string
  quota_bytes: number
  quota_reset_enabled: boolean
  up_total: number
  down_total: number
  last_reset_at?: string
  sub_token: string
  enabled: boolean
  email_verified?: boolean
  max_invites?: number
  created_at: string
  updated_at: string
}

export interface UserWithSubToken extends User {
  sub_token: string
}

export interface UserRequest {
  email: string
  username?: string | null
  level: number
  expire_at?: string | null
  quota_bytes: number
  quota_reset_enabled: boolean
  enabled?: boolean
  max_invites?: number | null
}

// --- Invite codes ---
export interface InviteCode {
  id: string
  code: string
  created_by_user_id?: string | null
  created_by_admin_id?: number | null
  note?: string
  max_uses: number
  used_count: number
  expires_at?: string | null
  created_at: string
  updated_at: string
}

export interface InviteStatus {
  used: number
  issued: number
  quota: number
}

export interface InviteRequest {
  max_uses?: number
  expires_at?: string | null
  note?: string
}

// --- Redemption codes ---
export type RedeemType = 'traffic' | 'duration' | 'plan' | 'reset'

export interface RedemptionCode {
  id: string
  code: string
  type: RedeemType
  max_uses: number
  used_count: number
  expires_at?: string | null
  note?: string
  quota_bytes?: number
  duration_days?: number
  plan_id?: string | null
  created_by_admin_id?: number | null
  created_at: string
  updated_at: string
}

export interface GenerateRedemptionRequest {
  type: RedeemType
  quota_bytes?: number
  duration_days?: number
  plan_id?: string
  max_uses?: number
  expires_at?: string | null
  count: number
  note?: string
}

export interface RedemptionRecord {
  id: string
  code_id: string
  user_id: string
  type: RedeemType
  redeemed_at: string
}

// --- Announcements ---
export interface Announcement {
  id: string
  title: string
  content: string
  pinned: boolean
  active: boolean
  author_admin_id: number
  created_at: string
  updated_at: string
}

export interface AnnouncementRequest {
  title: string
  content: string
  pinned: boolean
  active: boolean
}

// --- Email ---
export type EmailRecipients = 'all' | 'active' | 'ids'

export interface SendEmailRequest {
  recipients: EmailRecipients
  user_ids?: string[]
  subject: string
  body: string
  create_announcement?: boolean
  pinned?: boolean
}

export interface Admin {
  id: number
  username: string
  role: 'super_admin' | 'admin'
  created_at: string
  updated_at: string
}

// --- Plans (purchasable products) ---
export interface PlanPrice {
  id?: string
  plan_id?: string
  period: string // month | quarter | half_year | year
  price: number // cents
  duration_days?: number
  sort?: number
  enabled?: boolean
}

export interface Plan {
  id: string
  name: string
  quota_bytes: number
  description: string
  level: number
  enabled: boolean
  // Optional plan-scoped traffic reset package.
  reset_enabled?: boolean
  reset_price?: number // cents
  prices?: PlanPrice[]
  created_at: string
  updated_at: string
}

export interface PlanRequest {
  name: string
  quota_bytes: number
  description?: string
  level?: number
  enabled?: boolean
  reset_enabled?: boolean
  reset_price?: number // cents
  prices: PlanPrice[]
}

// --- Traffic packages (one-time traffic add-ons) ---
export interface TrafficPackage {
  id: string
  name: string
  price: number // cents
  quota_bytes: number
  validity_days: number // 0 = no expiry extension
  description: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface TrafficPackageRequest {
  name: string
  price: number // cents
  quota_bytes: number
  validity_days?: number
  description?: string
  enabled?: boolean
}

// --- Orders (alipay purchases) ---
export type OrderStatus = 'pending' | 'paid' | 'closed'

export interface Order {
  id: string
  user_id: string
  kind: string // plan | traffic
  plan_id: string
  plan_price_id?: string
  period?: string
  duration_days: number
  traffic_package_id: string
  validity_days: number
  amount: number // cents
  status: OrderStatus
  platform?: string // payment gateway: alipay | manual | (future)
  out_trade_no: string
  trade_no?: string
  channel: 'pc' | 'wap'
  paid_at?: string
  expired_at?: string
  created_at: string
  updated_at: string
}

export interface CreateOrderRequest {
  kind: string // "plan" | "traffic"
  plan_id?: string
  plan_price_id?: string
  traffic_package_id?: string
  channel?: 'pc' | 'wap'
  platform?: string // payment gateway; defaults to alipay
}

export interface AdminCreateOrderRequest {
  user_id: string
  kind: string
  plan_id?: string
  plan_price_id?: string
  traffic_package_id?: string
  channel?: 'pc' | 'wap'
  platform?: string // payment gateway; defaults to alipay
}

export interface CreateOrderResponse {
  order: Order
  pay_url: string // redirect URL (alipay/stripe) or QR content (wechat code_url)
  // How to present pay_url to the user: "redirect" (open in browser) or
  // "qr" (render pay_url as a QR code to scan, e.g. wechat NATIVE).
  pay_mode?: 'redirect' | 'qr'
}
