# Pivot — AI 原生浏览器

自备 API Key，AI 驱动的新一代浏览器体验。

## 功能

- **多标签页浏览** — 原生 Electron webview，流畅切换
- **AI 侧边栏** — DeepSeek / Claude / OpenAI 任选，流式对话
- **联网深度搜索** — Tavily / SearXNG 后端，检索结果 + AI 综合回答
- **跨标签页操控** — AI 可打开、关闭、切换、读取任意标签页
- **动态主题色** — 让 AI 帮你换主题色
- **Markdown 渲染** — AI 回复支持代码块、表格、列表
- **本地存储** — 书签、历史、设置全存在本地 SQLite
- **可调宽度的侧边栏** — 拖拽调整大小

## 快速开始

```bash
# 安装依赖
npm install
npx electron-rebuild -f -w better-sqlite3

# 构建并启动
npm run build
npm start
```

## 配置

启动后在 **设置 → API Keys** 中配置 AI 模型的 API Key（DeepSeek/Claude/OpenAI）。

在 **设置 → 搜索** 中配置联网搜索后端（Tavily api.tavily.com 注册免费额度 / 自建 SearXNG）。

## 打包发布

```bash
# macOS
npm run dist -- --mac

# Linux (.deb)
npm run dist -- --linux deb

# Windows (需要 wine)
npm run dist -- --win
```

## 技术栈

Electron + React 19 + TypeScript + Tailwind CSS v4 + Vite + SQLite (better-sqlite3)

## License

MIT
