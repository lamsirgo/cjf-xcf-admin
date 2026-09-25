<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import {
  createMenu,
  deleteMenu,
  fetchMenuList,
  updateMenu,
  type SysMenuItem
} from '@/service/api/system';

defineOptions({ name: 'ManageMenu' });

const loading = ref(false);
const treeRows = ref<SysMenuItem[]>([]);
const flatRows = ref<SysMenuItem[]>([]);

function buildTree(list: SysMenuItem[]): SysMenuItem[] {
  const map = new Map<number, SysMenuItem>();
  list.forEach(m => map.set(m.id, { ...m, children: undefined }));
  const roots: SysMenuItem[] = [];
  map.forEach(node => {
    if (node.parent_id && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!;
      parent.children = parent.children ?? [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

async function load() {
  loading.value = true;
  const { data, error } = await fetchMenuList();
  if (!error && data) {
    flatRows.value = data.list;
    treeRows.value = buildTree(data.list);
  }
  loading.value = false;
}

const TYPE_MAP: Record<number, { label: string; type: 'primary' | 'success' | 'warning' }> = {
  1: { label: '目录', type: 'primary' },
  2: { label: '菜单', type: 'success' },
  3: { label: '按钮', type: 'warning' }
};

// 上级菜单下拉（仅目录/菜单可选），带层级缩进
const parentOptions = computed(() => {
  const depth = new Map<number, number>();
  const result: { id: number; title: string }[] = [{ id: 0, title: '根节点' }];
  const walk = (nodes: SysMenuItem[], d: number) => {
    nodes.forEach(n => {
      depth.set(n.id, d);
      if (n.type !== 3) result.push({ id: n.id, title: `${'　'.repeat(d)}${n.title}` });
      if (n.children?.length) walk(n.children, d + 1);
    });
  };
  walk(treeRows.value, 0);
  return result;
});

// ---------- 新增 / 编辑 ----------
const modalVisible = ref(false);
const modalLoading = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();
const emptyForm = () => ({
  id: 0,
  parent_id: 0,
  type: 2,
  title: '',
  name: '',
  path: '',
  icon: '',
  sort: 0,
  visible: 1,
  status: 1
});
const form = reactive(emptyForm());
const formRules = {
  parent_id: [{ required: true, message: '请选择上级', trigger: 'change' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  title: [{ required: true, message: '请输入名称', trigger: 'blur' }]
};

function openCreate(parentId = 0) {
  isEdit.value = false;
  Object.assign(form, emptyForm(), { parent_id: parentId });
  modalVisible.value = true;
}

function openEdit(row: SysMenuItem) {
  isEdit.value = true;
  Object.assign(form, {
    id: row.id,
    parent_id: row.parent_id,
    type: row.type,
    title: row.title,
    name: row.name,
    path: row.path,
    icon: row.icon,
    sort: row.sort,
    visible: row.visible,
    status: row.status
  });
  modalVisible.value = true;
}

async function submit() {
  await formRef.value?.validate();
  modalLoading.value = true;
  const payload = { ...form };
  delete (payload as any).id;
  const { error } = isEdit.value ? await updateMenu(form.id, payload) : await createMenu(payload);
  modalLoading.value = false;
  if (!error) {
    ElMessage.success(isEdit.value ? '已更新' : '菜单已创建');
    modalVisible.value = false;
    load();
  }
}

async function onDelete(row: SysMenuItem) {
  await ElMessageBox.confirm(`确认删除「${row.title}」？有子项时需先删除子项。`, '提示', { type: 'warning' });
  const { error } = await deleteMenu(row.id);
  if (!error) {
    ElMessage.success('已删除');
    load();
  }
}

onMounted(load);
</script>

<template>
  <div class="min-h-500px flex-col-stretch">
    <div class="mb-16px flex items-center justify-between">
      <span class="text-13px text-gray-500">
        维护后台菜单与按钮权限点；角色页通过菜单授权使用此处配置（当前版本为权限资源登记，后续切换动态路由后即时生效）
      </span>
      <el-button type="success" @click="openCreate(0)">新增根菜单</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="treeRows"
      row-key="id"
      border
      default-expand-all
      :tree-props="{ children: 'children' }"
    >
      <el-table-column prop="title" label="名称" min-width="200" />
      <el-table-column label="类型" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="TYPE_MAP[row.type as number]?.type">{{ TYPE_MAP[row.type as number]?.label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="icon" label="图标" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.icon" class="flex items-center gap-6px">
            <SvgIcon :icon="row.icon" class="text-16px" />
            <span>{{ row.icon }}</span>
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="路由名 / 权限标识" min-width="170" />
      <el-table-column prop="path" label="路径" min-width="150" />
      <el-table-column prop="sort" label="排序" width="80" align="center" />
      <el-table-column label="显示" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.visible === 1 ? 'success' : 'info'" size="small">
            {{ row.visible === 1 ? '显示' : '隐藏' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right" align="center">
        <template #default="{ row }">
          <el-button v-if="row.type !== 3" size="small" type="primary" link @click="openCreate(row.id)">
            新增子项
          </el-button>
          <el-button size="small" link @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" link @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="modalVisible" :title="isEdit ? '编辑菜单' : '新增菜单'" width="520px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item label="上级菜单" prop="parent_id">
          <el-select v-model="form.parent_id" class="w-full">
            <el-option
              v-for="opt in parentOptions"
              :key="opt.id"
              :label="opt.title"
              :value="opt.id"
              :disabled="isEdit && (opt.id === form.id)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio :value="1">目录</el-radio>
            <el-radio :value="2">菜单</el-radio>
            <el-radio :value="3">按钮（权限点）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="名称" prop="title">
          <el-input v-model="form.title" placeholder="菜单显示名称" />
        </el-form-item>
        <el-form-item v-if="form.type !== 3" label="路由名">
          <el-input v-model="form.name" placeholder="如 inv-task（需与前端路由 name 一致）" />
        </el-form-item>
        <el-form-item v-else label="权限标识">
          <el-input v-model="form.name" placeholder="如 user:create（按钮权限点）" />
        </el-form-item>
        <el-form-item v-if="form.type !== 3" label="路径">
          <el-input v-model="form.path" placeholder="如 /inv-task" />
        </el-form-item>
        <el-form-item v-if="form.type !== 3" label="图标">
          <el-input v-model="form.icon" placeholder="图标集标识，如 mdi:account-outline" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
          <span class="ml-8px text-12px text-gray-400">数值小的在前</span>
        </el-form-item>
        <el-form-item v-if="form.type !== 3" label="是否显示">
          <el-switch
            :model-value="form.visible === 1"
            active-text="显示"
            inactive-text="隐藏"
            @change="(v: string | number | boolean) => (form.visible = v ? 1 : 0)"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            :model-value="form.status === 1"
            active-text="启用"
            inactive-text="禁用"
            @change="(v: string | number | boolean) => (form.status = v ? 1 : 0)"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="modalVisible = false">取消</el-button>
        <el-button type="primary" :loading="modalLoading" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
