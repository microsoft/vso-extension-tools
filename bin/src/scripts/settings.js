/// <reference path="../../typings/tsd.d.ts" />
var _ = require("lodash");
var fs = require("fs");
var Q = require("q");
var path = require("path");
var program = require("commander");
var tmp = require("tmp");
function resolveSettings(options, defaults) {
    var passedOptions = {};
    var settingsPath = path.resolve("settings.vset.json");
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
    if (options.galleryUrl) {
        _.set(passedOptions, "publish.galleryUrl", options.galleryUrl);
    }
    if (options.token) {
        _.set(passedOptions, "publish.token", options.token);
    }
    if (options.vsix) {
        _.set(passedOptions, "publish.vsixPath", options.vsix);
    }
    if (options.publisher) {
        _.set(passedOptions, "publish.publisher", options.publisher);
    }
    if (options.extension) {
        _.set(passedOptions, "publish.extensionId", options.extension);
    }
    if (options.shareWith) {
        _.set(passedOptions, "publish.shareWith", options.shareWith.split(/,|;/));
    }
    if (options.unshareWith) {
        _.set(passedOptions, "publish.shareWith", options.unshareWith.split(/,|;/));
    }
    var parsedOverrides, args = process.argv.slice(2);
    for (var i = 0; i < args.length; ++i) {
        var arg = args[i];
        if (arg === "--override") {
            if (args[i + 1]) {
                try {
                    parsedOverrides = JSON.parse(args[i + 1]);
                    _.set(passedOptions, "package.overrides", parsedOverrides);
                }
                catch (e) {
                }
            }
            break;
        }
    }
    return Q.Promise(function (resolve, reject, notify) {
        try {
            if (settingsPath) {
                resolve(parseSettingsFile(settingsPath).then(function (settings) {
                    return _.merge({}, defaultSettings, settings, passedOptions);
                }));
            }
            else {
                resolve(_.merge({}, defaultSettings, passedOptions));
            }
        }
        catch (err) {
            reject(err);
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
                    try {
                        tmp.dir({ unsafeCleanup: true }, function (err, tmpPath, cleanupCallback) {
                            if (err) {
                                reject(err);
                            }
                            resolve(path.join(tmpPath, "extension.vsix"));
                        });
                    }
                    catch (err) {
                        reject(err);
                    }
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
        try {
            if (fs.existsSync(settingsPath)) {
                resolve(JSON.parse(fs.readFileSync(settingsPath, "utf8").replace(/^\uFEFF/, "")));
            }
            else {
                resolve({});
            }
        }
        catch (err) {
            reject(err);
        }
    });
}
