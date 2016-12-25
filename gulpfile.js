const del = require('del');
const gulp = require('gulp');
const ts = require('gulp-typescript');

const tsProject = ts.createProject('tsconfig.json');

gulp.task('default', ['clean', 'scripts']);

gulp.task('clean', () => del(['dist/**/*']));

gulp.task('scripts', () =>
  tsProject.src()
    .pipe(tsProject())
    .js.pipe(gulp.dest('dist')));

gulp.task('watch', ['default'], () => {
  gulp.watch('src/**/*.ts', ['scripts']);
});
