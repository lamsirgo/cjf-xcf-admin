<script setup lang="ts">
import { onActivated, onDeactivated, onMounted, onUnmounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import {
  fetchAdjustQuota,
  fetchAdminUsers,
  fetchResetUserPwd,
  fetchToggleUser,
  type AdminUser
} from '@/service/api/inv';
import { useAuth } from '@/hooks/business/auth';

defineOptions({ name: 'InvUser' });

const { hasAuth } = useAuth();

const loading = ref(false);
const rows = ref<AdminUser[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20, keywords: '' });
let timer: number | undefined;
let firstActivate = true;

// silent=true 为后台轮询：不翻转表格 loading，避免每 15 秒闪一次
async function load(silent = false) {
  if (!silent) loading.value = true;
  const { data, error } = await fetchAdminUsers({
    page: query.page,
    page_size: query.pageSize,
    keywords: query.keywords
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
  timer = window.setInterval(() => load(true), 15000);
}

// 浏览器标签隐藏时暂停轮询，可见时恢复
function onVisibility() {
  if (document.hidden) stopTimer();
  else startTimer();
}

function onSearch() {
  query.page = 1;
  load();
}

async function onToggle(row: AdminUser) {
  const action = row.status === 1 ? '禁用' : '启用';
  try {
    await ElMessageBox.confirm(`确定${action}用户 ${row.mobile} 吗？`, '提示', { type: 'warning' });
  } catch {
    return; // 用户取消
  }
  const { error } = await fetchToggleUser(row.id);
  if (!error) {
    ElMessage.success('已更新');
    load();
  }
}

// ---------- 调整额度 ----------
const quotaVisible = ref(false);
const quotaSubmitting = ref(false);
const quotaFormRef = ref<FormInstance>();
const quotaForm = reactive({ id: 0, mobile: '', change: 10, remark: '' });
const quotaRules = {
  change: [{ required: true, message: '请输入变动量', trigger: 'blur' }],
  remark: [{ required: true, message: '请填写调整备注（记入流水）', trigger: 'blur' }]
};

function openQuota(row: AdminUser) {
  quotaForm.id = row.id;
  quotaForm.mobile = row.mobile;
  quotaForm.change = 10;
  quotaForm.remark = '';
  quotaVisible.value = true;
}

async function submitQuota() {
  await quotaFormRef.value?.validate();
  quotaSubmitting.value = true;
  const { error } = await fetchAdjustQuota(quotaForm.id, quotaForm.change, quotaForm.remark);
  quotaSubmitting.value = false;
  if (!error) {
    ElMessage.success('额度已调整');
    quotaVisible.value = false;
    load();
  }
}

// ---------- 重置密码 ----------
async function onResetPwd(row: AdminUser) {
  let value: string;
  try {
    ({ value } = await ElMessageBox.prompt(
      `为用户 ${row.mobile} 设置新密码（8-32 位，须同时含字母和数字）`,
      '重置密码',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /^(?=.*[A-Za-z])(?=.*\d)\S{8,32}$/,
        inputErrorMessage: '密码需 8-32 位，且须同时包含字母和数字'
      }
    ));
  } catch {
    return; // 用户取消
  }
  const { error } = await fetchResetUserPwd(row.id, value);
  if (!error) ElMessage.success('密码已重置');
}

onMounted(() => {
  load();
  startTimer();
  document.addEventListener('visibilitychange', onVisibility);
});
// keep-alive 切走即停轮询，切回静默刷新一次并恢复
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
</script>

<template>
  <div class="min-h-500px flex-col-stretch">
    <div class="mb-16px flex items-center justify-between">
      <el-input
        v-model="query.keywords"
        placeholder="搜索手机号 / 昵称"
        clearable
        class="w-260px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-button type="primary" @click="onSearch">查询</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="mobile" label="手机号" width="140" />
      <el-table-column prop="nickname" label="昵称" min-width="120" />
      <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
      <el-table-column prop="quota_balance" label="剩余额度" width="100" align="center" />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="注册时间" width="190">
        <template #default="{ row }">{{ row.created_at?.replace('T', ' ').slice(0, 19) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right" align="center">
        <template #default="{ row }">
          <el-button v-if="hasAuth('user_quota_adjust')" size="small" type="primary" link @click="openQuota(row)">
            调额度
          </el-button>
          <el-button v-if="hasAuth('user_toggle')" size="small" link @click="onToggle(row)">
            {{ row.status === 1 ? '禁用' : '启用' }}
          </el-button>
          <el-button v-if="hasAuth('user_reset_password')" size="small" type="warning" link @click="onResetPwd(row)">
            重置密码
          </el-button>
          <span v-if="!hasAuth(['user_quota_adjust', 'user_toggle', 'user_reset_password'])">—</span>
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

    <el-dialog v-model="quotaVisible" title="调整识别额度" width="420px">
      <el-form ref="quotaFormRef" :model="quotaForm" :rules="quotaRules" label-width="80px">
        <el-form-item label="用户">
          <span>{{ quotaForm.mobile }}</span>
        </el-form-item>
        <el-form-item label="变动量" prop="change">
          <el-input-number v-model="quotaForm.change" :step="10" :min="-99999" />
          <span class="ml-8px text-12px text-gray-400">正数增加，负数扣减</span>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="quotaForm.remark" placeholder="如：活动赠送 / 异常扣减修正" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="quotaVisible = false">取消</el-button>
        <el-button type="primary" :loading="quotaSubmitting" @click="submitQuota">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
