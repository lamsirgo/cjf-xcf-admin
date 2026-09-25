<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import {
  fetchAdminInvoiceDetail,
  fetchAdminInvoices,
  type AdminInvoice,
  type AdminInvoiceDetail
} from '@/service/api/inv';

defineOptions({ name: 'InvInvoice' });

const loading = ref(false);
const rows = ref<AdminInvoice[]>([]);
const total = ref(0);
const query = reactive({
  page: 1,
  pageSize: 20,
  keywords: '',
  result: '',
  dateRange: [] as string[]
});

const resultOptions = [
  { label: '全部结果', value: '' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '被重复上传', value: 'duplicate' }
];

const tagTypeMap: Record<number, 'success' | 'danger' | 'warning' | 'info'> = {
  1: 'success',
  2: 'danger',
  3: 'warning',
  0: 'info'
};

function fmtTime(s?: string) {
  return s ? s.replace('T', ' ').slice(0, 19) : '';
}

function fmtDate(s?: string) {
  return s ? s.slice(0, 10) : '';
}

async function load() {
  loading.value = true;
  const { data, error } = await fetchAdminInvoices({
    page: query.page,
    page_size: query.pageSize,
    keywords: query.keywords?.trim(),
    result: query.result,
    date_start: query.dateRange?.[0] || '',
    date_end: query.dateRange?.[1] || ''
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

function onReset() {
  query.keywords = '';
  query.result = '';
  query.dateRange = [];
  query.page = 1;
  load();
}

// ---------- 详情抽屉 ----------
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<AdminInvoiceDetail | null>(null);

async function showDetail(row: AdminInvoice) {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  const { data, error } = await fetchAdminInvoiceDetail(row.id);
  if (!error && data) detail.value = data;
  detailLoading.value = false;
}

onMounted(load);
</script>

<template>
  <div class="min-h-500px flex-col-stretch">
    <!-- 筛选栏 -->
    <div class="mb-16px flex flex-wrap items-center gap-12px">
      <el-input
        v-model="query.keywords"
        placeholder="号码/代码/购销方/手机号"
        clearable
        class="w-240px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-radio-group v-model="query.result">
        <el-radio-button v-for="opt in resultOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </el-radio-button>
      </el-radio-group>
      <el-date-picker
        v-model="query.dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开票开始"
        end-placeholder="开票结束"
        value-format="YYYY-MM-DD"
        class="w-260px"
      />
      <el-button type="primary" @click="onSearch">查询</el-button>
      <el-button @click="onReset">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column label="所属用户" min-width="140">
        <template #default="{ row }">
          <div>{{ row.mobile }}</div>
          <div class="text-12px text-gray-400">ID: {{ row.user_id }}{{ row.nickname ? ` · ${row.nickname}` : '' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="发票号码/代码" min-width="170">
        <template #default="{ row }">
          <div>{{ row.invoice_num || '—' }}</div>
          <div class="text-12px text-gray-400">{{ row.invoice_code || '—' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="invoice_type" label="类型" width="120" show-overflow-tooltip />
      <el-table-column label="开票日期" width="110">
        <template #default="{ row }">{{ fmtDate(row.invoice_date) }}</template>
      </el-table-column>
      <el-table-column prop="purchaser_name" label="购买方" min-width="180" show-overflow-tooltip />
      <el-table-column prop="seller_name" label="销售方" min-width="180" show-overflow-tooltip />
      <el-table-column label="价税合计" width="110" align="right">
        <template #default="{ row }">
          <span class="text-error">¥{{ Number(row.total_amount ?? 0).toFixed(2) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="重复上传" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.dup_count > 0" type="warning">{{ row.dup_count }} 次</el-tag>
          <span v-else class="text-gray-300">0</span>
        </template>
      </el-table-column>
      <el-table-column prop="package_filename" label="来源包" min-width="160" show-overflow-tooltip />
      <el-table-column label="操作" width="90" fixed="right" align="center">
        <template #default="{ row }">
          <el-button type="primary" link @click="showDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      class="mt-16px justify-end"
      layout="total, prev, pager, next, sizes"
      :total="total"
      :page-sizes="[20, 50, 100]"
      :page-size="query.pageSize"
      :current-page="query.page"
      @current-change="(p: number) => { query.page = p; load(); }"
      @size-change="(s: number) => { query.pageSize = s; query.page = 1; load(); }"
    />

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="发票详情" size="640px">
      <el-descriptions v-loading="detailLoading" v-if="detail" :column="2" border>
        <el-descriptions-item label="发票ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="detail.file_status !== null" :type="tagTypeMap[detail.file_status] || 'info'">
            {{ detail.status_text }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="发票号码">{{ detail.invoice_num || '—' }}</el-descriptions-item>
        <el-descriptions-item label="发票代码">{{ detail.invoice_code || '—' }}</el-descriptions-item>
        <el-descriptions-item label="发票类型" :span="2">{{ detail.invoice_type || '—' }}</el-descriptions-item>
        <el-descriptions-item label="开票日期">{{ fmtDate(detail.invoice_date) }}</el-descriptions-item>
        <el-descriptions-item label="价税合计">
          <span class="text-error font-600">¥{{ Number(detail.total_amount ?? 0).toFixed(2) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="购买方" :span="2">{{ detail.purchaser_name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="购买方税号" :span="2">{{ detail.purchaser_register_num || '—' }}</el-descriptions-item>
        <el-descriptions-item label="销售方" :span="2">{{ detail.seller_name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="销售方税号" :span="2">{{ detail.seller_register_num || '—' }}</el-descriptions-item>
        <el-descriptions-item label="所属用户">{{ detail.mobile }}（ID: {{ detail.user_id }}）</el-descriptions-item>
        <el-descriptions-item label="入库时间">{{ fmtTime(detail.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="来源包" :span="2">{{ detail.package_filename || '—' }}</el-descriptions-item>
        <el-descriptions-item label="原始文件" :span="2">{{ detail.orig_path || '—' }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.fail_reason" label="失败/重复原因" :span="2">
          <span class="text-warning">{{ detail.fail_reason }}</span>
        </el-descriptions-item>
        <el-descriptions-item v-if="detail.remark" label="备注" :span="2">{{ detail.remark }}</el-descriptions-item>
      </el-descriptions>

      <template v-if="detail">
        <h4 class="mt-20px mb-10px">商品明细（{{ detail.items.length }} 行）</h4>
        <el-table :data="detail.items" border size="small">
          <el-table-column type="index" label="#" width="50" align="center" />
          <el-table-column prop="commodity_name" label="项目名称" min-width="180" show-overflow-tooltip />
          <el-table-column prop="commodity_type" label="规格型号" min-width="110" show-overflow-tooltip />
          <el-table-column prop="commodity_unit" label="单位" width="70" align="center" />
          <el-table-column prop="commodity_num" label="数量" width="80" align="right" />
          <el-table-column prop="commodity_price" label="单价" width="90" align="right" />
          <el-table-column prop="commodity_amount" label="金额" width="100" align="right" />
          <el-table-column prop="commodity_tax_rate" label="税率" width="80" align="center" />
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>
