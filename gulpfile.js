var gulp = require('gulp');
var tsb = require('gulp-tsb');
var tsconfig = require('./tsconfig.json')

var compilation = tsb.create(tsconfig.compilerOptions);

var sources = [
	'src/**/*.ts',
	'test/**/*.ts',
	'typings/**/*.ts'
];

gulp.task('compile', function () {
	return gulp.src(sources)
		.pipe(compilation())
		.pipe(gulp.dest('bin'));
});
