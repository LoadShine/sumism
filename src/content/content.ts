class SummaryLengthCalculator {
    static calculateOverallSummaryLength(fullText: string): number {
        const wordCount = this.getWordCount(fullText);
        // 整体总结长度约为原文的 10%-15%
        return Math.max(
            100, // 最小长度
            Math.min(Math.ceil(wordCount * 0.15), 500), // 最大长度
        );
    }

    static calculateParagraphSummaryLength(paragraph: string): number {
        const wordCount = this.getWordCount(paragraph);
        // 段落总结长度约为原文的 20%-30%
        return Math.max(
            30, // 最小长度
            Math.min(Math.ceil(wordCount * 0.25), 150), // 最大长度
        );
    }

    static getWordCount(text: string): number {
        // 针对中文和英文的字数统计
        const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishWords = text
            .replace(/[\u4e00-\u9fa5]/g, '')
            .trim()
            .split(/\s+/)
            .filter((word) => word.length > 0).length;

        // 中文字数 + 英文词数
        return chineseCount + englishWords;
    }
}

class ContentSummarizer {
    private observer: IntersectionObserver | null = null;
    private summarizedParagraphs: Set<string> = new Set();
    private requestQueue: {
        paragraph: HTMLParagraphElement;
        resolve: (value: void | PromiseLike<void>) => void;
        reject: (reason?: any) => void;
    }[] = [];
    private activeRequests: number = 0;
    private maxConcurrentRequests: number = 10;

    async initialize() {
        // Check if already initialized to prevent duplicate work
        if (document.getElementById('summary-state-marker')) {
            return;
        }

        // Rest of the existing initialization logic remains the same
        const paragraphs = document.querySelectorAll('p');
        paragraphs.forEach((p, index) => {
            if (!p.id) {
                p.id = `paragraph-${index}`;
            }
            this.wrapParagraph(p);
        });

        this.setupIntersectionObserver();

        const summaryStateMarker = document.createElement('div');
        summaryStateMarker.id = 'summary-state-marker';
        summaryStateMarker.style.display = 'none';
        document.body.appendChild(summaryStateMarker);

        chrome.runtime.sendMessage({
            action: 'updateContextMenu',
            hasSummaries: true,
        });
    }

    getDefaultSystemPrompt(): string {
        return `你是一个卓越的文章内容分析专家，具备深度语义理解和精准信息提取能力。你的任务是进行多层次、高质量的段落总结。你需要遵循以下复杂的认知处理流程：

分析阶段：
1. 语义理解
- 深入解析段落语义层次
- 识别隐含信息和潜在主题
- 评估信息的重要性和关联性

2. 信息提炼
- 提取核心观点和关键信息
- 过滤冗余和次要细节
- 保持信息的原始意图和精髓

总结策略：
- 简洁精炼：用精确的文字表达重要信息
- 重点突出：突出核心论点和关键信息
- 逻辑清晰：保持内容的逻辑性和连贯性
- 避免重复：不要重复原文内容，而是进行信息提炼
- 专业准确：保持专业术语的准确性

输出要求：
- 根据原文长度动态调整总结长度
- 使用简洁的语言
- 保持客观专业的语气

特殊要求：
- 对技术文章，突出专业术语和核心概念
- 对学术文章，凸显研究要点和方法论
- 对叙事文章，提炼情节发展和主题脉络
- 对财经文章，强调数据和趋势分析
- 对新闻文章，重点报道事实和事件背景`;
    }

    getOverallSummaryPrompt(fullText: string): string {
        const targetLength =
            SummaryLengthCalculator.calculateOverallSummaryLength(fullText);

        return `请对以下文章进行整体总结：

${fullText}

要求：
1. 提炼文章的核心主题和主要观点
2. 总结篇幅控制在${targetLength}字以内
3. 突出文章的逻辑框架和重点内容
4. 保持总结的连贯性和完整性`;
    }

    getParagraphSummaryPrompt(
        overallSummary: string,
        paragraph: string,
    ): string {
        const targetLength =
            SummaryLengthCalculator.calculateParagraphSummaryLength(paragraph);

        return `参考文章整体总结：
${overallSummary}

请对以下段落进行简要总结：
${paragraph}

要求：
1. 结合整体内容，提炼该段落的核心信息
2. 总结长度控制在${targetLength}字以内
3. 避免与整体总结重复
4. 突出该段落独特的信息价值
5. 确保总结与上下文逻辑连贯`;
    }

    wrapParagraph(paragraph: HTMLParagraphElement) {
        const wrapper = document.createElement('div');
        wrapper.className = 'paragraph-wrapper';
        paragraph.parentNode?.insertBefore(wrapper, paragraph);
        wrapper.appendChild(paragraph);

        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'summary-content';
        summaryDiv.style.display = 'none';
        wrapper.insertBefore(summaryDiv, paragraph);
    }

    setupIntersectionObserver() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const paragraph = entry.target.querySelector('p');
                        if (paragraph && !this.summarizedParagraphs.has(paragraph.id)) {
                            this.summarizeParagraph(paragraph);
                        }
                    }
                });
            },
            { threshold: 0.1 },
        );

        document.querySelectorAll('.paragraph-wrapper').forEach((wrapper) => {
            this.observer?.observe(wrapper);
        });
    }

    async summarizeParagraph(paragraph: HTMLParagraphElement) {
        // 如果已经在队列中,不要重复添加
        if (this.requestQueue.some((req) => req.paragraph.id === paragraph.id)) {
            return;
        }

        // 创建一个Promise来处理请求
        const requestPromise = new Promise<void>((resolve, reject) => {
            this.requestQueue.push({
                paragraph,
                resolve,
                reject,
            });
        });

        // 尝试处理队列
        this.processQueue();

        return requestPromise;
    }

    async processQueue() {
        // 如果已经达到并发限制或队列为空，则返回
        if (
            this.activeRequests >= this.maxConcurrentRequests ||
            this.requestQueue.length === 0
        ) {
            return;
        }

        // 获取队列中的下一个请求
        const request = this.requestQueue.shift();
        if (!request) return;

        this.activeRequests++;

        try {
            // 获取存储的设置
            const settings = await chrome.storage.local.get('aiSettings');
            const aiSettings = settings.aiSettings || {};

            const settingHashString = btoa(JSON.stringify(aiSettings));

            // 检查缓存
            const cachedSummary = await this.getFromCache(
                settingHashString + '_' + request.paragraph.id,
            );
            if (cachedSummary) {
                this.displaySummary(request.paragraph, cachedSummary);
                request.resolve();
                return;
            }

            // 添加加载动画
            const wrapper = request.paragraph.closest('.paragraph-wrapper');
            if (!wrapper) return;
            const summaryDiv = wrapper.querySelector('.summary-content');
            if (!summaryDiv) return;
            summaryDiv.innerHTML = `<div class="loading-spinner"></div>`;
            (summaryDiv as HTMLElement).style.display = 'block';

            // 重试机制
            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const summary = await this.callAIAPI(
                        request.paragraph.textContent || '',
                        aiSettings,
                    );
                    await this.saveToCache(
                        settingHashString + '_' + request.paragraph.id,
                        summary,
                    );
                    this.displaySummary(request.paragraph, summary);
                    request.resolve();
                    break;
                } catch (error) {
                    console.error(`总结失败，重试 ${attempt}:`, error);
                    if (attempt === maxRetries) {
                        this.displayError(request.paragraph);
                        request.reject(error);
                    }
                }
            }
        } finally {
            this.activeRequests--;
            // 继续处理队列中的其他请求
            this.processQueue();
        }
    }

    async callAIAPI(text: string, settings: any) {
        // 获取所有段落内容
        const paragraphs = Array.from(document.querySelectorAll('p'));
        const fullText = paragraphs.map((p) => p.textContent).join('\n');

        // 第一步：获取整体总结
        const systemPrompt = settings.useCustomPrompt
            ? settings.systemPrompt
            : this.getDefaultSystemPrompt();

        const overallSummaryPrompt = settings.useCustomPrompt
            ? settings.userPrompt.replace('{full_text}', fullText)
            : this.getOverallSummaryPrompt(fullText);

        const overallSummary = await this.callProviderAPI(
            settings,
            systemPrompt,
            overallSummaryPrompt,
        );

        // 第二步：获取段落总结
        const paragraphPrompt = settings.useCustomPrompt
            ? settings.userPrompt.replace('{paragraph}', text)
            : this.getParagraphSummaryPrompt(overallSummary, text);

        return this.callProviderAPI(settings, systemPrompt, paragraphPrompt);
    }

    async callProviderAPI(
        settings: any,
        systemPrompt: string,
        userPrompt: string,
    ) {
        const languageInstruction =
            settings.summaryLanguage === 'auto'
                ? '请使用输入语言输出总结。'
                : `请使用${settings.summaryLanguage}输出总结。`;

        const finalSystemPrompt = systemPrompt + '\n' + languageInstruction;

        switch (settings.provider) {
            case 'ai302':
                return this.call302AIAPI(settings, finalSystemPrompt, userPrompt);
            case 'openai':
                return this.callOpenAIAPI(settings, finalSystemPrompt, userPrompt);
            case 'claude':
                return this.callClaudeAPI(settings, finalSystemPrompt, userPrompt);
            case 'zhipu':
                return this.callZhipuAPI(settings, finalSystemPrompt, userPrompt);
            case 'custom':
                return this.callCustomAPI(settings, finalSystemPrompt, userPrompt);
            default:
                return this.callOpenAIAPI(settings, finalSystemPrompt, userPrompt);
        }
    }

    async call302AIAPI(settings: any, systemPrompt: string, userPrompt: string) {
        const response = await fetch('https://api.302.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${settings.apiKey}`,
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            }),
        });
        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callOpenAIAPI(settings: any, systemPrompt: string, userPrompt: string) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${settings.apiKey}`,
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            }),
        });
        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callClaudeAPI(settings: any, systemPrompt: string, userPrompt: string) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': settings.apiKey,
                'Anthropic-Version': '2023-06-01',
            },
            body: JSON.stringify({
                model: settings.model || 'claude-3-sonnet-20240229',
                max_tokens: 200,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            }),
        });
        const data = await response.json();
        return data.content[0].text;
    }

    async callZhipuAPI(settings: any, systemPrompt: string, userPrompt: string) {
        const response = await fetch(
            'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${settings.apiKey}`,
                },
                body: JSON.stringify({
                    model: settings.model || 'glm-4-flash',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt,
                        },
                        {
                            role: 'user',
                            content: userPrompt,
                        },
                    ],
                }),
            },
        );
        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callCustomAPI(settings: any, systemPrompt: string, userPrompt: string) {
        const response = await fetch(settings.customApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${settings.apiKey}`,
            },
            body: JSON.stringify({
                model: settings.customModelName,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            }),
        });
        const data = await response.json();
        return data.choices[0].message.content;
    }

    displayError(paragraph: HTMLParagraphElement) {
        const wrapper = paragraph.closest('.paragraph-wrapper');
        if (!wrapper) return;
        const summaryDiv = wrapper.querySelector('.summary-content');
        if (!summaryDiv) return;
        summaryDiv.innerHTML = `<div class="error-message">总结失败，点击重试</div>`;
        (summaryDiv as HTMLElement).onclick = () => this.summarizeParagraph(paragraph);
    }

    displaySummary(paragraph: HTMLParagraphElement, summary: string) {
        const wrapper = paragraph.closest('.paragraph-wrapper');
        if (!wrapper) return;
        const summaryDiv = wrapper.querySelector('.summary-content');
        if (!summaryDiv) return;
        summaryDiv.textContent = summary;
        (summaryDiv as HTMLElement).style.display = 'block';
        paragraph.style.opacity = '0.2';
        this.summarizedParagraphs.add(paragraph.id);
    }

    async saveToCache(paragraphId: string, summary: string) {
        const cacheKey = `summary_${window.location.href}_${paragraphId}`;
        await chrome.storage.local.set({ [cacheKey]: summary });
    }

    async getFromCache(paragraphId: string) {
        const cacheKey = `summary_${window.location.href}_${paragraphId}`;
        const result = await chrome.storage.local.get(cacheKey);
        return result[cacheKey];
    }

    async hideSummaries() {
        document.querySelectorAll('.summary-content').forEach((summary) => {
            (summary as HTMLElement).style.display = 'none';
        });
        document.querySelectorAll('.paragraph-wrapper p').forEach((p) => {
            (p as HTMLElement).style.opacity = '1';
        });

        // 移除状态标记元素
        const marker = document.getElementById('summary-state-marker');
        if (marker) {
            marker.remove();
        }

        chrome.runtime.sendMessage({
            action: 'updateContextMenu',
            hasSummaries: false,
        });
    }
}

// 监听来自background.js的消息
chrome.runtime.onMessage.addListener(
    (
        request: { action: string },
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void,
    ) => {
        const summarizer = new ContentSummarizer();

        if (request.action === 'initializeSummary') {
            summarizer.initialize();
        } else if (request.action === 'hideSummaries') {
            summarizer.hideSummaries();
        } else if (request.action === 'checkSummaryState') {
            // 检查是否存在summary-state-marker
            sendResponse(!!document.getElementById('summary-state-marker'));
        }
    },
);
