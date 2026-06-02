# 知行合一 · Weekly Planner

一个 AI 驱动的周计划 + 日执行 + 知识复盘工作流系统。

**在线体验：** https://weekly-planner.vercel.app

---

## 功能一览

| 功能 | 说明 |
|------|------|
| **周计划** | 输入每天一个目标，AI 自动生成 10:00-19:00 的小时级任务计划 |
| **日执行** | 按小时查看任务、标记完成、记录备注、逐小时打卡 |
| **知识卡片** | 从打卡笔记中 AI 提取知识点，生成可复习的闪卡 |
| **周回顾** | 完成率统计、时间分配图表、计划偏离分析、知识测验 |
| **本地模板** | 不配置 API 也能用，内置本地计划生成模板 |
| **云端同步** | 可选 Supabase 登录，多设备数据同步 |

---

## 工作流：知行合一闭环

```
周日制定计划 → 每日微调 → 逐小时打卡 → AI 提取知识 → 周六复盘
```

### 第一步：制定周计划

在「周计划」页面，为周一到周五各写一个目标，调整时间预算（默认 5h 深度 + 2h 缓冲 + 2h 休息），点击「AI 生成计划」。

AI 会为每天生成 10:00-19:00 的详细时间表，包含：
- 🔵 **深度工作**（50 分钟/段）— 需要专注的核心任务
- 🟡 **缓冲**（40 分钟/段）— 邮件、会议、杂务
- 🟢 **休息**（10-40 分钟/段）— 午休、茶歇、走动

### 第二步：每日执行

点击某一天进入「今日」页面：
- 查看每小时的任务安排
- 点击任务标记完成，可写完成备注
- 每小时可打卡，记录 3 项自检（任务推进？注意力集中？产出达标？）
- 打卡备注可一键 AI 提取知识点

### 第三步：知识积累

- AI 从你的打卡笔记中提取关键知识点
- 生成问答式闪卡（问题 + 答案 + 标签）
- 支持与 AI 对话深入讨论某张卡片
- 间隔复习调度（掌握度 0-3，复习间隔 1→3→7→21 天）

### 第四步：周回顾

周六在「周回顾」页面查看：
- 整体完成率和每日完成率柱状图
- 时间分配饼图（深度/缓冲/休息）
- 计划偏离度（每天修改了多少次）
- 知识图谱（按标签的掌握度分布）
- 知识测验（随机抽卡，自评 0-3 分）

---

## API 配置（重要）

配置 API 后，AI 功能会使用真实的 LLM 生成计划和知识卡片。不配置则使用内置本地模板（功能可用，但内容是通用模板）。

### 什么是 API？

API（Application Programming Interface）是让程序和 AI 模型对话的接口。你需要一个 AI 服务商提供的 **API 地址** 和 **API Key**，本应用就能调用 AI 来生成计划。

### 以 DeepSeek 为例的配置步骤

#### 第 1 步：注册 DeepSeek 账号

打开 https://platform.deepseek.com ，注册账号并登录。

#### 第 2 步：获取 API Key

1. 登录后进入「API Keys」页面（左侧菜单）
2. 点击「创建 API Key」
3. 复制生成的 Key（格式类似 `sk-xxxxxxxxxxxxxxxxxxxxxxxx`）

> ⚠️ Key 只显示一次，务必立即复制保存。如果丢失，删除后重新创建即可。

#### 第 3 步：充值

DeepSeek API 是按量付费的（非常便宜，一次周计划生成大约 ¥0.01）。在「费用中心」充值几块钱即可。

#### 第 4 步：在应用中填写

打开应用 → 右上角设置 ⚙️ → API 配置：

| 字段 | 填写内容 |
|------|----------|
| **API Endpoint** | `https://api.deepseek.com` |
| **API Key** | 粘贴你刚才复制的 Key |
| **Model** | `deepseek-chat` |

填完后点击「保存设置」，然后点「测试连接」验证是否配置成功。

### 其他服务商配置参考

| 服务商 | API Endpoint | Model |
|--------|-------------|-------|
| **OpenAI** | `https://api.openai.com` | `gpt-4o` |
| **DeepSeek** | `https://api.deepseek.com` | `deepseek-chat` |
| **通义千问** | `https://dashscope.aliyuncs.com/compatible-mode` | `qwen-plus` |
| **硅基流动** | `https://api.siliconflow.cn` | `Qwen/Qwen2.5-7B-Instruct` |
| **本地模型** | `http://localhost:11434` | `llama3` |

> 所有兼容 OpenAI Chat Completions 接口的服务都可以使用。只需填对 Endpoint、Key 和 Model 名称。

### 填写注意事项

- **API Endpoint** 只需填到域名即可，不需要加 `/v1/chat/completions`，应用会自动补全
- **API Key** 以 `sk-` 开头，是一长串字符，不要多复制空格
- **Model** 必须是该服务商支持的模型名称，区分大小写
- 填完后一定要点「保存设置」再点「测试连接」

---

## 四个页面说明

### 📋 周计划（首页）

- 左右箭头切换周
- 为每天填写一个核心目标
- 滑块调整时间预算（深度/缓冲/休息，总和 9 小时）
- 点击「AI 生成计划」生成一周的任务安排
- 查看每天的任务预览（最多显示 5 个时间段）
- 点击某天的 📅 图标进入详细日计划

### 📅 今日（日计划）

- 10:00-19:00 的时间网格
- 每个时间段显示任务类型、描述、时间
- 点击任务 → 标记完成（可写备注）
- 编辑按钮 → 修改任务内容、时间、类型
- 每小时打卡按钮 → 3 项自检 + 备注
- 「每日安排」折叠区 → 单独为今天 AI 生成计划
- 底部一句话总结

### 🧠 知识卡片

- 搜索、按标签筛选
- 点击卡片翻转查看答案
- 与 AI 对话深入讨论某张卡片
- 掌握度评分（0-3），影响复习间隔
- AI 生成 / 手动添加

### 📊 周回顾

- 整体完成率环形图
- 每日完成率柱状图
- 时间分配饼图
- 计划偏离度柱状图
- 知识图谱（标签分布、掌握度）
- 知识测验（随机抽卡 + 自评）

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

开发模式下，API 请求通过 Vite 内置代理转发，无需额外配置 CORS。

---

## 项目结构

```
weekly-planner/
├── api/
│   └── llm.js                  # Vercel Serverless CORS 代理
├── src/
│   ├── App.tsx                 # 路由定义
│   ├── main.tsx                # 入口
│   ├── theme.ts                # MUI 主题
│   ├── types.ts                # 类型定义和常量
│   ├── components/
│   │   ├── Layout.tsx          # 应用壳（头部+底部导航）
│   │   ├── BottomNav.tsx       # 底部 4 tab 导航
│   │   ├── TimeBlock.tsx       # 时间段组件
│   │   ├── KnowledgeCard.tsx   # 知识卡片组件
│   │   └── CardChatDialog.tsx  # 卡片对话弹窗
│   ├── pages/
│   │   ├── WeeklyPlanner.tsx   # 周计划页
│   │   ├── DailySchedule.tsx   # 日计划页
│   │   ├── KnowledgeCards.tsx  # 知识卡片页
│   │   ├── WeeklyReview.tsx    # 周回顾页
│   │   ├── Settings.tsx        # 设置页
│   │   └── Login.tsx           # 登录页
│   └── data/
│       ├── aiService.ts        # LLM API 调用
│       ├── aiSimulation.ts     # 本地模板生成（无 API 时使用）
│       ├── storage.ts          # 数据存储（localStorage + Supabase）
│       ├── sampleData.ts       # 示例数据
│       └── tokenUsage.ts       # Token 用量统计
├── vercel.json                 # Vercel 部署配置
├── vite.config.ts              # Vite 配置
└── package.json
```

---

## 技术栈

- **前端：** React 18 + TypeScript + Vite 5
- **UI：** Material UI 5 + Tailwind CSS 4
- **图表：** Recharts
- **路由：** React Router 6
- **日期：** date-fns
- **后端（可选）：** Supabase（认证 + 数据同步）
- **部署：** Vercel（静态 + Serverless Function）

---

## 数据存储

- **默认：** 数据存在浏览器 localStorage，不联网也能用
- **可选：** 配置 Supabase 后可登录账号，数据自动同步到云端
- **API Key：** 存在用户浏览器本地，不会上传到任何服务器

---

## FAQ

**Q: 不配置 API 能用吗？**
A: 能。不配置 API 时，AI 生成计划会使用内置本地模板。内容是通用的（按周一调研、周三编码、周五部署的节奏），不如真实 AI 针对性强，但基本功能完整。

**Q: API 调用大概花多少钱？**
A: 以 DeepSeek 为例，生成一周计划约 5 次 API 调用，总 token 约 5000，费用约 ¥0.01。知识卡片生成约 ¥0.001/张。非常便宜。

**Q: 我的数据安全吗？**
A: API Key 只存在你的浏览器本地。即使部署到公开网站，别人也拿不到你的 Key。用户数据如果配置了 Supabase，有行级安全策略（RLS），每人只能读自己的数据。

**Q: 支持哪些 AI 模型？**
A: 所有兼容 OpenAI Chat Completions 接口的模型都支持，包括 OpenAI、DeepSeek、通义千问、硅基流动、本地 Ollama 等。

**Q: 为什么生成的计划每天看起来差不多？**
A: 检查控制台（F12）的日志。如果看到红色的「API 调用失败」，说明 API 配置有误或余额不足，应用回退到了本地模板。按上面的配置步骤检查 Endpoint、Key 和 Model。

---

## License

MIT
