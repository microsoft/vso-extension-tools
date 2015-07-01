/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import chalk = require("chalk");
import fs = require("fs");
import glob = require("glob");
import path = require("path");
import Q = require("q");
import settings = require("./settings");
import stream = require("stream");
import tmp = require("tmp");
import xml = require("xml2js");
import zip = require("jszip");

export module Package {
	/**
	 * Combines the vsix and vso manifests into one object
	 */
	export interface SplitManifest {
		vsoManifest: any;
		vsixManifest: any;
	}
	
	/**
	 * Describes an asset in a manifest
	 */
	export interface AssetDeclaration {
		type: string;
		path: string;
	}
	
	/**
	 * Settings for doing the merging
	 */
	export interface MergeSettings {
		/**
		 * Root of source manifests
		 */
		root: string;
		
		/**
		 * List of globs for searching for partial manifests
		 */
		manifestGlobs: string[];
	}
	
	/**
	 * Facilitates the gathering/reading of partial manifests and creating the merged
	 * manifests (one vsoManifest and one vsixManifest)
	 */
	export class Merger {
		private static DEFAULT_MERGE_SETTINGS_FILE: string = "merge-settings.json";
		
		private mergeSettings: MergeSettings;
		
		/**
		 * constructor
		 * @param string Root path for locating candidate manifests
		 */
		constructor(settings: settings.PackageSettings) {
			this.mergeSettings = {
				root: settings.root,
				manifestGlobs: settings.manifestGlobs
			}
		}
		
		private gatherManifests(globPatterns: string[]): Q.Promise<string[]> {
			let globs = globPatterns.map(pattern => 
				path.isAbsolute(pattern) ? pattern : path.join(this.mergeSettings.root, pattern));
			return Q.all(globs.map(pattern => this.gatherManifestsFromGlob(pattern))).then((fileLists) => {
				return _.unique(fileLists.reduce((a, b) => { return a.concat(b); }));
			}).then((paths) => {
				if (paths.length > 0) {
					return paths;
				} else {
					throw "No manifests found from the following glob patterns: \n" + globPatterns.join("\n");
				}
			});
		}
		
		private gatherManifestsFromGlob(globPattern: string): Q.Promise<string[]> {
			return Q.Promise<string[]>((resolve, reject, notify) => {
				glob(globPattern, (err, matches) => {
					if (!err) {
						resolve(matches);
					} else {
						reject(err);
					}
				});
			});
		}
		
		/**
		 * Finds all manifests and merges them into two JS Objects: vsoManifest and vsixManifest
		 * @return Q.Promise<SplitManifest> An object containing the two manifests
		 */
		public merge(): Q.Promise<SplitManifest> {
			return this.gatherManifests(this.mergeSettings.manifestGlobs).then((files: string[]) => {
				let manifestPromises: Q.Promise<any>[] = [];
				files.forEach((file) => {
					manifestPromises.push(Q.nfcall<any>(fs.readFile, file, "utf8").then((data) => {
						try {
							let result = JSON.parse(data);
							result.__origin = file; // save the origin in order to resolve relative paths later.
							return result;	
						} catch (err) {
							console.log("Error parsing the JSON in " + file + ": ");
							console.log(data);
							throw err;
						}
					}));
				});
				let defaultVsixManifestPath = path.join(require("app-root-path").path, "src", "tmpl", "default_vsixmanifest.json"); 
				let vsixManifest: any = JSON.parse(fs.readFileSync(defaultVsixManifestPath, "utf8"));
				vsixManifest.__meta_root = this.mergeSettings.root;
				let vsoManifest: any = {
					__meta_root: this.mergeSettings.root,
					scopes: [],
					contributions: [],
					manifestVersion: 1.0
				};
				return Q.all(manifestPromises).then((partials: any[]) => {
					partials.forEach((partial) => {
						// Transform asset paths to be relative to the root of all manifests.
						if (_.isArray(partial["assets"])) {
							(<Array<AssetDeclaration>>partial["assets"]).forEach((asset) => {
								let keys = Object.keys(asset);
								if (keys.length !== 2 || keys.indexOf("type") < 0 || keys.indexOf("path") < 0) {
									throw "Assets must have a type and a path.";
								}
								if (path.isAbsolute(asset.path)) {
									throw "Paths in manifests must be relative.";
								}
								let absolutePath = path.join(path.dirname(partial.__origin), asset.path);
								asset.path = path.relative(this.mergeSettings.root, absolutePath);
							});
						}
						
						// Merge each key of each partial manifest into the joined manifests
						Object.keys(partial).forEach((key) => {
							this.mergeKey(key, partial[key], vsoManifest, vsixManifest);
						});
					});
					return <SplitManifest>{vsoManifest: vsoManifest, vsixManifest: vsixManifest};
				});
			});
		}
		
		private handleDelimitedList(value: any, object: any, path: string, delimiter: string = ",") {
			if (_.isString(value)) {
				value = value.split(delimiter);
				_.remove(value, v => v === "");
			}
			var items = _.get(object, path, "").split(delimiter);
			_.remove(items, v => v === "");
			_.set(object, path, _.uniq(items.concat(value)).join(delimiter));
		}
		
		private mergeKey(key: string, value: any, vsoManifest: any, vsixManifest: any) {
			switch(key.toLowerCase()) {
				case "namespace":
				case "extensionid":
					// Assert string value
					if (_.isString(value)) {
						vsixManifest.PackageManifest.Metadata[0].Identity[0].$.Id = value.replace(/\./g, "-");
					}
					break;
				case "version":
					// Assert string value
					vsoManifest.version = value;
					vsixManifest.PackageManifest.Metadata[0].Identity[0].$.Version = value;
					break;
				case "name":
					// Assert string value
					vsoManifest.name = value;
					vsixManifest.PackageManifest.Metadata[0].DisplayName[0] = value;
					break;
				case "description":
					// Assert string value
					vsoManifest.description = value;
					vsixManifest.PackageManifest.Metadata[0].Description[0]._ = value;
					break;
				case "versioncheckuri":
					vsoManifest.versionCheckUri = value;
					break;
				case "manifestversion":
					let version = value;
					if (_.isString(version)) {
						version = parseFloat(version);
					}
					if (!version) {
						version = 1;
					}
					vsoManifest.manifestVersion = version;
					break;
				case "public": 
					if (typeof value === "boolean") {
						let flags = _.get(vsixManifest, "PackageManifest.Metadata[0].VSOFlags[0]", "").split(",");
						_.remove(flags, v => v === "");
						if (value === true) {
							flags.push("Public");
						}
						_.set(vsixManifest, "PackageManifest.Metadata[0].VSOFlags[0]", _.uniq(flags).join(","));
						vsoManifest.__meta_public = value;
					}
					break;
				case "publisher":
					vsixManifest.PackageManifest.Metadata[0].Identity[0].$.Publisher = value;
					break;
				case "releasenotes":
					vsixManifest.PackageManifest.Metadata[0].ReleaseNotes = [value];
					break;
				case "scopes":
					if (_.isArray(value)) {
						vsoManifest.scopes = _.uniq(vsoManifest.scopes.concat(value));
					}
					break;
				case "tags":
					this.handleDelimitedList(value, vsixManifest, "PackageManifest.Metadata[0].Tags[0]");
					break;
				case "vsoflags":
					this.handleDelimitedList(value, vsixManifest, "PackageManifest.Metadata[0].VSOFlags[0]");
					break;
				case "categories":
					this.handleDelimitedList(value, vsixManifest, "PackageManifest.Metadata[0].Categories[0]");
					break;
				case "baseuri":
					// Assert string value
					vsoManifest.baseUri = value;
					break;
				case "contributions":
					if (_.isArray(value)) {
						vsoManifest.contributions = vsoManifest.contributions.concat(value);
					}
					break;
				case "contributiontypes":
					if (!vsoManifest.contributionTypes) {
						vsoManifest.contributionTypes = {};
					}
					_.merge(vsoManifest.contributionTypes, value);
					break;
				case "assets": // fix me
					if (_.isArray(value)) {
						vsixManifest.PackageManifest.Assets = [{"Asset": []}];
						value.forEach((asset: AssetDeclaration) => {
							vsixManifest.PackageManifest.Assets[0].Asset.push({
								"$": {
									"Type": asset.type,
									"d:Source": "File",
									"Path": asset.path.replace(/\\/g, "/")
								}
							});
						});
					}
					break;
			}
		}
	}
	
	/**
	 * Facilitates packaging the vsix and writing it to a file
	 */
	export class VsixWriter {
		private vsoManifest: any;
		private vsixManifest: any;
		
		private static VSO_MANIFEST_FILENAME: string = "extension.vsomanifest";
		private static VSIX_MANIFEST_FILENAME: string = "extension.vsixmanifest";
		private static CONTENT_TYPES_FILENAME: string = "[Content_Types].xml";
		
		/**
		 * List of known file types to use in the [Content_Types].xml file in the VSIX package.
		 */
		private static CONTENT_TYPE_MAP: {[key: string]: string} = {
			txt: "text/plain",
			pkgdef: "text/plain",
			xml: "text/xml",
			vsixmanifest: "text/xml",
			vsomanifest: "application/json",
			json: "application/json",
			htm: "text/html",
			html: "text/html",
			rtf: "application/rtf",
			pdf: "application/pdf",
			gif: "image/gif",
			jpg: "image/jpg",
			jpeg: "image/jpg",
			tiff: "image/tiff",
			vsix: "application/zip",
			zip: "application/zip",
			dll: "application/octet-stream"
		};
		
		/**
		 * constructor
		 * @param any vsoManifest JS Object representing a vso manifest
		 * @param any vsixManifest JS Object representing the XML for a vsix manifest
		 */
		constructor(vsoManifest: any, vsixManifest: any) {
			this.vsoManifest = vsoManifest;
			this.vsixManifest = vsixManifest;
			this.prepManifests();
		}
		
		private prepManifests() {
			// Remove any vso manifest assets, then add the correct entry.
			let assets = _.get<any[]>(this.vsixManifest, "PackageManifest.Assets[0].Asset");
			if (assets) {
				_.remove(assets, (asset) => {
					return _.get(asset, "$.Type", "x").toLowerCase() === "microsoft.vso.manifest";
				});
			} else {
				assets = [];
				_.set<any, any>(this.vsixManifest, "PackageManifest.Assets[0].Asset[0]", assets);
			}
			
			assets.push({$:{
				Type: "Microsoft.VSO.Manifest",
				Path: VsixWriter.VSO_MANIFEST_FILENAME
			}});
			
			console.log("Manifests finished prepping.");
		}
		
		/**
		 * Recursive mkdirSync
		 */
		private mkdirp(dirPath: string) {
			let exploded = dirPath.split(/[\/\\]/);
			if (exploded.length > 0) {
				let current = path.join();
				for (let i = 0; i < exploded.length; ++i) {
					current = path.join(current, exploded[i]);
					if (!fs.existsSync(current)) {
						fs.mkdirSync(current);
					}
				}
			}
		}
		
		private ensureDirExists(fullPath: string) {
			let dir = path.dirname(fullPath);
			this.mkdirp(dir);
		}
		
		/**
		 * If outPath is {auto}, generate an automatic file name.
		 * Otherwise, try to determine if outPath is a directory (checking for a . in the filename)
		 * If it is, generate an automatic filename in the given outpath
		 * Otherwise, outPath doesn't change.
		 */
		private getOutputPath(outPath: string): string {
			let newPath = outPath;
			let pub = _.get(this.vsixManifest, "PackageManifest.Metadata[0].Identity[0].$.Publisher");
			let ns = _.get(this.vsixManifest, "PackageManifest.Metadata[0].Identity[0].$.Id");
			let version = _.get(this.vsixManifest, "PackageManifest.Metadata[0].Identity[0].$.Version");
			let autoName = pub + "." + ns + "-" + version + ".vsix";
			
			if (outPath === "{auto}") {
				return path.resolve(autoName);
			} else {
				let basename = path.basename(outPath);
				if (basename.indexOf(".") > 0) { // conscious use of >
					return path.resolve(outPath);
				} else {
					return path.resolve(path.join(outPath, autoName));
				}
			}
		}
		
		/**
		 * Write a vsix package to the given file name
		 * @param stream.Writable Stream to write the vsix package
		 */
		public writeVsix(outPath: string): Q.Promise<any> {
			let outputPath = this.getOutputPath(outPath);
			let vsix = new zip();
			let root = this.vsoManifest.__meta_root;
			if (!root) {
				throw "Manifest root unknown. Manifest objects should have a __meta_root key specifying the absolute path to the root of assets.";
			}
			
			// Add assets to vsix archive
			let assets = <any[]>_.get(this.vsixManifest, "PackageManifest.Assets[0].Asset");
			if (_.isArray(assets)) {
				assets.forEach((asset) => {
					if (asset.$) {
						if (asset.$.Type === "Microsoft.VSO.Manifest") {
							return; // skip the vsomanifest, it is added later.
						}
						vsix.file((<string>asset.$.Path).replace(/\\/g, "/"), fs.readFileSync(path.join(root, asset.$.Path)));
					}
				});
			}
			
			// Write the manifests to a temporary path and add them to the zip
			return Q.Promise<string>((resolve, reject, notify) => {
				tmp.dir({unsafeCleanup: true}, (err, tmpPath, cleanupCallback) => {
					if (err) {
						reject(err);
					}
					resolve(tmpPath);
				});
			}).then((tmpPath) => {
				let manifestWriter = new ManifestWriter(this.vsoManifest, this.vsixManifest);
				let vsoPath = path.join(tmpPath, VsixWriter.VSO_MANIFEST_FILENAME);
				let vsixPath = path.join(tmpPath, VsixWriter.VSIX_MANIFEST_FILENAME);
				let vsoStr = fs.createWriteStream(vsoPath);
				let vsixStr = fs.createWriteStream(vsixPath);
				return manifestWriter.writeManifests(vsoStr, vsixStr).then(() => {
					vsix.file(VsixWriter.VSO_MANIFEST_FILENAME, fs.readFileSync(vsoPath, "utf-8"));
					vsix.file(VsixWriter.VSIX_MANIFEST_FILENAME, fs.readFileSync(vsixPath, "utf-8"));
				});
			}).then(() => {
				vsix.file(VsixWriter.CONTENT_TYPES_FILENAME, this.genContentTypesXml(Object.keys(vsix.files)));
				let buffer = vsix.generate({
					type: "nodebuffer",
					compression: "DEFLATE",
					compressionOptions: { level: 9 },
					platform: process.platform
				});
				console.log("Writing vsix to: " + outputPath);
				this.ensureDirExists(outputPath);
				return Q.nfcall(fs.writeFile, outputPath, buffer);
			});
				
		}
		
		/**
		 * Generates the required [Content_Types].xml file for the vsix package.
		 * This xml contains a <Default> entry for each different file extension
		 * found in the package, mapping it to the appropriate MIME type.
		 */
		private genContentTypesXml(fileNames: string[]): string {
			let contentTypes: any = {
				Types: {
					$: {
						xmlns: "http://schemas.openxmlformats.org/package/2006/content-types"
					},
					Default: []
				}
			};
			let uniqueExtensions = _.unique<string>(fileNames.map(f => _.trimLeft(path.extname(f))));
			uniqueExtensions.forEach((ext) => {
				let type = VsixWriter.CONTENT_TYPE_MAP[ext];
				if (!type) {
					type = "application/octet-stream";
				}
				contentTypes.Types.Default.push({
					$: {
						Extension: ext,
						ContentType: type
					}
				});
			});
			let builder = new xml.Builder({
				indent: "    ",
				newline: require("os").EOL,
				pretty: true,
				xmldec: {
					encoding: "utf-8",
					standalone: null,
					version: "1.0"
				}
			});
			return builder.buildObject(contentTypes);
		}
	}
	
	/**
	 * Class to help writing the vso manifest and vsix manifest
	 */
	export class ManifestWriter {
		private vsoManifest: any;
		private vsixManifest: any;
		
		/**
		 * constructor
		 * @param any vsoManifest JS Object representing a vso manifest
		 * @param any vsixManifest JS Object representing the XML for a vsix manifest
		 */
		constructor(vsoManifest: any, vsixManifest: any) {
			this.vsoManifest = this.removeMetaKeys(vsoManifest);
			this.vsixManifest = this.removeMetaKeys(vsixManifest);
		}
		
		private removeMetaKeys(obj: any): any {
			return _.omit(obj, (v, k) => {
				return _.startsWith(k, "__meta_");
			});
		}
		
		/**
		 * Writes the vso manifest and vsix manifest to given streams and ends the streams.
		 * @param stream.Writable Stream to write the vso manifest (json)
		 * @param stream.Writable Stream to write the vsix manifest (xml)
		 * @return Q.Promise<any> A promise that is resolved when the streams have been written/ended
		 */
		public writeManifests(vsoStream: stream.Writable, vsixStream: stream.Writable): Q.Promise<any> {
			let eol = require("os").EOL;
			let vsoPromise = Q.ninvoke<any>(vsoStream, "write", JSON.stringify(this.vsoManifest, null, 4).replace(/\n/g, eol), "utf8");
			vsoPromise = vsoPromise.then(() => {
				vsoStream.end();
			});
			
			let builder = new xml.Builder({
				indent: "    ",
				newline: eol,
				pretty: true,
				xmldec: {
					encoding: "utf-8",
					standalone: null,
					version: "1.0"
				}
			});
			let vsix = builder.buildObject(this.vsixManifest);
			let vsixPromise = Q.ninvoke<any>(vsixStream, "write", vsix, "utf8");
			vsixPromise = vsixPromise.then(() => {
				vsixStream.end();
			});
			
			return Q.all([vsoPromise, vsixPromise]);
		}
	}
}