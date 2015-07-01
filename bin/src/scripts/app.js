/// <reference path="../../typings/tsd.d.ts" />
var _ = require("lodash");
var fs = require("fs");
var logger = require("tracer");
var package = require("./package");
var program = require("commander");
var publish = require("./publish");
var Q = require("q");
var settings = require("./settings");
var upgrade = require("./upgrade");
var log = logger.console();
var App;
(function (App) {
    var defaultSettings = {
        package: {
            root: process.cwd(),
            manifestGlobs: ["**/*-manifest.json"],
            outputPath: "{auto}",
            publisher: null
        }
    };
    function doPackageCreate(settings) {
        var merger = new package.Package.Merger(settings);
        console.log("Beginning merge of partial manifests.");
        return merger.merge().then(function (manifests) {
            console.log("Merge completed.");
            var vsixWriter = new package.Package.VsixWriter(manifests.vsoManifest, manifests.vsixManifest);
            console.log("Beginning writing VSIX");
            return vsixWriter.writeVsix(settings.outputPath).then(function (outPath) {
                console.log("VSIX written to: " + outPath);
                return outPath;
            });
        }).then(function (outPath) {
            console.log("Successfully created VSIX package.");
            return outPath;
        });
    }
    function doPublish(settings) {
        var publisher = new publish.Publish.PackagePublisher(settings);
        return publisher.publish(settings.vsixPath);
    }
    function publishVsix(options) {
        return settings.resolveSettings(options, defaultSettings).then(function (settings) {
            return Q.Promise(function (resolve, reject, notify) {
                if (!settings.package) {
                    console.log("VSIX was manually specified. Skipping generation.");
                    resolve(settings.publish.vsixPath);
                }
                else {
                    resolve(doPackageCreate(settings.package));
                }
            }).then(function (vsixPath) {
                settings.publish.vsixPath = vsixPath;
                return doPublish(settings.publish);
            }).then(function () {
                console.log("Successfully published VSIX from " + settings.publish.vsixPath + " to the gallery.");
            }).catch(function (error) {
                var errStr = _.isString(error) ? error : JSON.stringify(error, null, 4);
                console.error("Error: " + errStr);
            }).then(function () {
                process.exit(0);
            });
        }).catch(function (err) {
            console.error(err);
            process.exit(-1);
        });
    }
    App.publishVsix = publishVsix;
    function createPackage(options) {
        return settings.resolveSettings(options, defaultSettings).then(function (settings) {
            return doPackageCreate(settings.package).then(function () {
                process.exit(0);
            });
        }).catch(function (err) {
            console.error(err);
            process.exit(-1);
        });
    }
    App.createPackage = createPackage;
    function createPublisher(name, displayName, description, options) {
        return settings.resolveSettings(options, defaultSettings).then(function (options) {
            var pubManager = new publish.Publish.PublisherManager(options.publish);
            return pubManager.createPublisher(name, displayName, description).catch(console.error.bind(console));
        }).then(function () {
            console.log("Successfully created publisher `" + name + "`.");
            process.exit(0);
        }).catch(function (err) {
            console.error(err);
            process.exit(-1);
        });
    }
    App.createPublisher = createPublisher;
    function deletePublisher(publisherName, options) {
        return settings.resolveSettings(options, defaultSettings).then(function (options) {
            var pubManager = new publish.Publish.PublisherManager(options.publish);
            return pubManager.deletePublisher(publisherName).catch(console.error.bind(console));
        }).then(function () {
            console.log("Successfully deleted publisher `" + publisherName + "`.");
            process.exit(0);
        }).catch(function (err) {
            console.error(err);
            process.exit(-1);
        });
    }
    App.deletePublisher = deletePublisher;
    function toM85(pathToManifest, publisherName, outputPath, options) {
        var outPath = outputPath;
        if (!outputPath) {
            outPath = pathToManifest;
        }
        if (fs.existsSync(outPath) && !options.forceOverwrite) {
            throw "File " + outPath + " already exists. Specify the -f to force overwriting this file.";
        }
        if (!publisherName) {
            throw "Publisher name not specified.";
        }
        var upgrader = new upgrade.ToM85(pathToManifest, publisherName);
        return upgrader.execute(outPath).then(function () {
            console.log("Successfully upgraded manifest to M85. Result written to " + outPath + ".");
            process.exit(0);
        }).catch(function (err) {
            console.error(err);
            process.exit(-1);
        });
    }
    App.toM85 = toM85;
})(App || (App = {}));
var version = process.version;
if (parseInt(version.split(".")[1], 10) < 12) {
    console.log("Please upgrade to NodeJS v0.12.x or higher");
    process.exit(-1);
}
program
    .version("0.0.1")
    .option("--fiddler", "Use the fiddler proxy for REST API calls.")
    .usage("command [options]");
program
    .command("package")
    .description("Create a vsix package for an extension.")
    .option("-r, --root <root>", "Specify the root for files in your vsix package. [.]")
    .option("-m, --manifest-glob <glob>", "Specify the pattern for manifest files to join. [**/*-manifest.json]")
    .option("-o, --output-path <output>", "Specify the path and file name of the generated vsix. [..]")
    .option("-s, --settings <settings_path>", "Specify the path to a settings file")
    .action(App.createPackage);
program
    .command("publish")
    .description("Publish a VSIX package to your account. Generates the VSIX using [package_settings_path] unless --vsix is specified.")
    .option("-v, --vsix <path_to_vsix>", "If specified, publishes this VSIX package instead of auto-packaging.")
    .option("-r, --root <root>", "Specify the root for files in your vsix package. [.]")
    .option("-m, --manifest-glob <manifest-glob>", "Specify the pattern for manifest files to join. [**/*-manifest.json]")
    .option("-o, --output-path <output>", "Specify the path and file name of the generated vsix. [..]")
    .option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery.")
    .option("-t, --token <token>", "Specify your personal access token.")
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
    .command("toM85 <path_to_manifest> <publisher_name> [output_path]")
    .description("Convert a manifest to the new contribution model introduced in M85.")
    .option("-f, --force-overwrite", "Overwrite an existing file, or overwrite the original manifest when output_path is not specified.")
    .action(App.toM85);
program.parse(process.argv);
program.outputHelp();
