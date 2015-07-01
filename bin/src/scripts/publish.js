/// <reference path="../../typings/tsd.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var _ = require("lodash");
var errHandler = require("./errorhandler");
var fs = require("fs");
var GalleryClient = require("../lib/VSS/Gallery/RestClient");
var RestClient = require("../lib/VSS/WebApi/RestClient");
var Q = require("q");
var xml2js = require("xml2js");
var zip = require("jszip");
var Publish;
(function (Publish) {
    var GalleryBase = (function () {
        function GalleryBase(baseUrl, token) {
            if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
                throw "Invalid or missing gallery URL.";
            }
            if (!token || !/^[A-z0-9]{52}$/.test(token)) {
                console.log(token);
                console.log(token.length);
                throw "Invalid or missing personal access token.";
            }
            this.galleryUrl = baseUrl;
            this.token = token;
            this.galleryClient = RestClient.VssHttpClient.getClient(GalleryClient.GalleryHttpClient, this.galleryUrl, this.token);
        }
        return GalleryBase;
    })();
    var PublisherManager = (function (_super) {
        __extends(PublisherManager, _super);
        function PublisherManager(settings) {
            _super.call(this, settings.galleryUrl, settings.token);
        }
        PublisherManager.prototype.createPublisher = function (name, displayName, description) {
            return this.galleryClient.createPublisher({
                publisherName: name,
                displayName: displayName,
                longDescription: description,
                shortDescription: description
            }).catch(errHandler.err);
        };
        PublisherManager.prototype.deletePublisher = function (name) {
            return this.galleryClient.deletePublisher(name).catch(errHandler.err);
        };
        return PublisherManager;
    })(GalleryBase);
    Publish.PublisherManager = PublisherManager;
    var PackagePublisher = (function (_super) {
        __extends(PackagePublisher, _super);
        function PackagePublisher(settings) {
            _super.call(this, settings.galleryUrl, settings.token);
        }
        PackagePublisher.prototype.getExtensionIdAndPublisher = function (vsixPath) {
            return Q.Promise(function (resolve, reject, notify) {
                fs.readFile(vsixPath, function (err, data) {
                    if (err)
                        reject(err);
                    console.log("Read vsix as zip... Size (bytes): " + data.length);
                    resolve(new zip(data));
                });
            }).then(function (zip) {
                console.log("Files in the zip: " + Object.keys(zip.files).join(", "));
                var vsixManifestFileNames = Object.keys(zip.files).filter(function (key) { return _.endsWith(key, "vsixmanifest"); });
                if (vsixManifestFileNames.length > 0) {
                    return Q.nfcall(xml2js.parseString, zip.files[vsixManifestFileNames[0]].asText());
                }
                else {
                    throw "Could not locate vsix manifest!";
                }
            }).then(function (vsixManifestAsJson) {
                var extensionId = _.get(vsixManifestAsJson, "PackageManifest.Metadata[0].Identity[0].$.Id");
                var extensionPublisher = _.get(vsixManifestAsJson, "PackageManifest.Metadata[0].Identity[0].$.Publisher");
                if (extensionId && extensionPublisher) {
                    return { id: extensionId, publisher: extensionPublisher };
                }
                else {
                    throw "Could not locate both the extension id and publisher in vsix manfiest! Ensure your manifest includes both a namespace and a publisher property.";
                }
            });
        };
        PackagePublisher.prototype.checkVsixPublished = function (vsixPath) {
            var _this = this;
            return this.getExtensionIdAndPublisher(vsixPath).then(function (extInfo) {
                return _this.galleryClient.getExtension(extInfo.publisher, extInfo.id).then(function (ext) {
                    if (ext) {
                        return extInfo;
                    }
                    return null;
                }).catch(function () { return null; });
            });
        };
        PackagePublisher.prototype.publish = function (vsixPath) {
            var _this = this;
            var extPackage = {
                extensionManifest: fs.readFileSync(vsixPath, "base64")
            };
            console.log("Begin publish for vsix at " + vsixPath);
            console.log("Checking if this extension is already published...");
            return this.checkVsixPublished(vsixPath).then(function (publishedExtInfo) {
                if (publishedExtInfo) {
                    console.log("It is, update the extension");
                    return _this.galleryClient.updateExtension(extPackage, publishedExtInfo.publisher, publishedExtInfo.id).then(function () {
                    }).catch(errHandler.err);
                }
                else {
                    console.log("It isn't, create a new extension.");
                    return _this.galleryClient.createExtension(extPackage).then(function () {
                    }).catch(errHandler.err);
                }
            });
        };
        return PackagePublisher;
    })(GalleryBase);
    Publish.PackagePublisher = PackagePublisher;
})(Publish = exports.Publish || (exports.Publish = {}));
