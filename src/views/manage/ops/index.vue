<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onUnmounted, ref } from 'vue';
import { type OpsEvent, type OpsMetrics, fetchOpsMetrics, fetchOpsTicket, getOpsStreamUrl } from '@/service/api/ops';

defineOptions({ name: 'ManageOps' });

// ---------------- 实时事件流 ----------------

const MAX_EVENTS = 300;
const events = ref<OpsEvent[]>([]);
const seq = ref(0);
const connected = ref(false);
const connecting = ref(false);
const paused = ref(false);
const autoScroll = ref(true);
const levelFilter = ref<'ALL' | 'WARN' | 'ERROR'>('ALL');
const streamBox = ref<HTMLElement | null>(null);

let es: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let closed = false;

const KIND_LABELS: Record<string, string> = {
  log: '日志',
  http_anomaly: '接口异常'
};

function kindLabel(kind: string) {
  return KIND_LABELS[kind] ?? kind;
}

function levelRank(level: string) {
  if (level === 'ERROR') return 3;
  if (level === 'WARNING' || level === 'WARN') return 2;
  return 1;
}

const visibleEvents = computed(() => {
  if (levelFilter.value === 'ALL') return events.value;
  const min = levelFilter.value === 'ERROR' ? 3 : 2;
  return events.value.filter(e => levelRank(e.level) >= min);
});

function eventText(e: OpsEvent): string {
  if (e.kind === 'http_anomaly') {
    return `${e.method ?? ''} ${e.path ?? ''} → ${e.status ?? '?'}（${e.cost_ms ?? '?'}ms）${e.ip ? ` · ${e.ip}` : ''}`;
  }
  if (e.kind === 'log') {
    const where = e.module ? `[${e.module}${e.function ? `:${e.function}` : ''}${e.line ? `:${e.line}` : ''}] ` : '';
    return `${where}${e.msg ?? ''}${e.exc ? ` ${e.exc}` : ''}`;
  }
  if (e.msg) return String(e.msg);
  // 未知事件：展示除公共字段外的内容
  const reserved = new Set(['ts', 'kind', 'level']);
  const rest = Object.entries(e).filter(([k]) => !reserved.has(k));
  return rest.map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ');
}

function pushEvent(raw: string) {
  // 暂停显示期间直接丢弃（SSE 仍保持连接），避免缓冲大量事件
  if (paused.value) return;
  try {
    const evt = JSON.parse(raw) as OpsEvent;
    if (!evt.kind) return;
    seq.value += 1;
    events.value.push({ ...evt, _seq: seq.value } as OpsEvent);
    if (events.value.length > MAX_EVENTS) events.value.splice(0, events.value.length - MAX_EVENTS);
    if (autoScroll.value && !paused.value) {
      nextTick(() => {
        const el = streamBox.value;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
  } catch {
    /* 忽略无法解析的帧 */
  }
}

async function connect() {
  if (closed || es) return;
  connecting.value = true;
  let ticket = '';
  const { error, data } = await fetchOpsTicket();
  if (error || !data) {
    // 多为登录态失效（拦截器会处理跳转）；避免高频重试
    retryTimer = setTimeout(connect, 5000);
    return;
  }
  ticket = data.ticket;
  if (closed) return;
  es = new EventSource(getOpsStreamUrl(ticket));
  es.onopen = () => {
    connected.value = true;
    connecting.value = false;
  };
  es.onmessage = ev => pushEvent(ev.data);
  es.onerror = () => {
    closeSource();
    connected.value = false;
    connecting.value = false;
    // 服务端 10 分钟主动断 / 网络抖动：3s 后重新取票建连
    retryTimer = setTimeout(connect, 3000);
  };
}

function closeSource() {
  if (es) {
    es.onopen = null;
    es.onmessage = null;
    es.onerror = null;
    es.close();
    es = null;
  }
}

function startStream() {
  closed = false;
  connect();
}

function stopStream() {
  closed = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  closeSource();
  connected.value = false;
}

function clearEvents() {
  events.value = [];
}

// ---------------- 指标轮询 ----------------

const metrics = ref<OpsMetrics | null>(null);
let metricsTimer: ReturnType<typeof setInterval> | null = null;

async function loadMetrics() {
  const { error, data } = await fetchOpsMetrics();
  if (!error && data) metrics.value = data;
}

function startMetrics() {
  loadMetrics();
  metricsTimer = setInterval(loadMetrics, 2000);
}

function stopMetrics() {
  if (metricsTimer) {
    clearInterval(metricsTimer);
    metricsTimer = null;
  }
}

// keepAlive：切走时断开（全局仅 10 个 SSE 名额），切回重连
onActivated(() => {
  startMetrics();
  startStream();
});
onDeactivated(() => {
  stopMetrics();
  stopStream();
});
onUnmounted(() => {
  stopMetrics();
  stopStream();
});

// ---------------- 展示辅助 ----------------

const hbItems = computed(() => {
  const checks = metrics.value?.health.checks ?? {};
  return [
    { key: 'api', label: 'API', ok: checks.api_heartbeat ?? false },
    { key: 'worker', label: 'Worker', ok: checks.worker_heartbeat ?? false },
    { key: 'beat', label: 'Beat', ok: checks.beat_heartbeat ?? false }
  ];
});

const queueOcr = computed(() => metrics.value?.health.queues.ocr ?? -1);
const queueDefault = computed(() => metrics.value?.health.queues.default ?? -1);
const diskFree = computed(() => metrics.value?.health.disk_free_percent ?? null);
const ready = computed(() => metrics.value?.health.ready ?? false);

function barHeight(count: number, max: number) {
  if (!max) return 2;
  return Math.max(2, Math.round((count / max) * 100));
}

const max5xx = computed(() => Math.max(1, ...(metrics.value?.series_5xx.map(i => i.count) ?? [0])));
const maxSlow = computed(() => Math.max(1, ...(metrics.value?.series_slow.map(i => i.count) ?? [0])));

function hhmm(minute: string) {
  return minute.length === 12 ? `${minute.slice(8, 10)}:${minute.slice(10, 12)}` : minute;
}
</script>

<template>
  <div class="ops-page">
    <!-- 指标卡 -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value" :class="ready ? 'text-green' : 'text-red'">
          {{ ready ? '正常' : '异常' }}
        </div>
        <div class="stat-label">服务就绪（Redis/DB）</div>
        <div class="hb-row">
          <span v-for="h in hbItems" :key="h.key" class="hb-item">
            <i class="dot" :class="h.ok ? 'dot-green' : 'dot-red'" />
            {{ h.label }}
          </span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ metrics?.current.total ?? '-' }}</div>
        <div class="stat-label">本分钟请求</div>
        <div class="stat-sub">上一分钟 {{ metrics?.previous.total ?? 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" :class="(metrics?.current['5xx'] ?? 0) > 0 ? 'text-red' : ''">
          {{ metrics?.current['5xx'] ?? 0 }}
        </div>
        <div class="stat-label">本分钟 5xx</div>
        <div class="stat-sub">4xx {{ metrics?.current['4xx'] ?? 0 }} / 429 {{ metrics?.current['429'] ?? 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" :class="(metrics?.current.slow ?? 0) > 0 ? 'text-orange' : ''">
          {{ metrics?.current.slow ?? 0 }}
        </div>
        <div class="stat-label">慢请求（&gt;800ms）</div>
        <div class="stat-sub">实时统计窗口为当前分钟</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" :class="queueOcr > 20 ? 'text-red' : queueOcr > 0 ? 'text-orange' : ''">
          {{ queueOcr }}
        </div>
        <div class="stat-label">OCR 队列深度</div>
        <div class="stat-sub">default 队列 {{ queueDefault }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" :class="diskFree !== null && diskFree < 10 ? 'text-red' : ''">
          {{ diskFree === null ? '-' : `${diskFree}%` }}
        </div>
        <div class="stat-label">磁盘剩余</div>
        <div class="stat-sub">告警阈值 10%</div>
      </div>
    </div>

    <!-- 近 30 分钟迷你趋势 -->
    <div class="trend-grid">
      <div class="trend-card">
        <div class="section-title">近 30 分钟 5xx</div>
        <div class="bars">
          <div
            v-for="item in metrics?.series_5xx ?? []"
            :key="item.minute"
            class="bar-col"
            :title="`${hhmm(item.minute)}：${item.count}`"
          >
            <i
              class="bar"
              :class="item.count > 0 ? 'bar-red' : ''"
              :style="{ height: `${barHeight(item.count, max5xx)}%` }"
            />
            <span class="bar-time">{{ hhmm(item.minute) }}</span>
          </div>
        </div>
      </div>
      <div class="trend-card">
        <div class="section-title">近 30 分钟慢请求</div>
        <div class="bars">
          <div
            v-for="item in metrics?.series_slow ?? []"
            :key="item.minute"
            class="bar-col"
            :title="`${hhmm(item.minute)}：${item.count}`"
          >
            <i
              class="bar"
              :class="item.count > 0 ? 'bar-orange' : ''"
              :style="{ height: `${barHeight(item.count, maxSlow)}%` }"
            />
            <span class="bar-time">{{ hhmm(item.minute) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 实时事件流 -->
    <div class="stream-card">
      <div class="stream-toolbar">
        <div class="stream-title">
          <span class="section-title">实时事件</span>
          <i class="dot" :class="connected ? 'dot-green' : 'dot-red'" />
          <span class="conn-text">
            {{ connected ? '实时连接中' : connecting ? '连接中…' : '未连接（3s 自动重连）' }}
          </span>
        </div>
        <div class="stream-actions">
          <ElRadioGroup v-model="levelFilter" size="small">
            <ElRadioButton value="ALL">全部</ElRadioButton>
            <ElRadioButton value="WARN">WARN+</ElRadioButton>
            <ElRadioButton value="ERROR">ERROR</ElRadioButton>
          </ElRadioGroup>
          <ElButton size="small" :type="autoScroll ? 'primary' : 'default'" @click="autoScroll = !autoScroll">
            {{ autoScroll ? '自动滚底' : '不滚动' }}
          </ElButton>
          <ElButton size="small" :type="paused ? 'warning' : 'default'" @click="paused = !paused">
            {{ paused ? '继续显示' : '暂停显示' }}
          </ElButton>
          <ElButton size="small" @click="clearEvents">清屏</ElButton>
        </div>
      </div>
      <div ref="streamBox" class="stream-box">
        <div v-if="!visibleEvents.length" class="empty-tip">
          暂无事件，5xx / 慢请求 / WARNING 以上日志会实时出现在这里
        </div>
        <div
          v-for="e in visibleEvents"
          :key="(e as Record<string, number>)._seq"
          class="evt-row"
          :class="`evt-${e.level === 'WARNING' ? 'warn' : e.level.toLowerCase()}`"
        >
          <span class="evt-ts">{{ e.ts.slice(11, 19) }}</span>
          <ElTag
            size="small"
            :type="e.level === 'ERROR' ? 'danger' : e.level === 'WARNING' ? 'warning' : 'info'"
            disable-transitions
          >
            {{ e.level }}
          </ElTag>
          <ElTag size="small" type="info" effect="plain" disable-transitions>{{ kindLabel(e.kind) }}</ElTag>
          <span class="evt-text">{{ eventText(e) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ops-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.stat-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 16px 20px;
}
.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.stat-label {
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.stat-sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.hb-row {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.hb-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.text-red {
  color: #f56c6c;
}
.text-green {
  color: #67c23a;
}
.text-orange {
  color: #e6a23c;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-green {
  background: #67c23a;
  box-shadow: 0 0 4px #67c23a;
}
.dot-red {
  background: #f56c6c;
}
.trend-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.trend-card,
.stream-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 16px 20px;
}
.section-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}
.bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 72px;
  margin-top: 12px;
}
.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
}
.bar {
  width: 70%;
  min-height: 2px;
  background: var(--el-fill-color-light);
  border-radius: 2px 2px 0 0;
  display: block;
}
.bar-red {
  background: #f56c6c;
}
.bar-orange {
  background: #e6a23c;
}
.bar-time {
  font-size: 9px;
  color: var(--el-text-color-placeholder);
  margin-top: 2px;
  transform: scale(0.9);
  white-space: nowrap;
}
.stream-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.stream-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.conn-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.stream-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stream-box {
  margin-top: 12px;
  height: calc(100vh - 420px);
  min-height: 300px;
  overflow-y: auto;
  background: var(--el-fill-color-darker);
  border-radius: 6px;
  padding: 8px 12px;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 1.8;
}
.empty-tip {
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 40px 0;
}
.evt-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 2px 8px;
  border-left: 3px solid transparent;
  border-radius: 2px;
}
.evt-row:hover {
  background: var(--el-fill-color);
}
.evt-error {
  border-left-color: #f56c6c;
}
.evt-warn {
  border-left-color: #e6a23c;
}
.evt-info {
  border-left-color: var(--el-border-color);
}
.evt-ts {
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.evt-text {
  color: var(--el-text-color-primary);
  word-break: break-all;
}
@media (max-width: 1100px) {
  .trend-grid {
    grid-template-columns: 1fr;
  }
}
</style>
