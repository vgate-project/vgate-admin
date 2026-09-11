// Wire-format types mirroring the manager's nested config DTOs
// (manager/internal/wire/wire.go). These back the node-editor sub-forms.

export interface TLSConfig {
  server_name?: string
  cert_file?: string
  key_file?: string
  cert_pem?: string
  key_pem?: string
  alpn?: string[]
  min_version?: string
  max_version?: string
  reject_unknown_sni?: boolean
}

export interface RealityConfig {
  show?: boolean
  target?: string
  xver?: number
  server_name?: string
  private_key?: string
  short_ids?: string[]
  min_client_ver?: string
  max_client_ver?: string
  max_time_diff?: number
}

export interface VLESS {
  decryption?: string
  xor_mode?: number
  seconds_from?: number
  seconds_to?: number
  padding?: string
}

// One per-user-per-node-per-hour traffic detail row (GET /admin/traffic):
// the raw (un-multiplied) bytes reported that hour, the multiplier in effect
// when they were written, and the billed bytes charged against the quota.
export interface TrafficRecord {
  hour: string // UTC hour bucket, RFC3339
  user_id: string
  email: string
  node_id: string
  up_total: number
  down_total: number
  multiplier: number
  up_billed: number
  down_billed: number
}

// TrafficTotals / BucketStat / NodeUsage / TrafficStats mirror
// service.TrafficStats (manager/internal/service/traffic.go): aggregated usage
// over a filtered range — totals for the summary cards, a zero-filled
// hour/day series for the trend chart, and a per-node breakdown.
export interface TrafficTotals {
  up: number
  down: number
  up_billed: number
  down_billed: number
}

export interface BucketStat {
  bucket: string // ISO time: UTC hour bucket or UTC day start
  up: number
  down: number
}

export interface NodeUsage {
  node_id: string
  node_name: string
  up: number
  down: number
  share: number // fraction of total up+down, 0..1
}

export interface TrafficStats {
  from: string
  to: string
  bucket: 'hour' | 'day'
  totals: TrafficTotals
  series: BucketStat[]
  by_node: NodeUsage[]
}

// One grouped row of GET /admin/traffic/aggregate: usage summed per user or
// per entry point over the filtered range; only the chosen grouping's key
// fields are populated server-side.
export interface TrafficAggregateRow {
  user_id?: string
  email?: string
  node_id?: string
  node_name?: string
  up: number
  down: number
  up_billed: number
  down_billed: number
  active_hours: number // distinct hour buckets with traffic
}
