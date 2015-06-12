/// <reference path="../../typings/tsd.d.ts" />

import chalk = require("chalk");
import xml = require("xmlbuilder");

export module Package {
	export function begin(path: string, command: commander.ICommand) {
		
	}
	
	export interface MergeSettings {
		
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
		
		public merge() {
			
		}
		
	}
}