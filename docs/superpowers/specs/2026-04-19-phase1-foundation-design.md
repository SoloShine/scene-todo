# Phase 1: 基础组件与交互改进

**日期**: 2026-04-19
**范围**: Toast 通知、确认弹窗、空状态、shadcn/ui 组件统一

## 目标

1. 新增 Toast 通知系统，为后续错误处理提供反馈基础设施
2. 为所有破坏性操作添加确认弹窗
3. 为空列表/无结果场景添加友好提示
4. 补齐 shadcn/ui 基础组件，统一项目 UI 组件风格

## 一、shadcn/ui 组件补齐

通过 `npx shadcn@latest add` 添加 9 个组件到 `src/components/ui/`：

| 组件 | 用途 | 替换范围 |
|------|------|----------|
| `sonner` | Toast 通知 | 新增 |
| `alert-dialog` | 确认弹窗 | App.tsx 关闭确认、Settings.tsx 导入确认 + 新增删除确认 |
| `dialog` | 对话框 | SceneEditor、BindingEditor、TodoDetailEditor、App.tsx 关闭弹窗 |
| `input` | 输入框 | TodoForm、TodoItem、TodoList、Sidebar 各列表、Widget、Settings（10+ 处） |
| `badge` | 标签/徽章 | 优先级、标签、场景徽章、统计状态（8 处） |
| `select` | 下拉选择 | Settings 3 处原生 select、SceneEditor App 选择 |
| `checkbox` | 复选框 | TodoDetailEditor 标签、ScenePicker、Widget 过滤、Settings |
| `popover` | 弹出层 | TodoDetailEditor 弹出、Widget 场景选择器 |
| `separator` | 分隔线 | Sidebar、Settings 中的 hr/border 分隔 |

**不在本阶段**: dropdown-menu、tooltip、tabs、context-menu、collapsible、radio-group

## 二、Toast 通知系统

### 技术方案

使用 `sonner` 库（shadcn/ui 官方推荐）。在 `App.tsx` 顶层添加 `<Toaster />`，全局可用。

### 位置与样式

- **位置**: 右下角（避开 Widget 区域）
- **自动消失**: 成功 2s / 信息 3s / 错误需手动关闭
- **主题**: 跟随应用主题色，暗色模式自动适配
- **类型**: success / error / warning / info

### 使用场景

| 场景 | 类型 | 触发点 |
|------|------|--------|
| 创建待办/分组/标签/场景 | success | 各 hook 的 create 方法 |
| 更新成功 | success | 各 hook 的 update 方法 |
| 删除成功 | success | 各 hook 的 remove 方法 |
| API 调用失败 | error | 各 hook 的 catch 分支 |
| 数据导入完成（部分失败） | warning | data_port import |
| 数据导入成功 | success | data_port import |
| 场景切换 | info | WindowMonitor foreground-changed |

### 实现模式

在 `src/lib/` 下创建 `toast.ts` 工具函数，封装 sonner 的调用：

```ts
import { toast } from "sonner"

export const notify = {
  success: (msg: string) => toast.success(msg),
  error: (msg: string) => toast.error(msg, { duration: Infinity }),
  warning: (msg: string, desc?: string) => toast.warning(msg, { description: desc }),
  info: (msg: string) => toast.info(msg),
}
```

各 hook 中在 try/catch 内调用 `notify.success()` / `notify.error()`。

## 三、确认弹窗

### 技术方案

使用 shadcn/ui `AlertDialog` 组件。创建 `src/components/ui/confirm-dialog.tsx` 通用组件。

### ConfirmDialog 接口

```ts
interface ConfirmProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description: string
  confirmText?: string    // 默认 "确认"
  cancelText?: string     // 默认 "取消"
  variant?: "danger" | "warning"  // danger=红色按钮, warning=黄色按钮
}
```

### 触发场景

| 操作 | title | description | variant |
|------|-------|-------------|---------|
| 删除待办 | 删除待办 | 确定要删除「{title}」吗？此操作不可撤销。 | danger |
| 删除分组 | 删除分组 | 确定要删除分组「{name}」吗？组内待办将变为未分组。 | danger |
| 删除标签 | 删除标签 | 确定要删除标签「{name}」吗？关联待办将移除此标签。 | danger |
| 删除场景 | 删除场景 | 确定要删除场景「{name}」吗？关联的 {N} 个待办将移除场景绑定。 | danger |
| 清空已完成 | 清空已完成 | 确定要删除所有已完成的待办吗？共 {N} 项，此操作不可撤销。 | danger |
| 数据导入覆盖 | 导入数据 | 当前数据将被替换为导入内容，建议先导出备份。确定继续？ | warning |

### 替换现有弹窗

- `App.tsx` 关闭确认弹窗：替换手写 overlay + DOM 操作为 Dialog 组件
- `Settings.tsx` 导入确认：替换手写 overlay 为 AlertDialog

## 四、空状态设计

### 技术方案

创建 `src/components/ui/empty-state.tsx` 通用组件。使用 lucide-react 图标 + 引导文案。

### EmptyState 接口

```ts
interface EmptyStateProps {
  icon: React.ReactNode   // lucide-react 图标
  title: string
  description?: string
  action?: React.ReactNode  // 可选的操作按钮
}
```

### 空状态场景

| 场景 | 图标 | title | description |
|------|------|-------|-------------|
| 无待办 | ClipboardList | 还没有待办事项 | 在上方输入框按回车快速添加 |
| 搜索无结果 | Search | 没有找到匹配的待办 | 试试换个关键词搜索 |
| 无分组 | FolderOpen | 还没有分组 | 点击上方 + 创建分组来整理待办 |
| 无标签 | Tag | 还没有标签 | 点击上方 + 创建标签来标记待办 |
| 无场景 | Layers | 还没有场景 | 点击上方 + 创建场景来关联应用 |
| 统计无数据 | BarChart3 | 暂无统计数据 | 开始使用应用后将生成统计信息 |
| Widget 无待办 | CheckSquare | 当前场景没有待办 | 在主窗口中添加待办 |

### 应用位置

- `TodoList.tsx`: 列表为空 / 搜索无结果
- `GroupList.tsx`: 无分组时
- `TagList.tsx`: 无标签时
- `SceneList.tsx`: 无场景时
- `StatsView.tsx`: 日期范围内无数据
- `Widget.tsx`: 场景过滤后无待办

## 五、组件替换细节

### Dialog 替换（4 处手写 overlay）

1. **SceneEditor.tsx** (lines 121-252): overlay + fixed 定位 → `<Dialog>` + `<DialogContent>`
2. **BindingEditor.tsx** (lines 108-125): 手写 overlay → `<Dialog>`
3. **TodoDetailEditor.tsx** (lines 42-103): 手写弹出层 → `<Popover>` + `<PopoverContent>`
4. **App.tsx** (lines 162-210): DOM querySelector + 手写 overlay → `<Dialog>` + `<RadioGroup>`

### Input 替换（10+ 处）

所有 `<input>` 替换为 `<Input />`，保持原有功能不变。涉及文件：
- TodoForm、TodoItem（3 处）、TodoList 搜索
- GroupList、TagList、SceneList 的创建输入
- SceneEditor 名称输入
- Widget 快速添加
- Settings 日期、保留天数、偏移量
- StatsView 日期选择

### Badge 替换（8 处）

所有手写标签样式替换为 `<Badge variant="...">`，统一圆角、字号、内边距：
- TodoItem 优先级（高/中/低）→ `<Badge variant="destructive/secondary/outline">`
- TagList 标签色块 → `<Badge style={{ backgroundColor: tag.color }}>`
- SceneList 场景徽章 → `<Badge>`
- StatsView 追踪状态 → `<Badge variant="secondary">`

### Select 替换（4 处）

原生 `<select>` 替换为 `<Select>` + `<SelectTrigger>` + `<SelectContent>`：
- Settings: 关闭行为、Widget 尺寸、保留天数
- SceneEditor: App 选择

### Checkbox 替换

`<input type="checkbox">` 替换为 `<Checkbox />`：
- TodoDetailEditor 标签选择
- ScenePicker 场景选择
- Widget 场景过滤
- Settings 各开关（不含已有的 switch 样式）

### Popover 替换

- TodoDetailEditor: 手动定位弹出 → `<Popover>` 自动定位
- Widget 场景选择器: 手动下拉 → `<Popover>`

### Separator 替换

`<hr>` 和 `border-b` 分隔线替换为 `<Separator />`：
- Sidebar 各区域之间
- Settings 各设置项之间
- ThemeSettings 分区

## 六、文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/components/ui/sonner.tsx` | shadcn/ui Toaster 组件 |
| `src/components/ui/alert-dialog.tsx` | shadcn/ui AlertDialog 组件 |
| `src/components/ui/dialog.tsx` | shadcn/ui Dialog 组件 |
| `src/components/ui/input.tsx` | shadcn/ui Input 组件 |
| `src/components/ui/badge.tsx` | shadcn/ui Badge 组件 |
| `src/components/ui/select.tsx` | shadcn/ui Select 组件 |
| `src/components/ui/checkbox.tsx` | shadcn/ui Checkbox 组件 |
| `src/components/ui/popover.tsx` | shadcn/ui Popover 组件 |
| `src/components/ui/separator.tsx` | shadcn/ui Separator 组件 |
| `src/components/ui/label.tsx` | shadcn/ui Label 组件（input/checkbox 配套） |
| `src/components/ui/confirm-dialog.tsx` | 自定义确认弹窗组件 |
| `src/components/ui/empty-state.tsx` | 自定义空状态组件 |
| `src/lib/toast.ts` | Toast 通知工具函数 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/App.tsx` | 添加 `<Toaster />`，关闭弹窗改用 Dialog |
| `src/components/todo/TodoList.tsx` | 空状态、搜索框 Input |
| `src/components/todo/TodoItem.tsx` | Badge 优先级、Input 编辑、确认删除 |
| `src/components/todo/TodoForm.tsx` | Input 组件 |
| `src/components/todo/TodoDetailEditor.tsx` | Popover + Checkbox |
| `src/components/todo/CalendarView.tsx` | Badge 优先级色 |
| `src/components/sidebar/Sidebar.tsx` | Separator |
| `src/components/sidebar/GroupList.tsx` | Input + Badge + 空状态 + 删除确认 |
| `src/components/sidebar/TagList.tsx` | Input + Badge + 空状态 + 删除确认 |
| `src/components/sidebar/SceneList.tsx` | Input + Badge + 空状态 + 删除确认 |
| `src/components/scene/SceneEditor.tsx` | Dialog + Input + Select + 删除确认 |
| `src/components/scene/ScenePicker.tsx` | Checkbox |
| `src/components/binding/BindingEditor.tsx` | Dialog |
| `src/components/widget/Widget.tsx` | Input + Badge + Checkbox + Popover + 空状态 |
| `src/components/stats/StatsView.tsx` | Badge + Input 日期 + 空状态 |
| `src/components/settings/Settings.tsx` | Dialog + Input + Select + Checkbox + Separator + 导入确认 |
| `src/components/settings/ThemeSettings.tsx` | Separator |
| `src/hooks/useTodos.ts` | Toast 反馈 |
| `src/hooks/useGroups.ts` | Toast 反馈 + 删除确认 |
| `src/hooks/useTags.ts` | Toast 反馈 + 删除确认 |
| `src/hooks/useScenes.ts` | Toast 反馈 + 删除确认 |
| `src/hooks/useApps.ts` | Toast 反馈 |
| `src/hooks/useTimeStats.ts` | Toast 反馈 |

### 安装依赖

```bash
npm install sonner
npx shadcn@latest add alert-dialog dialog input badge select checkbox popover separator label
```

## 七、不做的项

- 不改变现有业务逻辑
- 不添加新功能（只改进已有功能的反馈和体验）
- 不重构组件内部状态管理
- 不处理动画过渡（Phase 3）
- 不处理错误边界（Phase 2）
- 不替换 dropdown-menu、tooltip、tabs 等（后续阶段）
