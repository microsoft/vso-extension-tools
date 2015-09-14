import _ = require("lodash");
import fs = require("fs");
import log = require("./logger");
import mkdirp = require('mkdirp');
import path = require("path");
import Q = require("q");
import settings = require("./settings");

export module LocPrep {
	export interface ResourcesFile {
		[key: string]: string;
	}
	
	// Models the schema outlined at https://msdn.microsoft.com/en-us/library/dd997147.aspx
	export interface VsixLanguagePack {
		VsixLanguagePack: {
			$: {
				Version: string;
				xmlns: string;
			};
			LocalizedName: [string];
			LocalizedDescription: [string];
			LocalizedReleaseNotes: [string];
			License: [string];
			MoreInfoUrl: [string];
		};
	}
	
	export interface ResourceSet {
		vsixResources: VsixLanguagePack;
		vsoResources: ResourcesFile;
		combined: ResourcesFile;
	}
	
	/**
	 * Creates a deep copy of document, replacing resource keys with the values from
	 * the resources object.
	 * If a resource cannot be found, the same string from the defaults document will be substituted.
	 * The defaults object must have the same structure/schema as document.
	 */
	export function makeReplacements(document: any, resources: ResourcesFile, defaults: ResourcesFile): any {
		let locDocument = _.isArray(document) ? [] : {};
		for (let key in document) {
			if (propertyIsComment(key)) {
				continue;
			} else if (_.isObject(document[key])) {
				locDocument[key] = makeReplacements(document[key], resources, defaults);
			} else if (_.isString(document[key]) && _.startsWith(document[key], "resource:")) {
				let resourceKey = document[key].substr("resource:".length).trim();
				let replacement = resources[resourceKey];
				if (!_.isString(replacement)) {
					replacement = defaults[resourceKey];
					log.warn("Could not find a replacement for resource key %s. Falling back to '%s'.", resourceKey, replacement);
				}
				locDocument[key] = replacement; 
			} else {
				locDocument[key] = document[key];
			}
		}
		return locDocument;
	}
	
	/**
	 * If the resjsonPath setting is set...
	 * Check if the path exists. If it does, check if it's a directory.
	 * If it's a directory, write to path + extension.resjson
	 * All other cases just write to path.
	 */
	export function writeResourceFile(fullResjsonPath: string, resources: ResourcesFile): Q.Promise<void> {
		return Q.Promise<boolean>((resolve, reject, notify) => {
			fs.exists(fullResjsonPath, (exists) => {
				resolve(exists);
			});
		}).then<string>((exists) => {
			if (exists) {
				return Q.nfcall(fs.lstat, fullResjsonPath).then((obj: fs.Stats) => {
					return obj.isDirectory();
				}).then<string>((isDir) => {
					if (isDir) {
						return path.join(fullResjsonPath, "extension.resjson");
					} else {
						return fullResjsonPath;
					}
				});
			} else {
				return Q.resolve(fullResjsonPath)
			}
		}).then((determinedPath) => {
			return Q.nfcall(mkdirp, path.dirname(determinedPath)).then(() => {
				return Q.nfcall<void>(fs.writeFile, determinedPath, JSON.stringify(resources, null, 4), "utf8");
			});
		});
	}
	
	export function propertyIsComment(property: string): boolean {
		return _.startsWith(property, "_") && _.endsWith(property, ".comment");
	}
	
	export class LocKeyGenerator {
		private static I18N_PREFIX = "i18n:";
		private vsoManifest: any;
		private vsixManifest: any;
		private vsoManifestStrings: ResourcesFile;
		private combined: ResourcesFile;
		
		constructor(vsoManifest: any, vsixManifest: any) {
			this.vsoManifest = vsoManifest;
			this.vsixManifest = vsixManifest;
			this.initStringObjs();
		}
		
		private initStringObjs() {
			this.vsoManifestStrings = {};
			this.combined = {};
		}
		
		/**
		 * Destructive method modifies the manifests by replacing i18nable strings with resource:
		 * keys. Adds all the original resources to the resources object.
		 */
		public generateLocalizationKeys(): ResourceSet {
			this.initStringObjs();
			this.vsoReplaceWithKeysAndGenerateDefaultStrings(this.vsoManifest);
			this.vsixGenerateDefaultStrings();
			return this.splitIntoVsoAndVsixResourceObjs(this.vsoManifestStrings);
		}
		
		private addResource(sourceKey: string, resourceKey: string, obj: any) {
			let resourceVal = this.removeI18nPrefix(obj[sourceKey]);
			this.vsoManifestStrings[resourceKey] = resourceVal;
			let comment = obj["_" + sourceKey + ".comment"]; 
			if (comment) {
				this.vsoManifestStrings["_" + resourceKey + ".comment"] = comment;
			}
			obj[sourceKey] = "resource:" + resourceKey;
		}
		
		private removeI18nPrefix(str: string): string {
			if (_.startsWith(str, LocKeyGenerator.I18N_PREFIX)) {
				return str.substr(LocKeyGenerator.I18N_PREFIX.length);
			}
			return str;
		}
		
		/**
		 * Takes the contents of a .resjson file with resources for both .vsomanifest and .vsixmanifest
		 * and produces the contents of the VsixLanguagePack and the vsomanifest's .resjson file.
		 */
		public splitIntoVsoAndVsixResourceObjs(resources: ResourcesFile): ResourceSet {
			let vsixManifestStrings: VsixLanguagePack = {
				VsixLanguagePack: {
					$: {
						Version: "1.0.0",
						xmlns: "http://schemas.microsoft.com/developer/vsx-schema-lp/2010"
					},
					LocalizedName: [null],
					LocalizedDescription: [null],
					LocalizedReleaseNotes: [null],
					License: [null],
					MoreInfoUrl: [null]
				}
			};
			let vsoManifestStrings: ResourcesFile = {};
			for (let key in resources) {
				switch(key) {
					case "displayName" :
						vsixManifestStrings.VsixLanguagePack.LocalizedName[0] = resources[key];
						break;
					case "description" :
						vsixManifestStrings.VsixLanguagePack.LocalizedDescription[0] = resources[key];
						break;
					case "releaseNotes" :
						vsixManifestStrings.VsixLanguagePack.LocalizedReleaseNotes[0] = resources[key];
						break;
					default :
						vsoManifestStrings[key] = resources[key];
						break;
				}
			}
			return {
				vsixResources: vsixManifestStrings,
				vsoResources: vsoManifestStrings,
				combined: resources
			};
		}
		
		private vsixGenerateDefaultStrings(): void {
			let displayName = _.get<string>(this.vsixManifest, "PackageManifest.Metadata[0].DisplayName[0]");
			let description = _.get<string>(this.vsixManifest, "PackageManifest.Metadata[0].Description[0]._");
			let releaseNotes = _.get<string>(this.vsixManifest, "PackageManifest.Metadata[0].ReleaseNotes[0]");
			
			if (displayName) {
				let cleanDisplayName = this.removeI18nPrefix(displayName);
				this.vsoManifestStrings["displayName"] = cleanDisplayName;
				_.set<any, string>(this.vsixManifest, "PackageManifest.Metadata[0].DisplayName[0]", cleanDisplayName);
			}
			if (description) {
				let cleanDescription = this.removeI18nPrefix(description);
				this.vsoManifestStrings["description"] = this.removeI18nPrefix(cleanDescription);
				_.set<any, string>(this.vsixManifest, "PackageManifest.Metadata[0].Description[0]._", cleanDescription);
			}
			if (releaseNotes) {
				let cleanReleaseNotes = this.removeI18nPrefix(releaseNotes);
				this.vsoManifestStrings["releaseNotes"] = this.removeI18nPrefix(cleanReleaseNotes);
				_.set<any, string>(this.vsixManifest, "PackageManifest.Metadata[0].ReleaseNotes[0]", cleanReleaseNotes);
			}
		}
		
		private vsoReplaceWithKeysAndGenerateDefaultStrings(vsoManifest: any, path: string = ""): void {
			for (let key in vsoManifest) {
				let val = vsoManifest[key];
				if (_.isObject(val)) {
					let nextPath = path + key + ".";
					if (path === "contributions." && vsoManifest[key] && vsoManifest[key]["id"]) {
						nextPath = path + vsoManifest[key]["id"] + ".";
					}
					this.vsoReplaceWithKeysAndGenerateDefaultStrings(val, nextPath);
				} else if (_.isString(val) && _.startsWith(val, LocKeyGenerator.I18N_PREFIX)) {
					this.addResource(key, path + key, vsoManifest)
				}
			}
		}
	}
}