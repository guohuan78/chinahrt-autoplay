const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const scripts = process.env.CHINAHRT_SCRIPT ? [process.env.CHINAHRT_SCRIPT] : [
    'chinahrt-autoplay.js', 'dist/chinahrt-autoplay.js', 'dist/chinahrt-autoplay.user.js',
];
const mainUrl = id => `https://gp.chinahrt.com/index.html#/v_video?platformId=276&courseId=course&sectionId=${id}`;
const frameUrl = 'https://videoadmin.chinahrt.com/videoPlay/playEncrypt?param=test-fixture';
const entries = () => [
    { sectionId: 'one', sectionName: '第一节', url: mainUrl('one') },
    { sectionId: 'two', sectionName: '第二节', url: mainUrl('two') },
    { sectionId: 'three', sectionName: '第三节', url: mainUrl('three') },
];
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

class Events {
    constructor() { this.events = new Map(); }
    addEventListener(type, callback, options) {
        const listeners = this.events.get(type) || [];
        listeners.push({ callback, once: !!(options && options.once) });
        this.events.set(type, listeners);
    }
    removeEventListener(type, callback) {
        this.events.set(type, (this.events.get(type) || []).filter(item => item.callback !== callback));
    }
    dispatchEvent(event) {
        for (const item of [...(this.events.get(event.type) || [])]) {
            if (item.once) this.removeEventListener(event.type, item.callback);
            item.callback.call(this, event);
        }
    }
}

class Element extends Events {
    constructor(tag) {
        super();
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.className = '';
        this.attributes = {};
        this.classList = { add: name => { this.className += ` ${name}`; } };
    }
    appendChild(child) { this.children.push(child); child.parent = this; return child; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name]; }
    descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
    getElementsByClassName(name) { return this.descendants().filter(child => child.className.split(' ').includes(name)); }
    getElementsByTagName(tag) { return this.descendants().filter(child => child.tagName === tag.toUpperCase()); }
}

function makePlayer(paused = false) {
    const player = new Events();
    player.V = { ended: false, paused };
    player.playCalls = 0;
    player.clearCalls = 0;
    player.addListener = player.addEventListener;
    player.removeListener = player.removeEventListener;
    player.videoPlay = function () { this.playCalls++; this.V.paused = false; };
    player.videoClear = function () { this.clearCalls++; this.V = null; };
    for (const name of ['videoMute', 'videoEscMute', 'changePlaybackRate', 'changeControlBarShow', 'changeConfig']) {
        player[name] = () => {};
    }
    player.getMetaDate = () => ({ duration: 600 });
    return player;
}

function environment(script, options = {}) {
    const navigation = [];
    let href = options.href || mainUrl('one');
    const location = {
        get href() { return href; },
        set href(value) { href = String(value); navigation.push(href); },
        get pathname() { return new URL(href).pathname; },
        get origin() { return new URL(href).origin; },
        get hash() { return new URL(href).hash; },
        get host() { return new URL(href).host; },
        replace(value) { this.href = value; },
    };
    const document = {
        head: new Element('head'), body: new Element('body'), documentElement: new Element('html'), referrer: options.referrer || '',
        createElement: tag => new Element(tag), createTextNode: text => Object.assign(new Element('#text'), { textContent: text }),
        getElementById(id) { return this.body.descendants().find(el => el.id === id) || null; },
        getElementsByClassName(name) { return this.body.getElementsByClassName(name); },
        querySelectorAll(tag) { return this.body.getElementsByTagName(tag); },
    };
    const requests = [];
    class XHR extends Events {
        open(method, url) { this.method = method; this.url = String(url); this.readyState = 1; }
        send(body) { this.body = body; requests.push(this); }
        respond(data, status = 200) {
            this.response = typeof data === 'string' ? data : JSON.stringify(data);
            this.status = status;
            this.readyState = 4;
            this.dispatchEvent({ type: 'readystatechange' });
            try {
                if (status && this.onload) this.onload();
            } finally {
                // 浏览器在 load 回调抛错后仍会派发 loadend；保留异常供用例断言。
                this.dispatchEvent({ type: 'loadend' });
            }
        }
    }
    const window = new Events();
    Object.assign(window, { location, document, self: window, top: options.top || window });
    const page = options.isolated === false ? window : {};
    Object.assign(page, {
        XMLHttpRequest: XHR, fetch: options.fetch || (() => Promise.resolve(new Response('{"ok":true}'))),
        attrset: { sectionId: options.sectionId || 'one', signId: 'fixture-token', maxTime: 600 },
        removePauseBlur() {},
        courseyunRecord() {},
    });
    const player = options.player === undefined ? makePlayer() : options.player;
    if (player) page.player = player;
    if (options.noAttributes) delete page.attrset;
    // 对照真实页面：平台原生结束回调发送 token 请求，平台轮询负责更新 signId。
    const prefilters = [];
    const jquery = { ajaxPrefilter(callback) { prefilters.push(callback); }, ajax(settings) {
        const options = { ...settings };
        const xhr = new page.XMLHttpRequest();
        for (const prefilter of prefilters) prefilter(options, settings, xhr);
        xhr.open(options.type || 'GET', options.url);
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const filtered = options.dataFilter ? options.dataFilter.call(options, xhr.response, options.dataType) : xhr.response;
                const data = typeof filtered === 'string' ? JSON.parse(filtered) : filtered;
                if (options.success) options.success.call(options.context || options, data);
            } else if (options.error) options.error(xhr);
            if (options.complete) options.complete();
        };
        xhr.send(options.data);
        return xhr;
    } };
    if (!options.jqueryDelayed) page.$ = jquery;
    page.endedHandler = function () {
        page.courseyunRecord();
        player.videoClear();
        page.$.ajax({
            type: 'post', url: '/videoPlay/takeRecordByToken',
            data: JSON.stringify({ token: page.attrset.signId, time: page.attrset.maxTime, isEnd: true }),
            success() {},
        });
    };
    if (player) player.addListener('ended', page.endedHandler);
    // sandbox 与 page realm 分离，用于验证 unsafeWindow 访问。
    window.XMLHttpRequest = options.isolated === false ? XHR : class SandboxXHR {};
    window.fetch = page.fetch;
    const stored = new Map([['courses', structuredClone(options.courses || entries())]]);
    const valueListeners = new Map();
    const notifications = [];
    const intervals = [];
    const timers = [];
    const context = vm.createContext({
        window, document, unsafeWindow: page, URL, URLSearchParams, Promise, Response, Request,
        console: { info() {}, log() {}, warn() {} },
        setInterval: fn => { intervals.push(fn); return intervals.length; }, clearInterval() {},
        setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
        confirm: () => true, CustomEvent: class { constructor(type, data) { this.type = type; Object.assign(this, data); } },
        GM_getValue: (key, fallback) => structuredClone(stored.has(key) ? stored.get(key) : fallback),
        GM_setValue(key, value) {
            const old = stored.get(key);
            stored.set(key, structuredClone(value));
            for (const callback of valueListeners.get(key) || []) callback(key, old, value, false);
        },
        GM_addValueChangeListener(key, callback) {
            const listeners = valueListeners.get(key) || [];
            listeners.push(callback);
            valueListeners.set(key, listeners);
        },
        GM_notification(value) {
            if (options.notificationThrows) throw new Error('Notifications unavailable');
            notifications.push(value.text);
        },
    });
    if (options.exposeGlobals) Object.assign(context, page);
    vm.runInContext(fs.readFileSync(path.resolve(root, script), 'utf8'), context, { filename: script });
    return {
        window, page, document, context, requests, navigation, notifications, intervals, timers, stored, jquery, prefilters,
        ids: () => stored.get('courses').map(course => String(course.sectionId)),
        record(body = { token: page.attrset?.signId, time: 600, isEnd: true }, url = '/videoPlay/takeRecordByToken') {
            const request = new page.XMLHttpRequest();
            request.open('POST', url);
            request.send(typeof body === 'string' ? body : JSON.stringify(body));
            return request;
        },
        tick() { for (const callback of intervals) callback(); },
    };
}

for (const script of scripts) {
    test(`${script}: 平台原生 token 结束请求保存后移除并连播`, async () => {
        const app = environment(script, { href: frameUrl, exposeGlobals: true });
        app.tick();
        app.page.player.dispatchEvent({ type: 'ended' });
        assert.equal(app.requests.length, 1);
        assert.equal(app.requests[0].url, '/videoPlay/takeRecordByToken');
        assert.equal(JSON.parse(app.requests[0].body).isEnd, true);
        assert.deepEqual(app.ids(), ['one', 'two', 'three']);
        app.requests[0].respond({ status: '0' });
        assert.deepEqual(app.ids(), ['two', 'three']);
        assert.deepEqual(app.navigation, [mainUrl('two')]);
        app.tick();
        assert.equal(app.requests.length, 1);
        await flush();
    });

    test(`${script}: 已在播放时仍能接收结束记录且保留平台监听`, () => {
        const player = makePlayer(false);
        const app = environment(script, { href: frameUrl, player });
        app.tick(); app.tick();
        assert.equal(player.events.get('ended').length, 1);
        assert.equal(player.events.get('ended')[0].callback, app.page.endedHandler);
        assert.equal(player.events.get('time').length, 1);
        assert.equal(app.document.documentElement.getAttribute('data-chinahrt-autoplay-stage'), 'ready');
        const record = app.record();
        assert.equal(app.document.documentElement.getAttribute('data-chinahrt-autoplay-stage'), 'waiting-record');
        record.respond({ status: 0 });
        assert.deepEqual(app.navigation, [mainUrl('two')]);
        assert.equal(app.document.documentElement.getAttribute('data-chinahrt-autoplay-stage'), 'navigating');
    });

    test(`${script}: 跨域 iframe 报告完成并由主页面导航`, () => {
        const parent = environment(script, { player: null, noAttributes: true });
        const frame = parent.document.createElement('iframe');
        frame.src = frameUrl;
        const frameWindow = {};
        frame.contentWindow = frameWindow;
        parent.document.body.appendChild(frame);
        const messages = [];
        const child = environment(script, {
            href: frameUrl, referrer: mainUrl('one'),
            top: {
                get location() { throw new Error('Cross-origin navigation is blocked'); },
                postMessage(data, origin) {
                    messages.push({ data, origin });
                    parent.window.dispatchEvent({ type: 'message', data, origin: 'https://videoadmin.chinahrt.com', source: frameWindow });
                },
            },
        });
        child.record().respond({ status: '0' });
        assert.deepEqual(parent.ids(), ['two', 'three']);
        assert.deepEqual(parent.navigation, [mainUrl('two')]);
        assert.deepEqual(child.navigation, []);
        assert.equal(messages[0].origin, 'https://gp.chinahrt.com');
        assert.deepEqual(Object.keys(messages[0].data).sort(), ['sectionId', 'type']);
        assert.equal(child.document.documentElement.getAttribute('data-chinahrt-autoplay-stage'), 'notified-parent');
    });

    test(`${script}: 仅接受当前播放器和当前小节的完成消息`, () => {
        const app = environment(script, { player: null });
        const frame = app.document.createElement('iframe');
        frame.src = frameUrl;
        frame.contentWindow = {};
        app.document.body.appendChild(frame);
        const event = { type: 'message', data: { type: 'chinahrt-autoplay:record-saved', sectionId: 'one' },
            source: frame.contentWindow, origin: 'https://videoadmin.chinahrt.com' };
        app.window.dispatchEvent({ ...event, source: {} });
        app.window.dispatchEvent({ ...event, origin: 'https://example.com' });
        app.window.dispatchEvent({ ...event, data: { ...event.data, sectionId: 'two' } });
        assert.deepEqual(app.ids(), ['one', 'two', 'three']);
        app.window.dispatchEvent(event);
        app.window.dispatchEvent(event);
        assert.deepEqual(app.navigation, [mainUrl('two')]);
    });

    test(`${script}: 心跳记录和失败响应保留队列`, () => {
        const app = environment(script, { href: frameUrl });
        app.record({ token: 'fixture-token', time: 120 }).respond({ status: '0' });
        app.record({ token: 'fixture-token', time: 120, isEnd: false }).respond({ status: '0' });
        app.record().respond({ status: '-1' });
        app.record().respond({ status: '0' }, 500);
        app.record().respond('', 0);
        app.record().respond('<html>login</html>');
        app.record().respond({ message: 'ok' });
        assert.deepEqual(app.ids(), ['one', 'two', 'three']);
        assert.deepEqual(app.navigation, []);
        app.record().respond({ status: '0' });
        assert.deepEqual(app.navigation, [mainUrl('two')]);
    });

    test(`${script}: 心跳错误说明在原生弹窗前补齐且保留失败处理`, () => {
        const app = environment(script, { href: frameUrl });
        let popup;
        const body = JSON.stringify({ token: 'fixture-token', time: 120 });
        const response = { status: '-2', message: '服务端提供的具体原因', data: 'private-response-token' };
        const request = app.page.$.ajax({
            type: 'post', url: '/videoPlay/takeRecordByToken', data: body, dataType: 'json',
            success(data) {
                assert.equal(data.status, '-2');
                assert.equal(data.data, 'private-response-token');
                if (data.status === '-2') {
                    popup = data.error_desc;
                    assert.equal(app.document.documentElement.getAttribute('data-chinahrt-autoplay-stage'), 'record-failed');
                    app.page.player.videoClear();
                }
            },
        });
        request.respond(response);
        assert.equal(popup, response.message);
        assert.equal(request.body, body);
        assert.deepEqual(JSON.parse(request.response), response);
        assert.equal(app.page.player.clearCalls, 1);
        assert.deepEqual(app.ids(), ['one', 'two', 'three']);
        assert.deepEqual(app.navigation, []);
        const diagnostic = app.document.documentElement.getAttribute('data-chinahrt-record-error');
        assert.deepEqual(JSON.parse(diagnostic), {
            kind: 'progress', httpStatus: 200, status: '-2', errorDescriptionMissing: true, message: response.message,
        });
        assert.ok(!diagnostic.includes('fixture-token'));
        assert.ok(!diagnostic.includes('private-response-token'));
    });

    test(`${script}: 缺失或无效错误字段显示状态码和重试说明`, () => {
        for (const error_desc of [undefined, null, '', '  ', 'undefined', ' NULL ', 12]) {
            const app = environment(script, { href: frameUrl });
            let popup;
            app.page.$.ajax({
                type: 'POST', url: '/videoPlay/takeRecordByToken', data: '{"token":"fixture-token","time":120}',
                success(data) { popup = data.error_desc; },
            }).respond({ status: -2, error_desc });
            assert.match(popup, /平台状态码：-2/);
            assert.match(popup, /刷新当前课程/);
            assert.doesNotMatch(popup, /undefined|null/i);
            assert.deepEqual(app.navigation, []);
        }
    });

    test(`${script}: 保留原有错误说明并按字段优先级选择说明`, () => {
        for (const [response, expected] of [
            [{ status: '-2', error_desc: ' 原有说明 ', message: '备用说明' }, ' 原有说明 '],
            [{ status: '-2', message: ' message 说明 ', msg: '备用说明' }, 'message 说明'],
            [{ status: '-2', error_desc: 'undefined', message: 'null', msg: 'msg 说明' }, 'msg 说明'],
        ]) {
            const app = environment(script, { href: frameUrl });
            let received;
            app.page.$.ajax({
                type: 'POST', url: '/videoPlay/takeRecordByToken', data: '{"token":"fixture-token","time":120}',
                success(data) { received = data; },
            }).respond(response);
            assert.equal(received.error_desc, expected);
            assert.equal(received.status, response.status);
        }
    });

    test(`${script}: 成功心跳保留原始响应和平台 token 轮换`, () => {
        const app = environment(script, { href: frameUrl });
        const response = { status: '0', data: 'next-fixture-token' };
        app.page.$.ajax({
            type: 'POST', url: '/videoPlay/takeRecordByToken', data: '{"token":"fixture-token","time":120}',
            success(data) {
                assert.deepEqual(data, response);
                app.page.attrset.signId = data.data;
            },
        }).respond(response);
        assert.equal(app.page.attrset.signId, response.data);
        assert.equal(app.document.documentElement.getAttribute('data-chinahrt-autoplay-stage'), 'progress-saved');
        assert.equal(app.document.documentElement.getAttribute('data-chinahrt-record-error'), undefined);
        assert.deepEqual(app.navigation, []);
        app.record().respond({ status: '0' });
        assert.deepEqual(app.navigation, [mainUrl('two')]);
    });

    test(`${script}: 错误处理兼容已有 dataFilter 的参数和上下文`, () => {
        const app = environment(script, { href: frameUrl });
        let filterCalls = 0;
        const settings = {
            type: 'post', url: '/videoPlay/takeRecordByToken', data: '{"token":"fixture-token","time":120}', dataType: 'json',
            dataFilter(raw, type) {
                filterCalls++;
                assert.equal(type, 'json');
                assert.equal(this.url, settings.url);
                return raw.slice(4);
            },
            success(data) { assert.equal(data.error_desc, '过滤后的说明'); },
        };
        const originalFilter = settings.dataFilter;
        app.page.$.ajax(settings).respond('head{"status":"-2","message":"过滤后的说明"}');
        assert.equal(filterCalls, 1);
        assert.equal(settings.dataFilter, originalFilter);
    });

    test(`${script}: 非记录接口和其他课程请求保持原始响应`, () => {
        const app = environment(script, { href: frameUrl });
        const response = { status: '-2', message: '其他请求' };
        for (const [url, data] of [
            ['/another-api', '{"token":"fixture-token","time":120}'],
            ['https://example.com/videoPlay/takeRecordByToken', '{"token":"fixture-token","time":120}'],
            ['/videoPlay/takeRecordByToken', '{"token":"other-fixture-token","time":120}'],
        ]) {
            app.page.$.ajax({ type: 'POST', url, data, success(value) { assert.deepEqual(value, response); } }).respond(response);
        }
        assert.equal(app.document.documentElement.getAttribute('data-chinahrt-record-error'), undefined);
        assert.deepEqual(app.navigation, []);
    });

    test(`${script}: 非 JSON 和缺失业务状态的响应由平台原样处理`, () => {
        const app = environment(script, { href: frameUrl });
        const options = { type: 'POST', url: '/videoPlay/takeRecordByToken', data: '{"token":"fixture-token","time":120}' };
        for (const prefilter of app.prefilters) prefilter(options, options, {});
        for (const value of ['<html>login</html>', 'null', '[]', '{"message":"no status"}']) {
            assert.equal(options.dataFilter(value, 'json'), value);
        }
    });

    test(`${script}: 业务失败后自动播放等待当前课程保存恢复`, () => {
        const app = environment(script, { href: frameUrl });
        app.record({ token: 'fixture-token', time: 120 }).respond({ status: '-2' });
        app.page.player.V.paused = true;
        app.tick(); app.tick();
        app.context.GM_setValue('autoPlay', true);
        assert.equal(app.page.player.playCalls, 0);
        assert.deepEqual(app.navigation, []);
        app.record({ token: 'fixture-token', time: 150 }).respond({ status: '0' });
        app.tick();
        assert.equal(app.page.player.playCalls, 1);
        assert.equal(app.document.documentElement.getAttribute('data-chinahrt-autoplay-stage'), 'progress-saved');
    });

    test(`${script}: 旧小节错误不会阻止新小节自动播放`, () => {
        const app = environment(script, { href: frameUrl });
        const pending = app.record({ token: 'fixture-token', time: 120 });
        app.page.attrset.sectionId = 'two';
        app.page.player.V.paused = true;
        pending.respond({ status: '-2' });
        app.tick();
        assert.equal(app.page.player.playCalls, 1);
        assert.equal(app.document.documentElement.getAttribute('data-chinahrt-record-error'), undefined);
    });

    test(`${script}: 延迟加载 jQuery 时安装一次错误说明处理`, () => {
        const app = environment(script, { href: frameUrl, jqueryDelayed: true });
        assert.equal(app.prefilters.length, 0);
        app.page.$ = app.jquery;
        app.tick(); app.tick();
        assert.equal(app.prefilters.length, 1);
        assert.equal(app.document.documentElement.getAttribute('data-chinahrt-record-messages'), 'ready');
        let popup;
        app.page.$.ajax({
            type: 'POST', url: '/videoPlay/takeRecordByToken', data: '{"token":"fixture-token","time":120}',
            success(data) { popup = data.error_desc; },
        }).respond({ status: '-2' });
        assert.match(popup, /平台状态码：-2/);
    });

    test(`${script}: fetch 心跳错误留下诊断且保留原始响应`, async () => {
        const response = { status: '-2', message: 'fetch 心跳失败' };
        const app = environment(script, { href: frameUrl, fetch: () => Promise.resolve(new Response(JSON.stringify(response))) });
        const result = await app.page.fetch('/videoPlay/takeRecordByToken', {
            method: 'POST', body: '{"token":"fixture-token","time":120}',
        });
        assert.deepEqual(await result.json(), response);
        await flush();
        const diagnostic = JSON.parse(app.document.documentElement.getAttribute('data-chinahrt-record-error'));
        assert.equal(diagnostic.kind, 'progress');
        assert.equal(diagnostic.status, '-2');
        assert.deepEqual(app.navigation, []);
    });

    test(`${script}: 原生成功回调异常仍按已保存的结束记录连播`, () => {
        const app = environment(script, { href: frameUrl });
        const request = app.page.$.ajax({
            type: 'POST', url: '/videoPlay/takeRecordByToken', data: '{"token":"fixture-token","time":600,"isEnd":true}',
            success() { throw new ReferenceError('nextUrl is not defined'); },
        });
        assert.throws(() => request.respond({ status: '0' }), /nextUrl is not defined/);
        assert.deepEqual(app.navigation, [mainUrl('two')]);
    });

    test(`${script}: 旧接口表单和旧播放列表数据兼容`, () => {
        const app = environment(script, { href: frameUrl, sectionId: 42, courses: [
            { title: '旧版课程', url: mainUrl('42') }, null,
            { sectionName: '下一节', url: mainUrl('two') },
        ] });
        app.record('sectionId=42&isEnd=true', '/videoPlay/takeRecord').respond({ status: 0 });
        assert.deepEqual(app.ids(), ['two']);
        assert.deepEqual(app.navigation, [mainUrl('two')]);
        assert.ok(app.notifications.every(text => !text.includes('undefined')));
    });

    test(`${script}: 发送时匹配 token 并允许响应前正常轮换`, () => {
        const app = environment(script, { href: frameUrl });
        app.record({ token: 'another-token', isEnd: true }).respond({ status: '0' });
        assert.deepEqual(app.navigation, []);
        const request = app.record();
        app.page.attrset.signId = 'refreshed-token';
        request.respond({ status: '0' });
        assert.deepEqual(app.ids(), ['two', 'three']);
    });

    test(`${script}: 路由或小节变化后忽略旧请求响应`, () => {
        for (const change of ['route', 'section']) {
            const app = environment(script, { href: frameUrl });
            const request = app.record();
            if (change === 'route') app.window.location.href = `${frameUrl}&next=2`;
            else app.page.attrset.sectionId = 'two';
            request.respond({ status: '0' });
            assert.deepEqual(app.ids(), ['one', 'two', 'three']);
        }
    });

    test(`${script}: 最后一节完成只移除一次并通知`, () => {
        const app = environment(script, { href: frameUrl, courses: entries().slice(0, 1) });
        const one = app.record(), duplicate = app.record();
        one.respond({ status: '0' });
        duplicate.respond({ status: '0' });
        assert.deepEqual(app.ids(), []);
        assert.deepEqual(app.navigation, []);
        assert.equal(app.notifications.filter(text => text === '所有视频已经播放完毕').length, 1);
    });

    test(`${script}: 通知权限异常不影响跳转`, () => {
        const app = environment(script, { href: frameUrl, notificationThrows: true });
        app.record().respond({ status: '0' });
        assert.deepEqual(app.navigation, [mainUrl('two')]);
    });

    test(`${script}: 播放器延迟出现及 SPA 替换可恢复自动播放`, () => {
        const app = environment(script, { player: null, noAttributes: true });
        app.tick();
        app.page.player = makePlayer(true);
        app.tick(); app.tick();
        assert.equal(app.page.player.playCalls, 1);
        const replacement = makePlayer(true);
        app.page.player = replacement;
        app.window.dispatchEvent({ type: 'hashchange' });
        app.tick();
        assert.equal(replacement.playCalls, 1);
        assert.equal(replacement.events.get('time').length, 1);
        assert.equal(app.document.getElementsByClassName('controllerBox').length, 1);
    });

    test(`${script}: 普通页面启动后可进入 SPA 播放页`, () => {
        const app = environment(script, { href: 'https://gp.chinahrt.com/index.html', player: null, noAttributes: true });
        app.window.location.href = mainUrl('one');
        app.window.dispatchEvent({ type: 'hashchange' });
        app.page.player = makePlayer(true);
        app.tick();
        assert.equal(app.page.player.playCalls, 1);
        app.window.location.href = 'https://gp.chinahrt.com/index.html#/v_selected_course';
        app.window.dispatchEvent({ type: 'hashchange' });
        app.page.player.V.paused = true;
        app.tick();
        assert.equal(app.page.player.playCalls, 1);
        assert.equal(app.document.getElementById('controllerBox'), null);
    });

    test(`${script}: 自动播放重试与开关`, () => {
        const player = makePlayer(true);
        player.videoPlay = function () { this.playCalls++; if (this.playCalls > 1) this.V.paused = false; };
        const app = environment(script, { href: frameUrl, player });
        assert.equal(player.playCalls, 1);
        app.tick();
        assert.equal(player.playCalls, 2);
        app.context.GM_setValue('autoPlay', false);
        player.V.paused = true;
        app.tick();
        assert.equal(player.playCalls, 2);
        app.context.GM_setValue('autoPlay', true);
        assert.equal(player.playCalls, 3);
    });

    test(`${script}: fetch 响应保持可读且只处理结束记录`, async () => {
        const response = new Response('{"status":"0"}');
        const nativePromise = Promise.resolve(response);
        let requestBody;
        const app = environment(script, { href: frameUrl, fetch(input, options) { requestBody = options.body; return nativePromise; } });
        const result = app.page.fetch('/videoPlay/takeRecordByToken', {
            method: 'POST', body: JSON.stringify({ token: 'fixture-token', isEnd: true }),
        });
        assert.equal(result, nativePromise);
        assert.equal(JSON.parse(requestBody).isEnd, true);
        await flush();
        assert.equal((await response.json()).status, '0');
        await flush();
        assert.deepEqual(app.navigation, [mainUrl('two')]);
    });

    test(`${script}: fetch Request 和普通响应不会被消耗`, async () => {
        let platformRequest;
        const app = environment(script, { href: frameUrl, fetch(input) {
            platformRequest = input;
            return Promise.resolve(new Response('{"status":0}'));
        } });
        const request = new Request('https://videoadmin.chinahrt.com/videoPlay/takeRecordByToken', {
            method: 'POST', body: JSON.stringify({ token: 'fixture-token', isEnd: true }),
        });
        const response = await app.page.fetch(request);
        await flush();
        assert.equal(platformRequest, request);
        assert.equal(request.bodyUsed, false);
        assert.equal(response.bodyUsed, false);
        assert.deepEqual(app.navigation, [mainUrl('two')]);
        const ordinary = environment(script, { fetch: () => Promise.resolve(new Response('<html>page</html>')) });
        assert.equal(await (await ordinary.page.fetch('/index.html')).text(), '<html>page</html>');
        assert.deepEqual(ordinary.navigation, []);
    });

    test(`${script}: 平台立即读取 fetch 响应仍能观察保存结果`, async () => {
        const app = environment(script, { href: frameUrl, fetch: () => Promise.resolve(new Response('{"status":0}')) });
        const response = await app.page.fetch('/videoPlay/takeRecordByToken', {
            method: 'POST', body: JSON.stringify({ token: 'fixture-token', isEnd: true }),
        }).then(response => response.json());
        assert.equal(response.status, 0);
        await flush();
        assert.deepEqual(app.navigation, [mainUrl('two')]);
    });

    test(`${script}: 跨站或非结束接口响应不推进队列`, () => {
        const app = environment(script, { href: frameUrl });
        app.record(undefined, 'https://example.com/videoPlay/takeRecordByToken').respond({ status: '0' });
        app.record(undefined, '/videoPlay/takeRecordByToken/unrelated').respond({ status: '0' });
        assert.deepEqual(app.ids(), ['one', 'two', 'three']);
        assert.deepEqual(app.navigation, []);
    });

    test(`${script}: 按当前小节匹配且保留其他队列项`, () => {
        const app = environment(script, { href: frameUrl, sectionId: 'two' });
        app.record().respond({ status: '0' });
        assert.deepEqual(app.ids(), ['one', 'three']);
        assert.deepEqual(app.navigation, [mainUrl('one')]);
        const missing = environment(script, { href: frameUrl, sectionId: 'not-in-queue' });
        missing.record().respond({ status: '0' });
        assert.deepEqual(missing.ids(), ['one', 'two', 'three']);
        assert.deepEqual(missing.navigation, [mainUrl('one')]);
    });

    test(`${script}: 当前视频已移出队列时仍自动播放队列第一项`, () => {
        const app = environment(script, { href: frameUrl, courses: entries().slice(1) });
        const request = app.record();
        request.respond({ status: '0' });
        request.respond({ status: '0' });
        assert.deepEqual(app.ids(), ['two', 'three']);
        assert.deepEqual(app.navigation, [mainUrl('two')]);
    });

    test(`${script}: 跨域完成消息在当前视频已移出队列时继续连播`, () => {
        const app = environment(script, { player: null, courses: entries().slice(1) });
        const frame = app.document.createElement('iframe');
        frame.src = frameUrl;
        frame.contentWindow = {};
        app.document.body.appendChild(frame);
        app.window.dispatchEvent({ type: 'message', source: frame.contentWindow,
            origin: 'https://videoadmin.chinahrt.com',
            data: { type: 'chinahrt-autoplay:record-saved', sectionId: 'one' } });
        assert.deepEqual(app.ids(), ['two', 'three']);
        assert.deepEqual(app.navigation, [mainUrl('two')]);
    });

    test(`${script}: 课程页双斜线地址规范化后完整加载`, () => {
        const app = environment(script, { href: mainUrl('one').replace('/index.html', '//index.html'), player: null });
        assert.deepEqual(app.navigation, [mainUrl('one')]);
    });

    test(`${script}: 下一节队列中的双斜线地址规范化`, () => {
        const courses = entries();
        courses[1].url = mainUrl('two').replace('/index.html', '//index.html');
        const app = environment(script, { href: frameUrl, courses });
        app.record().respond({ status: 0 });
        assert.deepEqual(app.navigation, [mainUrl('two')]);
    });

    test(`${script}: 缺失小节身份及错误标识保留全部队列`, () => {
        const app = environment(script, { href: frameUrl, noAttributes: true });
        app.record({ isEnd: true }).respond({ status: 0 });
        app.context.removeCourse(undefined);
        app.context.removeCourse(null);
        assert.deepEqual(app.ids(), ['one', 'two', 'three']);
        const other = environment(script, { href: frameUrl });
        other.record('sectionId=two&isEnd=true', '/videoPlay/takeRecord').respond({ status: 0 });
        assert.deepEqual(other.ids(), ['one', 'two', 'three']);
    });

    test(`${script}: 下一节地址按站点和协议校验`, () => {
        for (const url of ['javascript:alert(1)', 'https://example.com/course', undefined]) {
            const courses = entries();
            courses[1].url = url;
            const app = environment(script, { href: frameUrl, courses });
            app.record().respond({ status: 0 });
            assert.deepEqual(app.ids(), ['two', 'three']);
            assert.deepEqual(app.navigation, []);
        }
    });

    test(`${script}: 复用 XMLHttpRequest 时每次只处理当前请求`, () => {
        const app = environment(script, { href: frameUrl });
        const request = app.record({ token: 'fixture-token', time: 30 });
        request.respond({ status: 0 });
        request.open('POST', '/videoPlay/takeRecordByToken');
        request.send(JSON.stringify({ token: 'fixture-token', isEnd: true }));
        request.respond({ status: 0 });
        assert.deepEqual(app.ids(), ['two', 'three']);
        assert.deepEqual(app.navigation, [mainUrl('two')]);
        assert.equal(request.events.get('loadend').length, 0);
    });
}

if (!process.env.CHINAHRT_SCRIPT) {
    test('发布文件与源码一致且版本同步', () => {
        const source = fs.readFileSync(path.join(root, 'chinahrt-autoplay.js'), 'utf8');
        assert.equal(fs.readFileSync(path.join(root, 'dist/chinahrt-autoplay.js'), 'utf8'), source);
        const version = require('../package.json').version;
        assert.ok(source.includes(`// @version      ${version}`));
        assert.ok(source.includes(`const runtimeVersion = '${version}';`));
        assert.ok(fs.readFileSync(path.join(root, 'dist/chinahrt-autoplay.user.js'), 'utf8').includes(`// @version      ${version}`));
        assert.equal(require('../package-lock.json').version, version);
        assert.equal(require('../package-lock.json').packages[''].version, version);
    });
}
