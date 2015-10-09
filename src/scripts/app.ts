/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import chalk = require("chalk");
import errHandler = require("./errorhandler");
import fs = require("fs");
import inquirer = require("inquirer");
import loc = require("./loc");
import log = require("./logger");
import pkg = require("./package");
import path = require("path");
import program = require("commander");
import publish = require("./publish");
import Q = require("q");
import settings = require("./settings");
import upgrade = require("./upgrade");

module App {
	let defaultSettings = {
		package: {
			root: process.cwd(),
			manifestGlobs: ["vss-extension.json"],
			outputPath: "{auto}",
			overrides: null,
			locRoot: null,
			resjsonPath: null
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
	
	function doPackageCreate(settings: settings.PackageSettings): Q.Promise<string> {
		log.info("Begin package creation", 1);
		let merger = new pkg.Package.Merger(settings);
		log.info("Merge partial manifests", 2);
		return merger.merge().then((vsixComponents) => {
			log.success("Merged successfully");
			let vsixWriter = new pkg.Package.VsixWriter(settings, vsixComponents);
			log.info("Beginning writing VSIX", 2);
			return vsixWriter.writeVsix().then((outPath: string) => {
				log.info("VSIX written to: %s", 3, outPath);
				return outPath;
			});
		}).then((outPath) => {
			log.success("Successfully created VSIX package.");
			return outPath;
		});
	}
	
	function doPublish(settings: settings.PublishSettings): Q.Promise<any> {
		log.info("Begin publish to Gallery", 1);
		let publisher = new publish.Publish.PackagePublisher(settings);
		return publisher.publish().then(() => {
			log.success("Successfully published VSIX from %s to the gallery.", settings.vsixPath);
		});
	}
	
	function doSharing(settings: settings.PublishSettings, unshare: boolean = false): Q.Promise<any> {
		log.info("Begin %ssharing with accounts: %s", 1, unshare ? "un-" : "", settings.shareWith.join(", "));
		let sharingMgr = new publish.Publish.SharingManager(settings);
		if (!unshare) {
			return sharingMgr.shareWith(settings.shareWith).then(() => {
				log.success("Extension shared successfully.");
			});
		} else {
			return sharingMgr.unshareWith(settings.shareWith).then(() => {
				log.success("Extension un-shared successfully.");
			});
		}
	}
	
	export function publishVsix(options: settings.CommandLineOptions): Q.Promise<any> {
		return settings.resolveSettings(options, defaultSettings).then((settings) => {
			return Q.Promise<string>((resolve, reject, notify) => {
				try {
					if (!settings.package) {
						log.info("VSIX was manually specified. Skipping generation.", 1);
						resolve(settings.publish.vsixPath);
					} else {
						resolve(doPackageCreate(settings.package));
					}
				} catch (err) {
					reject(err);
				}
			}).then((vsixPath) => {
				settings.publish.vsixPath = vsixPath;
				return doPublish(settings.publish);
			}).then(() => {
				if (settings.publish.shareWith && settings.publish.shareWith.length > 0) {
					return doSharing(settings.publish);
				}
			});
		}).catch(errHandler.errLog);
	}
	
	export function shareExtension(options: settings.CommandLineOptions): Q.Promise<any> {
		return settings.resolveSettings(options, defaultSettings).then((settings) => {
			if (settings.publish.shareWith && settings.publish.shareWith.length > 0) {
				return doSharing(settings.publish);
			} else {
				throw "You must specify specific accounts to share with.";
			}
		}).catch(errHandler.errLog);
	}
	
	export function unshareExtension(options: settings.CommandLineOptions): Q.Promise<any> {
		return settings.resolveSettings(options, defaultSettings).then((settings) => {
			if (settings.publish.shareWith && settings.publish.shareWith.length > 0) {
				return doSharing(settings.publish, true);
			} else {
				throw "You must specify specific accounts to un-share with.";
			}
		}).catch(errHandler.errLog);
	}
	
	export function showExtension(options: settings.CommandLineOptions): Q.Promise<any> {
		return settings.resolveSettings(options, defaultSettings).then((settings) => {
			log.info("Getting extension info...", 1);
			let sharingMgr = new publish.Publish.SharingManager(settings.publish);
			return sharingMgr.getExtensionInfo().then((info) => {
				log.info(JSON.stringify(info, null, 4), 3);
			});
		}).catch(errHandler.errLog);
	}
	
	export function createPackage(options: settings.CommandLineOptions): Q.Promise<any> {
		return settings.resolveSettings(options, defaultSettings).then((settings) => {
			return doPackageCreate(settings.package);
		}).catch(errHandler.errLog);
	}
	
	export function createPublisher(name: string, displayName: string, description: string, options: settings.CommandLineOptions): Q.Promise<any> {
		log.info("Creating publisher %s", 1, name);
		return settings.resolveSettings(options, defaultSettings).then((options) => {
			let pubManager = new publish.Publish.PublisherManager(options.publish);
			return pubManager.createPublisher(name, displayName, description);
		}).then(() => {
			log.success("Successfully created publisher `%s`", name);
		}).catch(errHandler.errLog);
	}
	
	export function deletePublisher(publisherName: string, options: settings.CommandLineOptions): Q.Promise<any> {
		log.info("Deleting publisher %s", 1, publisherName);
		return settings.resolveSettings(options, defaultSettings).then((options) => {
			let pubManager = new publish.Publish.PublisherManager(options.publish);
			return pubManager.deletePublisher(publisherName);
		}).then(() => {
			log.success("Successfully deleted publisher `%s`", publisherName);
		}).catch(errHandler.errLog);
	}
	
	export function toM85(pathToManifest: string, publisherName: string, outputPath: string, options: settings.CommandLineOptions): Q.Promise<any> {
		let outPath = outputPath;
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
		let upgrader = new upgrade.ToM85(pathToManifest, publisherName);
		return upgrader.execute(outPath).then(() => {
			log.success("Successfully upgraded manifest to M85. Result written to %s", outPath);
		}).catch(errHandler.errLog);
	}
	
	export function genResources(generatedResjsonPath: string, options: settings.CommandLineOptions) {
		return settings.resolveSettings(options, defaultSettings).then((settings) => {
			log.info("Begin resource generation", 1);
			let merger = new pkg.Package.Merger(settings.package);
			log.info("Merge partial manifests", 2);
			return merger.merge().then((vsixComponents) => {
				let resFilePath = path.resolve(settings.package.root, generatedResjsonPath);
				log.info("Writing resources to '%s'", 2, resFilePath);
				return loc.LocPrep.writeResourceFile(resFilePath, vsixComponents.resources.combined).then(() => resFilePath);
			});
		}).then((outPath) => {
			log.success("Wrote resources to '%s'", outPath);
		}).catch(errHandler.errLog);
	}
}

let version = process.version.split(".");
if (parseInt(version[1], 10) < 12 && version[0] === "v0") {
	log.error("Please upgrade to NodeJS v0.12.x or higher");
	process.exit(-1);
}

program
	.version("0.4.18")
	.option("--fiddler", "Use the fiddler proxy for REST API calls.")
	.option("--nologo", "Suppress printing the VSET logo.")
	.option("--debug", "Print debug log messages.")
	.option("--save", "Save command line options to ./settings.vset.json")
	.option("--bypass-validation", "Bypass local validation during packaging.")
	.usage("command [options]");

program
	.command("package")
	.description("Create a vsix package for an extension.")
	.option("-r, --root <root>", "Specify the root for files in your vsix package. [.]")
	.option("-m, --manifest-glob <glob>", "Specify the pattern for manifest files to join. [vss-extension.json]")
	.option("-o, --output-path <output>", "Specify the path and file name of the generated vsix. [{auto}]")
	.option("-s, --settings <settings_path>", "Specify the path to a settings file. [./settings.vset.json]")
	.option("-i, --override <overrides_JSON>", "Specify a JSON string to override anything in the manifests.")
	.option("-p, --publisher <publisher>", "Specify/override the publisher of the extension.")
	.option("-e, --extension <extension_id>", "Specify/override the extension id of the extension.")
	.option("-l, --loc-root <loc_root>", "Specify the root for localization files (see README for more info). [en-US]")	
	.action(App.createPackage);
	
program
	.command("publish")
	.description("Publish a VSIX package to your account. Generates the VSIX using [package_settings_path] unless --vsix is specified.")
	.option("-v, --vsix <path_to_vsix>", "If specified, publishes this VSIX package instead of auto-packaging.")
	.option("-r, --root <root>", "Specify the root for files in your vsix package. [.]")
	.option("-m, --manifest-glob <glob>", "Specify the pattern for manifest files to join. [vss-extension.json]")
	.option("-o, --output-path <output>", "Specify the path and file name of the generated vsix. [{auto}]")
	.option("-p, --publisher <publisher>", "Specify/override the publisher of the extension.")
	.option("-e, --extension <extension_id>", "Specify/override the extension id of the extension.")
	.option("-i, --override <overrides_JSON>", "Specify a JSON string to override anything in the manifests.")
	.option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery. [https://app.market.visualstudio.com]")
	.option("-t, --token <token>", "Specify your personal access token.")
	.option("-w, --share-with <share_with>", "Comma-separated list of accounts to share the extension with after it is published.")
	.option("-s, --settings <settings_path>", "Specify the path to a settings file. [./settings.vset.json]")
	.option("-l, --loc-root <loc_root>", "Specify the root for localization files (see README for more info). [en-US]")
	.action(App.publishVsix);
	
program
	.command("create-publisher <name> <display_name> <description>")
	.description("Create a publisher")
	.option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery. [https://app.market.visualstudio.com]")
	.option("-t, --token <token>", "Specify your personal access token.")
	.option("-s, --settings <settings_path>", "Specify the path to a settings file. [./settings.vset.json]")
	.action(App.createPublisher);
	
program
	.command("delete-publisher <publisher_name>")
	.description("Delete a publisher")
	.option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery. [https://app.market.visualstudio.com]")
	.option("-t, --token <token>", "Specify your personal access token.")
	.option("-s, --settings <settings_path>", "Specify the path to a settings file. [./settings.vset.json]")
	.action(App.deletePublisher);
	
program
	.command("share")
	.description("Share a private extension with other accounts.")
	.option("-w, --share-with <share_with>", "Comma-separated list of accounts to share the extension with.")
	.option("-p, --publisher <publisher>", "Specify the publisher of the extension to be shared.")
	.option("-e, --extension <extension_id>", "Specify the name of the extension to be shared.")
	.option("-v, --vsix <path_to_vsix>", "If specified, discovers the publisher & extension ID from the package.")
	.option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery. [https://app.market.visualstudio.com]")
	.option("-t, --token <token>", "Specify your personal access token.")
	.option("-s, --settings <settings_path>", "Specify the path to a settings file. [./settings.vset.json]")
	.action(App.shareExtension);
	
program
	.command("unshare")
	.description("Un-share a private extension with other accounts.")
	.option("-w, --unshare-with <unshare_with>", "Comma-separated list of accounts to un-share the extension with.")
	.option("-p, --publisher <publisher>", "Specify the publisher of the extension to be un-shared.")
	.option("-e, --extension <extension_id>", "Specify the name of the extension to be un-shared.")
	.option("-v, --vsix <path_to_vsix>", "If specified, discovers the publisher & extension ID from the package.")
	.option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery. [https://app.market.visualstudio.com]")
	.option("-t, --token <token>", "Specify your personal access token.")
	.option("-s, --settings <settings_path>", "Specify the path to a settings file. [./settings.vset.json]")
	.action(App.unshareExtension);
	
program
	.command("show")
	.description("Show information about an extension.")
	.option("-p, --publisher <publisher>", "Specify the publisher of the extension to be shared.")
	.option("-e, --extension <extension_id>", "Specify the name of the extension to be shared.")
	.option("-v, --vsix <path_to_vsix>", "If specified, discovers the publisher & extension ID from the package.")
	.option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery. [https://app.market.visualstudio.com]")
	.option("-t, --token <token>", "Specify your personal access token.")
	.option("-s, --settings <settings_path>", "Specify the path to a settings file. [./settings.vset.json]")
	.action(App.showExtension);
	
program
	.command("migrate <path_to_manifest> <publisher_name> [output_path]")
	.description("Convert a manifest to the new contribution model introduced in M85.")
	.option("-f, --force-overwrite", "Overwrite an existing file, or overwrite the original manifest when output_path is not specified.")
	.action(App.toM85);
	
program
	.command("genresources <generated_resjson_path>")
	.description("Generate a resjson file for an extension, which is used for string localization.")
	.option("-r, --root <root>", "Specify the root for files in your vsix package. [.]")
	.option("-m, --manifest-glob <glob>", "Specify the pattern for manifest files to join. [vss-extension.json]")
	.option("-s, --settings <settings_path>", "Specify the path to a settings file. [./settings.vset.json]")
	.option("-i, --override <overrides_JSON>", "Specify a JSON string to override anything in the manifests.")
	.action(App.genResources);

program.parse(process.argv);

let commandNames = program["commands"].map(c => c._name);
if (program["rawArgs"].length < 3 || commandNames.indexOf(program["rawArgs"][2]) === -1) {
	program.help();
}