/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import chalk = require("chalk");
import fs = require("fs");
import glob = require("glob");
import path = require("path");
import xml = require("xml2js");

export module Package {	
	/**
	 * Combines the vsix and vso manifests into one object
	 */
	export interface SplitManifest {
		vsoManifest: any;
		vsixManifest: any;
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
		 * Finds a directory named "public" above this script. 
		 * Searches for ..\src\tmpl\default_vsixmanifest.json from there.
		 */
		private getDefaultVsixManifestPath() {
			var currentPath = __dirname;
			while (currentPath.substr(currentPath.lastIndexOf(path.sep)) !== path.sep + "public") {
				currentPath = path.join(currentPath, "..");
				if (currentPath === path.join(currentPath, "..")) {
					throw "Did not find the public directory.";
				}
			}
			return path.join(currentPath, "..", "src", "tmpl", "default_vsixmanifest.json");
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
						return JSON.parse(data);
					}));
				});
				var vsixManifest: any = JSON.parse(fs.readFileSync(this.getDefaultVsixManifestPath(), "utf8"));
				var vsoManifest: any = {};
				return Q.all(manifestPromises).then((partials: {[key: string]: any}[]) => {
					partials.forEach((partial) => {
						var keys = Object.keys(partial);
						keys.forEach((key) => {
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
					break;
				case "name":
					// Assert string value
					vsoManifest.name = value;
					break;
				case "description":
					// Assert string value
					vsoManifest.description = value;
					vsixManifest.PackageManifest.Metadata[0].Description[0]._ = value;
					break;
				case "publisher":
					vsixManifest.PackageManifest.Metadata[0].Identity.$.Publisher = value;
					break;
				case "tags":
					if (_.isArray(value)) {
						value = (<Array<string>>value).join(",");
					}
					vsixManifest.PackageManifest.Metadata[0].Tags[0] = value;
					break;
				case "VSOFlags":
					if (_.isArray(value)) {
						value = (<Array<string>>value).join(",");
					}
					vsixManifest.PackageManifest.Metadata[0].VSOFlags[0] = value;
					break;
				case "baseUri":
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
				case "contributionPoints":
					if (!vsoManifest.contributionPoints) {
						vsoManifest.contributionPoints = {};
					}
					_.merge(vsoManifest.contributionPoints, value);
					break;
				case "contributionTypes":
					if (!vsoManifest.contributionTypes) {
						vsoManifest.contributionTypes = {};
					}
					_.merge(vsoManifest.contributionTypes, value);
					break;				
			}
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
			this.vsoManifest = vsoManifest;
			this.vsixManifest = vsixManifest;
		}
		
		/**
		 * Writes the vso manifest and vsix manifest to files with the given paths
		 * @param string Path to write the vso manifest (json)
		 * @param string Path to write the vsix manifest (xml)
		 * @return Q.Promise<any> A promise that is resolved when the files have been written
		 */
		public writeManifests(vsoPath: string, vsixPath: string): Q.Promise<any> {
			var vsoPromise = Q.nfcall(fs.writeFile, vsoPath, JSON.stringify(this.vsoManifest), {
				encoding: "utf8"
			});
			
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
				pretty: true
			});
			var vsix = builder.buildObject(this.vsixManifest);
			var vsixPromise = Q.nfcall(fs.writeFile, vsoPath, JSON.stringify(this.vsoManifest), {
				encoding: "utf8"
			});
			
			return Q.all([vsoPromise, vsixPromise])
		}
	}
}