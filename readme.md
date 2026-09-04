# Chinahrt 自动刷课

> 基于 [yikuaibaiban/chinahrt-autoplay](https://github.com/yikuaibaiban/chinahrt-autoplay) 二次开发，修复自动播放问题。

好用的 Chinahrt 继续教育刷课脚本，自动完成视频播放。

## 功能

1. 移除播放时失去焦点自动暂停
2. 视频自动开始播放
3. 调整视频播放速度（0.5x ~ 2x）
4. 开启视频拖动（突破平台限制）
5. 自动开启视频静音（绕过浏览器自动播放策略）
6. 特殊播放模式（三段播放、秒播等，部分地区支持）
7. 播放列表管理（一键添加 / 清空 / 自动播放下一个）

## 安装

安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/) 后，访问下方地址安装脚本：

> 待发布（可从本仓库 `dist/chinahrt-autoplay.user.js` 手动安装）

## 使用

1. 打开课程详情页，点击插件提供的【添加到播放列表】按钮添加课程
2. 进入视频播放页，脚本自动开始播放
3. 播放完毕自动跳转下一个

## 已知问题

- 首次自动播放可能受浏览器策略限制，请手动点一次播放或将"静音"设为开，然后刷新

## 反馈

- 问题反馈：[https://github.com/guohuan78/chinahrt-autoplay/issues](https://github.com/guohuan78/chinahrt-autoplay/issues)

## 修复说明

### v3.1.3-fix.4

- 兼容旧版脚本存储的播放列表数据（课程名字段为 `sectionName`），读取时自动迁移为 `title`，消除"即将播放下一个视频:undefined"通知

### v3.1.3-fix.3

- 修复视频播完后弹出 undefined 通知的问题：列表移除逻辑按课程 URL 精确匹配（忽略多余参数），播放页地址与列表地址参数顺序/附带参数不同也能正确删除
- 播放列表"移除"按钮按下标删除时先转数字，避免把字符串下标当作课程地址

### v3.1.3-fix.2

- 修复控制面板样式丢失导致界面错乱的问题：重构版引用了从未声明的 `@resource customCss`，整套面板 CSS 实际从未注入
- 补全 `@match` 站点覆盖（`*.chinahrt.com.cn`、`*.heb12333.cn`）

### v3.1.3-fix.1

- 修复自动跳转下一个视频后无法自动点击播放的问题

**根因**：重构后 `playerInit()` 只调用一次，若播放器未完全就绪，`videoPlay()` 静默失败且永不重试。

**修复**：
1. `playerInit()` 增加 guard：视频已在播放时跳过
2. 增加 `setInterval(playerInit, 1000)` 周期性重试，直到视频真正开始

## 免责申明

**本软件是免费软件，不收一分钱，只是分享给朋友们使用，不负责售后服务。使用时部分功能请谨慎使用，软件造成任何数据丢失，本人概不负责。**
