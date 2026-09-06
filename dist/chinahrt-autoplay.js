// ==UserScript==
// @name         Chinahrt 自动刷课
// @version      4.0.2
// @namespace    https://github.com/guohuan78/chinahrt-autoplay
// @description  Chinahrt 继续教育自动播放：确认学习记录保存后连播下一节，支持静音、播放列表管理和进度保存诊断
// @author       guohuan78
// @license      Apache-2.0
// 基于原作改编：yikuaibaiban/chinahrt-autoplay（Apache-2.0）
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAArFJREFUWEftlttPE0EUxr+9ddtdYOXSSmmlFFoasSFemmg0qYkIMfGF/9J/wTeN0cSYGBHEBBIoLSIU0VrKpe1eagaySWVmutu+GJPO4+5cfvOdc745wkGl3sI/HEIf4L9ToHrqoHLi4LTRgmm1IAhAMCDgmi4ibEgQhe4SyncOFA9tFMoWaucO9wRJFDAZlpCeUKAq/kA8AY7PHKwWmqic+i8WRRaQTciIj8qeFB0Bjo4dvN9ooOX/7L8OnLshYybaWQouALn5m/XeD3dJ5qcCSEQkrhJcgLfrdabshV8mvtdsPEoEPeV1JzzOqhjSROZ8JsBO2cJa0WQueLFSQ6lqYWpYQT4ZQnSQfzt3g+iwhFw64B/g9VqDm+0uANlNkYB8UkMupnqqkc+qMBgqUAqQOiex5412AHdOJhzAUlqDpvBNIBOXMTtBJyQF0El+ciALgHwfUEUspjTMjrGzPmKIuJ+hlaIA1ksmtg+srhRon7wwE0IuTieoHhTwZJ7+TgGsbDexe2T3DJAdV/E8o1HriTMu3QlR3ymAz4UmSj96A1AkActzOqZH6DD4BtjYM7G5130IYkMynmV0jHHqfXRQxMObPnKg/NvGh81mVyG4HQ1gcVYH22out5oel3Fr0kcVOC3g5cdz2JxH72oVPE1ruDfh7QMPMirCBo3IdMIvRfPi6WUNF2BMl0Aynjii1yAGRIyINZgADRN4tVa/aDiujnfFOg5PbCykNAyp/roPYsPEjn0DkInfflr4tMV+D7xu3P4/eV1GNsFXqWM/sLVv4usuvyK8QGIjEu6m2I+Qu9azIyKt2OoOvyp4EF439w1AJpLmhHjDfoVvUO6GJOHSMZkb86vAngq0L6ieOSA+UalddsWWfZmkA0ERhi4iYkjMUusUqq4AvGLey/8+QF+BP0npcPDdfTv7AAAAAElFTkSuQmCC
// @match        http://*.chinahrt.com/*
// @match        https://*.chinahrt.com/*
// @match        http://*.chinahrt.com.cn/*
// @match        https://*.chinahrt.com.cn/*
// @match        https://*.heb12333.cn/*
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_notification
// ==/UserScript==

const pageWindow = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
const runtimeVersion = '4.0.2';
const completionMessage = 'chinahrt-autoplay:record-saved';
const completedSections = new Set();
const recordNormalizers = new WeakSet();
let recordFailure = null;

function runtimeStage(stage, sectionId) {
    const root = document.documentElement;
    if (!root) return;
    // 现场诊断只记录版本、阶段和小节 ID。
    root.setAttribute('data-chinahrt-autoplay-version', runtimeVersion);
    root.setAttribute('data-chinahrt-autoplay-stage', stage);
    if (sectionId) root.setAttribute('data-chinahrt-autoplay-section', sectionId);
}

(function initStyles() {
    let style = document.createElement("style");
    style.appendChild(document.createTextNode(`.autoPlayBox {    padding: 5px 10px;}.autoPlayBox .title {    color: blue;}.autoPlayBox label {    margin-right: 6px;}.autoPlayBox label input {    margin-left: 4px;}.canPlaylist {    width: 300px;    height: 500px;    position: fixed;    top: 100px;    background: rgba(255, 255, 255, 1);    right: 80px;    border: 1px solid #c1c1c1;    overflow-y: auto;}.canPlaylist .oneClick {    margin: 0 auto;    width: 100%;    border: none;    padding: 6px 0;    background: linear-gradient(180deg, #4BCE31, #4bccf2);    height: 50px;    border-radius: 5px;    color: #FFF;    font-weight: bold;    letter-spacing: 4px;    font-size: 18px;}.canPlaylist .item {    border-bottom: 1px solid #c1c1c1;    padding: 8px;    line-height: 150%;    border-bottom: 1px solid #c1c1c1;    margin-bottom: 3px;}.canPlaylist .item .title {    font-size: 13px;    white-space: nowrap;    overflow: hidden;    text-overflow: ellipsis;}.canPlaylist .item .status {    font-size: 12px;    white-space: nowrap;    overflow: hidden;    text-overflow: ellipsis;    color: #c90000;}.canPlaylist .item .addBtn {    color: #FFF;    background-color: #4bccf2;    border: none;    padding: 5px 10px;    margin-top: 4px;}.canPlaylist .item .addBtn.remove {    background-color: #fd1952;}.dragBox {    padding: 5px 10px;}.dragBox .title {    color: blue;}.dragBox .remark {    font-size: 12px;    color: #fc1818;}.dragBox label {    margin-right: 6px;}.dragBox label input {    margin-left: 4px;}.multiSegmentBox {    position: fixed;    right: 255px;    top: 0;    width: 250px;    height: 280px;    background-color: #FFF;    z-index: 9999;    border: 1px solid #ccc;    font-size: 12px;}.multiSegmentBox .tip {    border-bottom: 1px solid #ccc;    padding: 5px;    font-weight: bold;    color: red;}.multiSegmentBox .item {    font-size: 14px;}.multiSegmentBox label {    margin-right: 3px;}.multiSegmentBox label input {    margin-left: 2px;}.muteBox {    padding: 5px 10px;}.muteBox .title {    color: blue;}.muteBox .remark {    font-size: 12px;    color: #fc1818;}.muteBox label {    margin-right: 6px;}.muteBox label input {    margin-left: 4px;}.controllerBox {    position: fixed;    right: 0;    top: 0;    width: 250px;    height: 280px;    background-color: #FFF;    z-index: 9999;    border: 1px solid #ccc;    overflow-y: auto;    font-size: 12px;}.controllerBox .linksBox {    display: flex;    flex-wrap: wrap;    justify-content: space-between;    height: 30px;    line-height: 30px;    font-weight: bold;    border-bottom: 1px dotted;}.playlistBox {    position: fixed;    right: 0;    top: 290px;    width: 250px;    height: 450px;    background-color: #FFF;    z-index: 9999;    border: 1px solid #ccc;    overflow-y: auto;}.playlistBox .oneClear {    width: 100%;    border: none;    padding: 6px 0;    background: linear-gradient(180deg, #4BCE31, #4bccf2);    height: 50px;    border-radius: 5px;    color: #FFF;    font-weight: bold;    letter-spacing: 4px;    font-size: 18px;    cursor: pointer;    margin-bottom: 5px;}.playlistBox .playlistItem {    display: flex;    justify-content: space-between;    align-items: center;    margin-bottom: 5px;}.playlistBox .playlistItem .child_title {    font-size: 13px;    white-space: nowrap;    overflow: hidden;    text-overflow: ellipsis;    width: 180px;}.playlistBox .playlistItem .child_remove {    color: #FFF;    background-color: #fd1952;    border: none;    padding: 5px 10px;    cursor: pointer;}.speedBox {    padding: 5px 10px;}.speedBox .title {    color: blue;}.speedBox .remark {    font-size: 12px;    color: #fc1818;}.speedBox label {    margin-right: 6px;}.speedBox label input {    margin-left: 4px;}`));
    document.head.appendChild(style);
})();

function autoPlay(value) {
    if (value !== undefined) {
        GM_setValue('autoPlay', value);
        return value;
    }

    return GM_getValue('autoPlay', true);
}

function mute(value) {
    if (value !== undefined) {
        GM_setValue('mute', value);
        return value;
    }

    return GM_getValue('mute', true);
}

function drag(value) {
    if (pageWindow.attrset) {
        pageWindow.attrset.ifCanDrag = 1;
    }

    if (value) {
        GM_setValue('drag', value);
        return value;
    }

    return GM_getValue('drag', 5);
}

function speed(value) {
    if (pageWindow.attrset) {
        pageWindow.attrset.playbackRate = 1;
    }

    if (value) {
        GM_setValue('speed', value);
        return value;
    }

    return GM_getValue('speed', 1);
}

function playMode(value) {
    if (value !== undefined) {
        GM_setValue('playMode', value);
        return value;
    }

    return GM_getValue('playMode', 'loop');
}
function addCourse(course) {
    let courses = coursesList();
    if (courseAdded(course.sectionId)) {
        notification(`课程 ${course.sectionName} 已经在播放列表中。`);
        return false;
    }
    courses.push({...course, url: course.getUrl()});
    coursesList(courses);
    return true;
}

function removeCourse(sectionId) {
    const id = normalizeSectionId(sectionId);
    if (!id) return;
    let courses = coursesList();

    for (let i = courses.length - 1; i >= 0; i--) {
        if (normalizeSectionId(courses[i].sectionId) !== id) {
            continue;
        }
        courses.splice(i, 1);
    }

    coursesList(courses);
}

function courseAdded(sectionId) {
    const id = normalizeSectionId(sectionId);
    if (!id) return false;
    let courses = coursesList();
    for (let i = 0; i < courses.length; i++) {
        if (normalizeSectionId(courses[i].sectionId) === id) {
            return true;
        }
    }
    return false;
}

function coursesList(value) {
    if (value) {
        if (!Array.isArray(value)) {
            notification("保存课程数据失败，数据格式异常。");
            return [];
        }
        return GM_setValue('courses', value);
    }

    let courses = GM_getValue('courses', []);
    if (!Array.isArray(courses)) {
        return [];
    }

    // 兼容不同版本的存储格式：补齐 title / sectionName / sectionId 字段
    const validCourses = courses.filter(course => course && typeof course === 'object');
    let migrated = validCourses.length !== courses.length;
    courses = validCourses;
    for (let i = 0; i < courses.length; i++) {
        const course = courses[i];
        if (!course) {
            continue;
        }
        if (!course.title && course.sectionName) {
            course.title = course.sectionName;
            migrated = true;
        }
        if (!course.sectionName && course.title) {
            course.sectionName = course.title;
            migrated = true;
        }
        if (!course.sectionId && course.url) {
            const id = sectionIdFromUrl(course.url);
            if (id) {
                course.sectionId = id;
                migrated = true;
            }
        }
    }
    if (migrated) {
        GM_setValue('courses', courses);
    }

    return courses;
}
function normalizeSectionId(value) {
    return value === undefined || value === null ? '' : String(value).trim();
}

function sectionIdFromUrl(value) {
    try {
        const url = new URL(value, window.location.href);
        const query = url.hash.includes('?') ? url.hash.slice(url.hash.indexOf('?') + 1) : '';
        return normalizeSectionId(new URLSearchParams(query).get('sectionId') || url.searchParams.get('sectionId'));
    } catch (error) {
        return '';
    }
}

function isRecordUrl(value) {
    try {
        const url = new URL(value, window.location.href);
        return url.origin === window.location.origin && /^\/videoPlay\/takeRecord(?:ByToken)?\/?$/.test(url.pathname);
    } catch (error) {
        return false;
    }
}

function playbackContext() {
    const attributes = pageWindow.attrset || {};
    return {
        href: window.location.href,
        sectionId: normalizeSectionId(attributes.sectionId) || sectionIdFromUrl(window.location.href),
        token: attributes.signId,
    };
}

function studyRecord(url, method, body, context) {
    if (String(method).toUpperCase() !== 'POST' || !isRecordUrl(url)) return null;
    try {
        let data;
        if (typeof body === 'string') {
            data = body.trim().startsWith('{') ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body));
        } else if (body && typeof body.entries === 'function') {
            data = Object.fromEntries(body.entries());
        } else {
            return null;
        }
        if (!data || typeof data !== 'object') return null;
        if (data.token !== undefined && String(data.token) !== String(context.token)) return null;
        const sectionId = normalizeSectionId(data.sectionId) || context.sectionId;
        if (!sectionId || (context.sectionId && sectionId !== context.sectionId)) return null;
        // 请求发送时固定小节身份，异步响应不会移除后来切换到的小节。
        return { sectionId, href: context.href, isEnd: data.isEnd === true || data.isEnd === 'true' };
    } catch (error) {
        return null;
    }
}

function meaningfulMessage(value) {
    return typeof value === 'string' && value.trim() && !/^(undefined|null)$/i.test(value.trim());
}

function recordErrorMessage(data) {
    if (data && typeof data === 'object') {
        for (const value of [data.error_desc, data.message, data.msg]) {
            if (meaningfulMessage(value)) return value.trim();
        }
    }
    const status = data && data.status !== undefined ? String(data.status) : '未知';
    return '学习进度保存失败（平台状态码：' + status + '）。平台未提供错误说明，请刷新当前课程后重试。';
}

function recordErrorDiagnostic(record, httpStatus, data) {
    if (!record || record.href !== window.location.href) return;
    const currentId = playbackContext().sectionId;
    if (currentId && currentId !== record.sectionId) return;
    recordFailure = record;
    runtimeStage('record-failed', record.sectionId);
    // 只选取错误字段，不记录请求体、签名或响应中的 data。
    document.documentElement.setAttribute('data-chinahrt-record-error', JSON.stringify({
        kind: record.isEnd ? 'end' : 'progress',
        httpStatus: httpStatus || null,
        status: data && data.status !== undefined ? String(data.status).slice(0, 40) : null,
        errorDescriptionMissing: !meaningfulMessage(data && data.error_desc),
        message: recordErrorMessage(data).slice(0, 300),
    }));
}

function installRecordErrorMessages() {
    const jquery = pageWindow.jQuery || pageWindow.$;
    if (!jquery || typeof jquery.ajaxPrefilter !== 'function' || recordNormalizers.has(jquery)) return;
    jquery.ajaxPrefilter(function (options, originalOptions, xhr) {
        const record = studyRecord(options.url, options.type || 'GET', options.data, playbackContext());
        if (!record) return;
        const originalFilter = options.dataFilter;
        options.dataFilter = function (response, type) {
            const filtered = typeof originalFilter === 'function' ? originalFilter.call(this, response, type) : response;
            let data;
            try {
                data = typeof filtered === 'string' ? JSON.parse(filtered) : filtered;
            } catch (error) {
                return filtered;
            }
            if (!data || typeof data !== 'object' || data.status == null || String(data.status) === '0') return filtered;
            // 在原生 success 弹窗前记录诊断；失败状态仍由平台处理。
            recordErrorDiagnostic(record, xhr && xhr.status, data);
            if (meaningfulMessage(data.error_desc)) return filtered;
            const normalized = { ...data, error_desc: recordErrorMessage(data) };
            return typeof filtered === 'string' ? JSON.stringify(normalized) : normalized;
        };
    });
    recordNormalizers.add(jquery);
    document.documentElement.setAttribute('data-chinahrt-record-messages', 'ready');
}

function recordSaved(record, status, response) {
    if (!record || record.href !== window.location.href) return;
    const currentId = playbackContext().sectionId;
    if (currentId && currentId !== record.sectionId) return;
    let data = response;
    try {
        if (typeof data === 'string') data = JSON.parse(data);
    } catch (error) {
        data = null;
    }
    if (status < 200 || status >= 300 || !data || String(data.status) !== '0') {
        recordErrorDiagnostic(record, status, data);
        if (record.isEnd) notification(recordErrorMessage(data));
        return;
    }
    recordFailure = null;
    if (!record.isEnd) {
        runtimeStage('progress-saved', record.sectionId);
        return;
    }
    if (completedSections.has(record.sectionId)) return;
    runtimeStage('record-saved', record.sectionId);
    if (window.top === window.self) {
        finishCourse(record.sectionId);
        return;
    }
    // 跨域播放器只报告已保存的小节，由课程主页面修改队列并导航。
    try {
        const parentOrigin = new URL(document.referrer).origin;
        window.top.postMessage({ type: completionMessage, sectionId: record.sectionId }, parentOrigin);
        completedSections.add(record.sectionId);
        runtimeStage('notified-parent', record.sectionId);
    } catch (error) {
        notification('学习进度已保存，请在课程主页面刷新脚本后继续播放。');
    }
}

function finishCourse(sectionId) {
    const id = normalizeSectionId(sectionId);
    if (!id || completedSections.has(id)) return;
    // 队列保存待播放项；当前视频可能已被移除，仍应播放剩余的第一项。
    removeCourse(id);
    completedSections.add(id);
    const courses = coursesList();
    if (!courses.length) {
        runtimeStage('queue-empty', id);
        notification('所有视频已经播放完毕');
        return;
    }
    let nextUrl;
    try {
        nextUrl = new URL(courses[0].url);
        nextUrl.pathname = nextUrl.pathname.replace(/^\/{2,}/, '/');
        if (!/^https?:$/.test(nextUrl.protocol) || !/\.(chinahrt\.com(?:\.cn)?|heb12333\.cn)$/.test(nextUrl.hostname)) {
            throw new Error('Invalid course URL');
        }
    } catch (error) {
        runtimeStage('next-url-invalid', id);
        notification('下一个视频的播放地址无效，请在课程详情页重新添加。');
        return;
    }
    notification('即将播放下一个视频:' + (courses[0].sectionName || courses[0].title || '下一节'));
    runtimeStage('navigating', id);
    window.location.href = nextUrl.href;
}

function handleCompletionMessage(event) {
    if (window.top !== window.self || currentPageType() !== 2) return;
    const data = event.data;
    if (!data || data.type !== completionMessage || typeof data.sectionId !== 'string') return;
    if (data.sectionId !== sectionIdFromUrl(window.location.href)) return;
    const trustedFrame = Array.from(document.querySelectorAll('iframe')).some(frame => {
        try {
            const url = new URL(frame.src, window.location.href);
            return frame.contentWindow === event.source && url.origin === event.origin &&
                /^https?:$/.test(url.protocol) && /\.(chinahrt\.com(?:\.cn)?|heb12333\.cn)$/.test(url.hostname) &&
                /^\/videoPlay\/play(?:Encrypt)?\/?$/.test(url.pathname);
        } catch (error) {
            return false;
        }
    });
    if (trustedFrame) {
        runtimeStage('completion-received', data.sectionId);
        finishCourse(data.sectionId);
    }
}

function interceptFetch() {
    const originalFetch = pageWindow.fetch;
    if (typeof originalFetch !== 'function') return;
    pageWindow.fetch = function (input, options) {
        const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
        const context = playbackContext();
        const method = (options && options.method) || input.method || 'GET';
        const isRecord = isRecordUrl(url) && String(method).toUpperCase() === 'POST';
        let body;
        if (isRecord) {
            body = options && options.body !== undefined ? Promise.resolve(options.body) :
                (typeof input.clone === 'function' ? input.clone().text() : Promise.resolve(undefined));
            body.catch(() => {});
        }
        const result = originalFetch.apply(this, arguments);
        if (isRecord) {
            result.then(response => {
                // 在平台读取原始响应前建立副本，请求体解析可以异步完成。
                const copy = response.clone();
                return body.then(value => {
                    const record = studyRecord(url, method, value, context);
                    if (!record) return;
                    return copy.text().then(text => recordSaved(record, response.status, text));
                });
            }).catch(() => {});
        }
        return result;
    };
}

function interceptsXHR(callback) {
    if (!pageWindow.XMLHttpRequest) return;
    const prototype = pageWindow.XMLHttpRequest.prototype;
    const open = prototype.open;
    const send = prototype.send;
    const requests = new WeakMap();
    prototype.open = function (method, url) {
        requests.set(this, { method, url: String(url) });
        return open.apply(this, arguments);
    };
    prototype.send = function (body) {
        const request = requests.get(this);
        if (request) {
            const record = studyRecord(request.url, request.method, body, playbackContext());
            if (record && record.isEnd) runtimeStage('waiting-record', record.sectionId);
            this.addEventListener('loadend', function () {
                try {
                    recordSaved(record, this.status, this.response);
                    if (this.status >= 200 && this.status < 300) {
                        callback(request.url, this.response, request.method, this.readyState);
                    }
                } catch (error) {
                    console.warn('[Chinahrt] 处理课程响应失败', error.name);
                }
            }, { once: true });
        }
        return send.apply(this, arguments);
    };
}
function notification(content) {
    try {
    GM_notification({
        text: content,
        title: "Chinahrt自动刷课",
        image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAArFJREFUWEftlttPE0EUxr+9ddtdYOXSSmmlFFoasSFemmg0qYkIMfGF/9J/wTeN0cSYGBHEBBIoLSIU0VrKpe1eagaySWVmutu+GJPO4+5cfvOdc745wkGl3sI/HEIf4L9ToHrqoHLi4LTRgmm1IAhAMCDgmi4ibEgQhe4SyncOFA9tFMoWaucO9wRJFDAZlpCeUKAq/kA8AY7PHKwWmqic+i8WRRaQTciIj8qeFB0Bjo4dvN9ooOX/7L8OnLshYybaWQouALn5m/XeD3dJ5qcCSEQkrhJcgLfrdabshV8mvtdsPEoEPeV1JzzOqhjSROZ8JsBO2cJa0WQueLFSQ6lqYWpYQT4ZQnSQfzt3g+iwhFw64B/g9VqDm+0uANlNkYB8UkMupnqqkc+qMBgqUAqQOiex5412AHdOJhzAUlqDpvBNIBOXMTtBJyQF0El+ciALgHwfUEUspjTMjrGzPmKIuJ+hlaIA1ksmtg+srhRon7wwE0IuTieoHhTwZJ7+TgGsbDexe2T3DJAdV/E8o1HriTMu3QlR3ymAz4UmSj96A1AkActzOqZH6DD4BtjYM7G5130IYkMynmV0jHHqfXRQxMObPnKg/NvGh81mVyG4HQ1gcVYH22out5oel3Fr0kcVOC3g5cdz2JxH72oVPE1ruDfh7QMPMirCBo3IdMIvRfPi6WUNF2BMl0Aynjii1yAGRIyINZgADRN4tVa/aDiujnfFOg5PbCykNAyp/roPYsPEjn0DkInfflr4tMV+D7xu3P4/eV1GNsFXqWM/sLVv4usuvyK8QGIjEu6m2I+Qu9azIyKt2OoOvyp4EF439w1AJpLmhHjDfoVvUO6GJOHSMZkb86vAngq0L6ieOSA+UalddsWWfZmkA0ERhi4iYkjMUusUqq4AvGLey/8+QF+BP0npcPDdfTv7AAAAAElFTkSuQmCC",
    });
    } catch (error) {
        console.info('[Chinahrt]', content);
    }
}

function currentPageType() {
    if (window.location.pathname === "/videoPlay/playEncrypt") return 2;
    if (window.location.pathname === "/videoPlay/play") return 2;
    // SPA 内的播放页（hash 路由）同样启用自动播放
    if (window.location.href.indexOf("#/v_video?") > -1) return 2;

    const route = /#\/([^?]+)/.exec(window.location.href);
    const currentPage = route ? route[1] : '';
    switch (currentPage) {
        case "v_video":
            return 2;
        case "v_courseDetails":
            return 1;
        default:
            return 0;
    }
}
function createAutoPlayOption() {
    let box = document.createElement('div');
    box.classList.add('autoPlayBox');

    let title = document.createElement('p');
    title.classList.add('title');
    title.innerText = '自动播放';
    box.appendChild(title);

    let options = [
        {text: "是", value: true},
        {text: "否", value: false}
    ]

    options.forEach(option => {
        let label = document.createElement('label');
        label.innerText = option.text;
        box.appendChild(label);
        let input = document.createElement('input');
        input.type = 'radio';
        input.name = 'autoPlay';
        input.value = option.value;
        input.checked = autoPlay() === option.value;
        input.onclick = function () {
            autoPlay(option.value);
        };
        label.appendChild(input);
    });

    return box;
}
function createCanPlaylist() {
    let playlist = document.createElement("div");
    playlist.id = "canPlaylist";
    playlist.className = "canPlaylist";

    let oneClick = document.createElement("button");
    oneClick.innerText = "一键添加";
    oneClick.type = "button";
    oneClick.className = "oneClick";
    oneClick.onclick = function () {
        const items = playlist.getElementsByClassName("item");
        for (let item of items) {
            const buttons = item.getElementsByTagName("button");
            for (let button of buttons) {
                if (button.innerText === "从播放列表移除") {
                    continue;
                }
                button.click();
            }
        }
    }
    playlist.appendChild(oneClick);
    playlist.addEventListener("clear", function () {
        let elementsByClassName = playlist.getElementsByClassName("item");
        for (let i = elementsByClassName.length - 1; i >= 0; i--) {
            elementsByClassName[i].remove();
        }
    });

    playlist.addEventListener("refresh", function () {
        let elements = playlist.getElementsByClassName("item");
        for (let i = elements.length - 1; i >= 0; i--) {
            const element = elements[i];
            const buttonElement = element.getElementsByTagName("button")[0];
            let added = courseAdded(buttonElement.getAttribute("data-sectionId"));
            buttonElement.innerText = added ? "从播放列表移除" : "添加到播放列表";
            buttonElement.className = added ? "addBtn remove" : "addBtn";
        }
    });
    playlist.addEventListener("append", function (data) {
        let child = document.createElement("div");
        child.className = "item";
        this.appendChild(child);

        let title = document.createElement("p");
        title.innerText = data.detail.sectionName;
        title.title = title.innerText;
        title.className = "title";
        child.appendChild(title);

        let status = document.createElement("p");
        status.innerText = data.detail.study_status;
        status.title = status.innerText;
        status.className = "status";
        child.appendChild(status);

        let added = courseAdded(data.detail.sectionId);
        let addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.innerText = added ? "从播放列表移除" : "添加到播放列表";
        addBtn.className = added ? "addBtn remove" : "addBtn";
        addBtn.setAttribute("data-sectionId", data.detail.sectionId);
        addBtn.onclick = function () {
            if (this.innerText === "从播放列表移除") {
                removeCourse(data.detail.sectionId);
            } else {
                addCourse(data.detail);
            }
        };
        child.appendChild(addBtn);
    });

    document.body.appendChild(playlist);
    return playlist;
}
function createDragOption() {
    let box = document.createElement('div');
    box.classList.add('dragBox');

    let title = document.createElement('p');
    title.classList.add('title');
    title.innerText = '拖动';
    box.appendChild(title);

    let options = [
        {text: "还原", value: 5},
        {text: "启用", value: 1}
    ]

    options.forEach(option => {
        let label = document.createElement('label');
        label.innerText = option.text;
        box.appendChild(label);
        let input = document.createElement('input');
        input.type = 'radio';
        input.name = 'drag';
        input.value = option.value;
        input.checked = drag() === option.value;
        input.onclick = function () {
            drag(option.value);
        };
        label.appendChild(input);
    });

    let remark = document.createElement('p');
    remark.classList.add('remark');
    remark.innerText = '注意：慎用此功能，后台可能会检测播放数据。';
    box.appendChild(remark);

    return box;
}
function createMultiSegmentBox() {
    let box = document.createElement("div");
    box.className = "multiSegmentBox";
    document.body.appendChild(box);

    let tip = document.createElement("div");
    tip.innerHTML = "此功能只适用个别地区。无法使用的就不要使用了。<br/>网站会定期上传学习进度非必要别使用此功能。";
    tip.className = "tip";
    box.appendChild(tip);

    let options = [
        {text: "正常", value: 0},
        {text: "二段播放", value: 3, title: "将视频分为二段：开始，结束各播放90秒"},
        {text: "三段播放", value: 1, title: "将视频分为三段：开始，中间，结束各播放90秒"},
        {text: "秒播", value: 2, title: "将视频分为两段:开始，结束各播放一秒"}
    ];

    options.forEach(option => {
        let label = document.createElement('label');
        label.innerText = option.text;
        box.appendChild(label);
        let input = document.createElement('input');
        input.type = 'radio';
        input.name = 'playMode';
        input.value = option.value;
        input.checked = playMode() === option.value;
        input.onclick = function () {
            playMode(option.value);
        };
        label.appendChild(input);
    });
}

function timeHandler(t) {
    const player = pageWindow.player;
    if (!player || typeof player.getMetaDate !== 'function') return;
    let videoDuration = parseInt(player.getMetaDate().duration);
    if (playMode() === 1) {
        if (videoDuration <= 270) {
            return;
        }
        const videoMiddleStart = (videoDuration / 2) - 45;
        const videoMiddleEnd = (videoDuration / 2) + 45;
        const videoEndStart = videoDuration - 90;
        if (t > 90 && t < videoMiddleStart) {
            player.videoSeek(videoMiddleStart);
            return;
        }
        if (t > videoMiddleEnd && t < videoEndStart) {
            player.videoSeek(videoEndStart);
            return;
        }
        return;
    }
    if (playMode() === 2) {
        if (t > 1 && t < videoDuration - 1) {
            player.videoSeek(videoDuration - 1);
        }
        return;
    }
    if (playMode() === 3) {
        if (videoDuration <= 180) {
            return;
        }
        if (t > 90 && t < videoDuration - 90) {
            player.videoSeek(videoDuration - 90);
        }
    }
}
function createMuteOption() {
    let box = document.createElement('div');
    box.classList.add('muteBox');

    let title = document.createElement('p');
    title.classList.add('title');
    title.innerText = '静音';
    box.appendChild(title);

    let options = [
        {text: "是", value: true},
        {text: "否", value: false}
    ]

    options.forEach(option => {
        let label = document.createElement('label');
        label.innerText = option.text;
        box.appendChild(label);
        let input = document.createElement('input');
        input.type = 'radio';
        input.name = 'mute';
        input.value = option.value;
        input.checked = mute() === option.value;
        input.onclick = function () {
            mute(option.value);
        };
        label.appendChild(input);
    });

    let remark = document.createElement('p');
    remark.classList.add('remark');
    remark.innerText = '注意：受浏览器策略影响，不静音，视频可能会出现不会自动播放';
    box.appendChild(remark);

    return box;
}
function createControllerBox() {
	let controllerBox = document.createElement('div');
	controllerBox.id = 'controllerBox';
	controllerBox.className = 'controllerBox';
	document.body.appendChild(controllerBox);

	let linksBox = document.createElement('div');
	linksBox.className = 'linksBox';
	controllerBox.appendChild(linksBox);

	const links = [
		{
			title: '使用说明',
			link: 'https://github.com/guohuan78/chinahrt-autoplay#readme',
		},
		{
			title: '问题反馈',
			link: 'https://github.com/guohuan78/chinahrt-autoplay/issues',
		},
	];

	for (const link of links) {
		let a = document.createElement('a');
		a.innerText = link.title;
		a.target = '_blank';
		a.href = link.link;
		linksBox.appendChild(a);
	}

	controllerBox.appendChild(createAutoPlayOption());
	controllerBox.appendChild(createDragOption());
	controllerBox.appendChild(createMuteOption());
	controllerBox.appendChild(createSpeedOption());

	return controllerBox;
}

const initializedPlayers = new WeakSet();
let playInited = false;

function playerInit() {
    if (currentPageType() !== 2) return;
    installRecordErrorMessages();
    if (recordFailure && recordFailure.href === window.location.href &&
        recordFailure.sectionId === playbackContext().sectionId) return;
    const player = pageWindow.player;
    if (!player || !player.V) return;
    try {
        if (!initializedPlayers.has(player)) {
            if (typeof pageWindow.removePauseBlur === 'function') pageWindow.removePauseBlur();
            // 平台原生 endedHandler 负责提交结束记录，脚本监听该请求的保存结果。
            player.addListener('time', function (time) {
                if (pageWindow.player === player) timeHandler(time);
            });
            initializedPlayers.add(player);
        }
        if (!document.getElementById('controllerBox')) {
            createPlaylistBox();
            createControllerBox();
            createMultiSegmentBox();
        }
        if (player.V.ended || !player.V.paused) return;
        player.changeControlBarShow(true);
        player.changeConfig('config', 'timeScheduleAdjust', drag());
        if (mute()) player.videoMute();
        else player.videoEscMute();
        player.changePlaybackRate(speed());
        if (autoPlay()) player.videoPlay();
    } catch (error) {
        // 播放器与媒体异步就绪，下一轮使用当前实例重试。
    }
}

function playInit() {
    if (playInited) return;
    playInited = true;
    GM_addValueChangeListener('courses', function () {
        if (document.getElementById('playlistBox')) {
            removePlaylistBox();
            createPlaylistBox();
        }
    });
    GM_addValueChangeListener('autoPlay', function () {
        playerInit();
    });
    for (const option of ['mute', 'drag', 'speed']) {
        GM_addValueChangeListener(option, function (name, oldValue, newValue) {
            const player = pageWindow.player;
            if (!player || !player.V || currentPageType() !== 2) return;
            try {
                if (name === 'mute') {
                    if (newValue) player.videoMute();
                    else player.videoEscMute();
                } else if (name === 'drag') {
                    player.changeConfig('config', 'timeScheduleAdjust', newValue);
                } else {
                    player.changePlaybackRate(newValue);
                }
            } catch (error) {
                // 媒体切换期间由 playerInit 重试当前配置。
            }
        });
    }
    // 先安装轮询，首次初始化异常也不会中断后续自动播放。
    setInterval(playerInit, 1000);
    playerInit();
}
function createPlaylistBox() {
    let playlistBox = document.createElement("div");
    playlistBox.id = "playlistBox";
    playlistBox.className = "playlistBox";
    document.body.appendChild(playlistBox);

    let oneClear = document.createElement("button");
    oneClear.innerText = "一键清空";
    oneClear.className = "oneClear";
    oneClear.onclick = function () {
        if (confirm("确定要清空播放列表么？")) {
            coursesList([]);
        }
    };
    playlistBox.appendChild(oneClear);

    const courses = coursesList();
    for (let i = 0; i < courses.length; i++) {
        const course = courses[i];
        let playlistItem = document.createElement("div");
        playlistItem.className = "playlistItem";
        playlistBox.appendChild(playlistItem);

        let childTitle = document.createElement("p");
        childTitle.innerText = course.sectionName;
        childTitle.title = childTitle.innerText;
        childTitle.className = "child_title";
        playlistItem.appendChild(childTitle);

        let childBtn = document.createElement("button");
        childBtn.innerText = "移除";
        childBtn.type = "button";
        childBtn.className = "child_remove";
        childBtn.onclick = function () {
            if (confirm("确定要删除这个视频任务么？")) {
                removeCourse(course.sectionId);
            }
        };
        playlistItem.appendChild(childBtn);
    }
}

function removePlaylistBox() {
    let playlistBox = document.getElementById("playlistBox");
    if (playlistBox) {
        playlistBox.remove();
    }
}

function removeControllerBox() {
    let controllerBox = document.getElementById("controllerBox");
    if (controllerBox) {
        controllerBox.remove();
    }
}

function removeMultiSegmentBox() {
    const boxes = document.getElementsByClassName("multiSegmentBox");
    for (let i = boxes.length - 1; i >= 0; i--) {
        boxes[i].remove();
    }
}
function createSpeedOption() {
    let box = document.createElement('div');
    box.classList.add('speedBox');

    let title = document.createElement('p');
    title.classList.add('title');
    title.innerText = '播放速度';
    box.appendChild(title);

    let options = [
        {text: "0.5x", value: 0.5},
        {text: "1x", value: 1},
        {text: "1.25x", value: 2},
        {text: "1.5x", value: 3},
        {text: "2x", value: 4}
    ]

    options.forEach(option => {
        let label = document.createElement('label');
        label.innerText = option.text;
        box.appendChild(label);
        let input = document.createElement('input');
        input.type = 'radio';
        input.name = 'speed';
        input.value = option.value;
        input.checked = speed() === option.value;
        input.onclick = function () {
            speed(option.value);
        };
        label.appendChild(input);
    });

    let remark = document.createElement('p');
    remark.classList.add('remark');
    remark.innerText = '注意：慎用此功能，后台可能会检测播放数据。';
    box.appendChild(remark);

    return box;
}
let tempCourses = [];

function interceptsXHRCallback(url, response, method, readyState) {
    if (readyState !== 4) return;

    // url: /gp6/lms/stu/course/courseDetail
    if (url.includes("courseDetail")) {
        let canPlaylist = document.getElementById("canPlaylist");
        if (canPlaylist === null) {
            canPlaylist = createCanPlaylist();
        }

        canPlaylist.dispatchEvent(new CustomEvent("clear", {}));
        tempCourses = [];

        const data = typeof response === 'string' ? JSON.parse(response) : response;
        data.data.course.chapter_list.forEach((chapter) => {
            chapter.section_list.forEach((section) => {
                const courseDetail = new CourseDetail();
                courseDetail.courseId = data.data.courseId;
                courseDetail.sectionId = section.id;
                courseDetail.sectionName = section.name;
                courseDetail.trainplanId = data.data.trainplanId;
                courseDetail.study_status = section.study_status;

                tempCourses.push(courseDetail);
                canPlaylist.dispatchEvent(new CustomEvent("append", {
                    detail: courseDetail
                }));
            })
        });
    }
}

function initRouter() {
    const canonicalUrl = new URL(window.location.href);
    if (window.top === window.self && currentPageType() === 2 && /^\/{2,}index\.html$/.test(canonicalUrl.pathname)) {
        canonicalUrl.pathname = '/index.html';
        runtimeStage('canonicalizing-url');
        window.location.replace(canonicalUrl.href);
        return;
    }
    window.addEventListener('message', handleCompletionMessage);
    interceptsXHR(interceptsXHRCallback);
    interceptFetch();
    installRecordErrorMessages();
    runtimeStage('ready');

    GM_addValueChangeListener("courses", function (name, oldValue, newValue, remote) {
            const element = document.getElementById("canPlaylist");
            if (element) {
                element.dispatchEvent(new CustomEvent("refresh", {}));
            }
    });
    if (currentPageType() === 2) {
        playInit();
    }

    // SPA 内 hash 切换不触发页面重载，路由进入播放页时兜底启动播放逻辑
    window.addEventListener("hashchange", function () {
        completedSections.clear();
        if (currentPageType() === 2) {
            playInit();
            playerInit();
        } else {
            removePlaylistBox();
            removeControllerBox();
            removeMultiSegmentBox();
        }
    });
}
class CourseDetail {
    constructor() {
        this.trainplanId = "";
        this.courseId = "";
        this.sectionId = "";
        this.sectionName = "";
        this.study_status = "";
    }

    getUrl() {
        const platformId = RegExp(/platformId=(\d+)/).exec(window.location.href)[1];
        return `https://${window.location.host}/index.html#/v_video?platformId=${platformId}&trainplanId=${this.trainplanId}&courseId=${this.courseId}&sectionId=${this.sectionId}&sectionName=${encodeURI(this.sectionName)}`;
    }
}


(function () {
    initRouter()
})();
