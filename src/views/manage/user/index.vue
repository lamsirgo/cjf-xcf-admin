<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import {
  createAccount,
  deleteAccount,
  fetchAccounts,
  fetchAllRoles,
  resetAccountPwd,
  updateAccount,
  type AdminAccount
} from '@/service/api/system';
import { useAuthStore } from '@/store/modules/auth';

defineOptions({ name: 'ManageUser' });

const authStore = useAuthStore();
const currentId = computed(() => Number(authStore.userInfo.userId));

const loading = ref(false);
const rows = ref<AdminAccount[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20, keywords: '' });

// 角色下拉
const roles = ref<{ code: string; name: string }[]>([]);
async function loadRoles() {
  const { data } = await fetchAllRoles();
  if (data) roles.value = data.list;
}

async function load() {
  loading.value = true;
  const { data, error } = await fetchAccounts({
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

function fmtTime(t?: string | null) {
  return t ? t.replace('T', ' ').slice(0, 19) : '-';
}

// ---------- 新增 / 编辑 ----------
const modalVisible = ref(false);
const modalLoading = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();
const form = reactive({ id: 0, username: '', password: '', role_code: 'R_ADMIN', status: 1 });
const formRules = computed(() => ({
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: isEdit.value ? [] : [{ required: true, message: '请输入密码', trigger: 'blur' }],
  role_code: [{ required: true, message: '请选择角色', trigger: 'change' }]
}));

function openCreate() {
  isEdit.value = false;
  Object.assign(form, { id: 0, username: '', password: '', role_code: roles.value[0]?.code ?? 'R_ADMIN', status: 1 });
  modalVisible.value = true;
}

function openEdit(row: AdminAccount) {
  isEdit.value = true;
  Object.assign(form, { id: row.id, username: row.username, password: '', role_code: row.role_code, status: row.status });
  modalVisible.value = true;
}

async function submit() {
  await formRef.value?.validate();
  modalLoading.value = true;
  const payload = { role_code: form.role_code, status: form.status };
  const { error } = isEdit.value
    ? await updateAccount(form.id, payload)
    : await createAccount({ username: form.username, password: form.password, ...payload });
  modalLoading.value = false;
  if (!error) {
    ElMessage.success(isEdit.value ? '已更新' : '管理员已创建');
    modalVisible.value = false;
    load();
  }
}

async function toggleStatus(row: AdminAccount) {
  const next = row.status === 1 ? 0 : 1;
  const { error } = await updateAccount(row.id, { role_code: row.role_code, status: next });
  if (!error) {
    row.status = next;
    ElMessage.success(next === 1 ? '已启用' : '已停用');
  }
}

async function onResetPwd(row: AdminAccount) {
  const { value } = await ElMessageBox.prompt(`为「${row.username}」设置新密码（6-32 位）`, '重置密码', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPattern: /^.{6,32}$/,
    inputErrorMessage: '密码长度 6-32 位'
  });
  const { error } = await resetAccountPwd(row.id, value);
  if (!error) ElMessage.success('密码已重置');
}

async function onDelete(row: AdminAccount) {
  await ElMessageBox.confirm(`确认删除管理员「${row.username}」？`, '提示', { type: 'warning' });
  const { error } = await deleteAccount(row.id);
  if (!error) {
    ElMessage.success('已删除');
    load();
  }
}

onMounted(() => {
  loadRoles();
  load();
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch">
    <div class="mb-16px flex items-center justify-between">
      <el-input
        v-model="query.keywords"
        placeholder="搜索用户名"
        clearable
        class="w-260px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <div class="flex gap-12px">
        <el-button @click="query.keywords = ''; onSearch()">重置</el-button>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button type="success" @click="openCreate">新增管理员</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column prop="role_name" label="角色" min-width="130" />
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === 1"
            :disabled="row.id === currentId || row.role_code === 'R_SUPER'"
            @change="toggleStatus(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right" align="center">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="warning" link @click="onResetPwd(row)">重置密码</el-button>
          <el-button
            size="small"
            type="danger"
            link
            :disabled="row.id === currentId || row.role_code === 'R_SUPER'"
            @click="onDelete(row)"
          >
            删除
          </el-button>
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

    <el-dialog v-model="modalVisible" :title="isEdit ? '编辑管理员' : '新增管理员'" width="440px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="isEdit" placeholder="登录用户名" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="6-32 位密码" />
        </el-form-item>
        <el-form-item label="角色" prop="role_code">
          <el-select v-model="form.role_code" class="w-full">
            <el-option v-for="r in roles" :key="r.code" :label="r.name" :value="r.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" class="w-full">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="modalVisible = false">取消</el-button>
        <el-button type="primary" :loading="modalLoading" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
