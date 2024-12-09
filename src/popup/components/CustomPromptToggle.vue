<template>
  <div class="form-group">
    <label>自定义Prompt</label>
    <div class="toggle-switch">
      <input type="checkbox" id="customPromptToggle" v-model="localUseCustomPrompt">
      <label for="customPromptToggle">启用</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, watch, defineEmits, defineProps} from 'vue';

const props = defineProps<{
  useCustomPrompt: boolean;
}>();

const emits = defineEmits<{
  (e: 'update:useCustomPrompt', value: boolean): void;
}>();

const localUseCustomPrompt = ref(props.useCustomPrompt);

watch(localUseCustomPrompt, (newValue) => {
  emits('update:useCustomPrompt', newValue);
});
</script>