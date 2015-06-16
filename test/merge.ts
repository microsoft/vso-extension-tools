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
				it("Should merge all found manifests into two JS objects", (done) => {
					withManifests((tmpPath) => {
						var merger = new package.Package.Merger(path.join(tmpPath, ".."));
						merger.merge().then((manifests) => {
							assert.equal(manifests.vsixManifest.PackageManifest.Assets[0].Asset.length, 2);
							assert.equal(manifests.vsixManifest.PackageManifest.Metadata[0].Identity[0].$.Id, "samples.point-guide");
							assert.equal(manifests.vsixManifest.PackageManifest.Metadata[0].Tags[0].length, 15);
							
							var contributionsKeys = Object.keys(manifests.vsoManifest.contributions);
							assert.equal(contributionsKeys.length, 19);
							assert.equal(contributionsKeys.indexOf("vss.code.web#sourceGridItemActions") >= 0, true);
							assert.equal(manifests.vsoManifest.contributions["vss.code.web#sourceGridItemActions"].length, 2);
							done();
						}).catch(console.error.bind(console));
					});
				});
			});
		});
		describe("VsixWriter", () => {
			describe("#writeVsix", () => {
				it("Should write the given manifests into a .vsix archive.", (done) => {
					withManifests((tmpPath) => {
						var merger = new package.Package.Merger(path.join(tmpPath, ".."));
						merger.merge().then((manifests) => {
							var vsixWriter = new package.Package.VsixWriter(manifests.vsoManifest, manifests.vsixManifest);
							vsixWriter.writeVsix(path.join(path.dirname(tmpPath), "ext.vsix")).then(() => {
								done();
							}).catch(console.error.bind(console));
						});
					});
				});
			});
		});
		describe("ManifestWriter", () => {
			describe("#writeManifests", () => {
				it("Should write the given manifest objects to files", (done) => {
					withManifests((tmpPath) => {
						var merger = new package.Package.Merger(path.join(tmpPath, ".."));
						merger.merge().then((manifests) => {
							var writer = new package.Package.ManifestWriter(manifests.vsoManifest, manifests.vsixManifest);
							var vsoStr = fs.createWriteStream(path.join(tmpPath, "vso.json"), {encoding: "utf-8"});
							var vsixStr = fs.createWriteStream(path.join(tmpPath, "vsix.xml"), {encoding: "utf-8"});
							writer.writeManifests(vsoStr, vsixStr).then(() => {
								done();
							});
						});
					});
				});
			});
		});		
	}
	
	function withManifests(action: (path: string) => void): void {
		tmp.dir({unsafeCleanup: false},(err, tmpPath, cleanupCallback) => {
			if (err) throw err;
			var tmpManifestsPath = path.join(tmpPath, "manifests");
			var srcManifestsPath = path.join(require("app-root-path").path, "test", "tmpl")
			fs.mkdirSync(tmpManifestsPath);
			fsx.copySync(srcManifestsPath, tmpManifestsPath);
			action(tmpManifestsPath);
		});
	}
}

MergeTests.runTests();



