// Browser automation agent using puppeteer-core + Electron's BrowserView/webContents:
import { ipcMain, BrowserWindow } from "electron";

export interface AgentAction {
  type: "navigate" | "click" | "type" | "extract" | "wait" | "scroll";
  params: Record<string, any>;
}

export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: string; // base64
}

export class BrowserAgent {
  private tabId: string;
  private webContentsId: number | null = null;

  constructor(tabId: string) {
    this.tabId = tabId;
  }

  // This method should be called by the renderer when the webview mounts to set the webContentsId
  setWebContentsId(webContentsId: number) {
    this.webContentsId = webContentsId;
  }

  private async getWebContents(): Promise<Electron.WebContents | null> {
    if (!this.webContentsId) return null;
    try {
      const { webContents } = require('electron');
      const wc = webContents.fromId(this.webContentsId);
      return wc || null;
    } catch (e) {
      console.error('Failed to get webContents by id:', e);
      return null;
    }
  }

  async execute(actions: AgentAction[]): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    for (const action of actions) {
      let result: AgentResult = { success: false };
      try {
        switch (action.type) {
          case "navigate": {
            const url = action.params.url as string;
            // We need to navigate via tabManager, but we don't have access here.
            // Instead, we will send an IPC to the main process to navigate the tab.
            // However, the agent is in the main process, so we can import tabManager.
            // But note: the agent is instantiated in the main process, so we can use tabManager directly.
            // However, we don't want to create a circular dependency. Let's assume we can import it.
            // We'll import tabManager and use it to navigate.
            const { tabManager } = await import('../browser/tab-manager');
            tabManager.navigate(this.tabId, url);
            // Wait for navigation to complete (we can wait for a load event, but for simplicity, we'll wait a bit)
            await new Promise(resolve => setTimeout(resolve, 2000));
            result = { success: true };
            break;
          }
          case "click": {
            const selector = action.params.selector as string;
            const webContents = await this.getWebContents();
            if (!webContents) throw new Error('WebContents not available');
            // Inject a click script
            await webContents.executeJavaScript(`
              (() => {
                const el = document.querySelector("${selector}");
                if (el) {
                  el.click();
                  return true;
                }
                return false;
              })()
            `);
            result = { success: true };
            break;
          }
          case "type": {
            const selector = action.params.selector as string;
            const text = action.params.text as string;
            const webContents = await this.getWebContents();
            if (!webContents) throw new Error('WebContents not available');
            await webContents.executeJavaScript(`
              (() => {
                const el = document.querySelector("${selector}");
                if (el) {
                  el.value = "${text}";
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                  return true;
                }
                return false;
              })()
            `);
            result = { success: true };
            break;
          }
          case "extract": {
            const webContents = await this.getWebContents();
            if (!webContents) throw new Error('WebContents not available');
            const text = await webContents.executeJavaScript('document.body.innerText');
            result = { success: true, data: text };
            break;
          }
          case "wait": {
            const ms = action.params.ms as number || 1000;
            await new Promise(resolve => setTimeout(resolve, ms));
            result = { success: true };
            break;
          }
          case "scroll": {
            const x = action.params.x as number || 0;
            const y = action.params.y as number || 0;
            const webContents = await this.getWebContents();
            if (!webContents) throw new Error('WebContents not available');
            await webContents.executeJavaScript(`window.scrollBy(${x}, ${y});`);
            result = { success: true };
            break;
          }
          default:
            result = { success: false, error: `Unknown action type: ${action.type}` };
        }
      } catch (e) {
        result = { success: false, error: (e as Error).message };
      }
      results.push(result);
    }

    return results;
  }

  async getPageContent(): Promise<string> {
    const webContents = await this.getWebContents();
    if (!webContents) throw new Error('WebContents not available');
    const text = await webContents.executeJavaScript('document.body.innerText');
    // Convert to clean text/markdown (simple version: just return the text)
    return text;
  }

  async fillForm(fields: Record<string, string>): Promise<void> {
    const webContents = await this.getWebContents();
    if (!webContents) throw new Error('WebContents not available');
    for (const [selector, value] of Object.entries(fields)) {
      await webContents.executeJavaScript(`
        (() => {
          const el = document.querySelector("${selector}");
          if (el) {
            el.value = "${value}";
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        })()
      `);
    }
  }

  async clickElement(selector: string): Promise<void> {
    const webContents = await this.getWebContents();
    if (!webContents) throw new Error('WebContents not available');
    await webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector("${selector}");
        if (el) {
          el.click();
          return true;
        }
        return false;
      })()
    `);
  }

  async takeScreenshot(): Promise<string> {
    const webContents = await this.getWebContents();
    if (!webContents) throw new Error('WebContents not available');
    // Capture page screenshot — capturePage returns NativeImage
    const img = await webContents.capturePage();
    // Convert to base64
    const screenshotBase64 = img.toDataURL();
    return screenshotBase64;
  }
}