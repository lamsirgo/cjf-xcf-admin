<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchAdminPackages,
  fetchUser360,
  fetchUserQuotaLogs,
  type AdminPackage,
  type User360Detail,
  type UserQuotaLog
} from '@/service/api/inv';

defineOptions({ name: 'InvUserDetail' });

const route = useRoute();
const router = useRouter();
const userId = Number(route.params.id);

const loading = ref(false);
const detail = ref<User360Detail | null>(null);

// 额度流水分页
const logLoading = ref(false);
const logs = ref<UserQuotaLog[]>([]);
const logTotal = ref(0);
const logPage = ref(1);
const PAGE_SIZE = 10;

// 近期任务
const pkgLoading = ref(false);
const packages = ref<AdminPackage[]>([]);
const pkgTotal = ref(0);
const pkgPage = ref(1);

async function loadDetail() {
  loading.value = true;
  const { data, error } = await fetchUser360(userId);
  if (!error && data) detail.value = data;
  loading.value = false;
}

async function loadLogs() {
  logLoading.value = true;
  const { data, error } = await fetchUserQuotaLogs(userId, { page: logPage.value, page_size: PAGE_SIZE });
  if (!error && data) {
    logs.value = data.list;
    logTotal.value = data.total;
  }
  logLoading.value = false;
}

async function loadPackages() {
  pkgLoading.value = true;
  const { data, error } = await fetchAdminPackages({
    page: pkgPage.value,
    page_size: PAGE_SIZE,
    user_id: userId
  });
  if (!error && data) {
    packages.value = data.list;
    pkgTotal.value = data.total;
  }
  pkgLoading.value = false;
}

function onLogPage(p: number) {
  logPage.value = p;
  loadLogs();
}

function onPkgPage(p: number) {
  pkgPage.value = p;
  loadPackages();
}

onMounted(() => {
  if (!Number.isFinite(userId)) {
    router.replace('/inv-user');
    return;
  }
  loadDetail();
  loadLogs();
  loadPackages();
});
</script>

<template>
  <div v-loading="loading" class="min-h-500px">
    <el-page-header class="mb-16px" content="用户详情" @back="router.back()" />

    <template v-if="detail">
      <!-- 基础信息 -->
      <el-card shadow="never" class="mb-16px">
        <el-descriptions :column="3" border>
          <el-descriptions-item label="ID">{{ detail.user.id }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ detail.user.mobile }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ detail.user.nickname || '-' }}</el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ detail.user.email || '未绑定' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="detail.user.status === 1 ? 'success' : 'danger'">
              {{ detail.user.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="注册时间">
            {{ detail.user.created_at?.replace('T', ' ').slice(0, 19) }}
          </el-descriptions-item>
          <el-descriptions-item label="总额度">{{ detail.user.quota_balance }}</el-descriptions-item>
          <el-descriptions-item label="可用额度">{{ detail.user.quota_available }}</el-descriptions-item>
          <el-descriptions-item label="冻结额度">{{ detail.user.quota_frozen }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 统计卡片 -->
      <div class="stat-grid mb-16px">
        <div class="stat-card">
          <div class="stat-value">{{ detail.stats.package_total }}</div>
          <div class="stat-label">解析任务总数</div>
          <div class="stat-sub">
            排队 {{ detail.stats.package_queued }} · 解析中 {{ detail.stats.package_parsing }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-value text-success">{{ detail.stats.file_success }}</div>
          <div class="stat-label">识别成功(文件)</div>
          <div class="stat-sub">完成包 {{ detail.stats.package_done }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value text-warning">{{ detail.stats.file_duplicate }}</div>
          <div class="stat-label">重复上传(文件)</div>
          <div class="stat-sub">部分成功 {{ detail.stats.package_partial }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value text-error">{{ detail.stats.file_failed }}</div>
          <div class="stat-label">失败(文件)</div>
          <div class="stat-sub">失败包 {{ detail.stats.package_failed }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ detail.stats.invoice_total }}</div>
          <div class="stat-label">在库发票</div>
          <div class="stat-sub">价税合计 ¥{{ detail.stats.invoice_amount_sum.toFixed(2) }}</div>
        </div>
      </div>

      <!-- 额度流水 -->
      <el-card shadow="never" class="mb-16px">
        <template #header>额度流水</template>
        <el-table v-loading="logLoading" :data="logs" size="small" border stripe>
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ row.created_at?.replace('T', ' ').slice(0, 19) }}</template>
          </el-table-column>
          <el-table-column prop="change_type_text" label="类型" width="100" />
          <el-table-column label="变动" width="90" align="center">
            <template #default="{ row }">
              <span :class="row.change > 0 ? 'text-success' : row.change < 0 ? 'text-error' : ''">
                {{ row.change > 0 ? '+' : '' }}{{ row.change }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="余额" width="130" align="center">
            <template #default="{ row }">{{ row.before }} → {{ row.after }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
        </el-table>
        <el-pagination
          class="mt-12px justify-end"
          layout="total, prev, pager, next"
          :total="logTotal"
          :page-size="PAGE_SIZE"
          :current-page="logPage"
          @current-change="onLogPage"
        />
      </el-card>

      <!-- 近期任务 -->
      <el-card shadow="never">
        <template #header>近期解析任务</template>
        <el-table v-loading="pkgLoading" :data="packages" size="small" border stripe>
          <el-table-column prop="id" label="任务ID" width="90" />
          <el-table-column prop="filename" label="文件名" min-width="200" show-overflow-tooltip />
          <el-table-column label="结果" width="200">
            <template #default="{ row }">
              {{ row.success_files }} 成功 / {{ row.failed_files }} 失败 /
              {{ row.duplicate_files }} 重复
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag size="small">{{ row.status_text }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="170">
            <template #default="{ row }">{{ row.created_at?.replace('T', ' ').slice(0, 19) }}</template>
          </el-table-column>
        </el-table>
        <el-pagination
          class="mt-12px justify-end"
          layout="total, prev, pager, next"
          :total="pkgTotal"
          :page-size="PAGE_SIZE"
          :current-page="pkgPage"
          @current-change="onPkgPage"
        />
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.stat-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 16px;
}
.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.stat-label {
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.stat-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
