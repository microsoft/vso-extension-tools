/// <reference path="../../typings/tsd.d.ts" />
var _ = require("lodash");
var defaultManifest = require("./default-manifest");
var childProcess = require("child_process");
var fs = require("fs");
var glob = require("glob");
var log = require("./logger");
var path = require("path");
var program = require("commander");
var Q = require("q");
var tmp = require("tmp");
var winreg = require("winreg");
var xml = require("xml2js");
var zip = require("jszip");
var Package;
(function (Package) {
    var Merger = (function () {
        function Merger(settings) {
            this.mergeSettings = {
                root: settings.root,
                manifestGlobs: settings.manifestGlobs,
                overrides: settings.overrides
            };
        }
        Merger.prototype.gatherManifests = function (globPatterns) {
            var _this = this;
            var globs = globPatterns.map(function (pattern) {
                return path.isAbsolute(pattern) ? pattern : path.join(_this.mergeSettings.root, pattern);
            });
            return Q.all(globs.map(function (pattern) { return _this.gatherManifestsFromGlob(pattern); })).then(function (fileLists) {
                return _.unique(fileLists.reduce(function (a, b) { return a.concat(b); }));
            }).then(function (paths) {
                if (paths.length > 0) {
                    log.info("Merging %s manifests from the following paths: ", 2, paths.length.toString());
                    paths.forEach(function (path) { return log.info(path, 3); });
                    return paths;
                }
                else {
                    throw "No manifests found from the following glob patterns: \n" + globPatterns.join("\n");
                }
            });
        };
        Merger.prototype.gatherManifestsFromGlob = function (globPattern) {
            return Q.Promise(function (resolve, reject, notify) {
                glob(globPattern, function (err, matches) {
                    if (!err) {
                        resolve(matches);
                    }
                    else {
                        reject(err);
                    }
                });
            });
        };
        Merger.prototype.merge = function () {
            var _this = this;
            return this.gatherManifests(this.mergeSettings.manifestGlobs).then(function (files) {
                var overridesProvided = false;
                var manifestPromises = [];
                files.forEach(function (file) {
                    manifestPromises.push(Q.nfcall(fs.readFile, file, "utf8").then(function (data) {
                        var jsonData = data.replace(/^\uFEFF/, '');
                        try {
                            var result = JSON.parse(jsonData);
                            result.__origin = file;
                            return result;
                        }
                        catch (err) {
                            log.error("Error parsing the JSON in %s: ", file);
                            log.info(jsonData, null);
                            throw err;
                        }
                    }));
                    if (_this.mergeSettings.overrides) {
                        overridesProvided = true;
                        manifestPromises.push(Q.resolve(_this.mergeSettings.overrides));
                    }
                });
                var vsixManifest = JSON.parse(JSON.stringify(defaultManifest.defaultManifest));
                vsixManifest.__meta_root = _this.mergeSettings.root;
                var vsoManifest = {
                    __meta_root: _this.mergeSettings.root,
                    scopes: [],
                    contributions: [],
                };
                var packageFiles = {};
                return Q.all(manifestPromises).then(function (partials) {
                    partials.forEach(function (partial, partialIndex) {
                        if (_.isArray(partial["files"])) {
                            partial["files"].forEach(function (asset) {
                                var keys = Object.keys(asset);
                                if (keys.indexOf("path") < 0) {
                                    throw "Files must have an absolute or relative (to the manifest) path.";
                                }
                                var absolutePath;
                                if (path.isAbsolute(asset.path)) {
                                    absolutePath = asset.path;
                                }
                                else {
                                    absolutePath = path.join(path.dirname(partial.__origin), asset.path);
                                }
                                asset.path = path.relative(_this.mergeSettings.root, absolutePath);
                            });
                        }
                        if (_.isObject(partial["icons"])) {
                            var icons = partial["icons"];
                            Object.keys(icons).forEach(function (iconKind) {
                                var absolutePath = path.join(path.dirname(partial.__origin), icons[iconKind]);
                                icons[iconKind] = path.relative(_this.mergeSettings.root, absolutePath);
                            });
                        }
                        var pathToFileDeclarations = function (fsPath, root) {
                            var files = [];
                            if (fs.lstatSync(fsPath).isDirectory()) {
                                log.debug("Path '%s` is a directory. Adding all contained files (recursive).", fsPath);
                                fs.readdirSync(fsPath).forEach(function (dirChildPath) {
                                    log.debug("-- %s", dirChildPath);
                                    files = files.concat(pathToFileDeclarations(path.join(fsPath, dirChildPath), root));
                                });
                            }
                            else {
                                var relativePath = path.relative(root, fsPath);
                                files.push({ path: relativePath, partName: relativePath, auto: true });
                            }
                            return files;
                        };
                        if (_.isArray(partial["files"])) {
                            for (var i = partial["files"].length - 1; i >= 0; --i) {
                                var fileDecl = partial["files"][i];
                                var fsPath = path.join(vsoManifest.__meta_root, fileDecl.path);
                                if (fs.lstatSync(fsPath).isDirectory()) {
                                    Array.prototype.splice.apply(partial["files"], [i, 1].concat(pathToFileDeclarations(fsPath, vsoManifest.__meta_root)));
                                }
                            }
                        }
                        Object.keys(partial).forEach(function (key) {
                            _this.mergeKey(key, partial[key], vsoManifest, vsixManifest, packageFiles, partials.length - 1 === partialIndex && overridesProvided);
                        });
                    });
                    var vsoDefaults = {
                        manifestVersion: 1.0
                    };
                    Object.keys(vsoDefaults).forEach(function (d) {
                        if (!vsoManifest[d]) {
                            vsoManifest[d] = vsoDefaults[d];
                        }
                    });
                    var validationResult = _this.validateVsixJson(vsixManifest);
                    log.debug("VSO Manifest: " + JSON.stringify(vsoManifest, null, 4));
                    log.debug("VSIX Manifest: " + JSON.stringify(vsixManifest, null, 4));
                    if (validationResult.length === 0 || program["bypassValidation"]) {
                        return { vsoManifest: vsoManifest, vsixManifest: vsixManifest, files: packageFiles };
                    }
                    else {
                        throw "There were errors with your manifests. Address the following errors and re-run the tool.\n" + validationResult;
                    }
                });
            });
        };
        Merger.prototype.handleDelimitedList = function (value, object, path, delimiter, uniq) {
            if (delimiter === void 0) { delimiter = ","; }
            if (uniq === void 0) { uniq = true; }
            if (_.isString(value)) {
                value = value.split(delimiter);
                _.remove(value, function (v) { return v === ""; });
            }
            var items = _.get(object, path, "").split(delimiter);
            _.remove(items, function (v) { return v === ""; });
            var val = items.concat(value);
            if (uniq) {
                val = _.uniq(val);
            }
            _.set(object, path, val.join(delimiter));
        };
        Merger.prototype.singleValueProperty = function (obj, path, value, manifestKey, override) {
            if (override === void 0) { override = false; }
            var existingValue = _.get(obj, path);
            if (!override && existingValue !== undefined) {
                log.warn("Multiple values found for '%s'. Ignoring future occurrences and using the value '%s'.", manifestKey, JSON.stringify(existingValue, null, 4));
                return false;
            }
            else {
                _.set(obj, path, value);
                return true;
            }
        };
        Merger.prototype.mergeKey = function (key, value, vsoManifest, vsixManifest, packageFiles, override) {
            switch (key.toLowerCase()) {
                case "namespace":
                case "extensionid":
                case "id":
                    if (_.isString(value)) {
                        this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].Identity[0].$.Id", value.replace(/\./g, "-"), "namespace/extensionId/id", override);
                    }
                    break;
                case "version":
                    if (this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].Identity[0].$.Version", value, key, override)) {
                        vsoManifest.version = value;
                    }
                    break;
                case "name":
                    if (this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].DisplayName[0]", value, key, override)) {
                        vsoManifest.name = value;
                    }
                    break;
                case "description":
                    vsoManifest.description = value;
                    vsixManifest.PackageManifest.Metadata[0].Description[0]._ = value;
                    break;
                case "eventcallbacks":
                    if (_.isObject(value)) {
                        if (!vsoManifest.eventCallbacks) {
                            vsoManifest.eventCallbacks = {};
                        }
                        _.merge(vsoManifest.eventCallbacks, value);
                    }
                    break;
                case "icons":
                    if (_.isString(value["default"])) {
                        var assets = _.get(vsixManifest, "PackageManifest.Assets[0].Asset");
                        var iconPath = value["default"].replace(/\\/g, "/");
                        assets.push({
                            "$": {
                                "Type": "Microsoft.VisualStudio.Services.Icons.Default",
                                "d:Source": "File",
                                "Path": iconPath
                            }
                        });
                        this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].Icon[0]", iconPath, "icons['default']", override);
                    }
                    if (_.isString(value["wide"])) {
                        var assets = _.get(vsixManifest, "PackageManifest.Assets[0].Asset");
                        assets.push({
                            "$": {
                                "Type": "Microsoft.VisualStudio.Services.Icons.Wide",
                                "d:Source": "File",
                                "Path": value["wide"].replace(/\\/g, "/")
                            }
                        });
                    }
                    break;
                case "manifestversion":
                    var version = value;
                    if (_.isString(version)) {
                        version = parseFloat(version);
                    }
                    if (!version) {
                        version = 1;
                    }
                    this.singleValueProperty(vsoManifest, "manifestVersion", version, key, override);
                    break;
                case "public":
                    if (typeof value === "boolean") {
                        var flags = _.get(vsixManifest, "PackageManifest.Metadata[0].GalleryFlags[0]", "").split(",");
                        _.remove(flags, function (v) { return v === ""; });
                        if (value === true) {
                            flags.push("Public");
                        }
                        _.set(vsixManifest, "PackageManifest.Metadata[0].GalleryFlags[0]", _.uniq(flags).join(","));
                    }
                    break;
                case "publisher":
                    this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].Identity[0].$.Publisher", value, key, override);
                    break;
                case "releasenotes":
                    this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].ReleaseNotes[0]", value, key, override);
                    break;
                case "scopes":
                    if (_.isArray(value)) {
                        vsoManifest.scopes = _.uniq(vsoManifest.scopes.concat(value));
                    }
                    break;
                case "tags":
                    this.handleDelimitedList(value, vsixManifest, "PackageManifest.Metadata[0].Tags[0]");
                    break;
                case "vsoflags":
                case "galleryflags":
                    this.handleDelimitedList(value, vsixManifest, "PackageManifest.Metadata[0].GalleryFlags[0]", " ");
                    break;
                case "categories":
                    this.handleDelimitedList(value, vsixManifest, "PackageManifest.Metadata[0].Categories[0]");
                    break;
                case "baseuri":
                    this.singleValueProperty(vsoManifest, "baseUri", value, key, override);
                    break;
                case "contributions":
                    if (_.isArray(value)) {
                        vsoManifest.contributions = vsoManifest.contributions.concat(value);
                    }
                    break;
                case "contributiontypes":
                    if (_.isArray(value)) {
                        if (!vsoManifest.contributionTypes) {
                            vsoManifest.contributionTypes = [];
                        }
                        vsoManifest.contributionTypes = vsoManifest.contributionTypes.concat(value);
                    }
                    break;
                case "files":
                    if (_.isArray(value)) {
                        value.forEach(function (asset) {
                            var assetPath = asset.path.replace(/\\/g, "/");
                            if (!asset.auto || !packageFiles[assetPath]) {
                                packageFiles[assetPath] = {
                                    partName: asset.partName || assetPath
                                };
                            }
                            if (asset.contentType) {
                                packageFiles[assetPath].contentType = asset.contentType;
                            }
                            if (asset.assetType) {
                                vsixManifest.PackageManifest.Assets[0].Asset.push({
                                    "$": {
                                        "Type": asset.assetType,
                                        "d:Source": "File",
                                        "Path": assetPath
                                    }
                                });
                            }
                            if (asset.assetType === "Microsoft.VisualStudio.Services.Icons.Default") {
                                vsixManifest.PackageManifest.Metadata[0].Icon = [assetPath];
                            }
                        });
                    }
                    break;
                default:
                    if (key.substr(0, 2) !== "__") {
                        this.singleValueProperty(vsoManifest, key, value, key, override);
                    }
                    break;
            }
        };
        Merger.prototype.validateVsixJson = function (vsixManifest) {
            return Object.keys(Merger.vsixValidators).map(function (path) { return Merger.vsixValidators[path](_.get(vsixManifest, path)); }).filter(function (r) { return !!r; });
        };
        Merger.vsixValidators = {
            "PackageManifest.Metadata[0].Identity[0].$.Id": function (value) {
                if (/^[A-z0-9_-]+$/.test(value)) {
                    return null;
                }
                else {
                    return "'extensionId' may only include letters, numbers, underscores, and dashes.";
                }
            },
            "PackageManifest.Metadata[0].Identity[0].$.Version": function (value) {
                if (typeof value === "string" && value.length > 0) {
                    return null;
                }
                else {
                    return "'version' must be provided.";
                }
            },
            "PackageManifest.Metadata[0].DisplayName[0]": function (value) {
                if (typeof value === "string" && value.length > 0) {
                    return null;
                }
                else {
                    return "'name' must be provided.";
                }
            },
            "PackageManifest.Assets[0].Asset": function (value) {
                var usedAssetTypes = {};
                if (_.isArray(value)) {
                    for (var i = 0; i < value.length; ++i) {
                        var asset = value[i].$;
                        if (asset) {
                            if (!asset.Path) {
                                return "All 'files' must include a 'path'.";
                            }
                            if (asset.Type) {
                                if (usedAssetTypes[asset.Type]) {
                                    return "Cannot have multiple files with the same 'assetType'.\nFile1: " + usedAssetTypes[asset.Type] + ", File 2: " + asset.Path + " (asset type: " + asset.Type + ")";
                                }
                                else {
                                    usedAssetTypes[asset.Type] = asset.Path;
                                }
                            }
                        }
                    }
                }
                return null;
            },
            "PackageManifest.Metadata[0].Identity[0].$.Publisher": function (value) {
                if (typeof value === "string" && value.length > 0) {
                    return null;
                }
                else {
                    return "'publisher' must be provided.";
                }
            },
            "PackageManifest.Metadata[0].Categories[0]": function (value) {
                if (!value) {
                    return null;
                }
                var categories = value.split(",");
                var validCategories = [
                    "Build and release",
                    "Collaboration",
                    "Customer support",
                    "Planning",
                    "Productivity",
                    "Sync and integration",
                    "Testing"
                ];
                _.remove(categories, function (c) { return !c; });
                var badCategories = categories.filter(function (c) { return validCategories.indexOf(c) === -1; });
                return badCategories.length ? "The following categories are not valid: " + badCategories.join(", ") + ". Valid categories are: " + validCategories.join(", ") + "." : null;
            }
        };
        return Merger;
    })();
    Package.Merger = Merger;
    var VsixWriter = (function () {
        function VsixWriter(vsoManifest, vsixManifest, files) {
            this.vsoManifest = vsoManifest;
            this.vsixManifest = vsixManifest;
            this.files = files;
            this.prepManifests();
        }
        VsixWriter.prototype.prepManifests = function () {
            var assets = _.get(this.vsixManifest, "PackageManifest.Assets[0].Asset");
            if (assets) {
                _.remove(assets, function (asset) {
                    var type = _.get(asset, "$.Type", "x").toLowerCase();
                    return type === "microsoft.vso.manifest" || type === "microsoft.visualstudio.services.manifest";
                });
            }
            else {
                assets = [];
                _.set(this.vsixManifest, "PackageManifest.Assets[0].Asset[0]", assets);
            }
            assets.push({ $: {
                    Type: "Microsoft.VisualStudio.Services.Manifest",
                    Path: VsixWriter.VSO_MANIFEST_FILENAME
                } });
            log.debug("Manifests finished prepping.");
        };
        VsixWriter.prototype.mkdirp = function (dirPath) {
            var exploded = dirPath.split(/[\/\\]/);
            if (exploded.length > 0) {
                var current = path.join();
                for (var i = 0; i < exploded.length; ++i) {
                    current = path.join(current, exploded[i]);
                    if (!fs.existsSync(current)) {
                        fs.mkdirSync(current);
                    }
                }
            }
        };
        VsixWriter.prototype.ensureDirExists = function (fullPath) {
            var dir = path.dirname(fullPath);
            this.mkdirp(dir);
        };
        VsixWriter.prototype.getOutputPath = function (outPath) {
            var newPath = outPath;
            var pub = _.get(this.vsixManifest, "PackageManifest.Metadata[0].Identity[0].$.Publisher");
            var ns = _.get(this.vsixManifest, "PackageManifest.Metadata[0].Identity[0].$.Id");
            var version = _.get(this.vsixManifest, "PackageManifest.Metadata[0].Identity[0].$.Version");
            var autoName = pub + "." + ns + "-" + version + ".vsix";
            if (outPath === "{auto}") {
                return path.resolve(autoName);
            }
            else {
                var basename = path.basename(outPath);
                if (basename.indexOf(".") > 0) {
                    return path.resolve(outPath);
                }
                else {
                    return path.resolve(path.join(outPath, autoName));
                }
            }
        };
        VsixWriter.prototype.writeVsix = function (outPath) {
            var _this = this;
            var outputPath = this.getOutputPath(outPath);
            var vsix = new zip();
            var root = this.vsoManifest.__meta_root;
            if (!root) {
                throw "Manifest root unknown. Manifest objects should have a __meta_root key specifying the absolute path to the root of assets.";
            }
            var overrides = {};
            Object.keys(this.files).forEach(function (file) {
                if (_.endsWith(file, VsixWriter.VSO_MANIFEST_FILENAME)) {
                    return;
                }
                var partName = _this.files[file].partName.replace(/\\/g, "/");
                var fsPath = path.join(root, file);
                vsix.file(partName, fs.readFileSync(path.join(root, file)));
                if (_this.files[file].contentType) {
                    overrides[partName] = _this.files[file];
                }
            });
            var assets = _.get(this.vsixManifest, "PackageManifest.Assets[0].Asset");
            if (_.isArray(assets)) {
                assets.forEach(function (asset) {
                    if (asset.$) {
                        if (asset.$.Type === "Microsoft.VisualStudio.Services.Manifest") {
                            return;
                        }
                        vsix.file(asset.$.Path.replace(/\\/g, "/"), fs.readFileSync(path.join(root, asset.$.Path)));
                    }
                });
            }
            return Q.Promise(function (resolve, reject, notify) {
                tmp.dir({ unsafeCleanup: true }, function (err, tmpPath, cleanupCallback) {
                    if (err) {
                        reject(err);
                    }
                    resolve(tmpPath);
                });
            }).then(function (tmpPath) {
                var manifestWriter = new ManifestWriter(_this.vsoManifest, _this.vsixManifest);
                var vsoPath = path.join(tmpPath, VsixWriter.VSO_MANIFEST_FILENAME);
                var vsixPath = path.join(tmpPath, VsixWriter.VSIX_MANIFEST_FILENAME);
                var vsoStr = fs.createWriteStream(vsoPath);
                var vsixStr = fs.createWriteStream(vsixPath);
                return manifestWriter.writeManifests(vsoStr, vsixStr).then(function () {
                    vsix.file(VsixWriter.VSO_MANIFEST_FILENAME, fs.readFileSync(vsoPath, "utf-8"));
                    vsix.file(VsixWriter.VSIX_MANIFEST_FILENAME, fs.readFileSync(vsixPath, "utf-8"));
                });
            }).then(function () {
                return _this.genContentTypesXml(Object.keys(vsix.files), overrides);
            }).then(function (contentTypesXml) {
                vsix.file(VsixWriter.CONTENT_TYPES_FILENAME, contentTypesXml);
                var buffer = vsix.generate({
                    type: "nodebuffer",
                    compression: "DEFLATE",
                    compressionOptions: { level: 9 },
                    platform: process.platform
                });
                log.debug("Writing vsix to: %s", outputPath);
                _this.ensureDirExists(outputPath);
                return Q.nfcall(fs.writeFile, outputPath, buffer).then(function () {
                    return outputPath;
                });
            });
        };
        VsixWriter.prototype.genContentTypesXml = function (fileNames, overrides) {
            var _this = this;
            log.debug("Generating [Content_Types].xml");
            var contentTypes = {
                Types: {
                    $: {
                        xmlns: "http://schemas.openxmlformats.org/package/2006/content-types"
                    },
                    Default: [],
                    Override: []
                }
            };
            var windows = /^win/.test(process.platform);
            var contentTypePromise;
            if (windows) {
                var contentTypePromises = [];
                var extensionlessFiles = [];
                var uniqueExtensions = _.unique(fileNames.map(function (f) {
                    var extName = path.extname(f);
                    if (!extName && !overrides[f]) {
                        log.warn("File %s does not have an extension, and its content-type is not declared. Defaulting to application/octet-stream.", path.resolve(f));
                    }
                    if (overrides[f]) {
                        return "";
                    }
                    return extName;
                }));
                uniqueExtensions.forEach(function (ext) {
                    if (!ext.trim()) {
                        return;
                    }
                    if (!ext) {
                        return;
                    }
                    if (VsixWriter.CONTENT_TYPE_MAP[ext.toLowerCase()]) {
                        contentTypes.Types.Default.push({
                            $: {
                                Extension: ext,
                                ContentType: VsixWriter.CONTENT_TYPE_MAP[ext.toLowerCase()]
                            }
                        });
                        return;
                    }
                    var hkcrKey = new winreg({
                        hive: winreg.HKCR,
                        key: "\\" + ext.toLowerCase()
                    });
                    var regPromise = Q.ninvoke(hkcrKey, "get", "Content Type").then(function (type) {
                        log.debug("Found content type for %s: %s.", ext, type.value);
                        var contentType = "application/octet-stream";
                        if (type) {
                            contentType = type.value;
                        }
                        return contentType;
                    }).catch(function (err) {
                        log.warn("Could not determine content type for extension %s. Defaulting to application/octet-stream. To override this, add a contentType property to this file entry in the manifest.", ext);
                        return "application/octet-stream";
                    }).then(function (contentType) {
                        contentTypes.Types.Default.push({
                            $: {
                                Extension: ext,
                                ContentType: contentType
                            }
                        });
                    });
                    contentTypePromises.push(regPromise);
                });
                contentTypePromise = Q.all(contentTypePromises);
            }
            else {
                var contentTypePromises = [];
                var extTypeCounter = {};
                fileNames.forEach(function (fileName) {
                    var extension = path.extname(fileName);
                    var mimePromise;
                    if (VsixWriter.CONTENT_TYPE_MAP[extension]) {
                        if (!extTypeCounter[extension]) {
                            extTypeCounter[extension] = {};
                        }
                        if (!extTypeCounter[extension][VsixWriter.CONTENT_TYPE_MAP[extension]]) {
                            extTypeCounter[extension][VsixWriter.CONTENT_TYPE_MAP[extension]] = [];
                        }
                        extTypeCounter[extension][VsixWriter.CONTENT_TYPE_MAP[extension]].push(fileName);
                        mimePromise = Q.resolve(null);
                        return;
                    }
                    mimePromise = Q.Promise(function (resolve, reject, notify) {
                        var child = childProcess.exec("file --mime-type \"" + fileName + "\"", function (err, stdout, stderr) {
                            try {
                                if (err) {
                                    reject(err);
                                }
                                var stdoutStr = stdout.toString("utf8");
                                var magicMime = _.trimRight(stdoutStr.substr(stdoutStr.lastIndexOf(" ") + 1), "\n");
                                log.debug("Magic mime type for %s is %s.", fileName, magicMime);
                                if (magicMime) {
                                    if (extension) {
                                        if (!extTypeCounter[extension]) {
                                            extTypeCounter[extension] = {};
                                        }
                                        var hitCounters = extTypeCounter[extension];
                                        if (!hitCounters[magicMime]) {
                                            hitCounters[magicMime] = [];
                                        }
                                        hitCounters[magicMime].push(fileName);
                                    }
                                    else {
                                        if (!overrides[fileName]) {
                                            overrides[fileName].contentType = magicMime;
                                        }
                                    }
                                }
                                else {
                                    if (stderr) {
                                        reject(stderr.toString("utf8"));
                                    }
                                    else {
                                        log.warn("Could not determine content type for %s. Defaulting to application/octet-stream. To override this, add a contentType property to this file entry in the manifest.", fileName);
                                        overrides[fileName].contentType = "application/octet-stream";
                                    }
                                }
                                resolve(null);
                            }
                            catch (e) {
                                reject(e);
                            }
                        });
                    });
                    contentTypePromises.push(mimePromise);
                });
                contentTypePromise = Q.all(contentTypePromises).then(function () {
                    Object.keys(extTypeCounter).forEach(function (ext) {
                        var hitCounts = extTypeCounter[ext];
                        var bestMatch = _this.maxKey(hitCounts, (function (i) { return i.length; }));
                        Object.keys(hitCounts).forEach(function (type) {
                            if (type === bestMatch) {
                                return;
                            }
                            hitCounts[type].forEach(function (fileName) {
                                overrides[fileName].contentType = type;
                            });
                        });
                        contentTypes.Types.Default.push({
                            $: {
                                Extension: ext,
                                ContentType: bestMatch
                            }
                        });
                    });
                });
            }
            return contentTypePromise.then(function () {
                Object.keys(overrides).forEach(function (partName) {
                    contentTypes.Types.Override.push({
                        $: {
                            ContentType: overrides[partName].contentType,
                            PartName: "/" + _.trimLeft(partName, "/")
                        }
                    });
                });
                var builder = new xml.Builder({
                    indent: "    ",
                    newline: require("os").EOL,
                    pretty: true,
                    xmldec: {
                        encoding: "utf-8",
                        standalone: null,
                        version: "1.0"
                    }
                });
                return builder.buildObject(contentTypes);
            });
        };
        VsixWriter.prototype.maxKey = function (obj, func) {
            var maxProp;
            for (var prop in obj) {
                if (!maxProp || func(obj[prop]) > func(obj[maxProp])) {
                    maxProp = prop;
                }
            }
            return maxProp;
        };
        VsixWriter.VSO_MANIFEST_FILENAME = "extension.vsomanifest";
        VsixWriter.VSIX_MANIFEST_FILENAME = "extension.vsixmanifest";
        VsixWriter.CONTENT_TYPES_FILENAME = "[Content_Types].xml";
        VsixWriter.CONTENT_TYPE_MAP = {
            ".md": "text/markdown",
            ".pdf": "application/pdf",
            ".png": "image/png",
            ".jpeg": "image/jpeg",
            ".jpg": "image/jpeg",
            ".gif": "image/gif",
            ".bat": "application/bat",
            ".json": "application/json",
            ".vsomanifest": "application/json",
            ".vsixmanifest": "text/xml",
            ".ps1": "text/ps1"
        };
        return VsixWriter;
    })();
    Package.VsixWriter = VsixWriter;
    var ManifestWriter = (function () {
        function ManifestWriter(vsoManifest, vsixManifest) {
            this.vsoManifest = this.removeMetaKeys(vsoManifest);
            this.vsixManifest = this.removeMetaKeys(vsixManifest);
        }
        ManifestWriter.prototype.removeMetaKeys = function (obj) {
            return _.omit(obj, function (v, k) {
                return _.startsWith(k, "__meta_");
            });
        };
        ManifestWriter.prototype.writeManifests = function (vsoStream, vsixStream) {
            var eol = require("os").EOL;
            var vsoPromise = Q.ninvoke(vsoStream, "write", JSON.stringify(this.vsoManifest, null, 4).replace(/\n/g, eol), "utf8");
            vsoPromise = vsoPromise.then(function () {
                vsoStream.end();
            });
            var builder = new xml.Builder({
                indent: "    ",
                newline: eol,
                pretty: true,
                xmldec: {
                    encoding: "utf-8",
                    standalone: null,
                    version: "1.0"
                }
            });
            var vsix = builder.buildObject(this.vsixManifest);
            var vsixPromise = Q.ninvoke(vsixStream, "write", vsix, "utf8");
            vsixPromise = vsixPromise.then(function () {
                vsixStream.end();
            });
            return Q.all([vsoPromise, vsixPromise]);
        };
        return ManifestWriter;
    })();
    Package.ManifestWriter = ManifestWriter;
})(Package = exports.Package || (exports.Package = {}));
