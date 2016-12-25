const del = require('del');
const fs = require('graceful-fs');
const gulp = require('gulp');
const ts = require('gulp-typescript');
const yaml = require('js-yaml');

const tsProject = ts.createProject('tsconfig.json');

gulp.task('default', ['clean', 'vendors-yml', 'scripts']);

gulp.task('clean', () => del(['dist/**/*']));

gulp.task('vendors-yml', () =>
  gulp.src('src/**/*.yml')
  .pipe(gulp.dest('dist')));

gulp.task('scripts', () =>
  tsProject.src()
    .pipe(tsProject())
    .js.pipe(gulp.dest('dist')));

gulp.task('watch', ['default'], () => {
  gulp.watch('src/**/*', ['vendors-yml', 'scripts']);
});
