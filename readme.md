# Chinahrt 自动刷课

> 基于 [yikuaibaiban/chinahrt-autoplay](https://github.com/yikuaibaiban/chinahrt-autoplay) 二次开发（原作博客：[ykbb](https://www.cnblogs.com/ykbb/)）

Chinahrt 继续教育自动刷课脚本：把课程加入播放列表后，视频播放、学习记录提交、自动跳转下一节全部自动完成。

## 功能

- 移除播放时失去焦点自动暂停
- 视频自动开始播放（内置守护，每秒重试直到真正开播）
- 播放完毕自动提交学习记录，并跳转播放列表中的下一节
- 调整视频播放速度（0.5x ~ 2x）
- 解锁视频拖动
- 自动开启静音（绕过浏览器自动播放策略）
- 特殊播放模式：二段播放 / 三段播放 / 秒播（仅个别地区有效，慎用）
- 播放列表管理：课程详情页一键添加，播放页侧边栏查看、移除、一键清空

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/) 扩展
2. 安装脚本，任选其一：
   - GreasyFork 安装页：（发布后补链接）
   - 下载本仓库的 [`dist/chinahrt-autoplay.user.js`](dist/chinahrt-autoplay.user.js)，拖入 Tampermonkey 图标上按提示安装
   - 在 Tampermonkey 中新建脚本，粘贴根目录 [`chinahrt-autoplay.js`](chinahrt-autoplay.js) 全文保存

## 使用

1. 打开课程详情页，逐节点击【添加到播放列表】，或使用【一键添加】
2. 进入任意一节的视频播放页，视频自动开始播放
3. 播放完毕自动提交学习记录并跳转下一节，直至列表全部播完

## 播放模式

| 模式 | 行为 |
|---|---|
| 正常 | 完整播放全片 |
| 二段播放 | 开始、结束各播 90 秒 |
| 三段播放 | 开始、中间、结束各播 90 秒 |
| 秒播 | 开始、结束各播 1 秒 |

> 播放模式位于播放页右侧"实验性功能"面板。该功能通过跳进度条实现，部分地区的后台会检测学习数据，无法使用的地区请不要开启。

## 常见问题

- **不会自动播放？**

    首次播放受浏览器自动播放策略限制，将面板中"静音"设为"是"后刷新；或先手动点一次播放，后续视频即可自动播放。

- **升级脚本后自动播放 / 静音 / 倍速设置不对？**

    在播放页右侧面板重新设置一次即可，设置会自动保存。

- **支持哪些站点？**

    `*.chinahrt.com`、`*.chinahrt.com.cn`、`*.heb12333.cn`。不同地区的页面结构有差异，如遇问题欢迎反馈。

## 反馈

- 问题反馈：[https://github.com/guohuan78/chinahrt-autoplay/issues](https://github.com/guohuan78/chinahrt-autoplay/issues)
- 原作反馈：[https://github.com/yikuaibaiban/chinahrt-autoplay/issues](https://github.com/yikuaibaiban/chinahrt-autoplay/issues)

## 更新日志

### 4.0.0（2026-09-06）

稳定性大版本。整体回归经过线上验证的函数式架构，并叠加以下增强：

- 自动播放守护：每秒检查播放状态并重试，视频未开播不放弃
- 单页应用支持：`#/v_video` 路由识别为播放页，站内切换课程无需刷新即可自动播放
- 播放结束收尾加固：先提交学习记录再跳转下一节；记录接口卡住或报错时，最多等 5 秒也会跳转
- 播放列表存储双向兼容新旧脚本添加的数据
- 补全 `*.chinahrt.com.cn`、`*.heb12333.cn` 站点覆盖；修复升级后控制面板样式丢失

更早版本历史见 [yikuaibaiban/chinahrt-autoplay](https://github.com/yikuaibaiban/chinahrt-autoplay) 上游仓库。

## 免责申明

**本软件是免费软件，不收一分钱，只是分享给朋友们使用，不负责售后服务。使用时部分功能请谨慎使用，软件造成任何数据丢失，本人概不负责。**
