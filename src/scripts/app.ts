/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import fs = require("fs");
import package = require("./package");
import path = require("path");
import program = require("commander");
import publish = require("./publish");
import Q = require("q");
import tmp = require("tmp");

module App {
	function getOptions(settingsPath: string, options: any, defaults: {[key: string]: any} = {}): {[key: string]: any} {
		if (settingsPath) {
			let settingsJson = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
			Object.keys(settingsJson).forEach((key) => {
				defaults[key] = settingsJson[key];
			});
		}
		Object.keys(defaults).forEach((key) => {
			if (options[key]) {
				defaults[key] = options[key];
			}
		});
		return defaults;
	}
	
	export function createPackage(settingsPath: string, options: any): Q.Promise<string> {
		let processedOptions = getOptions(settingsPath, options, {
			root: process.cwd(),
			manifestGlobs: ["**/*-manifest.json"],
			outputPath: process.cwd() 
		});
		
		if (options.manifestGlob) {
			processedOptions["manifestGlobs"] = options.manifestGlob;
		}
		if (typeof processedOptions["manifestGlobs"] === "string") {
			processedOptions["manifestGlobs"] = [processedOptions["manifestGlobs"]]; 
		}
		processedOptions["root"] = path.resolve(processedOptions["root"]);
		processedOptions["manifestGlobs"] = processedOptions["manifestGlobs"].map(g => path.join(processedOptions["root"], g));
		
		console.log("Creating a package with these options: \n" + JSON.stringify(processedOptions, null, 4));
		
		// Replace {tmp} at beginning of outPath with a temporary directory path
		let outPathPromise: Q.Promise<string>;
		if (processedOptions["outputPath"].indexOf("{tmp}") === 0) {
			outPathPromise = Q.Promise<string>((resolve, reject, notify) => {
				tmp.dir({unsafeCleanup: true}, (err, tmpPath, cleanupCallback) => {
					if (err) {
						reject(err);
					}
					resolve(processedOptions["outPath"].replace("{tmp}", tmpPath));
				});
			})
		} else {
			outPathPromise = Q.resolve<string>(processedOptions["outputPath"]);
		}
		return outPathPromise.then((outPath) => {
			let merger = new package.Package.Merger(processedOptions["root"], processedOptions["manifestGlobs"]);
			console.log("Beginning merge of partial manifests.");
			return merger.merge().then((manifests) => {
				console.log("Merge completed.");
				let vsixWriter = new package.Package.VsixWriter(manifests.vsoManifest, manifests.vsixManifest);
				console.log("Beginning writing VSIX");
				return vsixWriter.writeVsix(outPath).then(() => {
					console.log("VSIX written to: " + outPath);
					return outPath;
				}).catch<string>(console.error.bind(console));
			}).catch<string>(console.error.bind(console));
		}).catch<string>(console.error.bind(console));
	}
	
	function doPublish(vsixPath: string, publishSettingsPath: string, options: any): Q.Promise<any> {
		let publishOptions = getOptions(publishSettingsPath, options);
		if (!publishOptions["token"] || !publishOptions["galleryUrl"]) {
			throw "Could not find gallery URL or personal access token!";
		}
		
		let publisher = new publish.Publish.PackagePublisher(publishOptions["galleryUrl"], publishOptions["token"]);
		return publisher.publish(vsixPath);
	}
	
	export function publishVsix(publishSettingsPath: string, packageSettingsPath: string, options: any): Q.Promise<any> {
		return Q.Promise<string>((resolve, reject, notify) => {
			if (options.vsix) {
				console.log("VSIX was manually specified. Skipping generation.");
				resolve(options.vsix);
			} else {
				console.log("Generating VSIX from settings at: " + path.resolve(packageSettingsPath));
				resolve(createPackage(packageSettingsPath, options));
			}
		}).then((vsixPath) => {
			console.log("VSIX to publish is located at: " + vsixPath);
			return doPublish(vsixPath, publishSettingsPath, options);
		}).then(() => {
			console.log("Done!");
		}).catch((error) => {
			console.error("Error: " + error);
		});
	}
}

var version = process.version;
if (parseInt(version.split(".")[1], 10) < 12) {
	console.log("Please upgrade to NodeJS v0.12.x or higher");
	process.exit(-1);
}

program
	.version("0.0.1")
	.usage("command [options]");

program
	.command("package [package_settings_path]")
	.description("Create a vsix package for an extension.")
	.option("-r, --root <root>", "Specify the root for files in your vsix package. [.]")
	.option("-m, --manifest-glob <glob>", "Specify the pattern for manifest files to join. [**/*-manifest.json]")
	.option("-o, --output-path <output>", "Specify the path and file name of the generated vsix. [..]")
	.action(App.createPackage);
	
program
	.command("publish <publish_settings_path> [package_settings_path]")
	.description("Publish a VSIX package to your account. Generates the VSIX using [package_settings_path] unless --vsix is specified.")
	.option("-v, --vsix <path_to_vsix>", "If specified, publishes this VSIX package instead of auto-packaging.")
	.option("-r, --root <root>", "Specify the root for files in your vsix package. [.]")
	.option("-m, --manifest-glob <glob>", "Specify the pattern for manifest files to join. [**/*-manifest.json]")
	.option("-o, --output-path <output>", "Specify the path and file name of the generated vsix. [..]")
	.action(App.publishVsix);

program.parse(process.argv);
