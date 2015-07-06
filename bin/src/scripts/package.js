/// <reference path="../../typings/tsd.d.ts" />
var _ = require("lodash");
var fs = require("fs");
var glob = require("glob");
var path = require("path");
var Q = require("q");
var tmp = require("tmp");
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
                            console.log("Error parsing the JSON in " + file + ": ");
                            console.log(jsonData);
                            throw err;
                        }
                    }));
                    if (_this.mergeSettings.overrides) {
                        manifestPromises.push(Q.resolve(_this.mergeSettings.overrides));
                    }
                });
                var defaultVsixManifestPath = path.join(require("app-root-path").path, "src", "tmpl", "default_vsixmanifest.json");
                var vsixManifest = JSON.parse(fs.readFileSync(defaultVsixManifestPath, "utf8"));
                vsixManifest.__meta_root = _this.mergeSettings.root;
                var vsoManifest = {
                    __meta_root: _this.mergeSettings.root,
                    scopes: [],
                    contributions: [],
                    manifestVersion: 1.0
                };
                return Q.all(manifestPromises).then(function (partials) {
                    partials.forEach(function (partial) {
                        if (_.isArray(partial["assets"])) {
                            partial["assets"].forEach(function (asset) {
                                var keys = Object.keys(asset);
                                if (keys.length !== 2 || keys.indexOf("type") < 0 || keys.indexOf("path") < 0) {
                                    throw "Assets must have a type and a path.";
                                }
                                if (path.isAbsolute(asset.path)) {
                                    throw "Paths in manifests must be relative.";
                                }
                                var absolutePath = path.join(path.dirname(partial.__origin), asset.path);
                                asset.path = path.relative(_this.mergeSettings.root, absolutePath);
                            });
                        }
                        Object.keys(partial).forEach(function (key) {
                            _this.mergeKey(key, partial[key], vsoManifest, vsixManifest);
                        });
                    });
                    return { vsoManifest: vsoManifest, vsixManifest: vsixManifest };
                });
            });
        };
        Merger.prototype.handleDelimitedList = function (value, object, path, delimiter) {
            if (delimiter === void 0) { delimiter = ","; }
            if (_.isString(value)) {
                value = value.split(delimiter);
                _.remove(value, function (v) { return v === ""; });
            }
            var items = _.get(object, path, "").split(delimiter);
            _.remove(items, function (v) { return v === ""; });
            _.set(object, path, _.uniq(items.concat(value)).join(delimiter));
        };
        Merger.prototype.mergeKey = function (key, value, vsoManifest, vsixManifest) {
            switch (key.toLowerCase()) {
                case "namespace":
                case "extensionid":
                case "id":
                    if (_.isString(value)) {
                        vsixManifest.PackageManifest.Metadata[0].Identity[0].$.Id = value.replace(/\./g, "-");
                    }
                    break;
                case "version":
                    vsoManifest.version = value;
                    vsixManifest.PackageManifest.Metadata[0].Identity[0].$.Version = value;
                    break;
                case "name":
                    vsoManifest.name = value;
                    vsixManifest.PackageManifest.Metadata[0].DisplayName[0] = value;
                    break;
                case "description":
                    vsoManifest.description = value;
                    vsixManifest.PackageManifest.Metadata[0].Description[0]._ = value;
                    break;
                case "versioncheckuri":
                    vsoManifest.versionCheckUri = value;
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
                        vsixManifest.PackageManifest.Metadata[0].Icon = [iconPath];
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
                    vsoManifest.manifestVersion = version;
                    break;
                case "public":
                    if (typeof value === "boolean") {
                        var flags = _.get(vsixManifest, "PackageManifest.Metadata[0].GalleryFlags[0]", "").split(",");
                        _.remove(flags, function (v) { return v === ""; });
                        if (value === true) {
                            flags.push("Public");
                        }
                        _.set(vsixManifest, "PackageManifest.Metadata[0].GalleryFlags[0]", _.uniq(flags).join(","));
                        vsoManifest.__meta_public = value;
                    }
                    break;
                case "publisher":
                    vsixManifest.PackageManifest.Metadata[0].Identity[0].$.Publisher = value;
                    break;
                case "releasenotes":
                    vsixManifest.PackageManifest.Metadata[0].ReleaseNotes = [value];
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
                    this.handleDelimitedList(value, vsixManifest, "PackageManifest.Metadata[0].GalleryFlags[0]");
                    break;
                case "categories":
                    this.handleDelimitedList(value, vsixManifest, "PackageManifest.Metadata[0].Categories[0]");
                    break;
                case "baseuri":
                    vsoManifest.baseUri = value;
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
                case "assets":
                    if (_.isArray(value)) {
                        value.forEach(function (asset) {
                            var assetPath = asset.path.replace(/\\/g, "/");
                            vsixManifest.PackageManifest.Assets[0].Asset.push({
                                "$": {
                                    "Type": asset.type,
                                    "d:Source": "File",
                                    "Path": assetPath
                                }
                            });
                            if (asset.type === "Microsoft.VisualStudio.Services.Icons.Default") {
                                vsixManifest.PackageManifest.Metadata[0].Icon = [assetPath];
                            }
                        });
                    }
                    break;
            }
        };
        return Merger;
    })();
    Package.Merger = Merger;
    var VsixWriter = (function () {
        function VsixWriter(vsoManifest, vsixManifest) {
            this.vsoManifest = vsoManifest;
            this.vsixManifest = vsixManifest;
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
            console.log("Manifests finished prepping.");
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
                vsix.file(VsixWriter.CONTENT_TYPES_FILENAME, _this.genContentTypesXml(Object.keys(vsix.files)));
                var buffer = vsix.generate({
                    type: "nodebuffer",
                    compression: "DEFLATE",
                    compressionOptions: { level: 9 },
                    platform: process.platform
                });
                console.log("Writing vsix to: " + outputPath);
                _this.ensureDirExists(outputPath);
                return Q.nfcall(fs.writeFile, outputPath, buffer).then(function () {
                    return outputPath;
                });
            });
        };
        VsixWriter.prototype.genContentTypesXml = function (fileNames) {
            var contentTypes = {
                Types: {
                    $: {
                        xmlns: "http://schemas.openxmlformats.org/package/2006/content-types"
                    },
                    Default: []
                }
            };
            var uniqueExtensions = _.unique(fileNames.map(function (f) { return _.trimLeft(path.extname(f)); }));
            uniqueExtensions.forEach(function (ext) {
                var type = VsixWriter.CONTENT_TYPE_MAP[ext];
                if (!type) {
                    type = "application/octet-stream";
                }
                contentTypes.Types.Default.push({
                    $: {
                        Extension: ext,
                        ContentType: type
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
        };
        VsixWriter.VSO_MANIFEST_FILENAME = "extension.vsomanifest";
        VsixWriter.VSIX_MANIFEST_FILENAME = "extension.vsixmanifest";
        VsixWriter.CONTENT_TYPES_FILENAME = "[Content_Types].xml";
        VsixWriter.CONTENT_TYPE_MAP = {
            txt: "text/plain",
            pkgdef: "text/plain",
            xml: "text/xml",
            vsixmanifest: "text/xml",
            vsomanifest: "application/json",
            json: "application/json",
            htm: "text/html",
            html: "text/html",
            rtf: "application/rtf",
            pdf: "application/pdf",
            gif: "image/gif",
            jpg: "image/jpg",
            jpeg: "image/jpg",
            tiff: "image/tiff",
            vsix: "application/zip",
            zip: "application/zip",
            dll: "application/octet-stream"
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
