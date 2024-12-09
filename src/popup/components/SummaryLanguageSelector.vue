<template>
  <div class="form-group">
    <label>总结语言</label>
    <select v-model="localSummaryLanguage">
      <option value="auto">跟随输入语言</option>
      <option value="Chinese">中文</option>
      <option value="English">English</option>
      <option value="Japanese">日本語</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import {ref, watch, defineEmits, defineProps} from 'vue';

const props = defineProps<{
  summaryLanguage: string;
}>();

const emits = defineEmits<{
  (e: 'update:summaryLanguage', value: string): void;
}>();

const localSummaryLanguage = ref(props.summaryLanguage);

watch(localSummaryLanguage, (newValue) => {
  emits('update:summaryLanguage', newValue);
});
</script>