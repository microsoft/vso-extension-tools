/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import chalk = require("chalk");
import fs = require("fs");
import glob = require("glob");
import path = require("path");
import Q = require("q");
import stream = require("stream");
import xml = require("xml2js");
import zip = require("adm-zip");

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
		
		private root: string;
		private mergeSettings: MergeSettings;
		
		/**
		 * constructor
		 * @param string Root path for locating candidate manifests
		 */
		constructor(rootPath: string) {
			this.root = rootPath;
			this.parseSettings();
		}	
		
		private parseSettings() {
			this.mergeSettings = {
				manifestGlobs: ["manifests/**/*.json"]
			}
		}
		
		private gatherManifests(globPatterns: string[]): Q.Promise<string[]> {
			var globs = globPatterns.map(pattern => path.join(this.root, pattern));
			return Q.all(globs.map(pattern => this.gatherManifestsFromGlob(pattern))).then((fileLists) => {
				return _.unique(fileLists.reduce((a, b) => { return a.concat(b); }));
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
				var manifestPromises: Q.Promise<any>[] = [];
				files.forEach((file) => {
					manifestPromises.push(Q.nfcall<any>(fs.readFile, file, "utf8").then((data) => {
						try {
							var result = JSON.parse(data);
							result.__origin = file; // save the origin in order to resolve relative paths later.
							return result;	
						} catch (err) {
							console.log("Error parsing the JSON in " + file + ": ");
							console.log(data);
							throw err;
						}
					}));
				});
				var defaultVsixManifestPath = path.join(require("app-root-path").path, "src", "tmpl", "default_vsixmanifest.json"); 
				var vsixManifest: any = JSON.parse(fs.readFileSync(defaultVsixManifestPath, "utf8"));
				vsixManifest.__meta_root = this.root;
				var vsoManifest: any = {__meta_root: this.root};
				return Q.all(manifestPromises).then((partials: any[]) => {
					partials.forEach((partial) => {
						// Transform asset paths to be relative to the root of all manifests.
						if (_.isArray(partial["assets"])) {
							(<Array<AssetDeclaration>>partial["assets"]).forEach((asset) => {
								var keys = Object.keys(asset);
								if (keys.length !== 2 || keys.indexOf("type") < 0 || keys.indexOf("path") < 0) {
									throw "Assets must have a type and a path.";
								}
								if (path.isAbsolute(asset.path)) {
									throw "Paths in manifests must be relative.";
								}
								var absolutePath = path.join(partial.__origin, asset.path);
								asset.path = path.relative(this.root, absolutePath);
							});
						}
						
						// Merge each key of each partial manifest into the joined manifests
						Object.keys(partial).forEach((key) => {
							this.mergeKey(key, partial[key], vsoManifest, vsixManifest);
						});
					});
					return <SplitManifest>{vsoManifest: vsoManifest, vsixManifest: vsixManifest};
				});
			}).catch<SplitManifest>(console.error.bind(console));
		}
		
		private mergeKey(key: string, value: any, vsoManifest: any, vsixManifest: any) {
			switch(key.toLowerCase()) {
				case "namespace":
					// Assert string value
					vsoManifest.namespace = value;
					vsixManifest.PackageManifest.Metadata[0].Identity[0].$.Id = value;
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
				case "publisher":
					vsixManifest.PackageManifest.Metadata[0].Identity[0].$.Publisher = value;
					break;
				case "releasenotes":
					vsixManifest.PackageManifest.Metadata[0].ReleaseNotes = [value];
					break;
				case "tags":
					if (_.isArray(value)) {
						value = (<Array<string>>value).join(",");
					}
					vsixManifest.PackageManifest.Metadata[0].Tags = [value];
					break;
				case "vsoflags":
					if (_.isArray(value)) {
						value = (<Array<string>>value).join(",");
					}
					vsixManifest.PackageManifest.Metadata[0].VSOFlags = [value];
					break;
				case "baseuri":
					// Assert string value
					vsoManifest.baseUri = value;
					break;
				case "contributions":
					if (!vsoManifest.contributions) {
						vsoManifest.contributions = {};
					}
					_.merge(vsoManifest.contributions, value, (objectValue, sourceValue, key, object, source) => {
						if (_.isArray(objectValue)) {
							return (<Array<any>>objectValue).concat(sourceValue);
						}
					});
					break;
				case "contributionpoints":
					if (!vsoManifest.contributionPoints) {
						vsoManifest.contributionPoints = {};
					}
					_.merge(vsoManifest.contributionPoints, value);
					break;
				case "contributiontypes":
					if (!vsoManifest.contributionTypes) {
						vsoManifest.contributionTypes = {};
					}
					_.merge(vsoManifest.contributionTypes, value);
					break;
				case "assets": 
					if (_.isArray(value)) {
						vsixManifest.PackageManifest.Assets = [{"Asset": []}];
						value.forEach((asset: AssetDeclaration) => {
							vsixManifest.PackageManifest.Assets[0].Asset.push({
								"$": {
									"Type": asset.type,
									"d:Source": "File",
									"Path": asset.path
								}
							});
						});
					}
					break;		
			}
		}	 		
	}
	
	/**
	 * Facilitates packaging the vsix and writing it to a stream
	 */
	export class VsixWriter {
		private vsoManifest: any;
		private vsixManifest: any;
		
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
			var assets = _.get<AssetDeclaration[]>(this.vsixManifest, "PackageManifest.Assets[0].Asset");
			if (assets) {
				_.remove(assets, (asset) => {
					return _.get(asset, "$.Type", "x").toLowerCase() === "microsoft.vso.manifest";
				});
			} else {
				assets = [];
				_.set<any, any>(this.vsixManifest, "PackageManifest.Assets[0].Asset[0]", assets);
			}
			
			assets.push({
				type: "Microsoft.VSO.Manifest",
				path: "extension.vsomanifest"
			});
		}
		
		/**
		 * Write a vsix package to the given writable stream
		 * @param stream.Writable Stream to write the vsix package
		 */
		public writeVsix(outStream: stream.Writable): Q.Promise<any> {
			var vsix = new zip();
			var root = this.vsoManifest.__meta_root;
			if (!root) {
				throw "Manifest root unknown. Manifest objects should have a __meta_root key specifying the absolute path to the root of assets.";
			}
			
			return Q.resolve("");
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
			this.removeMetaKeys(vsoManifest);
			this.removeMetaKeys(vsixManifest);
			this.vsoManifest = vsoManifest;
			this.vsixManifest = vsixManifest;
		}
		
		private removeMetaKeys(obj: any) {
			Object.keys(obj).filter(key => key.indexOf("__meta_") === 0).forEach((key) => {
				delete obj[key];
			});
		}
		
		/**
		 * Writes the vso manifest and vsix manifest to given streams and ends the streams.
		 * @param stream.Writable Stream to write the vso manifest (json)
		 * @param stream.Writable Stream to write the vsix manifest (xml)
		 * @return Q.Promise<any> A promise that is resolved when the streams have been written/ended
		 */
		public writeManifests(vsoStream: stream.Writable, vsixStream: stream.Writable): Q.Promise<any> {
			
			var vsoPromise = Q.ninvoke(vsoStream, "write", JSON.stringify(this.vsoManifest, null, 4), "utf-8");
			vsoPromise = vsoPromise.then(() => {
				vsoStream.end();
			}).catch(console.error.bind(console));
			
			// vsoStream.write(JSON.stringify(this.vsoManifest, null, 4), "utf-8", function() { console.log("done"); vsoStream.end(); });
			// var vsoPromise = Q.resolve("test");
			
			/*doctype?: any;
            headless?: boolean;
            indent?: string;
            newline?: string;
            pretty?: boolean;
            renderOpts?: RenderOptions;
            rootName?: string;
            xmldec?: XMLDeclarationOptions;*/
			
			var builder = new xml.Builder({
				indent: "    ",
				newline: "\n",
				pretty: true,
				xmldec: {
					encoding: "utf-8",
					standalone: null,
					version: "1.0"
				}
			});
			var vsix = builder.buildObject(this.vsixManifest);
			var vsixPromise = Q.ninvoke(vsixStream, "write", vsix, "utf8");
			vsixPromise = vsixPromise.then(() => {
				vsixStream.end();
			}).catch(console.error.bind(console));
			
			return Q.all([vsoPromise, vsixPromise]);
		}
	}
}