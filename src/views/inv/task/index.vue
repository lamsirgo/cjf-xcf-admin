<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { fetchAdminPackages, type AdminPackage } from '@/service/api/inv';

defineOptions({ name: 'InvTask' });

const loading = ref(false);
const rows = ref<AdminPackage[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20, status: '' as number | '' });
let timer: number | undefined;

const statusOptions: { label: string; value: number | '' }[] = [
  { label: '全部状态', value: '' },
  { label: '排队中', value: 0 },
  { label: '解析中', value: 1 },
  { label: '已完成', value: 2 },
  { label: '部分成功', value: 3 },
  { label: '失败', value: 4 }
];

const tagTypeMap: Record<number, 'primary' | 'warning' | 'success' | 'danger' | 'info'> = {
  0: 'info',
  1: 'warning',
  2: 'success',
  3: 'primary',
  4: 'danger'
};

async function load() {
  loading.value = true;
  const { data, error } = await fetchAdminPackages({
    page: query.page,
    page_size: query.pageSize,
    status: query.status === '' ? undefined : query.status
  });
  if (!error && data) {
    rows.value = data.list;
    total.value = data.total;
  }
  loading.value = false;
}

watch(
  () => query.status,
  () => {
    query.page = 1;
    load();
  }
);

onMounted(() => {
  load();
  timer = window.setInterval(load, 10000);
});
onUnmounted(() => timer && clearInterval(timer));
</script>

<template>
  <div class="min-h-500px flex-col-stretch">
    <div class="mb-16px flex items-center gap-12px">
      <el-radio-group v-model="query.status">
        <el-radio-button v-for="opt in statusOptions" :key="String(opt.value)" :value="opt.value">
          {{ opt.label }}
        </el-radio-button>
      </el-radio-group>
      <el-tag type="info" effect="plain">每 10 秒自动刷新</el-tag>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="id" label="任务ID" width="90" />
      <el-table-column prop="user_id" label="用户ID" width="90" />
      <el-table-column prop="filename" label="文件名" min-width="200" show-overflow-tooltip />
      <el-table-column label="识别结果" width="200">
        <template #default="{ row }">
          <span class="text-success">{{ row.success_files }} 成功</span>
          <span class="mx-4px">/</span>
          <span :class="row.failed_files > 0 ? 'text-danger' : ''">{{ row.failed_files }} 失败</span>
          <span class="mx-4px">/</span>
          <span>共 {{ row.total_files }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="tagTypeMap[row.status]">{{ row.status_text }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="retry_count" label="重试次数" width="90" align="center" />
      <el-table-column prop="error_msg" label="错误信息" min-width="200" show-overflow-tooltip />
      <el-table-column label="创建时间" width="190">
        <template #default="{ row }">{{ row.created_at?.replace('T', ' ').slice(0, 19) }}</template>
      </el-table-column>
    </el-table>

    <el-pagination
      class="mt-16px justify-end"
      layout="total, prev, pager, next"
      :total="total"
      :page-size="query.pageSize"
      :current-page="query.page"
      @current-change="(p: number) => { query.page = p; load(); }"
    />
  </div>
</template>
