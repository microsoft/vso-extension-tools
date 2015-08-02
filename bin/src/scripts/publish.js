/// <reference path="../../typings/tsd.d.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var _ = require("lodash");
var chalk = require("chalk");
var errHandler = require("./errorhandler");
var fs = require("fs");
var GalleryClient = require("../lib/VSS/Gallery/RestClient");
var GalleryContracts = require("../lib/VSS/Gallery/Contracts");
var log = require("./logger");
var RestClient = require("../lib/VSS/WebApi/RestClient");
var Q = require("q");
var xml2js = require("xml2js");
var zip = require("jszip");
var Publish;
(function (Publish) {
    var GalleryBase = (function () {
        function GalleryBase(settings) {
            if (!settings.galleryUrl || !/^https?:\/\//.test(settings.galleryUrl)) {
                throw "Invalid or missing gallery URL.";
            }
            if (!settings.token || !/^[A-z0-9]{52}$/.test(settings.token)) {
                throw "Invalid or missing personal access token.";
            }
            this.settings = settings;
            this.galleryClient = RestClient.VssHttpClient.getClient(GalleryClient.GalleryHttpClient, this.settings.galleryUrl, this.settings.token);
        }
        GalleryBase.prototype.getExtInfo = function () {
            var _this = this;
            if (!this.vsixInfoPromise) {
                if (this.settings.extensionId && this.settings.publisher) {
                    this.vsixInfoPromise = Q.resolve({ id: this.settings.extensionId, publisher: this.settings.publisher, version: null });
                }
                else {
                    this.vsixInfoPromise = Q.Promise(function (resolve, reject, notify) {
                        fs.readFile(_this.settings.vsixPath, function (err, data) {
                            if (err)
                                reject(err);
                            log.debug("Read vsix as zip... Size (bytes): %s", data.length.toString());
                            try {
                                resolve(new zip(data));
                            }
                            catch (err) {
                                reject(err);
                            }
                        });
                    }).then(function (zip) {
                        log.debug("Files in the zip: %s", Object.keys(zip.files).join(", "));
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
                        var extensionVersion = _.get(vsixManifestAsJson, "PackageManifest.Metadata[0].Identity[0].$.Version");
                        if (extensionId && extensionPublisher) {
                            return { id: extensionId, publisher: extensionPublisher, version: extensionVersion };
                        }
                        else {
                            throw "Could not locate both the extension id and publisher in vsix manfiest! Ensure your manifest includes both a namespace and a publisher property.";
                        }
                    });
                }
            }
            return this.vsixInfoPromise;
        };
        return GalleryBase;
    })();
    var PublisherManager = (function (_super) {
        __extends(PublisherManager, _super);
        function PublisherManager(settings) {
            _super.call(this, settings);
        }
        PublisherManager.prototype.createPublisher = function (name, displayName, description) {
            return this.galleryClient.createPublisher({
                publisherName: name,
                displayName: displayName,
                longDescription: description,
                shortDescription: description
            }).catch(errHandler.httpErr);
        };
        PublisherManager.prototype.deletePublisher = function (name) {
            return this.galleryClient.deletePublisher(name).catch(errHandler.httpErr);
        };
        return PublisherManager;
    })(GalleryBase);
    Publish.PublisherManager = PublisherManager;
    var SharingManager = (function (_super) {
        __extends(SharingManager, _super);
        function SharingManager(settings) {
            _super.call(this, settings);
        }
        SharingManager.prototype.shareWith = function (accounts) {
            var _this = this;
            return this.getExtInfo().then(function (extInfo) {
                return Q.all(accounts.map(function (account) {
                    return _this.galleryClient.shareExtension(extInfo.publisher, extInfo.id, account).catch(errHandler.httpErr);
                }));
            });
        };
        SharingManager.prototype.unshareWith = function (accounts) {
            var _this = this;
            return this.getExtInfo().then(function (extInfo) {
                return Q.all(accounts.map(function (account) {
                    return _this.galleryClient.unshareExtension(extInfo.publisher, extInfo.id, account).catch(errHandler.httpErr);
                }));
            });
        };
        SharingManager.prototype.unshareWithAll = function () {
            var _this = this;
            return this.getSharedWithAccounts().then(function (accounts) {
                return _this.unshareWith(accounts);
            });
        };
        SharingManager.prototype.getSharedWithAccounts = function () {
            return this.getExtensionInfo().then(function (ext) {
                return ext.allowedAccounts.map(function (acct) { return acct.accountName; });
            });
        };
        SharingManager.prototype.getExtensionInfo = function () {
            var _this = this;
            return this.getExtInfo().then(function (extInfo) {
                return _this.galleryClient.getExtension(extInfo.publisher, extInfo.id, null, GalleryContracts.ExtensionQueryFlags.IncludeVersions |
                    GalleryContracts.ExtensionQueryFlags.IncludeFiles |
                    GalleryContracts.ExtensionQueryFlags.IncludeCategoryAndTags |
                    GalleryContracts.ExtensionQueryFlags.IncludeSharedAccounts).then(function (extension) {
                    return extension;
                }).catch(errHandler.httpErr);
            });
        };
        return SharingManager;
    })(GalleryBase);
    Publish.SharingManager = SharingManager;
    var PackagePublisher = (function (_super) {
        __extends(PackagePublisher, _super);
        function PackagePublisher(settings) {
            _super.call(this, settings);
        }
        PackagePublisher.prototype.checkVsixPublished = function () {
            var _this = this;
            return this.getExtInfo().then(function (extInfo) {
                return _this.galleryClient.getExtension(extInfo.publisher, extInfo.id).then(function (ext) {
                    if (ext) {
                        extInfo.published = true;
                        return extInfo;
                    }
                    return extInfo;
                }).catch(function () { return extInfo; });
            });
        };
        PackagePublisher.prototype.publish = function () {
            var _this = this;
            var extPackage = {
                extensionManifest: fs.readFileSync(this.settings.vsixPath, "base64")
            };
            log.debug("Publishing %s", this.settings.vsixPath);
            log.info("Checking if this extension is already published", 2);
            return this.createOrUpdateExtension(extPackage).then(function (extInfo) {
                log.info("Waiting for server to validate extension package...", 1);
                return _this.waitForValidation(extInfo.version).then(function (result) {
                    if (result === PackagePublisher.validated) {
                        return "success";
                    }
                    else {
                        throw "Extension validation failed. Please address the following issues and retry publishing.\n" + result;
                    }
                });
            });
        };
        PackagePublisher.prototype.createOrUpdateExtension = function (extPackage) {
            var _this = this;
            return this.checkVsixPublished().then(function (extInfo) {
                if (extInfo && extInfo.published) {
                    log.info("It is, %s the extension", 3, chalk.cyan("update").toString());
                    return _this.galleryClient.updateExtension(extPackage, extInfo.publisher, extInfo.id).catch(errHandler.httpErr).then(function (publishedExtension) {
                        return extInfo;
                    });
                }
                else {
                    log.info("It isn't, %s a new extension.", 3, chalk.cyan("create").toString());
                    return _this.galleryClient.createExtension(extPackage).catch(errHandler.httpErr).then(function (publishedExtension) {
                        return extInfo;
                    });
                }
            });
        };
        PackagePublisher.prototype.waitForValidation = function (version, interval, retries) {
            var _this = this;
            if (interval === void 0) { interval = PackagePublisher.validationInterval; }
            if (retries === void 0) { retries = PackagePublisher.validationRetries; }
            if (retries === 0) {
                throw "Validation timed out. There may be a problem validating your extension. Please try again later.";
            }
            else if (retries === 25) {
                log.info("This is taking longer than usual. Hold tight...", 2);
            }
            log.debug("Polling for validation (%s retries remaining).", retries.toString());
            return Q.delay(this.getValidationStatus(version), interval).then(function (status) {
                log.debug("--Retrieved validation status: %s", status);
                if (status === PackagePublisher.validationPending) {
                    return _this.waitForValidation(version, interval, retries - 1);
                }
                else {
                    return status;
                }
            });
        };
        PackagePublisher.prototype.getValidationStatus = function (version) {
            var _this = this;
            return this.getExtInfo().then(function (extInfo) {
                return _this.galleryClient.getExtension(extInfo.publisher, extInfo.id, extInfo.version, GalleryContracts.ExtensionQueryFlags.IncludeVersions).then(function (ext) {
                    if (!ext || ext.versions.length === 0) {
                        throw "Extension not published.";
                    }
                    var extVersion = ext.versions[0];
                    if (version) {
                        extVersion = _this.getVersionedExtension(ext, version);
                    }
                    if (extVersion.validationResultMessage) {
                        return extVersion.validationResultMessage;
                    }
                    else if ((extVersion.flags & GalleryContracts.ExtensionVersionFlags.Validated) === 0) {
                        return PackagePublisher.validationPending;
                    }
                    else {
                        return PackagePublisher.validated;
                    }
                });
            });
        };
        PackagePublisher.prototype.getVersionedExtension = function (extension, version) {
            var matches = extension.versions.filter(function (ev) { return ev.version === version; });
            if (matches.length > 0) {
                return matches[0];
            }
            else {
                return null;
            }
        };
        PackagePublisher.validationPending = "__validation_pending";
        PackagePublisher.validated = "__validated";
        PackagePublisher.validationInterval = 1000;
        PackagePublisher.validationRetries = 50;
        return PackagePublisher;
    })(GalleryBase);
    Publish.PackagePublisher = PackagePublisher;
})(Publish = exports.Publish || (exports.Publish = {}));
