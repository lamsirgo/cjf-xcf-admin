<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchLogs, type OperationLogItem } from '@/service/api/system';

defineOptions({ name: 'ManageLog' });

const loading = ref(false);
const rows = ref<OperationLogItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const module = ref('');
const action = ref('');
const keywords = ref('');

const moduleOptions = [
  { label: '账号', value: 'account' },
  { label: '角色', value: 'role' },
  { label: '菜单', value: 'menu' },
  { label: '应用', value: 'app' },
  { label: 'Banner', value: 'banner' },
  { label: '用户', value: 'user' },
  { label: '额度', value: 'quota' }
];
const actionOptions = [
  { label: '新增', value: 'create' },
  { label: '修改', value: 'update' },
  { label: '删除', value: 'delete' },
  { label: '重置密码', value: 'reset-password' },
  { label: '启用/禁用', value: 'toggle' },
  { label: '额度调整', value: 'adjust' }
];

async function load() {
  loading.value = true;
  const { data, error } = await fetchLogs({
    page: page.value,
    page_size: pageSize.value,
    module: module.value,
    action: action.value,
    keywords: keywords.value
  });
  if (!error && data) {
    rows.value = data.list;
    total.value = data.total;
  }
  loading.value = false;
}

function onSearch() {
  page.value = 1;
  load();
}

function onReset() {
  module.value = '';
  action.value = '';
  keywords.value = '';
  page.value = 1;
  load();
}

function onPageChange(p: number) {
  page.value = p;
  load();
}

function formatDetail(detail: Record<string, unknown> | null): string {
  if (!detail) return '-';
  return Object.entries(detail)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(',') : v}`)
    .join('  ');
}

onMounted(load);
</script>

<template>
  <div class="min-h-500px">
    <div class="mb-16px flex flex-wrap items-center gap-12px">
      <el-select v-model="module" placeholder="模块" clearable class="w-120px" @change="onSearch">
        <el-option v-for="o in moduleOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-select v-model="action" placeholder="动作" clearable class="w-130px" @change="onSearch">
        <el-option v-for="o in actionOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-input v-model="keywords" placeholder="管理员 / IP" clearable class="maxw-200px" @keyup.enter="onSearch">
        <template #append>
          <el-button @click="onSearch">搜索</el-button>
        </template>
      </el-input>
      <el-button @click="onReset">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="id" label="ID" width="70" align="center" />
      <el-table-column prop="admin_name" label="管理员" width="110" />
      <el-table-column label="模块" width="90" align="center">
        <template #default="{ row }">
          {{ moduleOptions.find(m => m.value === row.module)?.label || row.module }}
        </template>
      </el-table-column>
      <el-table-column label="动作" width="110" align="center">
        <template #default="{ row }">
          {{ actionOptions.find(a => a.value === row.action)?.label || row.action }}
        </template>
      </el-table-column>
      <el-table-column prop="target_id" label="对象ID" width="80" align="center">
        <template #default="{ row }">{{ row.target_id ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="变更详情" min-width="220">
        <template #default="{ row }">
          <span class="text-12px text-gray-500">{{ formatDetail(row.detail) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="ip" label="IP" width="120" />
      <el-table-column prop="created_at" label="时间" width="170" />
    </el-table>

    <div class="mt-16px flex justify-end">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        background
        @current-change="onPageChange"
      />
    </div>
  </div>
</template>

<style scoped>
.maxw-200px {
  max-width: 200px;
}
</style>
