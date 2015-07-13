/// <reference path="../../typings/tsd.d.ts" />
var _ = require("lodash");
var fs = require("fs");
var log = require("./logger");
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
    if (options.shareWith) {
        _.set(passedOptions, "publish.shareWith", options.shareWith.split(/,|;/));
    }
    if (options.unshareWith) {
        _.set(passedOptions, "publish.shareWith", options.unshareWith.split(/,|;/));
    }
    if (options.override) {
        try {
            _.set(passedOptions, "package.overrides", JSON.parse(options.override));
        }
        catch (e) {
            log.warn("Could not parse override JSON.");
            log.info(options.override, 2);
        }
    }
    return saveCliOptions(passedOptions, settingsPath).then(function () {
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
                log.debug("Parsed settings: %s", JSON.stringify(settings, null, 4));
                return settings;
            });
        });
    });
}
exports.resolveSettings = resolveSettings;
function saveCliOptions(cliOptions, settingsPath) {
    if (program["save"]) {
        log.info("Saving CLI options to %s.", 1, settingsPath);
        return Q.Promise(function (resolve, reject, notify) {
            try {
                fs.exists(settingsPath, function (exists) {
                    resolve(exists);
                });
            }
            catch (err) {
                reject(err);
            }
        }).then(function (exists) {
            if (exists) {
                log.info("Settings file exists. Merging settings.", 2);
                return Q.nfcall(fs.readFile, settingsPath, "utf8").then(function (content) { return content.replace(/^\uFEFF/, ""); });
            }
            else {
                log.info("Settings file does not exist. Writing file.", 2);
                return "{}";
            }
        }).then(function (settingsStr) {
            var settings = JSON.parse(settingsStr);
            _.merge(settings, cliOptions);
            if (Object.keys(settings).length > 0) {
                var fileContents = JSON.stringify(settings, null, 4);
                log.debug("Content: %s", fileContents);
                return Q.nfcall(fs.writeFile, settingsPath, fileContents, "utf8");
            }
            else {
                return;
            }
        });
    }
    else {
        return Q.resolve(null);
    }
}
function parseSettingsFile(settingsPath) {
    return Q.Promise(function (resolve, reject, notify) {
        try {
            if (fs.existsSync(settingsPath)) {
                var settingsStr = fs.readFileSync(settingsPath, "utf8").replace(/^\uFEFF/, "");
                var settingsJSON;
                try {
                    resolve(JSON.parse(settingsStr));
                }
                catch (err) {
                    log.warn("Could not parse settings file as JSON. No settings were read from %s.", settingsPath);
                    resolve({});
                }
            }
            else {
                if (!program["save"]) {
                    log.warn("No settings file found at %s.", settingsPath);
                }
                resolve({});
            }
        }
        catch (err) {
            reject(err);
        }
    });
}
