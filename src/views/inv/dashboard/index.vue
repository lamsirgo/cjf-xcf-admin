<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useEcharts, type ECOption } from '@/hooks/common/echarts';
import { fetchDashboard, fetchOcrStats, type DashboardData, type OcrStatsData } from '@/service/api/system';

defineOptions({ name: 'ManageDashboard' });

const loading = ref(false);
const data = ref<DashboardData | null>(null);
const ocrData = ref<OcrStatsData | null>(null);

function buildOptions(d: DashboardData | null): ECOption {
  const series = d?.series ?? [];
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['解析任务', '识别发票', '成功', '失败'], top: 0, left: 'center' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
    xAxis: { type: 'category', data: series.map(s => s.date.slice(5)) },
    yAxis: [{ type: 'value' }],
    series: [
      { name: '解析任务', type: 'bar', data: series.map(s => s.packages), itemStyle: { color: '#409eff' } },
      { name: '识别发票', type: 'bar', data: series.map(s => s.invoices), itemStyle: { color: '#67c23a' } },
      { name: '成功', type: 'line', smooth: true, data: series.map(s => s.success), itemStyle: { color: '#85ce61' } },
      { name: '失败', type: 'line', smooth: true, data: series.map(s => s.failed), itemStyle: { color: '#f56c6c' } }
    ]
  };
}

function buildOcrOptions(d: OcrStatsData | null): ECOption {
  const series = d?.series ?? [];
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['识别量', '成功率'], top: 0, left: 'center' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 60, containLabel: true },
    xAxis: { type: 'category', data: series.map(s => s.date.slice(5)) },
    yAxis: [
      { type: 'value', name: '数量' },
      { type: 'value', name: '成功率%', min: 0, max: 100 }
    ],
    series: [
      { name: '识别量', type: 'bar', data: series.map(s => s.total), itemStyle: { color: '#409eff' } },
      { name: '成功率', type: 'line', smooth: true, yAxisIndex: 1, data: series.map(s => s.success_rate), itemStyle: { color: '#67c23a' } }
    ]
  };
}

// 统一走 useEcharts：自动跟随明暗主题重建、容器尺寸变化 resize、组件卸载时 dispose
const { domRef: chartRef, updateOptions } = useEcharts(() => buildOptions(data.value));
const { domRef: ocrChartRef, updateOptions: updateOcrOptions } = useEcharts(() => buildOcrOptions(ocrData.value));

async function load() {
  loading.value = true;
  const [d, ocr] = await Promise.all([fetchDashboard(), fetchOcrStats()]);
  if (!d.error && d.data) {
    data.value = d.data;
    await updateOptions(() => buildOptions(d.data));
  }
  if (!ocr.error && ocr.data) {
    ocrData.value = ocr.data;
    await updateOcrOptions(() => buildOcrOptions(ocr.data));
  }
  loading.value = false;
}

onMounted(load);
</script>

<template>
  <div v-loading="loading" class="min-h-500px">
    <!-- 基础统计 -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value">{{ data?.user_total ?? '-' }}</div>
        <div class="stat-label">累计用户</div>
        <div class="stat-sub">今日新增 {{ data?.user_today ?? 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ data?.package_total ?? '-' }}</div>
        <div class="stat-label">累计解析任务</div>
        <div class="stat-sub">今日 {{ data?.package_today ?? 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ data?.invoice_total ?? '-' }}</div>
        <div class="stat-label">累计识别发票</div>
        <div class="stat-sub">今日 {{ data?.invoice_today ?? 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" :class="{ 'text-red': (data?.fail_rate ?? 0) > 10 }">
          {{ data?.fail_rate ?? 0 }}%
        </div>
        <div class="stat-label">今日失败率</div>
        <div class="stat-sub">成功 {{ data?.success_today ?? 0 }} / 失败 {{ data?.failed_today ?? 0 }}</div>
      </div>
    </div>

    <!-- OCR 运营指标 -->
    <div class="mt-24px">
      <div class="section-title">OCR 运营监控</div>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value" :class="{ 'text-green': (ocrData?.today.success_rate ?? 0) >= 90, 'text-red': (ocrData?.today.success_rate ?? 0) < 80 }">
            {{ ocrData?.today.success_rate ?? 0 }}%
          </div>
          <div class="stat-label">今日识别成功率</div>
          <div class="stat-sub">共 {{ ocrData?.today.total ?? 0 }} 张（成功 {{ ocrData?.today.success ?? 0 }} / 失败 {{ ocrData?.today.failed ?? 0 }}）</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ ocrData?.performance.p95_queue_seconds ?? '-' }}s</div>
          <div class="stat-label">排队 P95</div>
          <div class="stat-sub">平均耗时 {{ ocrData?.performance.avg_cost_seconds ?? '-' }}s / 单包 P95 {{ ocrData?.performance.p95_cost_seconds ?? '-' }}s</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ ocrData?.current.queued ?? 0 }}</div>
          <div class="stat-label">当前排队</div>
          <div class="stat-sub">解析中 {{ ocrData?.current.parsing ?? 0 }} 个任务</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" :class="ocrData?.current.token_cached ? 'text-green' : 'text-red'">
            {{ ocrData?.current.token_cached ? '正常' : '异常' }}
          </div>
          <div class="stat-label">OCR 凭证</div>
          <div class="stat-sub">{{ ocrData?.current.token_cached ? 'access_token 已缓存' : '凭证未就绪，请检查配置' }}</div>
        </div>
      </div>

      <!-- 错误码分布 -->
      <div v-if="ocrData?.error_codes.length" class="mt-16px">
        <div class="section-title">近7天常见错误</div>
        <el-table :data="ocrData.error_codes" size="small" border stripe>
          <el-table-column prop="name" label="错误类型" min-width="180" />
          <el-table-column prop="count" label="出现次数" width="120" align="right" />
        </el-table>
      </div>
    </div>

    <!-- 图表 -->
    <div class="chart-wrap">
      <div class="chart-title">近7天趋势</div>
      <div ref="chartRef" class="h-320px w-full" />
    </div>
    <div class="chart-wrap">
      <div class="chart-title">近7天 OCR 识别量与成功率</div>
      <div ref="ocrChartRef" class="h-320px w-full" />
    </div>
  </div>
</template>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.stat-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 20px;
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
.text-red {
  color: #f56c6c;
}
.text-green {
  color: #67c23a;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
}

.chart-wrap {
  margin-top: 24px;
}
.chart-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
}
</style>
