import type {AISettings} from "@/types";

class TokenCalculator {
    static estimateTokens(text: string): number {
        // Chinese characters (including punctuation)
        const chineseMatches = text.match(/[\u4e00-\u9fff，。！？；：""''「」『』（）【】《》〈〉]/g) || [];
        const chineseTokens = chineseMatches.length * 1.5;

        // Remove Chinese characters for English calculation
        const englishText = text.replace(/[\u4e00-\u9fff，。！？；：""''「」『』（）【】《》〈〉]/g, ' ');

        // Calculate English tokens
        const englishTokens = englishText.split(/\s+/)
            .filter(word => word.length > 0)
            .reduce((acc, word) => {
                // Common patterns that affect tokenization
                const capitalized = /^[A-Z]/.test(word) ? 0.1 : 0;
                const specialChars = (word.match(/[^a-zA-Z0-9]/g) || []).length * 0.1;
                const lengthFactor = Math.ceil(word.length / 4) * 0.2;
                return acc + 1.3 + capitalized + specialChars + lengthFactor;
            }, 0);

        // Numbers and special characters
        const numberTokens = (text.match(/\d+/g) || []).length * 0.5;

        return Math.ceil(chineseTokens + englishTokens + numberTokens);
    }

    static calculateTotalTokens(fullText: string, templateTokens: number): {
        inputTokens: number;
        outputTokens: number;
        total: number;
    } {
        const textTokens = this.estimateTokens(fullText);
        const paragraphCount = fullText.split('\n').length;

        const inputTokens = Math.ceil(
            textTokens + // Original text
            (textTokens * 0.2 * paragraphCount) + // Paragraph contexts
            templateTokens // Template tokens
        );

        const outputTokens = Math.ceil(textTokens * 0.5);

        return {
            inputTokens,
            outputTokens,
            total: inputTokens + outputTokens
        };
    }
}

class SummaryLengthCalculator {
    static calculateOverallSummaryLength(fullText: string): number {
        const wordCount = this.getWordCount(fullText);
        // 整体总结长度约为原文的 20%
        return Math.max(
            300, // 最小长度
            Math.min(Math.ceil(wordCount * 0.2), 1000), // 最大长度
        );
    }

    static calculateParagraphSummaryLength(paragraph: string): number {
        const wordCount = this.getWordCount(paragraph);
        // 段落总结长度约为原文的 30%
        return Math.max(
            30, // 最小长度
            Math.min(Math.ceil(wordCount * 0.3), 300), // 最大长度
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
    private static instance: ContentSummarizer | null = null;
    private observer: IntersectionObserver | null = null;
    private summarizedParagraphs: Set<string> = new Set();
    private requestQueue: {
        paragraph: HTMLElement;
        resolve: (value: void | PromiseLike<void>) => void;
        reject: (reason?: any) => void;
    }[] = [];
    private activeRequests: number = 0;
    private maxConcurrentRequests: number = 10;
    private paragraphEventListeners: {
        paragraph: HTMLParagraphElement;
        listener: () => void;
    }[] = [];
    private sidebar: HTMLDivElement | null = null;
    private overallSummary: string | null = null;
    private overallSummarySentences: string[] = [];
    private systemPrompt: string = '';
    private aiSettings: AISettings = {
        provider: 'openai',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        customApiUrl: '',
        customModelName: '',
        useCustomPrompt: false,
        systemPrompt: '',
        userPrompt: '',
        summaryLanguage: 'auto'
    };

    // Private constructor to enforce singleton pattern
    private constructor() { }

    static getInstance(): ContentSummarizer {
        if (!ContentSummarizer.instance) {
            ContentSummarizer.instance = new ContentSummarizer();
        }
        return ContentSummarizer.instance;
    }

    async initialize() {
        if (document.getElementById('summary-state-marker')) {
            return;
        }

        const elements = Array.from(this.findMainContentContainer()?.querySelectorAll('p, ul, ol, table') || []);
        elements.forEach((el, index) => {
            if (!el.id) {
                el.id = `content-element-${index}`;
            }
            this.wrapParagraph(el);
        });

        this.createSidebar();

        const fullText = elements.map((el) => el.textContent).join('\n');
        const templateTokens = 500; // Approximate tokens for templates
        const tokenEstimate = TokenCalculator.calculateTotalTokens(fullText, templateTokens);

        const TOKEN_THRESHOLD = 10000;

        if (tokenEstimate.total <= TOKEN_THRESHOLD) {
            this.displayTokenInfo(tokenEstimate);
            await this.startSummarization(fullText);
        } else {
            await this.showTokenConfirmation(tokenEstimate, fullText);
        }
    }

    private displayTokenInfo(tokenEstimate: { inputTokens: number; outputTokens: number; total: number }) {
        const tokenInfo = document.createElement('div');
        tokenInfo.className = 'token-info';
        tokenInfo.innerHTML = `
        <div>预计消耗 Tokens:</div>
        <div class="token-number">${tokenEstimate.total}</div>
        <div>输入: ${tokenEstimate.inputTokens} / 输出: ${tokenEstimate.outputTokens}</div>
    `;
        this.sidebar?.prepend(tokenInfo);
    }

    private async showTokenConfirmation(
        tokenEstimate: { inputTokens: number; outputTokens: number; total: number },
        fullText: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const confirmation = document.createElement('div');
            confirmation.className = 'token-confirmation';
            confirmation.innerHTML = `
            <div class="token-info">
                <div>预计消耗 Tokens:</div>
                <div class="token-number">${tokenEstimate.total}</div>
                <div>输入: ${tokenEstimate.inputTokens}</div>
                <div>输出: ${tokenEstimate.outputTokens}</div>
            </div>
            <div class="token-buttons">
                <button class="token-button token-confirm">继续</button>
                <button class="token-button token-cancel">取消</button>
            </div>
        `;

            this.sidebar?.appendChild(confirmation);

            confirmation.querySelector('.token-confirm')?.addEventListener('click', async () => {
                confirmation.remove();
                this.displayTokenInfo(tokenEstimate);
                await this.startSummarization(fullText);
                resolve();
            });

            confirmation.querySelector('.token-cancel')?.addEventListener('click', () => {
                confirmation.remove();
                this.sidebar?.remove();
                reject('User cancelled summarization');
            });
        });
    }

    private async saveOverallSummaryToCache(summary: string) {
        const settingHashString = btoa(JSON.stringify(this.aiSettings));
        const cacheKey = `overall_summary_${window.location.href}_${settingHashString}`;
        await chrome.storage.local.set({ [cacheKey]: summary });
    }

    private async getOverallSummaryFromCache(): Promise<string | null> {
        const settingHashString = btoa(JSON.stringify(this.aiSettings));
        const cacheKey = `overall_summary_${window.location.href}_${settingHashString}`;
        const result = await chrome.storage.local.get(cacheKey);
        return result[cacheKey] || null;
    }

    private async startSummarization(fullText: string) {
        const settings = await chrome.storage.local.get('aiSettings');
        this.aiSettings = settings.aiSettings || {};

        // Try to get cached overall summary first
        const cachedSummary = await this.getOverallSummaryFromCache();
        if (cachedSummary) {
            this.overallSummary = this.formatOverallSummary(cachedSummary);
            this.displayOverallSummary(this.overallSummary);
            this.setupIntersectionObserver();
            return;
        }

        const overallSummaryPrompt = this.aiSettings.useCustomPrompt
            ? this.aiSettings.userPrompt!.replace('{full_text}', fullText)
            : this.getOverallSummaryPrompt(fullText);

        this.overallSummary = await this.callProviderAPI(
            this.aiSettings,
            overallSummaryPrompt,
        );

        this.overallSummary = this.formatOverallSummary(this.overallSummary!);
        await this.saveOverallSummaryToCache(this.overallSummary);
        this.displayOverallSummary(this.overallSummary!);
        this.setupIntersectionObserver();
    }

    formatOverallSummary(input: string): string {
        const lines = input.split('\n').map(line => line.trim()); // 按行分割并去掉多余的首尾空格
        let result: string[] = [];

        const regexStart = /^\[P\d+(-P\d+)?(,P\d+)*\]/; // 匹配以 [P数字] 开头
        const regexEnd = /\[P\d+(-P\d+)?(,P\d+)*\]$/;  // 匹配以 [P数字] 结尾

        for (const line of lines) {
            if (regexStart.test(line)) {
                // 如果行以 [P数字] 开头
                const match = line.match(regexStart);
                if (match) {
                    const tag = match[0].trim(); // 提取 [P数字] 部分
                    const sentence = line.slice(tag.length).trim(); // 保留 [P数字] 后面的空格
                    result.push(`${tag} ${sentence}`);
                }
            } else if (regexEnd.test(line)) {
                // 如果行以 [P数字] 结尾
                const match = line.match(regexEnd);
                if (match) {
                    const tag = match[0].trim(); // 提取 [P数字] 部分
                    const sentence = line.slice(0, -tag.length).trim(); // 保留结尾前的空格
                    result.push(`${tag} ${sentence}`);
                }
            } else {
                // 如果行既不以 [P数字] 开头也不以其结尾，原样加入
                result.push(line);
            }
        }

        // result去除空元素
        result = result.filter(line => line.trim() !== '');
        return result.join('\n');
    }

    createSidebar() {
        this.sidebar = document.createElement('div');
        this.sidebar.id = 'summary-sidebar';

        // 创建切换按钮
        const toggleButton = document.createElement('button');
        toggleButton.className = 'sidebar-toggle-button';
        toggleButton.innerHTML = `
            <svg class="expand-icon" viewBox="0 0 24 24" width="24" height="24">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
        `;

        // 创建小型展开按钮
        const expandButton = document.createElement('button');
        expandButton.className = 'sidebar-expand-button';
        expandButton.innerHTML = `
            <svg class="toggle-icon" viewBox="0 0 24 24" width="24" height="24">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
        `;
        expandButton.style.display = 'none';

        document.body.appendChild(this.sidebar);
        document.body.appendChild(expandButton);
        this.sidebar.appendChild(toggleButton);

        // 添加事件监听器
        toggleButton.addEventListener('click', () => this.toggleSidebar(false));
        expandButton.addEventListener('click', () => this.toggleSidebar(true));

        // 在sidebar的正中心添加一个动画
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'sidebar-loading-spinner';
        this.sidebar.appendChild(loadingSpinner);
    }

    toggleSidebar(expand: boolean) {
        const sidebar = document.getElementById('summary-sidebar');
        const expandButton = document.querySelector('.sidebar-expand-button') as HTMLElement;

        if (!sidebar) return;

        if (expand) {
            sidebar.classList.remove('collapsed');
            expandButton.style.display = 'none';
        } else {
            sidebar.classList.add('collapsed');
            expandButton.style.display = 'flex';
        }
    }

    findMainContentContainer(): HTMLElement | null {
        // Strategy 1: Semantic HTML5 Elements
        let container = document.querySelector('article') || document.querySelector('main') || document.querySelector('[role="main"]');
        if (container) return container;

        // Strategy 2: Common Class or ID Names
        const commonIdentifiers = ['content', 'main-content', 'main'];
        for (const id of commonIdentifiers) {
            container = document.getElementById(id) || document.querySelector(`.${id}`);
            if (container) return container;
        }

        // Strategy 3: Heuristic Approach (select the container with the most target elements)
        const allContainers = document.querySelectorAll('div'); // You might need to refine this selector
        let bestContainer = null;
        let maxCount = 0;

        allContainers.forEach(div => {
            const count = div.querySelectorAll('p, ul, ol, table').length;
            if (count > maxCount) {
                maxCount = count;
                bestContainer = div;
            }
        });

        return bestContainer;
    }

    getOverallSummaryPrompt(fullText: string): string {
        const targetLength = SummaryLengthCalculator.calculateOverallSummaryLength(fullText);
        const firstLine = fullText.split('\n')[0].trim();

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
- 对新闻文章，重点报道事实和事件背景
        
请对以下文章进行整体总结。你的任务是创建一个详细的总结，其中每句话都必须清晰地映射回原文的一行或多行。
---
${fullText}
---
    具体要求：
    1. 提炼文章的核心主题和主要观点，确保每个重要概念都在总结中有所体现。
    2. 在总结的每一句话后面，用方括号标明这句话主要对应原文的哪几行。这是一个强制性要求，必须严格遵守。例如：
        - “[P1]”表示这句话主要对应上述文章的第一行。
        - “[P3-P5]”表示这句话对应上述文章的第三到第五行。
        - “[P2,P6]”表示这句话对应上述文章的第二和第六行。
        - 如果一句话概述了多个不连续的行，请用逗号分隔，如“[P1,P4,P7]”。
    3. 请确保你的总结的每一句话都能够精准地对应到原文，但是不需要原文中的每一行都对应着总结。如果原文中的内容不重要，可以在总结中省略。
    4. 总结篇幅控制在${targetLength}字以内。
    5. 突出文章的逻辑框架和重点内容。
    6. 保持总结的连贯性和完整性，同时确保每一句话都与其对应的原文紧密相关。

你的总结应该像一张详细的地图，能够清晰地指引读者回到原文的某一个或者某几个部分，让他们能够准确理解每句话的来源和上下文。
请务必按照“[P数字]”的格式来标记与行的对应关系，这对读者理解总结与原文的关联至关重要。
请以
"${firstLine}"
作为第一行[P1]，并以此类推，向后依次计算行数。请仔细检查，精准对应P后面的数字与行数，不要出现数字与原文行数不匹配的情况。
你的首要任务是保证总结的准确性和与原文的精确对应。
请使用中文输出。`;
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
5. 确保总结与上下文逻辑连贯
6. 请使用中文输出。`;
    }

    wrapParagraph(element: Element) {
        const wrapper = document.createElement('div');
        wrapper.className = 'paragraph-wrapper';
        element.parentNode?.insertBefore(wrapper, element);
        wrapper.appendChild(element);

        const summaryContainer = document.createElement('div');
        summaryContainer.className = 'summary-container';

        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'summary-content';
        summaryDiv.setAttribute('contenteditable', 'false');
        summaryDiv.style.display = 'none';

        const editControls = document.createElement('div');
        editControls.className = 'edit-controls';
        editControls.style.display = 'none';

        const saveButton = document.createElement('button');
        saveButton.className = 'save-button';
        saveButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
        </svg>
        <span>Save</span>
    `;

        const cancelButton = document.createElement('button');
        cancelButton.className = 'cancel-button';
        cancelButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
        <span>Cancel</span>
    `;

        editControls.appendChild(saveButton);
        editControls.appendChild(cancelButton);

        summaryContainer.appendChild(summaryDiv);
        summaryContainer.appendChild(editControls);
        wrapper.insertBefore(summaryContainer, element);

        let originalContent = '';

        // Double click to edit
        summaryDiv.addEventListener('dblclick', () => {
            originalContent = summaryDiv.textContent || '';
            summaryDiv.setAttribute('contenteditable', 'true');
            summaryDiv.focus();
            editControls.style.display = 'flex';
            editControls.classList.add('visible');
            summaryDiv.classList.add('editing');
        });

        // Save button click handler
        saveButton.addEventListener('click', async () => {
            const newContent = summaryDiv.textContent || '';
            summaryDiv.setAttribute('contenteditable', 'false');
            editControls.style.display = 'none';
            editControls.classList.remove('visible');
            summaryDiv.classList.remove('editing');

            // Save to cache
            await this.saveToCache(
                btoa(JSON.stringify(this.aiSettings)) + '_' + element.id,
                newContent
            );
        });

        // Cancel button click handler
        cancelButton.addEventListener('click', () => {
            summaryDiv.textContent = originalContent;
            summaryDiv.setAttribute('contenteditable', 'false');
            editControls.style.display = 'none';
            editControls.classList.remove('visible');
            summaryDiv.classList.remove('editing');
        });
    }

    setupIntersectionObserver() {
        if (this.observer) {
            return; // Prevent creating multiple observers
        }

        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const element = entry.target.querySelector('p') || entry.target.querySelector('ul') || entry.target.querySelector('ol') || entry.target.querySelector('table');
                        if (element && !this.summarizedParagraphs.has(element.id)) {
                            this.summarizeParagraph(element);
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

    async summarizeParagraph(element: HTMLElement) {
        // 如果已经在队列中,不要重复添加
        if (this.requestQueue.some((req) => req.paragraph.id === element.id)) {
            return;
        }

        // 创建一个Promise来处理请求
        const requestPromise = new Promise<void>((resolve, reject) => {
            this.requestQueue.push({
                paragraph: element,
                resolve,
                reject,
            });
        });

        // 尝试处理队列
        await this.processQueue();

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
            const settingHashString = btoa(JSON.stringify(this.aiSettings));

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
                        this.aiSettings,
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

    highlightParagraphsForSentence(sentenceIndex: number) {
        const sentenceWithBrackets = this.overallSummarySentences[sentenceIndex];
        const paragraphElements = Array.from(this.findMainContentContainer()?.querySelectorAll('p, ul, ol, table') || []);

        // Reset any previous highlighting
        paragraphElements.forEach(el => {
            el.classList.remove('highlighted-paragraph');
        });
        const activeSentenceDivs = this.sidebar!.querySelectorAll('.overall-summary-item.active');
        activeSentenceDivs.forEach(div => div.classList.remove('active'));

        // Extract paragraph references from the sentence using a regular expression
        const match = sentenceWithBrackets.match(/\[P\d+(-P\d+)?(,P\d+)*\]/g);

        if (match) {
            const allParagraphReferences: number[] = [];
            match.forEach(bracketedRef => {
                const ref = bracketedRef.slice(1, -1); // Remove the square brackets: "P1" or "P3-P5" or "P2,P6"
                if (ref.includes('-')) {
                    // Handle range like "P3-P5"
                    const [start, end] = ref.replaceAll('P', '').split('-').map(Number); // Remove the "P" and split
                    for (let i = start; i <= end; i++) {
                        allParagraphReferences.push(i);
                    }
                } else if (ref.includes(',')) {
                    // Handle multiple references like "P2,P6"
                    const refs = ref.replaceAll('P', '').split(',').map(Number); // Remove the "P" and split
                    allParagraphReferences.push(...refs);
                } else {
                    // Single reference like "P1"
                    allParagraphReferences.push(Number(ref.slice(1))); // Remove the "P"
                }
            });

            // Highlight the referenced paragraphs
            allParagraphReferences.forEach(refIndex => {
                const paragraphIndex = refIndex - 1; // Adjust to 0-based indexing
                if (paragraphIndex >= 0 && paragraphIndex < paragraphElements.length) {
                    paragraphElements[paragraphIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    paragraphElements[paragraphIndex].classList.add('highlighted-paragraph');
                }
            });

            // Add style for highlighted paragraphs
            const style = document.createElement('style');
            style.textContent += `
            .highlighted-paragraph {
                background-color: yellow;
            }
        `;
            document.head.appendChild(style);
        }

        // Highlight the active sentence
        const sentenceDiv = this.sidebar!.querySelectorAll('.overall-summary-item')[sentenceIndex];
        if (sentenceDiv) {
            sentenceDiv.classList.add('active');
        }
    }

    displayOverallSummary(overallSummary: string) {
        if (!this.sidebar) return;

        // Remove the loading spinner
        const loadingSpinner = this.sidebar.querySelector('.sidebar-loading-spinner');
        if (loadingSpinner) {
            loadingSpinner.remove();
        }

        const overallSummarySection = document.createElement('div');
        overallSummarySection.className = 'overall-summary-section';
        overallSummarySection.innerHTML = '<h3>整体总结</h3>';
        this.sidebar.appendChild(overallSummarySection);

        this.overallSummarySentences = overallSummary.split(/\n/).filter(sentence => sentence.trim() !== '');

        this.overallSummarySentences.forEach((sentence, index) => {
            const sentenceDiv = document.createElement('div');
            sentenceDiv.className = 'overall-summary-item';
            sentenceDiv.textContent = sentence;
            sentenceDiv.addEventListener('click', () => this.highlightParagraphsForSentence(index));
            overallSummarySection.appendChild(sentenceDiv);
        });
    }

    async callAIAPI(text: string, settings: any) {
        // 获取元素总结
        const paragraphPrompt = settings.useCustomPrompt
            ? settings.userPrompt.replace('{paragraph}', text)
            : this.getParagraphSummaryPrompt(this.overallSummary!, text);

        return this.callProviderAPI(settings, paragraphPrompt);
    }

    async callProviderAPI(
        settings: any,
        userPrompt: string,
    ) {
        const languageInstruction =
            settings.summaryLanguage === 'auto'
                ? '请使用输入语言输出总结。'
                : `请使用${settings.summaryLanguage}输出总结。`;

        switch (settings.provider) {
            case 'ai302':
                return this.call302AIAPI(settings, userPrompt);
            case 'openai':
                return this.callOpenAIAPI(settings, userPrompt);
            case 'claude':
                return this.callClaudeAPI(settings, userPrompt);
            case 'zhipu':
                return this.callZhipuAPI(settings, userPrompt);
            case 'custom':
                return this.callCustomAPI(settings, userPrompt);
            default:
                return this.callOpenAIAPI(settings, userPrompt);
        }
    }

    async call302AIAPI(settings: any, userPrompt: string) {
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
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            }),
        });
        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callOpenAIAPI(settings: any, userPrompt: string) {
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
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            }),
        });
        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callClaudeAPI(settings: any, userPrompt: string) {
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
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            }),
        });
        const data = await response.json();
        return data.content[0].text;
    }

    async callZhipuAPI(settings: any, userPrompt: string) {
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

    async callCustomAPI(settings: any, userPrompt: string) {
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
                        role: 'user',
                        content: userPrompt,
                    },
                ],
            }),
        });
        const data = await response.json();
        return data.choices[0].message.content;
    }

    displayError(element: HTMLElement) {
        const wrapper = element.closest('.paragraph-wrapper');
        if (!wrapper) return;
        const summaryDiv = wrapper.querySelector('.summary-content');
        if (!summaryDiv) return;
        summaryDiv.innerHTML = `<div class="error-message">总结失败，点击重试</div>`;
        (summaryDiv as HTMLElement).onclick = () => this.summarizeParagraph(element);
    }

    displaySummary(element: HTMLElement, summary: string) {
        const wrapper = element.closest('.paragraph-wrapper');
        if (!wrapper) return;
        const summaryDiv = wrapper.querySelector('.summary-content');
        if (!summaryDiv) return;
        summaryDiv.textContent = summary;
        (summaryDiv as HTMLElement).style.display = 'block';
        element.style.opacity = '0.3';
        this.summarizedParagraphs.add(element.id);
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
        // Disconnect the IntersectionObserver if it exists
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // Clear the request queue
        this.requestQueue = [];
        this.activeRequests = 0;

        // Clear the set of summarized paragraphs
        this.summarizedParagraphs.clear();

        // Remove event listeners from paragraphs
        this.paragraphEventListeners.forEach(({ paragraph, listener }) => {
            paragraph.removeEventListener('click', listener);
        });
        this.paragraphEventListeners = [];

        // Hide all summary divs
        const allWrappers = document.querySelectorAll('.paragraph-wrapper');
        allWrappers.forEach(wrapper => {
            const summaryDiv = wrapper.querySelector('.summary-content');
            if (summaryDiv) {
                (summaryDiv as HTMLElement).style.display = 'none';
                summaryDiv.textContent = '';
            }

            const paragraph = wrapper.querySelector('p');
            if (paragraph) {
                paragraph.style.opacity = '1';
            }
        });

        // Remove the state marker
        const marker = document.getElementById('summary-state-marker');
        if (marker) {
            marker.remove();
        }

        // Remove the sidebar
        if (this.sidebar) {
            this.sidebar.remove();
            this.sidebar = null;
        }

        // Remove highlighted paragraphs
        const highlightedParagraphs = document.querySelectorAll('.highlighted-paragraph');
        highlightedParagraphs.forEach(p => p.classList.remove('highlighted-paragraph'));

        this.overallSummary = null;
        this.overallSummarySentences = [];

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
        const summarizer = ContentSummarizer.getInstance(); // Get the singleton instance

        if (request.action === 'initializeSummary') {
            summarizer.initialize();
        } else if (request.action === 'hideSummaries') {
            summarizer.hideSummaries();
        } else if (request.action === 'checkSummaryState') {
            // Check for the existence of the summary-state-marker
            sendResponse(!!document.getElementById('summary-state-marker'));
        }
    },
);