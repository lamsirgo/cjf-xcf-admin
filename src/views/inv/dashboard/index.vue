<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useEcharts, type ECOption } from '@/hooks/common/echarts';
import { fetchDashboard, type DashboardData } from '@/service/api/system';

defineOptions({ name: 'ManageDashboard' });

const loading = ref(false);
const data = ref<DashboardData | null>(null);

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

// 统一走 useEcharts：自动跟随明暗主题重建、容器尺寸变化 resize、组件卸载时 dispose
const { domRef: chartRef, updateOptions } = useEcharts(() => buildOptions(data.value));

async function load() {
  loading.value = true;
  const { data: d, error } = await fetchDashboard();
  if (!error && d) {
    data.value = d;
    await updateOptions(() => buildOptions(d));
  }
  loading.value = false;
}

onMounted(load);
</script>

<template>
  <div v-loading="loading" class="min-h-500px">
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
    <div class="chart-wrap">
      <div class="chart-title">近7天趋势</div>
      <div ref="chartRef" class="h-320px w-full" />
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
