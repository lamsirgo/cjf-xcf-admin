import { request } from '../request';

export interface AdminUser {
  id: number;
  mobile: string;
  nickname: string;
  email: string | null;
  quota_balance: number;
  status: number;
  created_at: string;
}

export interface AdminPackage {
  id: number;
  user_id: number;
  filename: string;
  total_files: number;
  success_files: number;
  failed_files: number;
  duplicate_files: number;
  status: number;
  status_text: string;
  error_msg: string;
  retry_count: number;
  created_at: string;
}

interface PageData<T> {
  list: T[];
  total: number;
}

/** 用户列表 */
export function fetchAdminUsers(params: { page: number; page_size: number; keywords?: string }) {
  return request<PageData<AdminUser>>({ url: '/admin/users', method: 'get', params });
}

/** 调整额度 */
export function fetchAdjustQuota(userId: number, change: number, remark: string) {
  return request({
    url: `/admin/users/${userId}/quota`,
    method: 'post',
    data: { change, remark }
  });
}

/** 启用/禁用 */
export function fetchToggleUser(userId: number) {
  return request({ url: `/admin/users/${userId}/toggle`, method: 'post' });
}

/** 重置密码 */
export function fetchResetUserPwd(userId: number, new_password: string) {
  return request({
    url: `/admin/users/${userId}/reset-password`,
    method: 'post',
    data: { new_password }
  });
}

/** 全部解析任务 */
export function fetchAdminPackages(params: { page: number; page_size: number; status?: number | null }) {
  // 过滤空值，避免 null 被序列化为空字符串触发后端 422
  const query: Record<string, number> = { page: params.page, page_size: params.page_size };
  if (params.status !== null && params.status !== undefined) {
    query.status = params.status;
  }
  return request<PageData<AdminPackage>>({ url: '/admin/packages', method: 'get', params: query });
}

export interface AdminInvoice {
  id: number;
  user_id: number;
  mobile: string;
  nickname: string;
  package_id: number;
  package_filename: string;
  invoice_code: string;
  invoice_num: string;
  invoice_type: string;
  invoice_date: string;
  purchaser_name: string;
  seller_name: string;
  total_amount: number;
  file_status: number | null;
  status_text: string;
  dup_count: number;
  fail_reason: string;
  created_at: string;
}

export interface AdminInvoiceItem {
  commodity_name: string;
  commodity_type: string;
  commodity_unit: string;
  commodity_num: string;
  commodity_price: string;
  commodity_amount: string;
  commodity_tax_rate: string;
}

export interface AdminInvoiceDetail extends AdminInvoice {
  purchaser_register_num: string;
  seller_register_num: string;
  remark: string;
  orig_path: string;
  items: AdminInvoiceItem[];
}

export interface InvoiceQuery {
  page: number;
  page_size: number;
  keywords?: string;
  date_start?: string;
  date_end?: string;
  result?: string;
}

/** 全平台发票列表 */
export function fetchAdminInvoices(params: InvoiceQuery) {
  const query: Record<string, string | number> = { page: params.page, page_size: params.page_size };
  if (params.keywords) query.keywords = params.keywords;
  if (params.date_start) query.date_start = params.date_start;
  if (params.date_end) query.date_end = params.date_end;
  if (params.result) query.result = params.result;
  return request<PageData<AdminInvoice>>({ url: '/admin/invoices', method: 'get', params: query });
}

/** 发票详情 */
export function fetchAdminInvoiceDetail(id: number) {
  return request<AdminInvoiceDetail>({ url: `/admin/invoices/${id}`, method: 'get' });
}
