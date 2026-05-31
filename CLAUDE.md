# Tabby — AI 原生浏览器

## 技术栈

- Electron 34+ (主进程)
- React 19 + Tailwind 4 + Vite (渲染进程)
- Zustand (状态管理)
- better-sqlite3 (本地数据)
- Vercel AI SDK (统一多模型 API)
- puppeteer-core (浏览器内 Agent)
- electron-builder (打包分发)

## 核心约束

- **自备 API Key**：所有 AI 请求走用户自己的 API Key，零第三方中转
- **数据全本地**：书签、历史、配置存本地 SQLite，不上传
- **框架窗口**：使用 `titleBarStyle: "hiddenInset"` 实现 macOS 原生无边框
- **安全性**：webview 内容与渲染进程隔离，preload 暴露有限 API

## 开发命令

```bash
npm install           # 安装依赖
npm run dev           # 开发模式（主进程 + 渲染进程热更新）
npm run build         # 构建
npm start             # 启动
npm run dist          # 打包分发
```

## 架构

### 三进程模型

```
主进程 (Node.js) ←IPC→ 预加载脚本 ←contextBridge→ 渲染进程 (React)
    │                                                   │
    ├── tab-manager.ts                              Browser 组件
    ├── ai/engine.ts                                AI 侧边栏
    ├── storage/db.ts                               Settings 面板
    └── skills/loader.ts                            Skills 管理
```

### AI 引擎

`src/main/ai/engine.ts` 是核心，负责：
1. 收集当前标签页内容（markdown 转换）
2. 合并最近标签页上下文
3. 调用对应 provider（DeepSeek/Claude/OpenAI）
4. 流式返回渲染进程

### Providers

每个 provider 实现 `AIProvider` 接口：
```typescript
interface AIProvider {
  chat(messages: Message[], opts?: ChatOptions): Promise<Response>
  stream(messages: Message[], opts?: ChatOptions): AsyncIterable<Chunk>
}
```

### Skills

兼容 OpenClaw skill 格式的 yaml，存储在 `skills/` 目录：
```yaml
name: summarize
description: 总结当前页面内容
prompt: 请用300字以内总结以下内容的核心要点：
```

## 实现顺序

### Phase 1 — 浏览器能跑（先做这个）
1. `package.json` + 配置文件 ✅
2. `src/main/index.ts` — Electron 窗口创建 ✅
3. `src/preload/bridge.ts` — IPC 暴露给渲染进程
4. `src/renderer/main.tsx` + `App.tsx` — React 入口
5. `src/renderer/components/Browser/*` — 浏览器壳（TabBar, AddressBar, WebView, NavControls）
6. `src/main/browser/tab-manager.ts` — 标签页增删改查
7. `vite.config.ts` — Vite 配置

### Phase 2 — AI 接入
8. `src/main/ai/providers/base.ts` — Provider 接口定义
9. `src/main/ai/providers/deepseek.ts` + `claude.ts` + `openai.ts`
10. `src/main/ai/engine.ts` — AI 调度引擎
11. `src/main/ai/context.ts` — 多标签页上下文收集
12. `src/renderer/components/AI/*` — AI 侧边栏 UI

### Phase 3 — 本地存储
13. `src/main/storage/schema.ts` — SQLite 表结构
14. `src/main/storage/db.ts` — 数据库操作封装
15. `src/main/storage/migration.ts` — 数据迁移

### Phase 4 — 设置与 Skills
16. `src/renderer/components/Settings/*` — API Key 配置 UI
17. `src/main/skills/loader.ts` — Skill 加载器
18. `src/renderer/components/Skills/*` — Skills 管理界面

### Phase 5 — Agent 与自动化
19. `src/main/ai/agent.ts` — 浏览器 Agent（puppeteer-core）
20. Skills 兼容 OpenClaw 格式

## 重要 API

### IPC 通道

| channel | 方向 | 说明 |
|---------|------|------|
| `tab:create` | renderer→main | 新建标签页 |
| `tab:navigate` | renderer→main | 导航到 URL |
| `tab:close` | renderer→main | 关闭标签页 |
| `tab:list` | renderer→main | 获取所有标签页 |
| `ai:chat` | renderer→main | AI 对话（流式返回） |
| `ai:context` | renderer→main | 获取当前页上下文 |
| `settings:get` | renderer→main | 读取配置 |
| `settings:set` | renderer→main | 写入配置 |
| `bookmark:list` | renderer→main | 获取书签 |
| `bookmark:add` | renderer→main | 添加书签 |
| `history:search` | renderer→main | 搜索历史 |

### Settings 存储

```json
{
  "providers": {
    "deepseek": { "apiKey": "", "model": "deepseek-v4-flash", "baseUrl": "https://api.deepseek.com" },
    "claude": { "apiKey": "", "model": "claude-sonnet-4-6" },
    "openai": { "apiKey": "", "model": "gpt-4o" }
  },
  "defaultProvider": "deepseek",
  "theme": "system",
  "searchEngine": "google",
  "downloadPath": "~/Downloads"
}
```

## 新建文件时的规范

- 主进程文件放 `src/main/`，渲染进程放 `src/renderer/`
- IPC handlers 放 `src/main/ipc/handlers.ts`
- React 组件用 `export default function ComponentName()`
- 样式用 Tailwind 类，不写独立 CSS 文件
- AI Provider 名称用小写，文件名与 provider 名一致
