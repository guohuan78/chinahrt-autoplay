const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
// 平台当前使用 jQuery 1.9.1；作为测试依赖运行其真实 Ajax 转换流程。
const jquerySource = fs.readFileSync(require.resolve('jquery/jquery.js'), 'utf8');
const scripts = process.env.CHINAHRT_SCRIPT ? [process.env.CHINAHRT_SCRIPT] : [
    'chinahrt-autoplay.js', 'dist/chinahrt-autoplay.js', 'dist/chinahrt-autoplay.user.js',
];

function fixture(script) {
    const dom = new JSDOM('<!doctype html><html><head></head><body><div id="video"></div></body></html>', {
        url: 'https://videoadmin.chinahrt.com/videoPlay/playEncrypt?param=test-fixture',
        runScripts: 'outside-only',
    });
    const win = dom.window;
    win.eval(jquerySource);
    win.unsafeWindow = win;
    win.attrset = { sectionId: 'one', signId: 'fixture-token' };
    win.setInterval = () => 0;
    const stored = new Map([['courses', [{ sectionId: 'one', sectionName: '第一节' }]]]);
    win.GM_getValue = (name, fallback) => stored.has(name) ? structuredClone(stored.get(name)) : fallback;
    win.GM_setValue = (name, value) => stored.set(name, structuredClone(value));
    win.GM_addValueChangeListener = () => {};
    win.GM_notification = () => {};
    const alerts = [];
    win.alert = message => alerts.push(String(message));
    let transport;
    // 自定义本地 transport，所有请求均在内存完成，不访问训练平台。
    win.$.ajaxTransport('+*', options => ({
        send(headers, complete) { transport = { options, complete }; },
        abort() {},
    }));
    win.eval(fs.readFileSync(path.resolve(root, script), 'utf8'));
    return {
        dom, win, stored, alerts,
        request(settings, data) {
            const xhr = win.$.ajax({
                type: 'post', url: '/videoPlay/takeRecordByToken', dataType: 'json',
                contentType: 'text/html', data: '{"token":"fixture-token","time":120}', ...settings,
            });
            const originalBody = transport.options.data;
            const response = typeof data === 'string' ? data : JSON.stringify(data);
            transport.complete(200, 'OK', { text: response }, 'Content-Type: application/json\r\n');
            assert.equal(xhr.responseText, response);
            assert.equal(transport.options.data, originalBody);
            return xhr;
        },
    };
}

for (const script of scripts) {
    test(`${script}: jQuery 1.9.1 的中途失败弹窗获得具体说明`, () => {
        const app = fixture(script);
        try {
            app.request({ success(data) {
                assert.equal(data.status, '-2');
                if (data.status === '-2') {
                    app.win.alert(data.error_desc);
                    app.win.$('#video').remove();
                    app.win.$('body').html('<h1>' + data.error_desc + '！</h1>');
                }
            } }, { status: '-2', message: '平台返回的具体原因' });
            assert.deepEqual(app.alerts, ['平台返回的具体原因']);
            assert.equal(app.win.document.querySelector('h1').textContent, '平台返回的具体原因！');
            assert.equal(app.win.document.querySelector('#video'), null);
            assert.equal(app.stored.get('courses').length, 1);
            const error = JSON.parse(app.win.document.documentElement.getAttribute('data-chinahrt-record-error'));
            assert.equal(error.status, '-2');
            assert.equal(error.kind, 'progress');
            assert.equal(error.errorDescriptionMissing, true);
        } finally { app.dom.window.close(); }
    });

    test(`${script}: jQuery 1.9.1 缺失所有说明字段时提示状态码`, () => {
        const app = fixture(script);
        try {
            app.request({ success(data) { app.win.alert(data.error_desc); } }, { status: '-2' });
            assert.match(app.alerts[0], /平台状态码：-2/);
            assert.doesNotMatch(app.alerts[0], /undefined/);
        } finally { app.dom.window.close(); }
    });

    test(`${script}: jQuery 1.9.1 原有说明与成功 token 保持原值`, () => {
        const app = fixture(script);
        try {
            app.request({ success(data) { assert.equal(data.error_desc, ' 原始说明 '); } }, { status: '-2', error_desc: ' 原始说明 ' });
            app.request({ success(data) {
                assert.equal(data.status, '0');
                assert.equal(data.error_desc, undefined);
                app.win.attrset.signId = data.data;
            } }, { status: '0', data: 'rotated-fixture-token' });
            assert.equal(app.win.attrset.signId, 'rotated-fixture-token');
        } finally { app.dom.window.close(); }
    });

    test(`${script}: jQuery 1.9.1 串联既有 dataFilter 并保留其他接口`, () => {
        const app = fixture(script);
        try {
            let calls = 0;
            app.request({
                dataFilter(raw, type) {
                    calls++;
                    assert.equal(type, 'json');
                    assert.equal(this.url, '/videoPlay/takeRecordByToken');
                    return raw.slice(4);
                },
                success(data) { assert.equal(data.error_desc, '已过滤的说明'); },
            }, 'head{"status":"-2","message":"已过滤的说明"}');
            assert.equal(calls, 1);
            app.request({ url: '/unrelated', success(data) { assert.equal(data.error_desc, undefined); } }, { status: '-2' });
        } finally { app.dom.window.close(); }
    });
}
