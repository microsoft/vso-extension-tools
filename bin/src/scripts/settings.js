/// <reference path="../../typings/tsd.d.ts" />
var _ = require("lodash");
var fs = require("fs");
var Q = require("q");
var path = require("path");
var program = require("commander");
var tmp = require("tmp");
function resolveSettings(options, defaults) {
    var passedOptions = {};
    var settingsPath = path.resolve("settings.json");
    var defaultSettings = defaults || {};
    if (options.manifestGlob) {
        _.set(passedOptions, "package.manifestGlobs", [options.manifestGlob]);
    }
    if (options.outputPath) {
        _.set(passedOptions, "package.outputPath", options.outputPath);
    }
    if (options.root) {
        _.set(passedOptions, "package.root", options.root);
    }
    if (options.settings) {
        settingsPath = options.settings;
    }
    if (options.vsix) {
        _.set(passedOptions, "publish.vsixPath", options.vsix);
    }
    return Q.Promise(function (resolve, reject, notify) {
        if (settingsPath) {
            resolve(parseSettingsFile(settingsPath).then(function (settings) {
                return _.merge({}, defaultSettings, settings, passedOptions);
            }));
        }
        else {
            resolve(_.merge({}, defaultSettings, passedOptions));
        }
    }).then(function (settings) {
        if (_.get(settings, "package.manifestGlobs")) {
            if (_.isString(settings.package.manifestGlobs)) {
                settings.package.manifestGlobs = [settings.package.manifestGlobs];
            }
            if (settings.package.root) {
                settings.package.root = path.resolve(settings.package.root);
                settings.package.manifestGlobs = settings.package.manifestGlobs.map(function (glob) { return path.join(settings.package.root, glob); });
            }
        }
        var outPathPromise;
        if (settings.package) {
            if (_.get(settings, "package.outputPath", "") === "{tmp}") {
                outPathPromise = Q.Promise(function (resolve, reject, notify) {
                    tmp.dir({ unsafeCleanup: true }, function (err, tmpPath, cleanupCallback) {
                        if (err) {
                            reject(err);
                        }
                        resolve(path.join(tmpPath, "extension.vsix"));
                    });
                });
            }
            else {
                outPathPromise = Q.resolve(settings.package["outputPath"]);
            }
        }
        else {
            outPathPromise = Q.resolve(null);
        }
        return outPathPromise.then(function (outPath) {
            if (outPath) {
                settings.package.outputPath = outPath;
            }
            if (!_.get(settings, "publish.vsixPath") && settings.package) {
                _.set(settings, "publish.vsixPath", _.get(settings, "package.outputPath"));
            }
            else if (_.get(settings, "publish.vsixPath") && _.get(program, "args[0]._name", "") === "publish") {
                settings.package = null;
            }
            return settings;
        });
    });
}
exports.resolveSettings = resolveSettings;
function parseSettingsFile(settingsPath) {
    return Q.Promise(function (resolve, reject, notify) {
        if (fs.existsSync(settingsPath)) {
            resolve(JSON.parse(fs.readFileSync(settingsPath, "utf8").replace(/^\uFEFF/, "")));
        }
        else {
            resolve({});
        }
    });
}
