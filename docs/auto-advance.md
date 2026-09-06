# 自动连播与进度保存诊断

版本：4.0.2

## 工作流程

平台原生 `endedHandler` 提交结束记录。脚本观察 XHR / fetch 响应，仅在 HTTP 成功、请求带有 `isEnd: true`、响应为 `status: 0` 时移除当前项并播放队列第一项。

跨域播放器通过 `postMessage` 报告小节 ID，由课程主页面校验来源和路由后更新队列。当前项已经移出队列时仍继续连播。课程地址中的 `//index.html` 规范化为 `/index.html`。

中途心跳成功只更新诊断阶段。保存失败后保留队列，自动播放重试等待当前课程恢复保存或用户重新加载页面。脚本观察平台提交结果，不自行构造学习记录。

## 错误说明

已核对的播放器每 30 秒调用 `courseyunRecord`。成功时更新 `attrset.signId`；业务状态 `-2` 分支直接执行 `alert(data.error_desc)`，随后清除播放器并用相同字段生成页面说明。字段缺失会显示 `undefined`；后台拒绝保存的具体原因仍需实际失败响应确认。

4.0.2 为当前小节的同源记录请求补齐失败说明：保留有效的 `error_desc`，否则依次使用 `message`、`msg`；均缺失、空白或为字面值 `undefined` / `null` 时，显示状态码及刷新重试说明。

实现使用 jQuery 的[请求预处理扩展点](https://api.jquery.com/jQuery.ajaxPrefilter/)设置[响应过滤回调](https://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings)，在原生回调前补齐说明。业务状态、token、请求体及 XHR 原始响应保持原值，平台继续处理失败。fetch 响应只用于诊断，仍向平台返回原始响应。

## 现场核对记录

2026-09-06 至 2026-09-07，在用户已经登录的课程页确认：

- 外层路由为 `gp.chinahrt.com/index.html#/v_video`，播放器位于 `videoadmin.chinahrt.com/videoPlay/playEncrypt` 跨域 iframe。
- 结束和心跳均使用 `/videoPlay/takeRecordByToken`，发送 JSON；结束请求额外包含 `isEnd: true`。
- 平台原生结束成功回调出现 `ReferenceError: nextUrl is not defined`。修复脚本独立观察保存结果后导航。
- 3.1.3-fix.10 运行时，第一章自然结束后移出队列，外层进入第二章，第二章时间持续增长。此项已现场确认。
- 切集后外层仍标记为 3.1.3-fix.10；新 iframe 缺少修复版属性，面板链接与仓库 4.0.1 一致。随后第二章停在片尾，队列仍从第二章开始。尚未核对脚本管理器中的更新来源。
- 本次接管未复现 `undefined` 弹窗，未取得原始失败响应。已确认可产生该弹窗的原生代码分支，未确认具体的后台拒绝原因。

本包以仓库提交 `e43001b` 为补丁基线，保留其署名和目录结构，合入连播修复及错误诊断。4.0.2 待用户安装后进行现场验收。

## 本地验证

要求 Node.js 18 或更新版本：

```sh
npm ci
npm start
npm test
```

共 124 项：37 个行为用例分别覆盖源码、可读 dist、压缩 dist（111 项），构建及版本一致性（1 项），4 个 jQuery 1.9.1 集成用例分别运行三个脚本（12 项）。

行为测试模拟存储、播放器、XHR、fetch 和跨域消息。集成测试在 jsdom 中运行平台同版本 jQuery，用内存 transport 验证说明补齐、原生失败处理、成功 token 和既有过滤器兼容。测试不访问训练平台，不代表实际账号验收。jQuery 和 jsdom 仅为测试依赖，不打包进用户脚本。

## 安装与验收

1. 编辑已有“Chinahrt 自动刷课”条目，用 `dist/chinahrt-autoplay.js` 全文替换并保存，核对版本 4.0.2。保留条目可沿用播放列表和设置。
2. 刷新最外层课程页，使外层和 iframe 同时加载新脚本。
3. 核对两层版本均为 4.0.2，播放器错误说明处理属性为 `ready`。
4. 自然播放时检查 `progress-saved`；自然结束后确认当前项移除、外层 `sectionId` 改变、下一节时间持续增长。
5. 如再出现保存失败，保留弹窗和下列诊断，按实际说明决定恢复方式。

## 运行属性

课程主页面和 iframe 的 `<html>` 包含：

| 属性 | 含义 |
|---|---|
| `data-chinahrt-autoplay-version` | 当前文档运行版本 |
| `data-chinahrt-autoplay-stage` | 当前处理阶段 |
| `data-chinahrt-autoplay-section` | 最近处理的小节 ID |
| `data-chinahrt-record-messages` | jQuery 说明处理安装后为 `ready` |
| `data-chinahrt-record-error` | 最近一次失败的 JSON 诊断 |

阶段包括 `ready`、`progress-saved`、`waiting-record`、`record-saved`、`notified-parent`、`completion-received`、`navigating`、`queue-empty`、`record-failed`、`next-url-invalid`、`canonicalizing-url`。

错误诊断选择 `kind`（`progress` / `end`）、`httpStatus`、业务 `status`、`errorDescriptionMissing` 和截断的 `message`。不复制请求体或响应的 `data`。原生弹窗前 HTTP 状态可能为 `null`，XHR 结束后补齐。恢复后保留最近一次错误，当前是否恢复以阶段为准。
