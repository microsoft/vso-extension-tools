/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import fs = require("fs");
import logger = require("tracer");
import package = require("./package");
import path = require("path");
import program = require("commander");
import publish = require("./publish");
import Q = require("q");
import settings = require("./settings");
import upgrade = require("./upgrade");

let log = logger.console();

module App {
	let defaultSettings = {
		package: {
			root: process.cwd(),
			manifestGlobs: ["**/*-manifest.json"],
			outputPath: "{auto}",
			publisher: null
		}
	};
	
	function doPackageCreate(settings: settings.PackageSettings): Q.Promise<string> {
		let merger = new package.Package.Merger(settings);
		console.log("Beginning merge of partial manifests.");
		return merger.merge().then((manifests) => {
			console.log("Merge completed.");
			let vsixWriter = new package.Package.VsixWriter(manifests.vsoManifest, manifests.vsixManifest);
			console.log("Beginning writing VSIX");
			return vsixWriter.writeVsix(settings.outputPath).then((outPath: string) => {
				console.log("VSIX written to: " + outPath);
				return outPath;
			});
		}).then((outPath) => {
			console.log("Successfully created VSIX package.");
			return outPath;
		});
	}
	
	function doPublish(settings: settings.PublishSettings): Q.Promise<any> {
		let publisher = new publish.Publish.PackagePublisher(settings);
		return publisher.publish(settings.vsixPath);
	}
	
	export function publishVsix(options: settings.CommandLineOptions): Q.Promise<any> {
		return settings.resolveSettings(options, defaultSettings).then((settings) => {
			return Q.Promise<string>((resolve, reject, notify) => {
				if (!settings.package) {
					console.log("VSIX was manually specified. Skipping generation.");
					resolve(settings.publish.vsixPath);
				} else {
					resolve(doPackageCreate(settings.package));
				}
			}).then((vsixPath) => {
				settings.publish.vsixPath = vsixPath;
				return doPublish(settings.publish);
			}).then(() => {
				console.log("Successfully published VSIX from " + settings.publish.vsixPath + " to the gallery.");
			}).catch((error) => {
				let errStr = _.isString(error) ? error : JSON.stringify(error, null, 4);
				console.error("Error: " + errStr);
			}).then(() => {
				process.exit(0);
			});
		}).catch((err) => {
			console.error(err);
			process.exit(-1);
		});
	}
	
	export function createPackage(options: settings.CommandLineOptions): Q.Promise<any> {
		return settings.resolveSettings(options, defaultSettings).then((settings) => {
			return doPackageCreate(settings.package).then(() => {
				process.exit(0);
			});
		}).catch((err) => {
			console.error(err);
			process.exit(-1);
		});
	}
	
	export function createPublisher(name: string, displayName: string, description: string, options: settings.CommandLineOptions): Q.Promise<any> {
		return settings.resolveSettings(options, defaultSettings).then((options) => {
			let pubManager = new publish.Publish.PublisherManager(options.publish);
			return pubManager.createPublisher(name, displayName, description).catch(console.error.bind(console));
		}).then(() => {
			console.log("Successfully created publisher `" + name + "`.");
			process.exit(0);
		}).catch((err) => {
			console.error(err);
			process.exit(-1);
		});
	}
	
	export function deletePublisher(publisherName: string, options: settings.CommandLineOptions): Q.Promise<any> {
		return settings.resolveSettings(options, defaultSettings).then((options) => {
			let pubManager = new publish.Publish.PublisherManager(options.publish);
			return pubManager.deletePublisher(publisherName).catch(console.error.bind(console));
		}).then(() => {
			console.log("Successfully deleted publisher `" + publisherName + "`.");
			process.exit(0);
		}).catch((err) => {
			console.error(err);
			process.exit(-1);
		});
	}
	
	export function toM85(pathToManifest: string, publisherName: string, outputPath: string, options: settings.CommandLineOptions): Q.Promise<any> {
		let outPath = outputPath;
		if (!outputPath) {
			outPath = pathToManifest;
		}
		if (fs.existsSync(outPath) && !options.forceOverwrite) {
			throw "File " + outPath + " already exists. Specify the -f to force overwriting this file.";
		}
		if (!publisherName) {
			throw "Publisher name not specified.";
		}
		let upgrader = new upgrade.ToM85(pathToManifest, publisherName);
		return upgrader.execute(outPath).then(() => {
			console.log("Successfully upgraded manifest to M85. Result written to " + outPath + ".");
			process.exit(0);
		}).catch((err) => {
			console.error(err);
			process.exit(-1);
		});
	}
}

let version = process.version;
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

let commandNames = program["commands"].map(c => c._name);
if (program["rawArgs"].length < 3 || commandNames.indexOf(program["rawArgs"][2]) === -1) {
	program.outputHelp();
}