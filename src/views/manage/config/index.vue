<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchConfigs, updateConfigs, type SysConfigItem } from '@/service/api/system';

defineOptions({ name: 'ManageConfig' });

const loading = ref(false);
const saving = ref(false);
const rows = ref<SysConfigItem[]>([]);

async function load() {
  loading.value = true;
  const { data, error } = await fetchConfigs();
  if (!error && data) rows.value = data.list;
  loading.value = false;
}

async function onSave() {
  // 前端范围预校验，避免无谓提交
  for (const r of rows.value) {
    const v = Number(r.value);
    if (!Number.isInteger(v)) {
      ElMessage.error(`${r.label}必须为整数`);
      return;
    }
    if (v < r.min || v > r.max) {
      ElMessage.error(`${r.label}需在 ${r.min}~${r.max} 之间`);
      return;
    }
  }
  saving.value = true;
  const { error } = await updateConfigs(rows.value.map(r => ({ key: r.key, value: r.value })));
  saving.value = false;
  if (!error) {
    ElMessage.success('配置已保存并即时生效');
    load();
  }
}

onMounted(load);
</script>

<template>
  <div v-loading="loading" class="min-h-500px">
    <el-alert
      class="mb-16px"
      title="此处仅维护可公开的运营参数；密钥、数据库口令等敏感配置仍通过环境变量(.env)管理"
      type="info"
      :closable="false"
      show-icon
    />

    <el-card shadow="never">
      <el-table :data="rows" border stripe>
        <el-table-column prop="label" label="参数" width="200" />
        <el-table-column label="当前值" width="220">
          <template #default="{ row }">
            <el-input v-model="row.value" :placeholder="`${row.min} ~ ${row.max}`" />
          </template>
        </el-table-column>
        <el-table-column prop="desc" label="说明" min-width="260" show-overflow-tooltip />
      </el-table>

      <div class="mt-16px">
        <el-button type="primary" :loading="saving" @click="onSave">保存配置</el-button>
        <el-button @click="load">还原</el-button>
      </div>
    </el-card>
  </div>
</template>
