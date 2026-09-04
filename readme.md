# Chinahrt AutoPlay(Chinahrt自动刷课)

**Fork & 修复自 [yikuaibaiban/chinahrt-autoplay](https://github.com/yikuaibaiban/chinahrt-autoplay)** | 原作博客：[博客园](https://www.cnblogs.com/ykbb/)

好用的Chinahrt刷课脚本

# 简介

1. 移除播放时失去焦点自动暂停
2. 提供视频自动开始播放
3. 调整视频播放速度
4. 开启视频拖动
5. 自动开启视频静音
6. 提供特殊播放模式(部分地区支持)

# 安装

安装`油猴`或者`暴力猴`等类似插件

直接访问安装地址进行安装 [https://greasyfork.org/zh-CN/scripts/400775-chinahrt%E7%BB%A7%E7%BB%AD%E6%95%99%E8%82%B2](https://greasyfork.org/zh-CN/scripts/400775-chinahrt%E7%BB%A7%E7%BB%AD%E6%95%99%E8%82%B2)

# 更新日志
- 2024.05.11.01
  - 重构所有代码
  - 修复了一些已知问题
  - 优化了部分功能
  - 适配了更多的地区
  
- 4.0.0
  - 1.本次重构了所有代码。
  - 2.修复了鼠标移出视频会暂停的问题。
  - 3.增加了'一键添加'到播放列表与'一键清空'的功能。
  - 4.修复一些已知错误。

- 3.1.3-Preview (20230829)：
  - 优化三段和秒播的跳转逻辑
  - 增加二段播放模式  

- 3.1.0 (20230613)：新增播放模式(请谨慎使用，特定地区支持)

- 3.0.1：适配http://www.scjxjypx.com/

- 3.0.0：重新构建的代码，优化界面，优化功能体验

# 播放模式

- 正常模式

    正常播放

- 三段模式

    将视频分为开始，中间，结束三段，每段播放90秒时间

- 秒播模式

    将视频分为开始，结束两段，每段播放1秒

# 常见问题

- 如何使用

    可以访问 https://yikuaibaiban.github.io/chinahrt-autoplay-docs/ 查看使用方法

- 不会自动播放？

    点击课程详情页中的插件提供的【添加到播放列表】按钮添加需要自动播放的课程。受到浏览器策略影响第一次可能无法自动播放，请手动点击播放。

- 所在的地区功能无法正常使用

    由于没有所有地区的账号无法全都进行匹配，如果愿意的话可以将你的账号密码通过私信的方式发我进行适配。
    - 原作反馈：[https://github.com/yikuaibaiban/chinahrt-autoplay/issues](https://github.com/yikuaibaiban/chinahrt-autoplay/issues)
    - 本 fork 反馈：[https://github.com/guohuan78/chinahrt-autoplay/issues](https://github.com/guohuan78/chinahrt-autoplay/issues)

# 修复说明

基于 [yikuaibaiban/chinahrt-autoplay](https://github.com/yikuaibaiban/chinahrt-autoplay) 的 `3.1.3-Preview` 版本修复。

## 问题

自动跳转下一个视频可以，但不能自动点击播放。

## 根因

重构后的 `PlayPage.playerInit()` 只调用一次（+ `loadedmetadata` 事件），如果平台播放器在那个时刻还没完全就绪，`player.videoPlay()` 会静默失败，之后再也没有重试机会。

## 修复

1. `playerInit()` 顶部加了 guard：视频已在播放或已结束时跳过
2. `PlayPage.init()` 中加了 `setInterval(PlayPage.playerInit, 1000)` 周期性重试

# 免责申明
