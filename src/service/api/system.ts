import { request } from '../request';

const BASE = '/admin/system';

// ================= 管理员账号 =================

export interface AdminAccount {
  id: number;
  username: string;
  role_code: string;
  role_name: string;
  status: number;
  created_at: string;
}

interface PageData<T> {
  list: T[];
  total: number;
}

export function fetchAccounts(params: { page: number; page_size: number; keywords?: string }) {
  return request<PageData<AdminAccount>>({ url: `${BASE}/accounts`, method: 'get', params });
}

export function createAccount(data: { username: string; password: string; role_code: string; status: number }) {
  return request({ url: `${BASE}/accounts`, method: 'post', data });
}

export function updateAccount(id: number, data: { role_code: string; status: number }) {
  return request({ url: `${BASE}/accounts/${id}`, method: 'put', data });
}

export function deleteAccount(id: number) {
  return request({ url: `${BASE}/accounts/${id}`, method: 'delete' });
}

export function resetAccountPwd(id: number, new_password: string) {
  return request({ url: `${BASE}/accounts/${id}/reset-password`, method: 'post', data: { new_password } });
}

// ================= 角色 =================

export interface AdminRoleItem {
  id: number;
  code: string;
  name: string;
  status: number;
  remark: string;
  admin_count: number;
  created_at: string;
}

export function fetchRoles(params: { page: number; page_size: number; keywords?: string }) {
  return request<PageData<AdminRoleItem>>({ url: `${BASE}/roles`, method: 'get', params });
}

export function fetchAllRoles() {
  return request<{ list: { code: string; name: string }[] }>({ url: `${BASE}/roles/all`, method: 'get' });
}

export function createRole(data: { code: string; name: string; status: number; remark: string }) {
  return request({ url: `${BASE}/roles`, method: 'post', data });
}

export function updateRole(id: number, data: { name: string; status: number; remark: string }) {
  return request({ url: `${BASE}/roles/${id}`, method: 'put', data });
}

export function deleteRole(id: number) {
  return request({ url: `${BASE}/roles/${id}`, method: 'delete' });
}

export function fetchRoleMenuIds(id: number) {
  return request<{ menu_ids: number[] }>({ url: `${BASE}/roles/${id}/menus`, method: 'get' });
}

export function authorizeRoleMenus(id: number, menu_ids: number[]) {
  return request({ url: `${BASE}/roles/${id}/menus`, method: 'post', data: { menu_ids } });
}

// ================= 菜单 =================

export interface SysMenuItem {
  id: number;
  parent_id: number;
  type: number; // 1目录 2菜单 3按钮
  title: string;
  name: string;
  path: string;
  icon: string;
  sort: number;
  visible: number;
  status: number;
  children?: SysMenuItem[];
}

export function fetchMenuList() {
  return request<{ list: SysMenuItem[] }>({ url: `${BASE}/menus`, method: 'get' });
}

export function createMenu(data: Omit<SysMenuItem, 'id' | 'children'>) {
  return request({ url: `${BASE}/menus`, method: 'post', data });
}

export function updateMenu(id: number, data: Omit<SysMenuItem, 'id' | 'children'>) {
  return request({ url: `${BASE}/menus/${id}`, method: 'put', data });
}

export function deleteMenu(id: number) {
  return request({ url: `${BASE}/menus/${id}`, method: 'delete' });
}

// ================= 应用 =================

export interface AppItem {
  id: number;
  code: string;
  name: string;
  icon: string;
  path: string;
  description: string;
  sort: number;
  is_default: number; // 1=工作台默认选中
  status: number; // 0禁用(H5置灰) 1启用 2内测中
  visible_scope: number; // 1全部用户可见 2仅指定用户可见
  visible_user_ids: number[]; // visible_scope=2 时生效
  beta_user_ids: number[]; // status=2 内测白名单
  created_at: string;
}

export type AppFormData = Omit<AppItem, 'id' | 'created_at'>;

export function fetchApps(params: { page: number; page_size: number; keywords?: string }) {
  return request<PageData<AppItem>>({ url: `${BASE}/apps`, method: 'get', params });
}

export function createApp(data: AppFormData) {
  return request({ url: `${BASE}/apps`, method: 'post', data });
}

export function updateApp(id: number, data: AppFormData) {
  return request({ url: `${BASE}/apps/${id}`, method: 'put', data });
}

export function deleteApp(id: number) {
  return request({ url: `${BASE}/apps/${id}`, method: 'delete' });
}

/** 全量保存排序（拖拽结束调用） */
export function sortApps(items: { id: number; sort: number }[]) {
  return request({ url: `${BASE}/apps/sort`, method: 'put', data: { items } });
}

// ================= 操作日志 =================

export interface OperationLogItem {
  id: number;
  admin_id: number;
  admin_name: string;
  module: string;
  action: string;
  target_id: number | null;
  detail: Record<string, unknown> | null;
  ip: string;
  created_at: string;
}

export function fetchLogs(params: {
  page: number;
  page_size: number;
  module?: string;
  action?: string;
  keywords?: string;
}) {
  const query: Record<string, string | number> = { page: params.page, page_size: params.page_size };
  if (params.module) query.module = params.module;
  if (params.action) query.action = params.action;
  if (params.keywords) query.keywords = params.keywords;
  return request<PageData<OperationLogItem>>({ url: `${BASE}/logs`, method: 'get', params: query });
}

// ================= 数据看板 =================

export interface DashboardData {
  user_total: number;
  user_today: number;
  package_total: number;
  package_today: number;
  invoice_total: number;
  invoice_today: number;
  success_today: number;
  failed_today: number;
  fail_rate: number;
  series: {
    date: string;
    packages: number;
    invoices: number;
    success: number;
    failed: number;
  }[];
}

export function fetchDashboard() {
  return request<DashboardData>({ url: '/admin/dashboard', method: 'get' });
}

// ================= OCR 运营监控 =================

export interface OcrStatsData {
  today: {
    total: number;
    success: number;
    failed: number;
    duplicate: number;
    success_rate: number;
  };
  series: {
    date: string;
    total: number;
    success: number;
    success_rate: number | null;
  }[];
  error_codes: { name: string; count: number }[];
  performance: {
    p95_cost_seconds: number;
    avg_cost_seconds: number;
    p95_queue_seconds: number;
  };
  current: {
    queued: number;
    parsing: number;
    token_cached: boolean;
  };
}

export function fetchOcrStats() {
  return request<OcrStatsData>({ url: '/admin/dashboard/ocr', method: 'get' });
}

// ================= 图片上传 =================

export function uploadImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<{ url: string }>({
    url: `${BASE}/upload-image`,
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}
