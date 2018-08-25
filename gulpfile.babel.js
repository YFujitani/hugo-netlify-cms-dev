import gulp from "gulp";
import cp from "child_process";
// import gutil from "gulp-util";
import gPluginError from "plugin-error";
import gLog from "gulplog";
import postcss from "gulp-postcss";
import cssImport from "postcss-import";
// import cssNext from "postcss-cssnext"; deprecated (see https://moox.io/blog/deprecating-cssnext/)
// fujitani added
// import cssNext from "postcss-cssnext";
import cssNested from "postcss-nested";
import cssPresetEnv from "postcss-preset-env";
import cssMixins from "postcss-mixins";
import cssDiscardComments from "postcss-discard-comments";
import cssConditionals from "postcss-conditionals";
import cssFontAwesome from "postcss-font-awesome";
import cssReporter from "postcss-reporter";
import cssBrowserReporter from "postcss-browser-reporter";
// fujitani added
import BrowserSync from "browser-sync";
import webpack from "webpack";
import webpackConfig from "./webpack.conf";
import svgstore from "gulp-svgstore";
import svgmin from "gulp-svgmin";
import inject from "gulp-inject";
// import cssnano from "cssnano";

const browserSync = BrowserSync.create();
const hugoBin = `./bin/hugo.${process.platform === "win32" ? "exe" : process.platform}`;
const defaultArgs = ["-d", "../dist", "-s", "site"];

if (process.env.DEBUG) {
  defaultArgs.unshift("--debug");
}

gulp.task("hugo", (cb) => buildSite(cb));
gulp.task("hugo-preview", (cb) => buildSite(cb, ["--buildDrafts", "--buildFuture"]));
gulp.task("build", ["css", "js", "cms-assets", "hugo"]);
gulp.task("build-preview", ["css", "js", "cms-assets", "hugo-preview"]);

gulp.task("css", () => (
  gulp.src("./src/css/*.css")
    .pipe(postcss([
      // TODO pipeの順序の確認
      cssImport({from: "./src/css/main.css"}),
      cssMixins(),
      cssPresetEnv({
        stage: 3, // default stage 2  (see https://www.npmjs.com/package/postcss-preset-env#stage)
        features: {
          "nesting-rules": true
        },
        insertBefore: {
          "all-property": cssNested
        }
      }),
      cssConditionals(),
      cssDiscardComments(),
      cssFontAwesome(),
      // ビルドが安定するまでコメントアウト
      // cssnano(),
      cssReporter(),
      cssBrowserReporter(),
    ]))
    .pipe(gulp.dest("./dist/css"))
    .on("error", (err) => gLog.error(err))
    .pipe(browserSync.stream())
));

gulp.task("cms-assets", () => (
  gulp.src("./node_modules/netlify-cms/dist/*.{woff,eot,woff2,ttf,svg,png}")
    .pipe(gulp.dest("./dist/css"))
));

gulp.task("js", (cb) => {
  const myConfig = Object.assign({}, webpackConfig);

  webpack(myConfig, (err, stats) => {
    if (err) throw new gPluginError("webpack", err);
    gLog.info("[webpack]", stats.toString({
      colors: true,
      progress: true
    }));
    browserSync.reload();
    cb();
  });
});

gulp.task("svg", () => {
  const svgs = gulp
    .src("site/static/img/icons-*.svg")
    .pipe(svgmin())
    .pipe(svgstore({inlineSvg: true}));

  function fileContents(filePath, file) {
    return file.contents.toString();
  }

  return gulp
    .src("site/layouts/partials/svg.html")
    .pipe(inject(svgs, {transform: fileContents}))
    .pipe(gulp.dest("site/layouts/partials/"));
});

gulp.task("server", ["hugo", "css", "cms-assets", "js", "svg"], () => {
  browserSync.init({
    server: {
      baseDir: "./dist"
    }
  });
  gulp.watch("./src/js/**/*.js", ["js"]);
  gulp.watch("./src/css/**/*.css", ["css"]);
  gulp.watch("./site/static/img/icons-*.svg", ["svg"]);
  gulp.watch("./site/**/*", ["hugo"]);
});

function buildSite(cb, options) {
  const args = options ? defaultArgs.concat(options) : defaultArgs;

  return cp.spawn(hugoBin, args, {stdio: "inherit"}).on("close", (code) => {
    if (code === 0) {
      browserSync.reload("notify:false");
      cb();
    } else {
      browserSync.notify("Hugo build failed :(");
      cb("Hugo build failed");
    }
  });
}
