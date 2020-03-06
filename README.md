# gulp-wx-image
gulp插件，支持小程序图片转base64和上传阿里oss

# 安装
`npm install --save-dev gulp-wx-image`

# 参考文档
[阿里云oss NodeJs Sdk](https://help.aliyun.com/document_detail/32068.html?spm=a2c4g.11174283.6.1259.33317da2q6XI3a)

# 使用
```
//gulpfile.js

const gulp = require("gulp");
const scss = require("gulp-sass");
const postcss = require("gulp-postcss");
const replace = require("gulp-replace");
const rename = require("gulp-rename");
const changed = require("gulp-changed");
const autoprefixer = require("autoprefixer");
const clean = require("gulp-clean");
const config = {
    scss: {
        blacks: {
            filter: [] //过滤不处理的*.scss文件
        }
    }
};
const cdnhost = "https://cdn.xxxxx.com";
const oss = require("gulp-wx-image").alioss;

//具体配置参考
const options = {
    accessKeyId: 'your accessKeyId',
    accessKeySecret: 'your accessKeySecret',
    bucket: 'your bucket',
    endpoint: "your endpoint",
    src: './src/',
    dest: 'images', //oss上的上传目录
    limit: 30000 //小于limit的图片转为base64，大于的才会上传oss，默认50000,单位byte
};

//编译样式
function compileScss(cb) {
    return gulp
        .src(["src/**/**/*.scss", "!src/assets/scss/*.scss"], {base: 'src'})
        .pipe(replace(/\@(import\s[^@;]*)+(;import|\bimport|;|\b)?/g, ($1) => {
            let isMixin = config.scss.blacks.filter(item => $1.indexOf(item) > -1);

            if (isMixin.length == 0) {
                return `\/*T${$1}T*\/`;
            } else {
                return $1;
            }
        }))
        .pipe(oss(options))
        .pipe(scss())
        .pipe(postcss([autoprefixer(['IOS >= 8', 'Android >= 4.1'])]))
        .pipe(
            rename(function(path) {
                path.extname = ".wxss";
            })
        )
        .pipe(changed('./'))
        .pipe(replace(/.scss/g, '.wxss'))
        .pipe(replace(/\/\*T(@import\s[^@;]*;)?(T\*\/)?/g, '$1'))
        .pipe(gulp.dest("./"));
}

exports.compileScss = compileScss;
```
