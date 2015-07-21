/// <reference path="../../typings/tsd.d.ts" />
var errHandler = require("./errorhandler");
var fs = require("fs");
var log = require("./logger");
var package = require("./package");
var program = require("commander");
var publish = require("./publish");
var Q = require("q");
var settings = require("./settings");
var upgrade = require("./upgrade");
var App;
(function (App) {
    var defaultSettings = {
        package: {
            root: process.cwd(),
            manifestGlobs: ["**/vss-extension*.json"],
            outputPath: "{auto}",
            overrides: null
        },
        publish: {
            galleryUrl: "https://app.market.visualstudio.com",
            token: null,
            vsixPath: null,
            publisher: null,
            extensionId: null,
            shareWith: []
        }
    };
    function doPackageCreate(settings) {
        log.info("Begin package creation", 1);
        var merger = new package.Package.Merger(settings);
        log.info("Merge partial manifests", 2);
        return merger.merge().then(function (vsixComponents) {
            log.success("Merged successfully");
            var vsixWriter = new package.Package.VsixWriter(vsixComponents.vsoManifest, vsixComponents.vsixManifest, vsixComponents.files);
            log.info("Beginning writing VSIX", 2);
            return vsixWriter.writeVsix(settings.outputPath).then(function (outPath) {
                log.info("VSIX written to: %s", 3, outPath);
                return outPath;
            });
        }).then(function (outPath) {
            log.success("Successfully created VSIX package.");
            return outPath;
        });
    }
    function doPublish(settings) {
        log.info("Begin publish to Gallery", 1);
        var publisher = new publish.Publish.PackagePublisher(settings);
        return publisher.publish().then(function () {
            log.success("Successfully published VSIX from %s to the gallery.", settings.vsixPath);
        });
    }
    function doSharing(settings, unshare) {
        if (unshare === void 0) { unshare = false; }
        log.info("Begin %ssharing with accounts: %s", 1, unshare ? "un-" : "", settings.shareWith.join(", "));
        var sharingMgr = new publish.Publish.SharingManager(settings);
        if (!unshare) {
            return sharingMgr.shareWith(settings.shareWith).then(function () {
                log.success("Extension shared successfully.");
            });
        }
        else {
            return sharingMgr.unshareWith(settings.shareWith).then(function () {
                log.success("Extension un-shared successfully.");
            });
        }
    }
    function publishVsix(options) {
        return settings.resolveSettings(options, defaultSettings).then(function (settings) {
            return Q.Promise(function (resolve, reject, notify) {
                try {
                    if (!settings.package) {
                        log.info("VSIX was manually specified. Skipping generation.", 1);
                        resolve(settings.publish.vsixPath);
                    }
                    else {
                        resolve(doPackageCreate(settings.package));
                    }
                }
                catch (err) {
                    reject(err);
                }
            }).then(function (vsixPath) {
                settings.publish.vsixPath = vsixPath;
                return doPublish(settings.publish);
            }).then(function () {
                if (settings.publish.shareWith && settings.publish.shareWith.length > 0) {
                    return doSharing(settings.publish);
                }
            });
        }).catch(errHandler.errLog);
    }
    App.publishVsix = publishVsix;
    function shareExtension(options) {
        return settings.resolveSettings(options, defaultSettings).then(function (settings) {
            if (settings.publish.shareWith && settings.publish.shareWith.length > 0) {
                return doSharing(settings.publish);
            }
            else {
                throw "You must specify specific accounts to share with.";
            }
        }).catch(errHandler.errLog);
    }
    App.shareExtension = shareExtension;
    function unshareExtension(options) {
        return settings.resolveSettings(options, defaultSettings).then(function (settings) {
            if (settings.publish.shareWith && settings.publish.shareWith.length > 0) {
                return doSharing(settings.publish, true);
            }
            else {
                throw "You must specify specific accounts to un-share with.";
            }
        }).catch(errHandler.errLog);
    }
    App.unshareExtension = unshareExtension;
    function showExtension(options) {
        return settings.resolveSettings(options, defaultSettings).then(function (settings) {
            log.info("Getting extension info...", 1);
            var sharingMgr = new publish.Publish.SharingManager(settings.publish);
            return sharingMgr.getExtensionInfo().then(function (info) {
                log.info(JSON.stringify(info, null, 4), 3);
            });
        }).catch(errHandler.errLog);
    }
    App.showExtension = showExtension;
    function createPackage(options) {
        return settings.resolveSettings(options, defaultSettings).then(function (settings) {
            return doPackageCreate(settings.package);
        }).catch(errHandler.errLog);
    }
    App.createPackage = createPackage;
    function createPublisher(name, displayName, description, options) {
        log.info("Creating publisher %s", 1, name);
        return settings.resolveSettings(options, defaultSettings).then(function (options) {
            var pubManager = new publish.Publish.PublisherManager(options.publish);
            return pubManager.createPublisher(name, displayName, description);
        }).then(function () {
            log.success("Successfully created publisher `%s`", name);
        }).catch(errHandler.errLog);
    }
    App.createPublisher = createPublisher;
    function deletePublisher(publisherName, options) {
        log.info("Deleting publisher %s", 1, publisherName);
        return settings.resolveSettings(options, defaultSettings).then(function (options) {
            var pubManager = new publish.Publish.PublisherManager(options.publish);
            return pubManager.deletePublisher(publisherName);
        }).then(function () {
            log.success("Successfully deleted publisher `%s`", publisherName);
        }).catch(errHandler.errLog);
    }
    App.deletePublisher = deletePublisher;
    function toM85(pathToManifest, publisherName, outputPath, options) {
        var outPath = outputPath;
        if (!outputPath) {
            outPath = pathToManifest;
        }
        if (fs.existsSync(outPath) && !options.forceOverwrite) {
            log.error("File %s already exists. Specify the -f to force overwriting this file.", outPath);
            process.exit(-1);
        }
        if (!publisherName) {
            log.error("Publisher name not specified.");
            process.exit(-1);
        }
        var upgrader = new upgrade.ToM85(pathToManifest, publisherName);
        return upgrader.execute(outPath).then(function () {
            log.success("Successfully upgraded manifest to M85. Result written to %s", outPath);
        }).catch(errHandler.errLog);
    }
    App.toM85 = toM85;
})(App || (App = {}));
var version = process.version;
if (parseInt(version.split(".")[1], 10) < 12) {
    log.error("Please upgrade to NodeJS v0.12.x or higher");
    process.exit(-1);
}
program
    .version("0.0.1")
    .option("--fiddler", "Use the fiddler proxy for REST API calls.")
    .option("--nologo", "Suppress printing the VSET logo.")
    .option("--debug", "Print debug log messages.")
    .option("--save", "Save command line options to ./settings.vset.json")
    .usage("command [options]");
program
    .command("package")
    .description("Create a vsix package for an extension.")
    .option("-r, --root <root>", "Specify the root for files in your vsix package. [.]")
    .option("-m, --manifest-glob <glob>", "Specify the pattern for manifest files to join. [**/*-manifest.json]")
    .option("-o, --output-path <output>", "Specify the path and file name of the generated vsix. [..]")
    .option("-s, --settings <settings_path>", "Specify the path to a settings file")
    .option("-i, --override <overrides_JSON>", "Specify a JSON string to override anything in the manifests.")
    .action(App.createPackage);
program
    .command("publish")
    .description("Publish a VSIX package to your account. Generates the VSIX using [package_settings_path] unless --vsix is specified.")
    .option("-v, --vsix <path_to_vsix>", "If specified, publishes this VSIX package instead of auto-packaging.")
    .option("-r, --root <root>", "Specify the root for files in your vsix package. [.]")
    .option("-m, --manifest-glob <manifest-glob>", "Specify the pattern for manifest files to join. [**/*-manifest.json]")
    .option("-o, --output-path <output>", "Specify the path and file name of the generated vsix. [..]")
    .option("-i, --override <overrides_JSON>", "Specify a JSON string to override anything in the manifests.")
    .option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery.")
    .option("-t, --token <token>", "Specify your personal access token.")
    .option("-w, --share-with <share_with>", "Comma-separated list of accounts to share the extension with after it is published.")
    .option("-s, --settings <settings_path>", "Specify the path to a settings file")
    .action(App.publishVsix);
program
    .command("create-publisher <name> <display_name> <description>")
    .description("Create a publisher")
    .option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery.")
    .option("-t, --token <token>", "Specify your personal access token.")
    .option("-s, --settings <settings_path>", "Specify the path to a settings file")
    .action(App.createPublisher);
program
    .command("delete-publisher <publisher_name>")
    .description("Delete a publisher")
    .option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery.")
    .option("-t, --token <token>", "Specify your personal access token.")
    .option("-s, --settings <settings_path>", "Specify the path to a settings file")
    .action(App.deletePublisher);
program
    .command("share")
    .description("Share a private extension with other accounts.")
    .option("-w, --share-with <share_with>", "Comma-separated list of accounts to share the extension with.")
    .option("-p, --publisher <publisher>", "Specify the publisher of the extension to be shared.")
    .option("-e, --extension <extension_id>", "Specify the name of the extension to be shared.")
    .option("-v, --vsix <path_to_vsix>", "If specified, discovers the publisher & extension ID from the package.")
    .option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery.")
    .option("-t, --token <token>", "Specify your personal access token.")
    .option("-s, --settings <settings_path>", "Specify the path to a settings file")
    .action(App.shareExtension);
program
    .command("unshare")
    .description("Un-share a private extension with other accounts.")
    .option("-w, --unshare-with <unshare_with>", "Comma-separated list of accounts to un-share the extension with.")
    .option("-p, --publisher <publisher>", "Specify the publisher of the extension to be un-shared.")
    .option("-e, --extension <extension_id>", "Specify the name of the extension to be un-shared.")
    .option("-v, --vsix <path_to_vsix>", "If specified, discovers the publisher & extension ID from the package.")
    .option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery.")
    .option("-t, --token <token>", "Specify your personal access token.")
    .option("-s, --settings <settings_path>", "Specify the path to a settings file")
    .action(App.unshareExtension);
program
    .command("show")
    .description("Show information about an extension.")
    .option("-p, --publisher <publisher>", "Specify the publisher of the extension to be shared.")
    .option("-e, --extension <extension_id>", "Specify the name of the extension to be shared.")
    .option("-v, --vsix <path_to_vsix>", "If specified, discovers the publisher & extension ID from the package.")
    .option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery.")
    .option("-t, --token <token>", "Specify your personal access token.")
    .option("-s, --settings <settings_path>", "Specify the path to a settings file")
    .action(App.showExtension);
program
    .command("migrate <path_to_manifest> <publisher_name> [output_path]")
    .description("Convert a manifest to the new contribution model introduced in M85.")
    .option("-f, --force-overwrite", "Overwrite an existing file, or overwrite the original manifest when output_path is not specified.")
    .action(App.toM85);
program.parse(process.argv);
var commandNames = program["commands"].map(function (c) { return c._name; });
if (program["rawArgs"].length < 3 || commandNames.indexOf(program["rawArgs"][2]) === -1) {
    program.help();
}
