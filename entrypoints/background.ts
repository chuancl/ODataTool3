import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import { isODataUrl, getSettings, isWhitelisted } from '@/utils/storage';

export default defineBackground(() => {
  console.log('OData Master Background Service Started');

  // 监听 Tab 更新
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      const settings = await getSettings();
      
      // 如果禁用了自动检查，且不在白名单中，则忽略
      const isInWhitelist = await isWhitelisted(tab.url);
      if (!settings.autoDetect && !isInWhitelist) {
        return;
      }

      // 执行简单的 URL 规则检查，更复杂的检查在 Dashboard 中通过 fetch 实现
      if (tab.url.includes('$metadata') || tab.url.includes('.svc') || isInWhitelist) {
        // 这里可以添加逻辑：如果确认为 OData，显示 Page Action 或通知
        // 为了避免无限跳转循环，我们不在 Background 做强制跳转，
        // 而是推荐用户点击图标，或者在 Content Script 中检测后通知 Background 打开 Dashboard
        console.log("Potential OData URL detected:", tab.url);
      }
    }
  });
});