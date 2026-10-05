import { getServiceBaseURL } from '@/utils/service';
import { request } from '../request';

const BASE = '/admin/ops';

// ================= 类型 =================

/** 实时运维事件（后端 app/core/observability.publish_event） */
export interface OpsEvent {
  ts: string;
  kind: string;
  level: string;
  msg?: string;
  module?: string;
  function?: string;
  line?: number;
  exc?: string;
  method?: string;
  path?: string;
  status?: number;
  cost_ms?: number;
  ip?: string;
  [key: string]: unknown;
}

export interface OpsMinuteBucket {
  minute: string;
  total: number;
  '2xx': number;
  '4xx': number;
  '5xx': number;
  '429': number;
  slow: number;
}

export interface OpsMetrics {
  current: OpsMinuteBucket;
  previous: OpsMinuteBucket;
  series_5xx: { minute: string; count: number }[];
  series_slow: { minute: string; count: number }[];
  health: {
    ts: string;
    ready: boolean;
    checks: Record<string, boolean>;
    queues: Record<string, number>;
    disk_free_percent: number | null;
  };
  server_time: string;
}

// ================= 接口 =================

export function fetchOpsTicket() {
  return request<{ ticket: string; expires_in: number }>({
    url: `${BASE}/ticket`,
    method: 'post'
  });
}

export function fetchOpsMetrics() {
  return request<OpsMetrics>({ url: `${BASE}/metrics`, method: 'get' });
}

/**
 * SSE 完整地址。dev + 代理开启时走 /proxy-default（vite 会 rewrite），
 * 生产同域部署直接用 /api/v1。
 */
export function getOpsStreamUrl(ticket: string) {
  const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
  const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);
  return `${baseURL}${BASE}/stream?ticket=${encodeURIComponent(ticket)}`;
}
