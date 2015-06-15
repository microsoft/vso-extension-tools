/// <reference path="../typings/tsd.test.d.ts" />

import assert = require("assert");
import fs = require("fs");
import fsx = require("fs-extra");
import package = require("../src/scripts/package");
import path = require("path");
import Q = require("q");
import stream = require("stream");
import tmp = require("tmp");

module MergeTests {
	export function runTests() {
		describe("Merger", () => {
			describe("#merge", () => {
				it("should return a string[] of filenames", (done) => {
					withManifests((tmpPath) => {
						console.log("Temp path for test files: " + tmpPath);
						var merger = new package.Package.Merger(path.join(tmpPath, ".."));
						merger.merge().then((manifests) => {
							var writer = new package.Package.ManifestWriter(manifests.vsoManifest, manifests.vsixManifest);
							var vsoStr = fs.createWriteStream(path.join(tmpPath, "vso.json"), {encoding: "utf-8"});
							var vsixStr = fs.createWriteStream(path.join(tmpPath, "vsix.xml"), {encoding: "utf-8"});
							writer.writeManifests(vsoStr, vsixStr).then(() => {
								done();
							});
						});
						return Q.defer<void>().promise;
					});
				});
			});
		});	
	}
	
	function withManifests(action: (path: string) => Q.Promise<void>): void {
		tmp.dir({unsafeCleanup: false},(err, tmpPath, cleanupCallback) => {
			if (err) throw err;
			var tmpManifestsPath = path.join(tmpPath, "manifests");
			var srcManifestsPath = path.join(require("app-root-path").path, "test", "tmpl")
			fs.mkdirSync(tmpManifestsPath);
			fsx.copySync(srcManifestsPath, tmpManifestsPath);
			action(tmpManifestsPath).then(() => {
				// cleanupCallback();
			});			
		});
	}
}

MergeTests.runTests();