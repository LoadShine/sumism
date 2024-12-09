<template>
  <div class="form-group">
    <label>模型选择</label>
    <select v-model="selectedModel">
      <option v-for="model in availableModels" :key="model" :value="model">{{ model }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import {ref, watch, computed, defineEmits, defineProps} from 'vue';
import {PROVIDER_MODELS} from '@/types';

const props = defineProps<{
  model: string;
  provider: string;
}>();

const emits = defineEmits<{
  (e: 'update:model', value: string): void;
}>();

const selectedModel = ref(props.model);

const availableModels = computed(() => {
  return PROVIDER_MODELS[props.provider] || [];
});

watch(selectedModel, (newModel) => {
  emits('update:model', newModel);
});
</script>