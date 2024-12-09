<template>
  <div class="form-group">
    <label>API地址</label>
    <input type="text" v-model="localCustomApiUrl" placeholder="输入自定义API地址">
    <label>模型名称</label>
    <input type="text" v-model="localCustomModelName" placeholder="输入自定义模型名称">
  </div>
</template>

<script setup lang="ts">
import {ref, watch, defineEmits, defineProps} from 'vue';

const props = defineProps<{
  customApiUrl: string;
  customModelName: string;
}>();

const emits = defineEmits<{
  (e: 'update:customApiUrl', value: string): void;
  (e: 'update:customModelName', value: string): void;
}>();

const localCustomApiUrl = ref(props.customApiUrl);
const localCustomModelName = ref(props.customModelName);

watch(localCustomApiUrl, (newCustomApiUrl) => {
  emits('update:customApiUrl', newCustomApiUrl);
});

watch(localCustomModelName, (newCustomModelName) => {
  emits('update:customModelName', newCustomModelName);
});
</script>