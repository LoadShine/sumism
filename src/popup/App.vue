<template>
  <div class="container">
    <div class="glass-card">
      <!-- Provider Selector -->
      <div class="form-group">
        <label>AI服务提供商</label>
        <select v-model="settings.provider" class="glass-select">
          <option value="ai302">302.ai</option>
          <option value="openai">OpenAI</option>
          <option value="claude">Claude</option>
          <option value="zhipu">智谱AI</option>
          <option value="custom">自定义</option>
        </select>

        <label>API密钥</label>
        <input
            type="text"
            v-model="settings.apiKey"
            :placeholder="'输入您的API密钥'"
            class="glass-input"
        >
      </div>

      <!-- Custom API Settings -->
      <div v-if="settings.provider === 'custom'" class="form-group fade-in">
        <label>API地址</label>
        <input
            type="text"
            v-model="settings.customApiUrl"
            placeholder="输入自定义API地址"
            class="glass-input"
        >

        <label>模型名称</label>
        <input
            type="text"
            v-model="settings.customModelName"
            placeholder="输入自定义模型名称"
            class="glass-input"
        >
      </div>

      <!-- Model Selector -->
      <div v-if="settings.provider !== 'custom'" class="form-group fade-in">
        <label>模型选择</label>
        <select v-model="settings.model" class="glass-select">
          <option
              v-for="model in availableModels"
              :key="model"
              :value="model"
          >
            {{ model }}
          </option>
        </select>
      </div>

      <button @click="saveSettings" class="glass-button">
        <span class="button-text">保存设置</span>
      </button>

      <div id="notification" ref="notificationRef" class="notification"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {reactive, ref, onMounted, watch, computed} from 'vue';
import type { AISettings } from '@/types';
import { PROVIDER_MODELS } from '@/types';

const providerApiKeys = ref<Record<string, string>>({});
const providerModels = ref<Record<string, string>>({});

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

const availableModels = computed(() => {
  return PROVIDER_MODELS[settings.provider] || [];
});

// 监听 provider 变化
watch(() => settings.provider, (newProvider) => {
  // 设置之前保存的 API Key
  settings.apiKey = providerApiKeys.value[newProvider] || '';

  // 如果该 provider 之前保存过 model，则使用保存的 model
  if (providerModels.value[newProvider]) {
    settings.model = providerModels.value[newProvider];
  } else {
    // 如果该 provider 没有保存过 model，则使用第一个可用的 model
    const providerAvailableModels = PROVIDER_MODELS[newProvider] || [];
    if (providerAvailableModels.length > 0) {
      settings.model = providerAvailableModels[0];
    }
  }
});

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

  // 保存 API Key
  providerApiKeys.value[settings.provider] = settings.apiKey;
  // 保存 model
  providerModels.value[settings.provider] = settings.model;

  chrome.storage.local.set({
    aiSettings: settings,
    providerApiKeys: providerApiKeys.value,
    providerModels: providerModels.value  // 保存 provider 对应的 model
  }, () => {
    showNotification('设置已成功保存');
  });
};

onMounted(() => {
  chrome.storage.local.get(['aiSettings', 'providerApiKeys', 'providerModels'], (data) => {
    if (data.aiSettings) {
      Object.assign(settings, data.aiSettings);
    }
    if (data.providerApiKeys) {
      providerApiKeys.value = data.providerApiKeys;
      settings.apiKey = providerApiKeys.value[settings.provider] || '';
    }
    if (data.providerModels) {
      providerModels.value = data.providerModels;
      if (providerModels.value[settings.provider]) {
        settings.model = providerModels.value[settings.provider];
      }
    }
  });
});
</script>

<style>
:root {
  --primary-color: #2196f3;
  --error-color: #ff5252;
  --success-color: #4CAF50;
  --text-color: #333;
  --background-color: #f5f5f5;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.container {
  width: 400px;
  padding: 20px;
  min-height: 450px;
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.2) 100%);
}

.glass-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-color);
  font-weight: 500;
  font-size: 0.9rem;
}

.glass-input, .glass-select {
  width: 100%;
  padding: 12px;
  margin-bottom: 15px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  backdrop-filter: blur(5px);
  color: var(--text-color);
  transition: all 0.3s ease;
}

.glass-input:focus, .glass-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
}

.glass-button {
  width: 100%;
  padding: 12px;
  background: rgba(33, 150, 243, 0.1);
  border: 1px solid rgba(33, 150, 243, 0.2);
  border-radius: 8px;
  backdrop-filter: blur(5px);
  color: var(--primary-color);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
  position: relative;
}

.glass-button:hover {
  background: rgba(33, 150, 243, 0.2);
  transform: translateY(-1px);
}

.glass-button:active {
  transform: translateY(1px);
}

.notification {
  margin-top: 15px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
  opacity: 0;
  transition: opacity 0.3s ease;
  text-align: center;
}

.notification.show {
  opacity: 1;
}

.notification.error {
  background: rgba(255, 82, 82, 0.1);
  color: var(--error-color);
}

.notification.success {
  background: rgba(76, 175, 80, 0.1);
  color: var(--success-color);
}

.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>