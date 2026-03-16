# Zotero SI DOCX to PDF

一个面向 Zotero 8 的插件，用于自动识别条目下的 DOC 或 DOCX 补充信息附件，并在满足条件时转换为 PDF、导入回当前条目并按模板重命名。

## 建议仓库名

`zotero-si-docx-to-pdf`

## 简介

当条目下已经存在 PDF 附件时，插件会监听新加入的 `.doc` / `.docx` 附件；如果该附件符合你的规则，就自动调用 Microsoft Word 或 LibreOffice 转换为 PDF，再将生成的 PDF 导入到原条目中。适合整理 SI、补充实验信息、投稿附件等场景。

## 主要功能

- 监听 Zotero 新增附件事件，自动处理符合条件的 DOC / DOCX 附件
- 支持 `auto`、`LibreOffice`、`Microsoft Word (Windows)` 三种转换后端
- 可按 Zotero 文件重命名模板自动生成导入后的 PDF 标题
- 可选按关键字筛选待处理附件
- 可选备份并删除原始 Word 附件
- 支持中英文界面文本

## 处理规则

插件默认按以下逻辑工作：

1. 监听新加入的附件项目
2. 仅处理有父条目的 `.doc` / `.docx` 附件
3. 仅在父条目下已存在其他 PDF 附件时触发转换
4. 转换成功后导入 PDF，并按模板重命名
5. 如果启用了相关选项，则备份并删除原 Word 文件

## 目录结构

- `addon/`：插件清单、首选项界面、图标和本地化资源
- `src/`：TypeScript 源码
- `src/modules/converter.ts`：Word / LibreOffice 转换逻辑
- `src/modules/processor.ts`：附件筛选、转换结果导入、备份与删除
- `src/modules/listener.ts`：Zotero 通知监听与任务调度
- `src/modules/ui.ts`：首选项面板注册
- `src/modules/config.ts`：默认配置与参数读取
- `typings/`：Zotero 相关类型声明

## 开发与构建

```bash
npm ci
npm run build
```

常用命令：

- `npm run start`：启动插件开发环境
- `npm run build`：构建 `.xpi` 并执行 TypeScript 类型检查
- `npm run lint:check`：检查格式和 ESLint
- `npm run lint:fix`：自动修复格式和部分 lint 问题

## 隐私与可移植性

- 仓库中不应提交 `.env`、`node_modules/`、`.scaffold/`、`dist/` 等本地构建产物
- 代码中的开发配置示例使用占位路径，不依赖本机目录
- 运行日志会对本地绝对路径做脱敏，避免在调试输出或截图中泄漏隐私
- 仓库元信息已经指向 GitHub 仓库地址，可直接继续初始化与推送

## 环境要求

- Zotero 8
- Node.js 18+
- Windows 下可选 Microsoft Word
- Windows / macOS / Linux 下可选 LibreOffice
