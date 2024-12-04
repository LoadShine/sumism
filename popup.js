document.addEventListener('DOMContentLoaded', () => {
    const providerSelect = document.getElementById('aiProvider');
    const customApiGroup = document.getElementById('customApiGroup');
    const saveButton = document.getElementById('saveSettings');
    const modelSelect = document.getElementById('modelSelect');
    const modelSelectGroup = document.getElementById('modelSelectGroup');
    const notificationEl = document.getElementById('notification');
    const customPromptToggle = document.getElementById('customPromptToggle');
    const customPromptGroup = document.getElementById('customPromptGroup');
    const systemPromptInput = document.getElementById('systemPrompt');
    const userPromptInput = document.getElementById('userPrompt');
    const summaryLanguageSelect = document.getElementById('summaryLanguage');

    const PROVIDER_MODELS = {
        ai302: ['gpt-3.5-turbo', 'gpt-4-turbo', 'gpt-4o', 'o1-mini', 'claude-3-5-sonnet-latest', 'gemini-1.5-flash-002', 'gemini-1.5-pro', 'Qwen-Turbo', 'Llama-3.1-nemotron'],
        openai: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
        claude: ['claude-3-sonnet', 'claude-3-opus'],
        zhipu: ['glm-4-flash', 'chatglm-turbo'],
        custom: []
    };

    customPromptToggle.addEventListener('change', (e) => {
        customPromptGroup.style.display = e.target.checked ? 'block' : 'none';
    });

    const showNotification = (message, type = 'success') => {
        notificationEl.textContent = message;
        notificationEl.className = `notification show ${type}`;

        setTimeout(() => {
            notificationEl.className = 'notification';
        }, 3000);
    };

    providerSelect.addEventListener('change', (e) => {
        const provider = e.target.value;

        if (provider === 'custom') {
            customApiGroup.style.display = 'block';
            modelSelectGroup.style.display = 'none';
        } else {
            customApiGroup.style.display = 'none';
            modelSelectGroup.style.display = 'block';

            modelSelect.innerHTML = PROVIDER_MODELS[provider].map(model =>
                `<option value="${model}">${model}</option>`
            ).join('');
        }
    });

    saveButton.addEventListener('click', () => {
        const settings = {
            provider: providerSelect.value,
            apiKey: document.getElementById('apiKey').value,
            model: providerSelect.value === 'custom'
                ? document.getElementById('customModelName').value
                : modelSelect.value,
            customApiUrl: document.getElementById('customApiUrl').value,
            customModelName: document.getElementById('customModelName').value,
            useCustomPrompt: customPromptToggle.checked,
            systemPrompt: systemPromptInput.value,
            userPrompt: userPromptInput.value,
            summaryLanguage: summaryLanguageSelect.value
        };

        if (!settings.apiKey) {
            showNotification('请输入API密钥', 'error');
            return;
        }

        // 验证自定义Prompt
        if (settings.useCustomPrompt) {
            if (!settings.systemPrompt || !settings.userPrompt) {
                showNotification('请填写完整的自定义Prompt', 'error');
                return;
            }
        }

        chrome.storage.local.set({aiSettings: settings}, () => {
            showNotification('设置已成功保存');
        });
    });

    // 加载已保存的设置
    chrome.storage.local.get('aiSettings', (data) => {
        if (data.aiSettings) {
            const settings = data.aiSettings;
            providerSelect.value = settings.provider;
            document.getElementById('apiKey').value = settings.apiKey;
            providerSelect.dispatchEvent(new Event('change'));

            if (settings.provider === 'custom') {
                document.getElementById('customApiUrl').value = settings.customApiUrl;
                document.getElementById('customModelName').value = settings.customModelName;
            } else {
                modelSelect.value = settings.model;
            }

            // 处理自定义Prompt
            customPromptToggle.checked = settings.useCustomPrompt || false;
            customPromptGroup.style.display = settings.useCustomPrompt ? 'block' : 'none';
            systemPromptInput.value = settings.systemPrompt || '';
            userPromptInput.value = settings.userPrompt || '';

            // 处理语言设置
            summaryLanguageSelect.value = settings.summaryLanguage || 'auto';
        }
    });
});
