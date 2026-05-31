import { tabManager } from "../browser/tab-manager";
import { BrowserWindow } from "electron";

export interface TabContent {
  url: string;
  title: string;
  content: string; // markdown/plain text content of the page
}

/**
 * Get content from a specific tab by ID
 * @param tabId The ID of the tab to get content from
 * @param mainWindow The main BrowserWindow instance (needed for webContents access)
 * @returns Promise resolving to TabContent or null if tab not found
 */
export async function getPageContent(tabId: string, mainWindow: BrowserWindow): Promise<TabContent | null> {
  const tab = tabManager.getAll().find((t) => t.id === tabId);
  if (!tab) return null;

  // Attempt to extract page content from the renderer's webview
  try {
    const extractScript = `
      (() => {
        const getVisibleText = function() {
          const clone = document.documentElement.cloneNode(true);
          const scripts = clone.querySelectorAll('script, style');
          scripts.forEach(function(el) { el.remove(); });
          return clone.innerText || clone.textContent || '';
        };
        return getVisibleText();
      })()
    `;

    const content = await mainWindow.webContents.executeJavaScript(extractScript);

    return {
      url: tab.url,
      title: tab.title,
      content: content || "(无法获取页面内容)",
    };
  } catch (error) {
    console.error("Failed to get page content:", error);
    return {
      url: tab.url,
      title: tab.title,
      content: "(获取页面内容时出错)",
    };
  }
}

/**
 * Get combined content from multiple tabs
 * @param tabIds Array of tab IDs to collect content from
 * @param mainWindow The main BrowserWindow instance
 * @returns Promise resolving to array of TabContent
 */
export async function getCombinedContext(tabIds: string[], mainWindow: BrowserWindow): Promise<TabContent[]> {
  const results: TabContent[] = [];
  for (const tabId of tabIds) {
    const content = await getPageContent(tabId, mainWindow);
    if (content) {
      results.push(content);
    }
  }
  return results;
}

/**
 * Get content from the currently active tab
 * @param mainWindow The main BrowserWindow instance
 * @returns Promise resolving to TabContent or null
 */
export async function getActiveContext(mainWindow: BrowserWindow): Promise<TabContent | null> {
  const activeTabId = tabManager.getActiveId();
  if (!activeTabId) return null;
  return getPageContent(activeTabId, mainWindow);
}
