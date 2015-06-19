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
	export function createPackage(settingsPath: string, options: any) {
		let root = process.cwd();
		let globs = ["**/*-manifest.json"];
		let outPath = process.cwd();
		if (settingsPath) {
			let packageSettings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
			root = packageSettings.root;
			globs = _.isArray(packageSettings.manifestGlobs) ? packageSettings.manifestGlobs : [packageSettings.manifestGlobs];
			outPath = packageSettings.outputPath;
		}
		// Passed in options trump defaults & JSON configuration
		root = path.resolve(options.root || root);
		globs = (options.manifestGlob ? [options.manifestGlob] : globs).map(glob => path.join(root, glob));
		outPath = options.outputPath || outPath;
		
		// Replace {tmp} at beginning of outPath with a temporary directory path
		let outPathPromise: Q.Promise<string>;
		if (outPath.indexOf("{tmp}") === 0) {
			outPathPromise = Q.Promise<string>((resolve, reject, notify) => {
				tmp.dir({unsafeCleanup: true}, (err, tmpPath, cleanupCallback) => {
					if (err) {
						reject(err);
					}
					resolve(outPath.replace("{tmp}", tmpPath));
				});
			})
		} else {
			outPathPromise = Q.resolve<string>(outPath);
		}
		outPathPromise.then((outPath) => {		
			let merger = new package.Package.Merger(root, globs);
			merger.merge().then((manifests) => {
				let vsixWriter = new package.Package.VsixWriter(manifests.vsoManifest, manifests.vsixManifest);
				
				vsixWriter.writeVsix(outPath).then(() => {
					
				}).catch(console.error.bind(console));
			});
		});
	}
	
	export function publish(publishSettingsPath: string, packageSettingsPath: string, options: any) {
		
	}
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
	.action(App.publish);
	
program.parse(process.argv);
