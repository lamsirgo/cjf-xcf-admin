<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import SvgIcon from '@/components/custom/svg-icon.vue';
import {
  createApp,
  deleteApp,
  fetchApps,
  sortApps,
  updateApp,
  type AppFormData,
  type AppItem
} from '@/service/api/system';
import { fetchAdminUsers } from '@/service/api/inv';

defineOptions({ name: 'ManageApp' });

// 可选图标（H5 使用 Vant 图标，存储不带前缀；图标选择器内用 iconify 的 van 集预览）
const ICON_OPTIONS = [
  'apps-o',
  'description',
  'records',
  'contact',
  'manager-o',
  'photo-o',
  'cart-o',
  'balance-o',
  'balance-list-o',
  'coupon-o',
  'gem-o',
  'gift-o',
  'fire-o',
  'flag-o',
  'bookmark-o',
  'star-o',
  'like-o',
  'location-o',
  'phone-o',
  'envelope-o',
  'user-o',
  'friends-o',
  'todo-list-o',
  'notes-o',
  'cluster-o',
  'chart-trending-o',
  'service-o',
  'shield-o'
];

const loading = ref(false);
const rows = ref<AppItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keywords = ref('');

async function load() {
  loading.value = true;
  const { data, error } = await fetchApps({ page: page.value, page_size: pageSize.value, keywords: keywords.value });
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

// ---------- 用户选项（可见/内测白名单） ----------
const userOptions = ref<{ id: number; mobile: string }[]>([]);
async function loadUsers() {
  if (userOptions.value.length) return;
  const { data, error } = await fetchAdminUsers({ page: 1, page_size: 500 });
  if (!error && data) {
    userOptions.value = data.list.map(u => ({ id: u.id, mobile: u.mobile }));
  }
}

// ---------- 行拖拽排序（原生 HTML5 DnD） ----------
// 只有「全部应用一页可见且无搜索过滤」时才允许拖拽：否则提交的只是局部序号，
// 会与其他页/被过滤掉的应用产生 sort 冲突，造成跨页错乱
const dragEnabled = computed(() => !keywords.value.trim() && total.value <= pageSize.value && page.value === 1);
const dragIndex = ref<number | null>(null);
const dragSaving = ref(false);
function onDragStart(index: number, e: DragEvent) {
  if (!dragEnabled.value) return;
  dragIndex.value = index;
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(index: number) {
  if (dragIndex.value === null || dragIndex.value === index) return;
  const list = rows.value;
  const [moved] = list.splice(dragIndex.value, 1);
  list.splice(index, 0, moved);
  dragIndex.value = index;
}
async function onDragEnd() {
  if (dragIndex.value === null) return;
  dragIndex.value = null;
  dragSaving.value = true;
  const items = rows.value.map((r, i) => ({ id: r.id, sort: i + 1 }));
  const { error } = await sortApps(items);
  dragSaving.value = false;
  if (!error) ElMessage.success('排序已保存');
  else {
    ElMessage.error('排序保存失败，已恢复原顺序');
    load();
  }
}

// ---------- 新增 / 编辑 ----------
const modalVisible = ref(false);
const modalLoading = ref(false);
const isEdit = ref(false);
const formRef = ref<FormInstance>();
const emptyForm = (): AppFormData => ({
  code: '',
  name: '',
  icon: '',
  path: '',
  description: '',
  sort: 0,
  is_default: 0,
  status: 1,
  visible_scope: 1,
  visible_user_ids: [],
  beta_user_ids: []
});
const form = reactive(emptyForm());
const formRules = {
  name: [{ required: true, message: '请输入应用名称', trigger: 'blur' }],
  code: [
    { required: true, message: '请输入应用编码', trigger: 'blur' },
    { pattern: /^[a-z0-9][a-z0-9-]*$/, message: '仅支持小写字母、数字、短横线', trigger: 'blur' }
  ]
};

async function openCreate() {
  isEdit.value = false;
  Object.assign(form, emptyForm());
  await loadUsers();
  modalVisible.value = true;
}

async function openEdit(row: AppItem) {
  isEdit.value = true;
  Object.assign(form, {
    code: row.code,
    name: row.name,
    icon: row.icon,
    path: row.path,
    description: row.description,
    sort: row.sort,
    is_default: row.is_default,
    status: row.status,
    visible_scope: row.visible_scope,
    visible_user_ids: [...row.visible_user_ids],
    beta_user_ids: [...row.beta_user_ids]
  });
  await loadUsers();
  modalVisible.value = true;
}

async function submit() {
  await formRef.value?.validate();
  modalLoading.value = true;
  const targetId = rows.value.find(r => r.code === form.code)?.id;
  const { error } = isEdit.value && targetId
    ? await updateApp(targetId, { ...form })
    : await createApp({ ...form });
  modalLoading.value = false;
  if (!error) {
    ElMessage.success(isEdit.value ? '已更新' : '应用已创建');
    modalVisible.value = false;
    load();
  }
}

async function onDelete(row: AppItem) {
  await ElMessageBox.confirm(`确认删除应用「${row.name}」？`, '提示', { type: 'warning' });
  const { error } = await deleteApp(row.id);
  if (!error) {
    ElMessage.success('已删除');
    load();
  }
}

function onPageChange(p: number) {
  page.value = p;
  load();
}

onMounted(load);
</script>

<template>
  <div class="min-h-500px flex-col-stretch">
    <div class="mb-16px flex items-center justify-between">
      <el-input
        v-model="keywords"
        class="maxw-280px"
        placeholder="搜索应用名称 / 编码"
        clearable
        @keyup.enter="onSearch"
        @clear="onSearch"
      >
        <template #append>
          <el-button @click="onSearch">搜索</el-button>
        </template>
      </el-input>
      <el-button type="success" @click="openCreate">新增应用</el-button>
    </div>

    <div v-if="!dragEnabled" class="mb-8px text-12px text-gray-400">
      应用较多或处于搜索结果中，拖拽已禁用，请在编辑弹窗中调整排序数字。
    </div>
    <div v-loading="loading || dragSaving" class="app-card-grid">
      <div
        v-for="(row, index) in rows"
        :key="row.id"
        class="app-card"
        :class="{ dragging: dragIndex === index, 'no-drag': !dragEnabled }"
        :draggable="dragEnabled"
        @dragstart="onDragStart(index, $event)"
        @dragover.prevent="onDragOver(index)"
        @dragend="onDragEnd"
      >
        <div class="card-header">
          <div class="flex items-center gap-8px">
            <SvgIcon v-if="row.icon" :icon="`van:${row.icon}`" class="card-title-icon text-22px" />
            <span v-else class="app-icon">apps</span>
            <span class="font-medium text-14px truncate">{{ row.name }}</span>
          </div>
          <el-dropdown trigger="click">
            <el-button size="small" link><SvgIcon icon="mdi:dots-vertical" /></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="openEdit(row)">编辑</el-dropdown-item>
                <el-dropdown-item class="danger-item" @click="onDelete(row)">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div class="card-body">
          <div class="card-row"><span class="label">编码</span><span class="value">{{ row.code }}</span></div>
          <div class="card-row"><span class="label">路径</span><span class="value">{{ row.path || '-' }}</span></div>
          <div class="card-row"><span class="label">可见</span>
            <el-tag v-if="row.visible_scope === 1" type="success" size="small">全部</el-tag>
            <el-tag v-else type="warning" size="small">指定 {{ row.visible_user_ids.length }} 人</el-tag>
          </div>
          <div class="card-row"><span class="label">状态</span>
            <el-tag v-if="row.status === 1" type="success" size="small">启用</el-tag>
            <el-tag v-else-if="row.status === 2" type="warning" size="small">内测({{ row.beta_user_ids.length }})</el-tag>
            <el-tag v-else type="info" size="small">禁用</el-tag>
          </div>
          <div class="card-row"><span class="label">默认</span>
            <el-tag v-if="row.is_default === 1" type="primary" size="small">默认</el-tag>
            <span v-else class="text-muted">-</span>
          </div>
        </div>
        <div class="card-sort">排序 {{ row.sort }}</div>
      </div>
    </div>

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

    <el-dialog v-model="modalVisible" :title="isEdit ? '编辑应用' : '新增应用'" width="560px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="应用名称" prop="name">
          <el-input v-model="form.name" placeholder="如 发票识别" />
        </el-form-item>
        <el-form-item label="应用编码" prop="code">
          <el-input v-model="form.code" :disabled="isEdit" placeholder="如 invoice（创建后不可修改）" />
        </el-form-item>
        <el-form-item label="图标">
          <el-popover :width="320" trigger="click" placement="bottom-start">
            <template #reference>
              <el-button>
                <SvgIcon
                  :icon="form.icon ? `van:${form.icon}` : 'mdi:help-circle-outline'"
                  class="mr-6px"
                />
                {{ form.icon || '点击选择图标' }}
              </el-button>
            </template>
            <div class="icon-grid">
              <span
                v-for="n in ICON_OPTIONS"
                :key="n"
                class="icon-cell"
                :class="{ active: form.icon === n }"
                @click="form.icon = n"
              >
                <SvgIcon :icon="`van:${n}`" />
              </span>
            </div>
          </el-popover>
        </el-form-item>
        <el-form-item label="H5 路径">
          <el-input v-model="form.path" placeholder="如 /app/invoice" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.description" placeholder="应用的一句话说明" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
          <span class="ml-8px text-12px text-muted">数值小的在前，也可拖拽行调整</span>
        </el-form-item>
        <el-form-item label="可见范围">
          <el-radio-group v-model="form.visible_scope">
            <el-radio :value="1">全部用户</el-radio>
            <el-radio :value="2">仅指定用户</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.visible_scope === 2" label="可见用户">
          <el-select
            v-model="form.visible_user_ids"
            multiple
            filterable
            class="w-full"
            placeholder="选择可见用户（按手机号）"
          >
            <el-option v-for="u in userOptions" :key="u.id" :label="u.mobile" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="0">禁用</el-radio>
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="2">内测中</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.status === 2" label="内测白名单">
          <el-select
            v-model="form.beta_user_ids"
            multiple
            filterable
            class="w-full"
            placeholder="仅白名单用户可点击"
          >
            <el-option v-for="u in userOptions" :key="u.id" :label="u.mobile" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="工作台默认">
          <el-switch
            :model-value="form.is_default === 1"
            active-text="默认选中"
            @change="(v: string | number | boolean) => (form.is_default = v ? 1 : 0)"
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

<style scoped>
.maxw-280px {
  max-width: 280px;
}
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.card-title-icon {
  color: var(--el-text-color-secondary);
}
.text-muted {
  color: var(--el-text-color-placeholder);
}
.danger-item {
  color: var(--el-color-danger);
}
.app-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  min-height: 200px;
}
.app-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px 14px;
  cursor: move;
  transition: box-shadow 0.2s;
  user-select: none;
}
.app-card:hover {
  box-shadow: var(--el-box-shadow-light);
}
.app-card.dragging {
  opacity: 0.55;
  box-shadow: var(--el-box-shadow-dark);
}
.app-card.no-drag {
  cursor: default;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.card-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.card-row .label {
  color: var(--el-text-color-secondary);
  width: 48px;
  flex-shrink: 0;
}
.card-row .value {
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-sort {
  margin-top: 8px;
  text-align: right;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
.icon-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.icon-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  font-size: 18px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}
.icon-cell:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-5);
}
.icon-cell.active {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
</style>
