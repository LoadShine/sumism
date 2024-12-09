<template>
  <div class="form-group">
    <label>AI服务提供商</label>
    <select v-model="selectedProvider">
      <option value="ai302">302.ai</option>
      <option value="openai">OpenAI</option>
      <option value="claude">Claude</option>
      <option value="zhipu">智谱AI</option>
      <option value="custom">自定义</option>
    </select>
    <label>API密钥</label>
    <input type="text" v-model="localApiKey" placeholder="输入您的API密钥">
  </div>
</template>

<script setup lang="ts">
import {ref, watch, defineEmits, defineProps} from 'vue';

const props = defineProps<{
  provider: string;
  apiKey: string;
}>();

const emits = defineEmits<{
  (e: 'update:provider', value: string): void;
  (e: 'update:apiKey', value: string): void;
}>();

const selectedProvider = ref(props.provider);
const localApiKey = ref(props.apiKey);

watch(selectedProvider, (newProvider) => {
  emits('update:provider', newProvider);
});

watch(localApiKey, (newApiKey) => {
  emits('update:apiKey', newApiKey);
});
</script>