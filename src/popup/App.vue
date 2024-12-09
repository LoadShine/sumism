<template>
  <div class="options-container">
    <ProviderSelector v-model:provider="settings.provider" v-model:apiKey="settings.apiKey" />
    <CustomApiSettings v-if="settings.provider === 'custom'" v-model:customApiUrl="settings.customApiUrl"
                       v-model:customModelName="settings.customModelName" />
    <ModelSelector v-if="settings.provider !== 'custom'" v-model:model="settings.model"
                   :provider="settings.provider" />
    <CustomPromptToggle v-model:useCustomPrompt="settings.useCustomPrompt" />
    <CustomPromptSettings v-if="settings.useCustomPrompt" v-model:systemPrompt="settings.systemPrompt"
                          v-model:userPrompt="settings.userPrompt" />
    <SummaryLanguageSelector v-model:summaryLanguage="settings.summaryLanguage" />
    <button @click="saveSettings">保存设置</button>
    <div id="notification" ref="notificationRef"></div>
  </div>
</template>

<script setup lang="ts">
import {reactive, ref, onMounted} from 'vue';
import ProviderSelector from './components/ProviderSelector.vue';
import CustomApiSettings from './components/CustomApiSettings.vue';
import ModelSelector from './components/ModelSelector.vue';
import CustomPromptToggle from './components/CustomPromptToggle.vue';
import CustomPromptSettings from './components/CustomPromptSettings.vue';
import SummaryLanguageSelector from './components/SummaryLanguageSelector.vue';
import type {AISettings} from '@/types';

const settings = reactive<AISettings>({
  provider: 'openai',
  apiKey: '',
  model: 'gpt-3.5-turbo',
  customApiUrl: '',
  customModelName: '',
  useCustomPrompt: false,
  systemPrompt: '',
  userPrompt: '',
  summaryLanguage: 'auto'
});

const notificationRef = ref<HTMLDivElement | null>(null);

const showNotification = (message: string, type = 'success') => {
  if (notificationRef.value) {
    notificationRef.value.textContent = message;
    notificationRef.value.className = `notification show ${type}`;

    setTimeout(() => {
      if (notificationRef.value) {
        notificationRef.value.className = 'notification';
      }
    }, 3000);
  }
};

const saveSettings = () => {
  if (!settings.apiKey) {
    showNotification('请输入API密钥', 'error');
    return;
  }

  if (settings.useCustomPrompt && (!settings.systemPrompt || !settings.userPrompt)) {
    showNotification('请填写完整的自定义Prompt', 'error');
    return;
  }

  chrome.storage.local.set({aiSettings: settings}, () => {
    showNotification('设置已成功保存');
  });
};

onMounted(() => {
  chrome.storage.local.get('aiSettings', (data) => {
    if (data.aiSettings) {
      Object.assign(settings, data.aiSettings);
    }
  });
});
</script>

<style scoped>
/* 你可以添加一些基本的样式 */
.options-container {
  width: 400px;
  padding: 20px;
}

button {
  margin-top: 20px;
  padding: 10px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  cursor: pointer;
}

.notification {
  margin-top: 10px;
  padding: 10px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
}

.notification.error {
  background-color: #fdd;
  border-color: #faa;
}
</style>