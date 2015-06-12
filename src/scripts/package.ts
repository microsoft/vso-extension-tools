/// <reference path="../../typings/tsd.d.ts" />

import chalk = require("chalk");
import fs = require("fs");
import glob = require("glob");
import xml = require("xmlbuilder");

export module Package {
	export function begin(path: string, command: commander.ICommand) {
		
	}
	
	export interface MergeSettings {
		manifestGlob: string;
	}
	
	class Merger {
		private static DEFAULT_MERGE_SETTINGS_FILE: string = "merge-settings.json";
		
		private files: string[];
		private mergeSettings: MergeSettings;
		
		constructor(files: string[]) {
			this.files = files;
			this.parseSettings();
		}
		
		private parseSettings() {
			
		}
		
		private gatherManifests(globPattern: string): Q.Promise<string[]> {
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
			return this.gatherManifests(this.mergeSettings.manifestGlob).then((files: string[]) => {
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
							
						});
					});
				});
			}).catch(console.error.bind(console));
		}
		
	}
}