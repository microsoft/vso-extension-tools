/// <reference path="../typings/tsd.test.d.ts" />

import assert = require("assert");
import fs = require("fs");
import fsx = require("fs-extra");
import package = require("../src/scripts/package");
import path = require("path");
import Q = require("q");
import tmp = require("tmp");

module MergeTests {
	export function runTests() {
		describe("Merger", () => {
			describe("#merge", () => {
				it("should return a string[] of filenames", (done) => {
					withManifests((path) => {
						var merger = new package.Package.Merger(path);
						done();						
						return Q.defer<void>().promise;
					});
				});
			});
		});	
	}
	
	function withManifests(action: (path: string) => Q.Promise<void>): void {
		tmp.dir({unsafeCleanup: true},(err, tmpPath, cleanupCallback) => {
			if (err) throw err;
			var tmpManifestsPath = path.join(tmpPath, "manifests");
			var srcManifestsPath = getSrcManifestsPath();
			fs.mkdirSync(tmpManifestsPath);
			fsx.copySync(srcManifestsPath, tmpManifestsPath);
			action(tmpManifestsPath).then(() => {
				cleanupCallback();
			});			
		});
	}
	
	function getSrcManifestsPath(): string {
		var currentPath = __dirname;
		while (currentPath.substr(currentPath.lastIndexOf(path.sep)) !== path.sep + "public") {
			currentPath = path.join(currentPath, "..");
			if (currentPath === path.join(currentPath, "..")) {
				throw "Did not find the public directory.";
			}
		}
		return path.join(currentPath, "..", "test", "tmpl");
	}
}

MergeTests.runTests();