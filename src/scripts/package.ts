/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import chalk = require("chalk");
import fs = require("fs");
import glob = require("glob");
import xml = require("xml2js");

export module Package {
	export function begin(path: string, command: commander.ICommand) {
		
	}
	
	export interface MergeSettings {
		manifestGlobs: string[];
	}
	
	export class Merger {
		private static DEFAULT_MERGE_SETTINGS_FILE: string = "merge-settings.json";
		
		private files: string[];
		private mergeSettings: MergeSettings;
		
		constructor(files: string[]) {
			this.files = files;
			this.parseSettings();
		}
		
		private parseSettings() {
			this.mergeSettings = {
				manifestGlobs: [""]
			}
		}
		
		private gatherManifests(globPatterns: string[]): Q.Promise<string[]> {
			return Q.all(globPatterns.map(pattern => this.gatherManifestsFromGlob(pattern))).then((fileLists) => {
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
		
		public merge(): Q.Promise<any> {
			return this.gatherManifests(this.mergeSettings.manifestGlobs).then((files: string[]) => {
				var manifestPromises: Q.Promise<any>[] = [];
				files.forEach((file) => {
					manifestPromises.push(Q.nfcall<string>(fs.read, file).then<any>((contents) => {
						return JSON.parse(contents);
					}));
				});
				var vsixManifest: any = {};
				var vsoManifest: any = {};
				Q.all(manifestPromises).then((partials: {[key: string]: any}[]) => {
					partials.forEach((partial) => {
						var keys = Object.keys(partial);
						keys.forEach((key) => {
							this.mergeKey(key, partial[key], vsoManifest, vsixManifest);
						});
					});
				});
			}).catch(console.error.bind(console));
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
					break;
				case "baseUri":
					// Assert string value
					vsoManifest.baseUri = value;
					break;
				case "contributions":
					this.mergeContributions(value, vsoManifest)
			}
		}
		
		private mergeContributions(contributions: any, manifest: any) {
			if (!manifest.contributions) {
				manifest.contributions = {};
			}
			var newContributionPoints = Object.keys(contributions);
			newContributionPoints.forEach((key: string) => {
				if (!manifest.contributions.hasOwnProperty(key)) {
					manifest.contributions[key] = [];
				}
				manifest.contributions[key].concar(contributions[key]);
			});
		}
	}
}