<template>
  <div class="form-group">
    <label>System Prompt</label>
    <textarea v-model="localSystemPrompt" placeholder="输入自定义System Prompt"></textarea>
    <label>User Prompt模板</label>
    <textarea v-model="localUserPrompt" placeholder="输入自定义User Prompt模板"></textarea>
  </div>
</template>

<script setup lang="ts">
import {ref, watch, defineEmits, defineProps} from 'vue';

const props = defineProps<{
  systemPrompt: string;
  userPrompt: string;
}>();

const emits = defineEmits<{
  (e: 'update:systemPrompt', value: string): void;
  (e: 'update:userPrompt', value: string): void;
}>();

const localSystemPrompt = ref(props.systemPrompt);
const localUserPrompt = ref(props.userPrompt);

watch(localSystemPrompt, (newValue) => {
  emits('update:systemPrompt', newValue);
});

watch(localUserPrompt, (newValue) => {
  emits('update:userPrompt', newValue);
});
</script>