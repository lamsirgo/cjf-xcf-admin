<script setup lang="ts">
import { onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  fetchAdminPackages,
  fetchRequeuePackage,
  fetchTerminatePackage,
  type AdminPackage
} from '@/service/api/inv';
import { useAuth } from '@/hooks/business/auth';

defineOptions({ name: 'InvTask' });

const { hasAuth } = useAuth();

const loading = ref(false);
const rows = ref<AdminPackage[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20, status: '' as number | '' });
let timer: number | undefined;
let firstActivate = true;

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

// silent=true 为后台轮询：不翻转表格 loading，避免每 10 秒闪一次
async function load(silent = false) {
  if (!silent) loading.value = true;
  const { data, error } = await fetchAdminPackages({
    page: query.page,
    page_size: query.pageSize,
    status: query.status === '' ? undefined : query.status
  });
  if (!error && data) {
    rows.value = data.list;
    total.value = data.total;
  }
  if (!silent) loading.value = false;
}

function stopTimer() {
  if (timer !== undefined) {
    window.clearInterval(timer);
    timer = undefined;
  }
}

function startTimer() {
  stopTimer();
  timer = window.setInterval(() => load(true), 10000);
}

// 浏览器标签隐藏时暂停轮询，可见时恢复
function onVisibility() {
  if (document.hidden) stopTimer();
  else startTimer();
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
  startTimer();
  document.addEventListener('visibilitychange', onVisibility);
});
// keep-alive 切走即停轮询，切回静默刷新一次并恢复，后台标签不再持续打接口
onActivated(() => {
  startTimer();
  if (!firstActivate) load(true);
  firstActivate = false;
});
onDeactivated(stopTimer);
onUnmounted(() => {
  stopTimer();
  document.removeEventListener('visibilitychange', onVisibility);
});

// ---------- 手动干预 ----------
async function onRequeue(row: AdminPackage) {
  try {
    await ElMessageBox.confirm(`确定将任务 #${row.id} 重新投递吗？`, '重投确认', {
      type: 'warning'
    });
  } catch {
    return;
  }
  const { error } = await fetchRequeuePackage(row.id);
  if (!error) {
    ElMessage.success('已重新投递');
    load();
  }
}

async function onTerminate(row: AdminPackage) {
  try {
    await ElMessageBox.confirm(
      `确定强制终止任务 #${row.id} 吗？\n剩余待解析文件将置失败，未消耗的冻结额度退回用户。`,
      '终止确认',
      { type: 'error', confirmButtonText: '强制终止' }
    );
  } catch {
    return;
  }
  const { error } = await fetchTerminatePackage(row.id);
  if (!error) {
    ElMessage.success('已终止');
    load();
  }
}
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
      <el-table-column label="识别结果" width="240">
        <template #default="{ row }">
          <span class="text-success">{{ row.success_files }} 成功</span>
          <span class="mx-4px">/</span>
          <span :class="row.failed_files > 0 ? 'text-error' : ''">{{ row.failed_files }} 失败</span>
          <template v-if="row.duplicate_files > 0">
            <span class="mx-4px">/</span>
            <span class="text-warning">{{ row.duplicate_files }} 重复</span>
          </template>
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
      <el-table-column label="操作" width="150" fixed="right" align="center">
        <template #default="{ row }">
          <template v-if="row.status === 0 || row.status === 1">
            <el-button v-if="hasAuth('task_requeue')" size="small" type="primary" link @click="onRequeue(row)">
              重投
            </el-button>
            <el-button v-if="hasAuth('task_terminate')" size="small" type="danger" link @click="onTerminate(row)">
              终止
            </el-button>
            <span v-if="!hasAuth(['task_requeue', 'task_terminate'])">—</span>
          </template>
          <span v-else>—</span>
        </template>
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
