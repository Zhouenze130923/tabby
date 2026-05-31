"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    // 标签页管理
    tab: {
        create: (url) => electron_1.ipcRenderer.invoke("tab:create", url),
        navigate: (id, url) => electron_1.ipcRenderer.invoke("tab:navigate", id, url),
        close: (id) => electron_1.ipcRenderer.invoke("tab:close", id),
        back: (id) => electron_1.ipcRenderer.invoke("tab:back", id),
        forward: (id) => electron_1.ipcRenderer.invoke("tab:forward", id),
        reload: (id) => electron_1.ipcRenderer.invoke("tab:reload", id),
        list: () => electron_1.ipcRenderer.invoke("tab:list"),
        activate: (id) => electron_1.ipcRenderer.invoke("tab:activate", id),
        onUpdate: (cb) => {
            const handler = (_event, tabs) => cb(tabs);
            electron_1.ipcRenderer.on("tab:updated", handler);
            return () => electron_1.ipcRenderer.removeListener("tab:updated", handler);
        },
        getContent: (id) => electron_1.ipcRenderer.invoke("tab:getContent", id),
        /** 同步 webview 导航事件产生的元数据（不触发 tab:updated 推送，避免循环） */
        updateMeta: (id, updates) => electron_1.ipcRenderer.invoke("tab:updateMeta", id, updates),
    },
    // AI
    ai: {
        chat: (messages, provider) => electron_1.ipcRenderer.invoke("ai:chat", messages, provider),
        stream: (messages, provider) => electron_1.ipcRenderer.invoke("ai:stream", messages, provider),
        context: () => electron_1.ipcRenderer.invoke("ai:context"),
    },
    // 设置
    settings: {
        get: () => electron_1.ipcRenderer.invoke("settings:get"),
        set: (key, value) => electron_1.ipcRenderer.invoke("settings:set", key, value),
        getProvider: (name) => electron_1.ipcRenderer.invoke("settings:getProvider", name),
        setProvider: (name, config) => electron_1.ipcRenderer.invoke("settings:setProvider", name, config),
    },
    // 书签 & 历史
    bookmark: {
        list: () => electron_1.ipcRenderer.invoke("bookmark:list"),
        add: (url, title) => electron_1.ipcRenderer.invoke("bookmark:add", url, title),
        remove: (id) => electron_1.ipcRenderer.invoke("bookmark:remove", id),
    },
    history: {
        search: (query) => electron_1.ipcRenderer.invoke("history:search", query),
    },
    // Skills
    skills: {
        list: () => electron_1.ipcRenderer.invoke("skills:list"),
        run: (name) => electron_1.ipcRenderer.invoke("skills:run", name),
    },
    // 窗口控制
    window: {
        minimize: () => electron_1.ipcRenderer.invoke("window:minimize"),
        maximize: () => electron_1.ipcRenderer.invoke("window:maximize"),
        close: () => electron_1.ipcRenderer.invoke("window:close"),
        isMaximized: () => electron_1.ipcRenderer.invoke("window:isMaximized"),
        onMaximizedChange: (cb) => {
            electron_1.ipcRenderer.on("window:maximizedChanged", (_event, maximized) => cb(maximized));
        },
    },
};
electron_1.contextBridge.exposeInMainWorld("tabby", api);
//# sourceMappingURL=bridge.js.map