import { useState, useEffect } from "react";
import { getName, getVersion } from "@tauri-apps/api/app";

const GITHUB_URL = "https://github.com/SoloShine/overlay-todo";

export function About() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-theme to-theme-light flex items-center justify-center text-white text-2xl font-bold shadow-lg">
          S
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">SceneTodo</h2>
          <AppVersion />
        </div>
      </div>

      <section className="mb-6">
        <p className="text-sm text-muted-foreground leading-relaxed">
          SceneTodo 是一款桌面待办事项应用。它可以将待办以浮动 Widget 的形式挂载到关联的桌面软件窗口上 ——
          切换到某个软件时自动显示关联的待办，切走后自动隐藏。
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-theme" />
          使用指南
        </h3>
        <div className="space-y-3 text-sm text-foreground">
          <GuideItem step={1} title="创建待办">
            在主界面底部的输入框中输入待办内容，按回车即可创建。点击待办可展开编辑详情：设置优先级、截止日期、所属分组等。
          </GuideItem>
          <GuideItem step={2} title="管理分组与标签">
            在侧边栏中可以创建分组和标签，将待办归类整理。支持嵌套分组结构。
          </GuideItem>
          <GuideItem step={3} title="创建场景">
            通过侧边栏的"场景"区域创建场景，将待办按使用场景组织。每个场景可以关联不同的应用和待办。
          </GuideItem>
          <GuideItem step={4} title="关联桌面软件">
            进入"设置"页，点击"抓取窗口添加关联软件"，然后点击目标窗口即可自动识别进程。也可以在场景编辑器中关联应用。
          </GuideItem>
          <GuideItem step={5} title="浮动 Widget">
            关联软件后，切换到对应窗口时会自动弹出浮动 Widget，显示关联的待办。Widget 支持拖拽调整位置，可在设置中调整透明度和大小。
          </GuideItem>
          <GuideItem step={6} title="时间追踪与统计">
            应用会自动追踪你在各场景中花费的时间。点击侧边栏的"统计"按钮查看时间分布、实时概览和时间线。
          </GuideItem>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-theme" />
          快捷操作
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <ShortcutItem text="系统托盘" desc="最小化后常驻托盘，右键可退出" />
          <ShortcutItem text="Widget 拖拽" desc="拖拽 Widget 可自定义显示位置" />
          <ShortcutItem text="快速添加" desc="在 Widget 中直接添加新待办" />
          <ShortcutItem text="数据备份" desc="设置页支持导出/导入全部数据" />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-theme" />
          关于
        </h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>基于 Tauri 2.0 + React + Rust 构建</p>
          <p>
            源代码与问题反馈：
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline ml-1"
            >
              {GITHUB_URL}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}

function AppVersion() {
  const [version, setVersion] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("unknown"));
    getName().then(setName).catch(() => setName("SceneTodo"));
  }, []);

  return (
    <p className="text-xs text-muted-foreground">
      {name} v{version}
    </p>
  );
}

function GuideItem({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-theme/10 text-theme text-xs font-semibold flex items-center justify-center">
        {step}
      </div>
      <div>
        <span className="font-medium">{title}</span>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function ShortcutItem({ text, desc }: { text: string; desc: string }) {
  return (
    <div className="p-2 rounded-lg bg-background">
      <span className="font-medium text-foreground">{text}</span>
      <p className="text-muted-foreground mt-0.5">{desc}</p>
    </div>
  );
}
