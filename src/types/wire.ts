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

export interface TrafficRow {
  user_id: string
  email: string
  node_id: string
  up_total: number
  down_total: number
}
