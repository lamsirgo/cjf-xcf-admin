<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import {
  authorizeRoleMenus,
  createRole,
  deleteRole,
  fetchMenuList,
  fetchRoleMenuIds,
  fetchRoles,
  updateRole,
  type AdminRoleItem,
  type SysMenuItem
} from '@/service/api/system';

defineOptions({ name: 'ManageRole' });

const loading = ref(false);
const rows = ref<AdminRoleItem[]>([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 20, keywords: '' });

async function load() {
  loading.value = true;
  const { data, error } = await fetchRoles({
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
const form = reactive({ id: 0, code: '', name: '', status: 1, remark: '' });
const formRules = {
  code: [
    { required: true, message: '请输入角色编码', trigger: 'blur' },
    { pattern: /^[A-Z0-9_]{2,50}$/, message: '2-50 位大写字母/数字/下划线', trigger: 'blur' }
  ],
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }]
};

function openCreate() {
  isEdit.value = false;
  Object.assign(form, { id: 0, code: '', name: '', status: 1, remark: '' });
  modalVisible.value = true;
}

function openEdit(row: AdminRoleItem) {
  isEdit.value = true;
  Object.assign(form, { id: row.id, code: row.code, name: row.name, status: row.status, remark: row.remark });
  modalVisible.value = true;
}

async function submit() {
  await formRef.value?.validate();
  modalLoading.value = true;
  const { error } = isEdit.value
    ? await updateRole(form.id, { name: form.name, status: form.status, remark: form.remark })
    : await createRole({ code: form.code, name: form.name, status: form.status, remark: form.remark });
  modalLoading.value = false;
  if (!error) {
    ElMessage.success(isEdit.value ? '已更新' : '角色已创建');
    modalVisible.value = false;
    load();
  }
}

async function onDelete(row: AdminRoleItem) {
  await ElMessageBox.confirm(`确认删除角色「${row.name}」？`, '提示', { type: 'warning' });
  const { error } = await deleteRole(row.id);
  if (!error) {
    ElMessage.success('已删除');
    load();
  }
}

// ---------- 菜单授权 ----------
const authVisible = ref(false);
const authLoading = ref(false);
const authRole = ref<AdminRoleItem | null>(null);
const treeRef = ref();
const treeData = ref<SysMenuItem[]>([]);
const treeProps = { children: 'children', label: 'title' };

function buildTree(list: SysMenuItem[]): SysMenuItem[] {
  const map = new Map<number, SysMenuItem>();
  list.forEach(m => map.set(m.id, { ...m, children: [] }));
  const roots: SysMenuItem[] = [];
  map.forEach(node => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

async function openAuth(row: AdminRoleItem) {
  authRole.value = row;
  authVisible.value = true;
  authLoading.value = true;
  const [menuRes, idsRes] = await Promise.all([fetchMenuList(), fetchRoleMenuIds(row.id)]);
  authLoading.value = false;
  if (menuRes.data) treeData.value = buildTree(menuRes.data.list.filter(m => m.status === 1));
  await nextTick();
  if (idsRes.data && treeRef.value) {
    treeRef.value.setCheckedKeys(idsRes.data.menu_ids);
  }
}

async function submitAuth() {
  if (!authRole.value || !treeRef.value) return;
  // 半选的父节点也要提交，保证回显完整
  const checked = treeRef.value.getCheckedKeys() as number[];
  const halfChecked = treeRef.value.getHalfCheckedKeys() as number[];
  const { error } = await authorizeRoleMenus(authRole.value.id, [...checked, ...halfChecked]);
  if (!error) {
    ElMessage.success('授权已保存');
    authVisible.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="min-h-500px flex-col-stretch">
    <div class="mb-16px flex items-center justify-between">
      <el-input
        v-model="query.keywords"
        placeholder="搜索角色编码 / 名称"
        clearable
        class="w-260px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <div class="flex gap-12px">
        <el-button @click="query.keywords = ''; onSearch()">重置</el-button>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button type="success" @click="openCreate">新增角色</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="code" label="角色编码" min-width="140" />
      <el-table-column prop="name" label="角色名称" min-width="140" />
      <el-table-column prop="admin_count" label="管理员数" width="100" align="center" />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right" align="center">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="openAuth(row)">菜单授权</el-button>
          <el-button size="small" link @click="openEdit(row)">编辑</el-button>
          <el-button
            size="small"
            type="danger"
            link
            :disabled="row.code === 'R_SUPER'"
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

    <!-- 新增 / 编辑 -->
    <el-dialog v-model="modalVisible" :title="isEdit ? '编辑角色' : '新增角色'" width="440px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="编码" prop="code">
          <el-input v-model="form.code" :disabled="isEdit" placeholder="如：R_OPS，大写字母/数字/下划线" />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="角色显示名称" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" class="w-full">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="角色职责说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="modalVisible = false">取消</el-button>
        <el-button type="primary" :loading="modalLoading" @click="submit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 菜单授权 -->
    <el-dialog v-model="authVisible" :title="`菜单授权 - ${authRole?.name ?? ''}`" width="480px">
      <div v-loading="authLoading" class="max-h-420px overflow-auto">
        <el-tree
          ref="treeRef"
          :data="treeData"
          :props="treeProps"
          node-key="id"
          show-checkbox
          default-expand-all
        />
      </div>
      <template #footer>
        <el-button @click="authVisible = false">取消</el-button>
        <el-button type="primary" :loading="authLoading" @click="submitAuth">保存授权</el-button>
      </template>
    </el-dialog>
  </div>
</template>
