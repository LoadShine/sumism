export interface AISettings {
    provider: string;
    apiKey: string;
    model: string;
    customApiUrl: string;
    customModelName: string;
    useCustomPrompt: boolean;
    systemPrompt: string;
    userPrompt: string;
    summaryLanguage: string;
}

export const PROVIDER_MODELS: { [key: string]: string[] } = {
    ai302: ['gpt-3.5-turbo', 'gpt-4-turbo', 'gpt-4o', 'o1-mini', 'claude-3-5-sonnet-latest', 'gemini-1.5-flash-002', 'gemini-1.5-pro', 'Qwen-Turbo', 'Llama-3.1-nemotron'],
    openai: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
    claude: ['claude-3-sonnet', 'claude-3-opus'],
    zhipu: ['glm-4-flash', 'chatglm-turbo'],
    custom: []
};