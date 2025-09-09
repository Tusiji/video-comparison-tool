chrome.action.onClicked.addListener((tab) => {
  const extensionPageUrl = chrome.runtime.getURL('index.html');
  
  // Check if a tab with the extension's page is already open
  chrome.tabs.query({ url: extensionPageUrl }, (tabs) => {
    if (tabs.length > 0) {
      // If it's open, focus on that tab and its window
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      // If not, open a new tab
      chrome.tabs.create({ url: extensionPageUrl });
    }
  });
});
