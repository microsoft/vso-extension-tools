var gulp = require('gulp');
var tsb = require('gulp-tsb');
var filter = require('gulp-filter');
var rimraf = require('rimraf');
var tsconfig = require('./tsconfig.json')
var compilation = tsb.create(tsconfig.compilerOptions);

gulp.task('clean', function (cb) {
	rimraf('bin', cb);
})

var sources = [
	'src/**',
	'test/**',
	'typings/**/*.ts'
];

gulp.task('compile', ['clean'], function () {
	var typescriptsFilter = filter('**/*.ts', { restore: true });
	
	return gulp.src(sources, { base: '.' })
		.pipe(typescriptsFilter)
		.pipe(compilation())
		.pipe(typescriptsFilter.restore)
		.pipe(gulp.dest('bin'));
});
