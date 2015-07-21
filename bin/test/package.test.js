/// <reference path="../typings/tsd.test.d.ts" />
var assert = require("assert");
var fs = require("fs");
var fsx = require("fs-extra");
var package = require("../src/scripts/package");
var path = require("path");
var tmp = require("tmp");
var PackageTests;
(function (PackageTests) {
    function runTests() {
        describe("Merger", function () {
            describe("#merge", function () {
                it("Should merge all found manifests into two JS objects", function (done) {
                    withManifests(function (tmpPath) {
                        var merger = new package.Package.Merger({ root: path.join(tmpPath, ".."), manifestGlobs: ["manifests/**/*.json"] });
                        merger.merge().then(function (manifests) {
                            assert.equal(manifests.vsixManifest.PackageManifest.Assets[0].Asset.length, 2);
                            assert.equal(manifests.vsixManifest.PackageManifest.Metadata[0].Identity[0].$.Id, "samples-point-guide");
                            assert.equal(manifests.vsixManifest.PackageManifest.Metadata[0].Tags[0].length, 15);
                            var contributions = manifests.vsoManifest.contributions;
                            console.log(contributions);
                            assert.equal(contributions.length, 19);
                            done();
                        }).catch(console.error.bind(console));
                    });
                });
            });
        });
        describe("VsixWriter", function () {
            describe("#writeVsix", function () {
                it("Should write the given manifests into a .vsix archive.", function (done) {
                    withManifests(function (tmpPath) {
                        var merger = new package.Package.Merger({ root: path.join(tmpPath, ".."), manifestGlobs: ["manifests/**/*.json"] });
                        merger.merge().then(function (manifests) {
                            var vsixWriter = new package.Package.VsixWriter(manifests.vsoManifest, manifests.vsixManifest, manifests.files);
                            vsixWriter.writeVsix(path.join(path.dirname(tmpPath), "ext.vsix")).then(function () {
                                done();
                            }).catch(console.error.bind(console));
                        });
                    });
                });
            });
        });
        describe("ManifestWriter", function () {
            describe("#writeManifests", function () {
                it("Should write the given manifest objects to files", function (done) {
                    withManifests(function (tmpPath) {
                        var merger = new package.Package.Merger({ root: path.join(tmpPath, ".."), manifestGlobs: ["manifests/**/*.json"] });
                        merger.merge().then(function (manifests) {
                            var writer = new package.Package.ManifestWriter(manifests.vsoManifest, manifests.vsixManifest);
                            var vsoStr = fs.createWriteStream(path.join(tmpPath, "vso.json"), { encoding: "utf-8" });
                            var vsixStr = fs.createWriteStream(path.join(tmpPath, "vsix.xml"), { encoding: "utf-8" });
                            writer.writeManifests(vsoStr, vsixStr).then(function () {
                                done();
                            });
                        });
                    });
                });
            });
        });
    }
    PackageTests.runTests = runTests;
    function withManifests(action) {
        tmp.dir({ unsafeCleanup: false }, function (err, tmpPath, cleanupCallback) {
            if (err)
                throw err;
            var tmpManifestsPath = path.join(tmpPath, "manifests");
            var srcManifestsPath = path.join(require("app-root-path").path, "test", "tmpl");
            fs.mkdirSync(tmpManifestsPath);
            fsx.copySync(srcManifestsPath, tmpManifestsPath);
            action(tmpManifestsPath);
        });
    }
})(PackageTests || (PackageTests = {}));
PackageTests.runTests();
