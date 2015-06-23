/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import fs = require("fs");
import logger = require("tracer");
import package = require("./package");
import program = require("commander");
import publish = require("./publish");
import Q = require("q");
import settings = require("./settings");

let log = logger.console();

module App {
	
	function doPackageCreate(settings: settings.PackageSettings): Q.Promise<any> {
		console.log("Creating a package with these options: \n" + JSON.stringify(settings, null, 4));
		let merger = new package.Package.Merger(settings);
		console.log("Beginning merge of partial manifests.");
		return merger.merge().then((manifests) => {
			console.log("Merge completed.");
			let vsixWriter = new package.Package.VsixWriter(manifests.vsoManifest, manifests.vsixManifest);
			console.log("Beginning writing VSIX");
			return vsixWriter.writeVsix(settings.outputPath).then(() => {
				console.log("VSIX written to: " + settings.outputPath);
			});
		}).catch<any>(console.error.bind(console));
	}
	
	function doPublish(settings: settings.PublishSettings): Q.Promise<any> {
		let publisher = new publish.Publish.PackagePublisher(settings);
		return publisher.publish(settings.vsixPath);
	}
	
	export function publishVsix(options: settings.CommandLineOptions): Q.Promise<any> {
		console.log("Begin");
		return settings.resolveSettings(options).then((settings) => {
			console.log("Settings resolved... " + JSON.stringify(settings, null, 4));
			return Q.Promise<any>((resolve, reject, notify) => {
				if (settings.package) {
					console.log("VSIX was manually specified. Skipping generation.");
					resolve(null);
				} else {
					resolve(doPackageCreate(settings.package));
				}
			}).then(() => {
				console.log("VSIX to publish is located at: " + settings.package.outputPath);
				return doPublish(settings.publish);
			}).then(() => {
				console.log("Done!");
			}).catch((error) => {
				let errStr = _.isString(error) ? error : JSON.stringify(error, null, 4);
				console.error("Error: " + errStr);
			});
		}).catch(console.error.bind(console));
	}
	
	export function createPackage(options: settings.CommandLineOptions): Q.Promise<any> {
		return settings.resolveSettings(options, {
			package: {
				root: process.cwd(),
				manifestGlobs: ["**/*-manifest.json"],
				outputPath: process.cwd()
			}
		}).then(doPackageCreate);
	}
	
	export function createPublisher(name: string, displayName: string, description: string, options: settings.CommandLineOptions): Q.Promise<any> {
		return settings.resolveSettings(options).then((options) => {
			let pubManager = new publish.Publish.PublisherManager(options.publish);
			return pubManager.createPublisher(name, displayName, description).catch(console.error.bind(console));
		})
	}
	
	export function deletePublisher(publisherName: string, options: settings.CommandLineOptions): Q.Promise<any> {
		return settings.resolveSettings(options).then((options) => {
			let pubManager = new publish.Publish.PublisherManager(options.publish);
			return pubManager.deletePublisher(publisherName).catch(console.error.bind(console));
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
	.command("package [settings_path]")
	.description("Create a vsix package for an extension.")
	.option("-r, --root <root>", "Specify the root for files in your vsix package. [.]")
	.option("-m, --manifest-glob <glob>", "Specify the pattern for manifest files to join. [**/*-manifest.json]")
	.option("-o, --output-path <output>", "Specify the path and file name of the generated vsix. [..]")
	.action(App.createPackage);
	
program
	.command("publish [settings_path]")
	.description("Publish a VSIX package to your account. Generates the VSIX using [package_settings_path] unless --vsix is specified.")
	.option("-v, --vsix <path_to_vsix>", "If specified, publishes this VSIX package instead of auto-packaging.")
	.option("-r, --root <root>", "Specify the root for files in your vsix package. [.]")
	.option("-m, --manifest-glob <manifest-glob>", "Specify the pattern for manifest files to join. [**/*-manifest.json]")
	.option("-o, --output-path <output>", "Specify the path and file name of the generated vsix. [..]")
	.option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery.")
	.option("-t, --token <token>", "Specify your personal access token.")
	.action(App.publishVsix);
	
program
	.command("create-publisher <name> <display_name> <description> [settings_path]")
	.description("Create a publisher")
	.option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery.")
	.option("-t, --token <token>", "Specify your personal access token.")
	.action(App.createPublisher);
	
program
	.command("delete-publisher <publisher_name> [settings_path]")
	.description("Delete a publisher")
	.option("-g, --gallery-url <gallery_url>", "Specify the URL to the gallery.")
	.option("-t, --token <token>", "Specify your personal access token.")
	.action(App.deletePublisher);

program.parse(process.argv);
