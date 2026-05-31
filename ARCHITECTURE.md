# Tabby — AI 原生浏览器

> 比 Tabbit 更强大的 AI 浏览器，自备 API Key，数据全本地。
> 基于 Electron + Chromium + 自研 AI 引擎。

## 技术栈

| 层 | 技术 | 理由 |
|----|------|------|
| 壳 | **Electron 34+** | Chromium 内核，跨平台 |
| UI | **React 19 + Tailwind 4** | 高性能，组件化 |
| 状态 | **Zustand** | 轻量，比 Redux 简单 |
| AI SDK | **Vercel AI SDK** | 统一 OpenAI/Anthropic/DeepSeek 接口 |
| 本地存储 | **SQLite (better-sqlite3)** + **IndexedDB** | 历史、书签、配置 |
| 自动化 | **Puppeteer-core** | 浏览器内部直接操控 |
| 打包 | **electron-builder** | 分发 .dmg / .exe |

## 目录结构

```
tabby/
├── package.json
├── electron-builder.yml
├── tailwind.config.js
├── tsconfig.json
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 入口：窗口创建、菜单
│   │   ├── browser/             # 浏览器引擎封装
│   │   │   ├── tab-manager.ts   # 标签页管理
│   │   │   ├── bookmark.ts      # 书签系统
│   │   │   └── history.ts       # 历史记录
│   │   ├── ai/                  # AI 引擎（主进程）
│   │   │   ├── engine.ts        # AI 调度核心
│   │   │   ├── providers/       # 各模型适配器
│   │   │   │   ├── base.ts
│   │   │   │   ├── deepseek.ts
│   │   │   │   ├── claude.ts
│   │   │   │   └── openai.ts
│   │   │   ├── context.ts      # 多标签页上下文合并
│   │   │   └── agent.ts        # 浏览器 Agent
│   │   ├── storage/             # 本地数据
│   │   │   ├── db.ts            # SQLite 初始化
│   │   │   ├── schema.ts        # 数据库表结构
│   │   │   └── migration.ts     # 迁移脚本
│   │   ├── skills/              # Skills 引擎
│   │   │   ├── loader.ts        # 加载 skill 文件
│   │   │   ├── sandbox.ts       # 安全沙箱
│   │   │   └── registry.ts      # Skill 注册表
│   │   └── ipc/                 # IPC 通道定义
│   │       └── handlers.ts
│   │
│   ├── preload/                 # 预加载脚本
│   │   └── bridge.ts            # contextBridge API
│   │
│   └── renderer/                # 渲染进程（React）
│       ├── index.html
│       ├── main.tsx             # React 入口
│       ├── App.tsx              # 根组件
│       ├── components/
│       │   ├── Browser/         # 浏览器壳
│       │   │   ├── TabBar.tsx       # 标签栏
│       │   │   ├── AddressBar.tsx   # 地址栏
│       │   │   ├── NavControls.tsx  # 前进/后退/刷新
│       │   │   └── WebView.tsx      # 网页视图
│       │   ├── AI/              # AI 面板
│       │   │   ├── SidePanel.tsx    # 侧边栏
│       │   │   ├── ChatView.tsx     # 对话界面
│       │   │   ├── ContextBar.tsx   # 当前页上下文
│       │   │   └── SelectionToolbar.tsx  # 划词工具栏
│       │   ├── Skills/          # Skills 管理
│       │   │   ├── SkillList.tsx
│       │   │   └── SkillEditor.tsx
│       │   └── Settings/        # 设置
│       │       ├── APIKeys.tsx
│       │       ├── Models.tsx
│       │       └── General.tsx
│       ├── stores/
│       │   ├── browser.ts       # 浏览器状态
│       │   ├── ai.ts            # AI 状态
│       │   ├── settings.ts      # 配置状态
│       │   └── skills.ts        # Skills 状态
│       └── styles/
│           └── globals.css
│
├── skills/                      # 默认内置 Skills（可编辑）
│   ├── summarize.yaml           # 网页摘要
│   ├── translate.yaml           # 划词翻译
│   └── agent-form.yaml          # 表单自动填写
│
└── resources/
    └── icon.png
```

## 核心功能清单

### MVP（先做这些）

- [x] Electron 窗口 + Chromium 网页浏览
- [x] 标签页管理（新建/关闭/切换）
- [x] 地址栏 + 导航按钮
- [x] AI 侧边栏（与当前页对话）
- [x] 多标签页上下文合并（跨标签页提问）
- [x] 划词解释 / 翻译
- [x] 多模型支持（DeepSeek / Claude / OpenAI）
- [x] API Key 本地配置
- [x] 设置面板

### V2（后续）

- [ ] 浏览器 Agent（自动执行网页操作）
- [ ] Skills 系统（兼容 OpenClaw 格式）
- [ ] 标签页自动分组（AI 归类）
- [ ] 网页快照 + 全文检索
- [ ] 妙招（录制的自动化流程）

## 数据流

```
用户输入（地址栏 / AI 对话 / 划词）
        │
        ▼
    IPC Bridge (preload/bridge.ts)
        │
        ▼
    Electron 主进程
        ├── 浏览器操作 → tab-manager → webview
        └── AI 请求 → engine.ts → provider → API
                             │
                             ▼
                        context.ts (收集当前标签页内容)
```

## AI 引擎设计

```typescript
// 核心接口
interface AIProvider {
  chat(messages: Message[], opts?: ChatOptions): Promise<Response>
  stream(messages: Message[], opts?: ChatOptions): AsyncIterable<Chunk>
}

// 上下文收集
interface BrowserContext {
  activeTab: {
    url: string
    title: string
    content: string      // 页面正文（markdown）
    selection?: string   // 当前选中文字
  }
  recentTabs: Array<{    // 前10个标签页
    url: string
    title: string
    content: string
  }>
  screenshot?: string    // 当前页截图（base64）
}
```
