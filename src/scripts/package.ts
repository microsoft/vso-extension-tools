/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import chalk = require("chalk");
import defaultManifest = require("./default-manifest");
import childProcess = require("child_process");
import fs = require("fs");
import glob = require("glob");
import log = require("./logger");
import path = require("path");
import Q = require("q");
import settings = require("./settings");
import stream = require("stream");
import util = require("util");
import tmp = require("tmp");
import winreg = require("winreg");
import xml = require("xml2js");
import zip = require("jszip");

export module Package {
	/**
	 * Combines the vsix and vso manifests into one object
	 */
	export interface VsixComponents {
		vsoManifest: any;
		vsixManifest: any;
		files: PackageFiles;
	}
	
	/**
	 * List of files in the package, mapped to null, or, if it can't be properly auto-
	 * detected, a content type.
	 */
	export interface PackageFiles {
		[path: string]: string;
	}
	
	/**
	 * Describes a file in a manifest
	 */
	export interface FileDeclaration {
		assetType?: string;
		contentType?: string;
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
		
		/**
		 * Highest priority partial manifest
		 */
		overrides: any;
	}
	
	/**
	 * Facilitates the gathering/reading of partial manifests and creating the merged
	 * manifests (one vsoManifest and one vsixManifest)
	 */
	export class Merger {
		private mergeSettings: MergeSettings;
		
		/**
		 * constructor
		 * @param string Root path for locating candidate manifests
		 */
		constructor(settings: settings.PackageSettings) {
			this.mergeSettings = {
				root: settings.root,
				manifestGlobs: settings.manifestGlobs,
				overrides: settings.overrides
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
		public merge(): Q.Promise<VsixComponents> {
			return this.gatherManifests(this.mergeSettings.manifestGlobs).then((files: string[]) => {
				let manifestPromises: Q.Promise<any>[] = [];
				files.forEach((file) => {
					manifestPromises.push(Q.nfcall<any>(fs.readFile, file, "utf8").then((data) => {
						let jsonData = data.replace(/^\uFEFF/, '');
						try {
							let result = JSON.parse(jsonData);
							result.__origin = file; // save the origin in order to resolve relative paths later.
							return result;	
						} catch (err) {
							log.error("Error parsing the JSON in %s: ", file);
							log.info(jsonData, null);
							throw err;
						}
					}));
					
					// Add the overrides if necessary
					if (this.mergeSettings.overrides) {
						manifestPromises.push(Q.resolve(this.mergeSettings.overrides));
					}
				});
				// Deep-copy of the default manifest.
				let vsixManifest: any = JSON.parse(JSON.stringify(defaultManifest.defaultManifest));
				vsixManifest.__meta_root = this.mergeSettings.root;
				let vsoManifest: any = {
					__meta_root: this.mergeSettings.root,
					scopes: [],
					contributions: [],
					manifestVersion: 1.0
				};
				let packageFiles: PackageFiles = {};
				return Q.all(manifestPromises).then((partials: any[]) => {
					partials.forEach((partial) => {
						// Transform asset paths to be relative to the root of all manifests, verify assets
						if (_.isArray(partial["files"])) {
							(<Array<FileDeclaration>>partial["files"]).forEach((asset) => {
								let keys = Object.keys(asset);
								if (keys.indexOf("path") < 0) {
									throw "Files must have an absolute or relative (to the manifest) path.";
								}
								let absolutePath;
								if (path.isAbsolute(asset.path)) {
									absolutePath = asset.path;
								} else {
									absolutePath = path.join(path.dirname(partial.__origin), asset.path);
								}
								asset.path = path.relative(this.mergeSettings.root, absolutePath);
							});
						}
						// Transform icon paths as above
						if (_.isObject(partial["icons"])) {
							let icons = partial["icons"];
							Object.keys(icons).forEach((iconKind: string) => {
								let absolutePath = path.join(path.dirname(partial.__origin), icons[iconKind]);
								icons[iconKind] = path.relative(this.mergeSettings.root, absolutePath);
							});
						}
						
						// Merge each key of each partial manifest into the joined manifests
						Object.keys(partial).forEach((key) => {
							this.mergeKey(key, partial[key], vsoManifest, vsixManifest, packageFiles);
						});
					});
					return <VsixComponents>{vsoManifest: vsoManifest, vsixManifest: vsixManifest, files: packageFiles};
				});
			});
		}
		
		private handleDelimitedList(value: any, object: any, path: string, delimiter: string = ","): void {
			if (_.isString(value)) {
				value = value.split(delimiter);
				_.remove(value, v => v === "");
			}
			var items = _.get(object, path, "").split(delimiter);
			_.remove(items, v => v === "");
			_.set(object, path, _.uniq(items.concat(value)).join(delimiter));
		}
		
		private mergeKey(key: string, value: any, vsoManifest: any, vsixManifest: any, packageFiles: PackageFiles): void {
			switch(key.toLowerCase()) {
				case "namespace":
				case "extensionid":
				case "id":
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
				case "icons":
					if (_.isString(value["default"])) {
						let assets = _.get<any>(vsixManifest, "PackageManifest.Assets[0].Asset");
						let iconPath = value["default"].replace(/\\/g, "/");
						assets.push({
							"$": {
								"Type": "Microsoft.VisualStudio.Services.Icons.Default",
								"d:Source": "File",
								"Path": iconPath
							}
						});
						
						// Default icon is also the package icon
						vsixManifest.PackageManifest.Metadata[0].Icon = [iconPath];
					}
					if (_.isString(value["wide"])) {
						let assets = _.get<any>(vsixManifest, "PackageManifest.Assets[0].Asset");
						assets.push({
							"$": {
								"Type": "Microsoft.VisualStudio.Services.Icons.Wide",
								"d:Source": "File",
								"Path": value["wide"].replace(/\\/g, "/")
							}
						});
					}
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
						let flags = _.get(vsixManifest, "PackageManifest.Metadata[0].GalleryFlags[0]", "").split(",");
						_.remove(flags, v => v === "");
						if (value === true) {
							flags.push("Public");
						}
						_.set(vsixManifest, "PackageManifest.Metadata[0].GalleryFlags[0]", _.uniq(flags).join(","));
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
				case "galleryflags":
					this.handleDelimitedList(value, vsixManifest, "PackageManifest.Metadata[0].GalleryFlags[0]");
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
					if (_.isArray(value)) {
						if (!vsoManifest.contributionTypes) {
							vsoManifest.contributionTypes = [];
						}
						vsoManifest.contributionTypes = vsoManifest.contributionTypes.concat(value);
					}
					break;
				case "files": 
					if (_.isArray(value)) {
						value.forEach((asset: FileDeclaration) => {
							let assetPath = asset.path.replace(/\\/g, "/");
							if (asset.assetType) {
								vsixManifest.PackageManifest.Assets[0].Asset.push({
									"$": {
										"Type": asset.assetType,
										"d:Source": "File",
										"Path": assetPath
									}
								});
							}
							if (asset.contentType) {
								packageFiles[assetPath] = asset.contentType;
							} else {
								packageFiles[assetPath] = null;
							}
							if (asset.assetType === "Microsoft.VisualStudio.Services.Icons.Default") {
								vsixManifest.PackageManifest.Metadata[0].Icon = [assetPath];
							}
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
		private files: PackageFiles;
		
		private static VSO_MANIFEST_FILENAME: string = "extension.vsomanifest";
		private static VSIX_MANIFEST_FILENAME: string = "extension.vsixmanifest";
		private static CONTENT_TYPES_FILENAME: string = "[Content_Types].xml";
		
		/**
		 * List of known file types to use in the [Content_Types].xml file in the VSIX package.
		 */
		private static CONTENT_TYPE_MAP: {[key: string]: string} = {
			".md": "text/markdown",
			".pdf": "application/pdf",
			".bat": "application/bat",
			".vsomanifest": "application/json",
			".vsixmanifest": "text/xml"
		};
		
		/**
		 * constructor
		 * @param any vsoManifest JS Object representing a vso manifest
		 * @param any vsixManifest JS Object representing the XML for a vsix manifest
		 */
		constructor(vsoManifest: any, vsixManifest: any, files: PackageFiles) {
			this.vsoManifest = vsoManifest;
			this.vsixManifest = vsixManifest;
			this.files = files;
			this.prepManifests();
		}
		
		private prepManifests() {
			// Remove any vso manifest assets, then add the correct entry.
			let assets = _.get<any[]>(this.vsixManifest, "PackageManifest.Assets[0].Asset");
			if (assets) {
				_.remove(assets, (asset) => {
					let type = _.get(asset, "$.Type", "x").toLowerCase();
					return type === "microsoft.vso.manifest" || type === "microsoft.visualstudio.services.manifest";
				});
			} else {
				assets = [];
				_.set<any, any>(this.vsixManifest, "PackageManifest.Assets[0].Asset[0]", assets);
			}
			
			assets.push({$:{
				Type: "Microsoft.VisualStudio.Services.Manifest",
				Path: VsixWriter.VSO_MANIFEST_FILENAME
			}});
			
			log.debug("Manifests finished prepping.");
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
			let overrides: {[partName: string]: string} = {};
			Object.keys(this.files).forEach((file) => {
				if (_.endsWith(file, VsixWriter.VSO_MANIFEST_FILENAME)) {
					return;
				}
				let partName = file.replace(/\\/g, "/"); 
				vsix.file(partName, fs.readFileSync(path.join(root, file)));
				if (this.files[file]) {
					overrides[partName] = this.files[file];
				}
			});
			let assets = <any[]>_.get(this.vsixManifest, "PackageManifest.Assets[0].Asset");
			if (_.isArray(assets)) {
				assets.forEach((asset) => {
					if (asset.$) {
						if (asset.$.Type === "Microsoft.VisualStudio.Services.Manifest") {
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
				return this.genContentTypesXml(Object.keys(vsix.files), overrides);
			}).then((contentTypesXml) => {
				vsix.file(VsixWriter.CONTENT_TYPES_FILENAME, contentTypesXml);
				let buffer = vsix.generate({
					type: "nodebuffer",
					compression: "DEFLATE",
					compressionOptions: { level: 9 },
					platform: process.platform
				});
				log.debug("Writing vsix to: %s", outputPath);
				this.ensureDirExists(outputPath);
				return Q.nfcall(fs.writeFile, outputPath, buffer).then(() => {
					return outputPath;
				});
			});
		}
		
		/**
		 * Generates the required [Content_Types].xml file for the vsix package.
		 * This xml contains a <Default> entry for each different file extension
		 * found in the package, mapping it to the appropriate MIME type.
		 */
		private genContentTypesXml(fileNames: string[], overrides: {[partName: string]: string}): Q.Promise<string> {
			log.debug("Generating [Content_Types].xml");
			let contentTypes: any = {
				Types: {
					$: {
						xmlns: "http://schemas.openxmlformats.org/package/2006/content-types"
					},
					Default: [],
					Override: []
				}
			};
			let windows = /^win/.test(process.platform);
			let contentTypePromise;
			if (windows) {
				// On windows, check HKCR to get the content type of the file based on the extension
				let contentTypePromises: Q.Promise<any>[] = [];
				let extensionlessFiles = [];
				let uniqueExtensions = _.unique<string>(fileNames.map((f) => {
					let extName = path.extname(f);
					if (!extName && !overrides[f]) {
						log.warn("File %s does not have an extension, and its content-type is not declared. Defaulting to application/octet-stream.", path.resolve(f));
					}
					if (overrides[f]) {
						// If there is an override for this file, ignore its extension
						return "";
					}
					return extName;
				}));
				uniqueExtensions.forEach((ext) => {
					if (!ext) {
						return;
					}
					if (VsixWriter.CONTENT_TYPE_MAP[ext.toLowerCase()]) {
						contentTypes.Types.Default.push({
							$: {
								Extension: ext,
								ContentType: VsixWriter.CONTENT_TYPE_MAP[ext.toLowerCase()]
							}
						});
						return;
					}
					let hkcrKey = new winreg({
						hive: winreg.HKCR,
						key: "\\" + ext.toLowerCase()
					});
					let regPromise = Q.ninvoke(hkcrKey, "get", "Content Type").then((type: WinregValue) => {
						log.debug("Found content type for %s: %s.", ext, type.value);
						let contentType = "application/octet-stream";
						if (type) {
							contentType = type.value;
						}
						return contentType;
					}).catch((err) => {
						log.warn("Could not determine content type for extension %s. Defaulting to application/octet-stream. To override this, add a contentType property to this file entry in the manifest.", ext);
						return "application/octet-stream";
					}).then((contentType) => {
						contentTypes.Types.Default.push({
							$: {
								Extension: ext,
								ContentType: contentType
							}
						});
					});
					contentTypePromises.push(regPromise);
				});
				contentTypePromise = Q.all(contentTypePromises);
			} else {
				// If not on windows, run the file --mime-type command to use magic to get the content type.
				// If the file has an extension, rev a hit counter for that extension and the extension
				// If there is no extension, create an <Override> element for the element
				// For each file with an extension that doesn't match the most common type for that extension
				// (tracked by the hit counter), create an <Override> element.
				// Finally, add a <Default> element for each extension mapped to the most common type.
				
				let contentTypePromises: Q.Promise<any>[] = [];
				let extTypeCounter: {[ext: string]: {[type: string]: string[]}} = {};
				fileNames.forEach((fileName) => {
					let extension = path.extname(fileName);
					let mimePromise;
					if (VsixWriter.CONTENT_TYPE_MAP[extension]) {
						if (!extTypeCounter[extension]) {
							extTypeCounter[extension] = {};
						}
						if (!extTypeCounter[extension][VsixWriter.CONTENT_TYPE_MAP[extension]]) {
							extTypeCounter[extension][VsixWriter.CONTENT_TYPE_MAP[extension]] = [];
						}
						extTypeCounter[extension][VsixWriter.CONTENT_TYPE_MAP[extension]].push(fileName);
						mimePromise = Q.resolve(null);
						return;
					}
					mimePromise = Q.Promise((resolve, reject, notify) => {
						let child = childProcess.exec("file --mime-type \"" + fileName + "\"", (err, stdout, stderr) => {
							try {
								if (err) {
									reject(err);
								}
								let stdoutStr = stdout.toString("utf8");
								let magicMime = _.trimRight(stdoutStr.substr(stdoutStr.lastIndexOf(" ") + 1), "\n");
								log.debug("Magic mime type for %s is %s.", fileName, magicMime);
								if (magicMime) {
									if (extension) {
										if (!extTypeCounter[extension]) {
											extTypeCounter[extension] = {};
										}
										let hitCounters = extTypeCounter[extension];
										if (!hitCounters[magicMime]) {
											hitCounters[magicMime] = [];
										} 
										hitCounters[magicMime].push(fileName);
									} else {
										if (!overrides[fileName]) {
											overrides[fileName] = magicMime;
										}
									}
								} else {
									if (stderr) {
										reject(stderr.toString("utf8"));
									} else {
										log.warn("Could not determine content type for %s. Defaulting to application/octet-stream. To override this, add a contentType property to this file entry in the manifest.", fileName);
										overrides[fileName] = "application/octet-stream";
									}
								}
								resolve(null);
							} catch (e) {
								reject(e);
							}
						});
					});
					contentTypePromises.push(mimePromise);
				});
				contentTypePromise = Q.all(contentTypePromises).then(() => {
					Object.keys(extTypeCounter).forEach((ext) => {
						let hitCounts = extTypeCounter[ext];
						let bestMatch = this.maxKey<string[]>(hitCounts, (i => i.length));
						Object.keys(hitCounts).forEach((type) => {
							if (type === bestMatch) {
								return;
							}
							hitCounts[type].forEach((fileName) => {
								overrides[fileName] = type;
							});
						});
						contentTypes.Types.Default.push({
							$: {
								Extension: ext,
								ContentType: bestMatch
							}
						});
					});
				});
			}
			return contentTypePromise.then(() => {
				Object.keys(overrides).forEach((partName) => {
					contentTypes.Types.Override.push({
						$: {
							ContentType: overrides[partName],
							PartName: partName
						}
					})
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
			});
		}
		
		private maxKey<T>(obj: {[key: string]: T}, func: (input: T) => number): string {
			let maxProp;
			for (let prop in obj) {
				if (!maxProp || func(obj[prop]) > func(obj[maxProp])) {
					maxProp = prop;
				}
			}
			return maxProp;
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