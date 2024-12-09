// src/background/background.ts
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'summarizeContent',
        title: '页面总结',
        contexts: ['page'],
    });
});

// 在标签页激活时更新菜单状态
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
        updateMenuState(tab.url);
    }
});

// 在标签页URL更新时更新菜单状态
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        updateMenuState(tab.url!);
    }
});

async function updateMenuState(url: string) {
    const key = `menuState_${url}`;
    const result = await chrome.storage.local.get(key);
    const showing = result[key] || false;

    chrome.contextMenus.update('summarizeContent', {
        title: showing ? '隐藏总结' : '页面总结',
    });
}

chrome.runtime.onMessage.addListener(async (request, sender) => {
    if (request.action === 'updateContextMenu' && sender.tab?.url) {
        const url = sender.tab.url;
        const key = `menuState_${url}`;
        await chrome.storage.local.set({ [key]: request.hasSummaries });

        chrome.contextMenus.update('summarizeContent', {
            title: request.hasSummaries ? '隐藏总结' : '页面总结',
        });
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'summarizeContent' && tab && tab.id && tab.url) {
        const key = `menuState_${tab.url}`;
        chrome.storage.local.get(key, (result) => {
            const showing = result[key] || false;
            chrome.tabs.sendMessage(tab.id!, {
                action: showing ? 'hideSummaries' : 'initializeSummary',
            });
        });
    }
});