/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import fs = require("fs");
import package = require("./package");
import path = require("path");
import program = require("commander");
import Q = require("q");
import tmp = require("tmp");

program
	.version("0.0.1")
	.usage("command [options]");

program
	.command("package [package_settings_path]")
	.description("Create a vsix package for an extension.")
	.option("-r, --root <root>", "Specify the root for files in your vsix package. [.]")
	.option("-m, --manifest-glob <glob>", "Specify the pattern for manifest files to join. [**/*-manifest.json]")
	.option("-o, --output-path <output>", "Specify the path and file name of the generated vsix. [..]")
	.action((settingsPath: string, options: any) => {
		var root = process.cwd();
		var globs = ["**/*-manifest.json"];
		var outPath = process.cwd();
		if (settingsPath) {
			var packageSettings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
			root = packageSettings.root;
			globs = _.isArray(packageSettings.manifestGlobs) ? packageSettings.manifestGlobs : [packageSettings.manifestGlobs];
			outPath = packageSettings.outputPath;
		}
		// Passed in options trump defaults & JSON configuration
		root = path.resolve(options.root || root);
		globs = (options.manifestGlob ? [options.manifestGlob] : globs).map(glob => path.join(root, glob));
		outPath = options.outputPath || outPath;
		
		// Replace {tmp} at beginning of outPath with a temporary directory path
		var outPathPromise: Q.Promise<string>;
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
			var merger = new package.Package.Merger(root, globs);
			merger.merge().then((manifests) => {
				var vsixWriter = new package.Package.VsixWriter(manifests.vsoManifest, manifests.vsixManifest);
				
				vsixWriter.writeVsix(outPath).then(() => {
					
				}).catch(console.error.bind(console));
			});
		});
	});
	
program
	.command("publish <publish_settings_path>")
	.description("Publish a VSIX package to your account.")
	.option("-s, --publish-settings", "Path to a publish settings file.");
	
program.parse(process.argv);
