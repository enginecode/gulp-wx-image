const oss = require("ali-oss");
var through = require("through2");
var gutil = require("gulp-util");
const putil = require('path');
const md5 = require("md5-file");
const fs = require('fs');
var PluginError = gutil.PluginError;

const PLUGIN_NAME = "gulp-alioss";
const uploadCache = {};

function checkFileSize(limit, file) {
    let size = fs.statSync(file).size;
    console.log(size);
    return size < limit;
}

function toBase64(file) {
    let bitmap = fs.readFileSync(file);
    let base64str = Buffer.from(bitmap, 'binary').toString('base64');
    return base64str;
}

function alioss(config) {
    const {
        accessKeyId,
        accessKeySecret,
        endpoint,
        region='oss-cn-hangzhou',
        bucket,
        cname=true,
        timeout= 10000,
        isRequestPay= false,
        secure= true,
        src = '/',
        dest = "/",
        limit = 50000,
        formats= ['png', 'jpg', 'jpeg', 'svg', 'bmp', 'gif', 'webp', 'tiff'],
        prefix = '@oss'
    } = config;
    const alioss = oss({
                    accessKeyId,
                    accessKeySecret,
                    endpoint,
                    region,
                    bucket,
                    cname,
                    timeout,
                    isRequestPay,
                    secure
                });
    let count = 0;

    return  through.obj(function(file, enc, cb) {
        if (file.isNull()) {
            cb(null, file);
        }

        if (file.isStream()) {
            this.emit(
                "error",
                new PluginError(PLUGIN_NAME, "streaming not supported")
            );
            cb(null, file);
        }

        const formatStr = formats.reduce((result, format) => {
            if (result) return `${result}|.${format}`

            return `.${format}`;
        }, '')

        const reg = new RegExp(`${prefix}\/[a-zA-Z-_\u4e00-\u9fa5/0-9@#!~]+(${formatStr})`, 'gi');
        let content = file.contents.toString();
        const matches = content.match(reg);

        const checkTask = () => {
            if (matches.length <= 0 && count <= 0) {
                file.contents = Buffer.from(content);
                this.push(file);
                cb();
            }
        };
        if (matches) {
            do {
                const match = matches.pop();
                const realPath = putil.resolve(src, match.replace(`${prefix}/`, ''));
                const extname = putil.extname(realPath);
                const showPath = putil.join(src, match.replace(`${prefix}/`, ''));

                let canBase = checkFileSize(limit, realPath);

                if (canBase) {
                    const baseMap = {
                        ".gif": "data:image/gif;base64,",
                        ".jpg": "data:image/png;base64,",
                        ".png": "data:image/jpeg;base64,"
                    };
                    let url = baseMap[extname] + toBase64(realPath);
                    content = content.replace(new RegExp(match, "g"), url);
                    checkTask();
                    continue;
                }

                if (!fs.existsSync(realPath)) {
                    console.log(
                        "上传CDN失败", 
                        " ", 
                        "图片资源", 
                        " ", 
                        showPath, 
                        " ", 
                        "文件不存在"
                    );

                    checkTask();
                    continue;
                }

                const fileKey = md5.sync(realPath);
                if (uploadCache[fileKey]) {
                    if (typeof uploadCache[fileKey] !== "boolean") {
                        content.replace(new RegExp(match, "g"), uploadCache[fileKey].regionUrl);
                    }

                    checkTask();
                    continue;
                }

                uploadCache[fileKey] = true;
                count += 1;

                alioss
                .put(putil.join(dest, `${fileKey}${extname}`).replace(/\\/g, '/'), realPath)
                .then(res => {
                    console.log(
                        "上传CDN成功",
                        " ",
                        "图片资源",
                        " ",
                        showPath,
                        " ",
                        res.url
                    );

                    content = content.replace(new RegExp(match, "g"), res.url);
                    count -= 1;
                    uploadCache[fileKey] = res;
                    checkTask();
                })
                .catch(err => {
                    console.log(
                        "上传CDN失败",
                        " ",
                        "图片资源",
                        " ",
                        showPath,
                        " ",
                        err.message
                    );
                    uploadCache[fileKey] = false;
                    count -= 1;
                    checkTask();
                })
            } while (matches.length > 0);
        } else {
            cb(null, file);
        }
    })
}

exports.alioss = alioss;