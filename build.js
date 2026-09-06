const fs = require("fs");
const uglifyjs = require("uglify-js");

// 根目录 chinahrt-autoplay.js 是唯一事实源
const source = fs.readFileSync("./chinahrt-autoplay.js", "utf8");

if (!fs.existsSync("./dist")) fs.mkdirSync("./dist");

// 未压缩版：调试用，也是 GreasyFork 发布用（平台规则禁止压缩/混淆代码）
fs.writeFileSync("./dist/chinahrt-autoplay.js", source);

// 压缩版：供 raw 链接安装
const header = source.split("// ==/UserScript==")[0] + "// ==/UserScript==\r\n";
const result = uglifyjs.minify(source);
if (result.error) throw result.error;
fs.writeFileSync("./dist/chinahrt-autoplay.user.js", header + result.code);

console.log("build ok");
