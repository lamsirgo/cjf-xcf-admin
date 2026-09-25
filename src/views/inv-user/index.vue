<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import {
  fetchAdjustQuota,
  fetchAdminUsers,
  fetchResetUserPwd,
  fetchToggleUser,
  type AdminUser
} from '@/service/api/inv';

defineOptions({ name: 'InvUser' });

const loading = ref(false);
const rows = ref<AdminUser[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20, keywords: '' });
let timer: number | undefined;

async function load() {
  loading.value = true;
  const { data, error } = await fetchAdminUsers({
    page: query.page,
    page_size: query.pageSize,
    keywords: query.keywords
  });
  if (!error && data) {
    rows.value = data.list;
    total.value = data.total;
  }
  loading.value = false;
}

function onSearch() {
  query.page = 1;
  load();
}

async function onToggle(row: AdminUser) {
  const action = row.status === 1 ? '禁用' : '启用';
  await ElMessageBox.confirm(`确定${action}用户 ${row.mobile} 吗？`, '提示', { type: 'warning' });
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
  const { value } = await ElMessageBox.prompt(`为用户 ${row.mobile} 设置新密码（至少 6 位）`, '重置密码', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPattern: /^.{6,32}$/,
    inputErrorMessage: '密码长度 6-32 位'
  });
  const { error } = await fetchResetUserPwd(row.id, value);
  if (!error) ElMessage.success('密码已重置');
}

onMounted(() => {
  load();
  timer = window.setInterval(load, 15000);
});
onUnmounted(() => timer && clearInterval(timer));
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
          <el-button size="small" type="primary" link @click="openQuota(row)">调额度</el-button>
          <el-button size="small" link @click="onToggle(row)">
            {{ row.status === 1 ? '禁用' : '启用' }}
          </el-button>
          <el-button size="small" type="warning" link @click="onResetPwd(row)">重置密码</el-button>
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
