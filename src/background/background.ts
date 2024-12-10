chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'summarizeContent',
        title: '页面总结',
        contexts: ['page'],
    });
});

// 在标签页激活时更新菜单状态
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await updateMenuState(activeInfo.tabId);
});

// 在标签页URL更新时更新菜单状态
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        await updateMenuState(tabId);
    }
});

async function updateMenuState(tabId: number) {
    chrome.tabs.sendMessage(tabId, { action: 'checkSummaryState' }, (isShowing) => {
        console.log('showing', isShowing);




        if (chrome.runtime.lastError) return;

        chrome.contextMenus.update('summarizeContent', {
            title: isShowing ? '隐藏总结' : '页面总结',
        });
    });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'summarizeContent' && tab && tab.id && tab.url) {
        chrome.tabs.sendMessage(tab.id, { action: 'checkSummaryState' }, (isShowing) => {
            if (chrome.runtime.lastError) return;

            chrome.tabs.sendMessage(tab.id!, {
                action: isShowing ? 'hideSummaries' : 'initializeSummary',
            });
            updateMenuState(tab.id!);
        });
    }

});