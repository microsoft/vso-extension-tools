import _ = require("lodash");
import fs = require("fs");
import log = require("./logger");
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
			} else if (_.isString(document[key]) && _.startsWith(document[key], "ms-resource:")) {
				let resourceKey = document[key].substr(12).trim();
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
	
	export function propertyIsComment(property: string): boolean {
		return _.startsWith(property, "_") && _.endsWith(property, ".comment");
	}
	
	export class LocKeyGenerator {
		private static NO_LOC_PREFIX = "!!";
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
		 * Destructive method modifies the manifests by replacing strings with ms-resource
		 * keys. Adds all the original resources to the resources object.
		 */
		public generateLocalizationKeys(): ResourceSet {
			this.initStringObjs();
			this.vsoReplaceWithKeysAndGenerateDefaultStrings();
			this.vsixGenerateDefaultStrings();
			return this.splitIntoVsoAndVsixResourceObjs(this.vsoManifestStrings);
		}
		
		private addResource(sourceKey: string, resourceKey: string, obj: any) {
			this.vsoManifestStrings[resourceKey] = obj[sourceKey];
			let comment = obj["_" + sourceKey + ".comment"]; 
			if (comment) {
				this.vsoManifestStrings["_" + resourceKey + ".comment"] = comment;
			}
			obj[sourceKey] = "ms-resource:" + resourceKey;
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
				this.vsoManifestStrings["displayName"] = displayName;
			}
			if (description) {
				this.vsoManifestStrings["description"] = description;
			}
			if (releaseNotes) {
				this.vsoManifestStrings["releaseNotes"] = releaseNotes;
			}
		}
		
		private vsoReplaceWithKeysAndGenerateDefaultStrings(): void {
			for (let key in this.vsoManifest) {
				switch (key.toLowerCase()) {
					case "contributions" :
						if (!_.isArray(this.vsoManifest[key])) {
							throw "Contributions property is not an array.";
						}
						
						for (let contribution of this.vsoManifest[key]) {
							if (!_.isObject(contribution)) {
								throw "Contribution is not an object.";
							}
							let contributionId = contribution.id;
							if (!contributionId) {
								throw "Contribution does not contain an id.";
							}
							
							for (let contributionKey in contribution) {
								switch (contributionKey) {
									case "description" :
										this.addResource(contributionKey, "contribution." + contributionId + ".description", contribution);
										break;
									case "properties" :
										let propObj = contribution.properties;
										if (!_.isObject(propObj)) {
											throw "Properties object on " + contributionId + " is not an object.";
										}
										for (let property in propObj) {
											let propertyIsComment = LocPrep.propertyIsComment(property);
											if (!_.startsWith(property, LocKeyGenerator.NO_LOC_PREFIX) && _.isString(propObj[property]) && !propertyIsComment) {
												this.addResource(property, "contribution." + contributionId + ".properties." + property, propObj);
											}
										}
								}
							}
						}
						break;
					case "contributiontypes" : 
						break;
				}
			}
		}
	}
}