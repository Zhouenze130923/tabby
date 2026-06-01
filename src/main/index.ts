import { app, BrowserWindow, session } from "electron";
import path from "path";
import { registerHandlers } from "./ipc/handlers";
import { taskScheduler } from "./tasks/scheduler";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "../preload/bridge.js"),
      webviewTag: true,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  registerHandlers(mainWindow!);
  // 只对主窗口（非 webview）的请求添加 CSP
  // webview 加载的网页使用它们自身的 CSP
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // 来自 webview 的请求不干预 CSP
    if (details.webContents?.getType() === "webview") {
      callback({});
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' http://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:* https://api.deepseek.com https://api.anthropic.com https://api.openai.com https://api.tavily.com https:;"
        ],
      },
    });
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
