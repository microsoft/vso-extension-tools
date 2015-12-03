/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import chalk = require("chalk");
import defaultManifest = require("./default-manifest");
import childProcess = require("child_process");
import fs = require("fs");
import glob = require("glob");
import loc = require("./loc");
import log = require("./logger");
import onecolor = require("onecolor");
import os = require("os");
import path = require("path");
import program = require("commander");
import Q = require("q");
import settings = require("./settings");
import stream = require("stream");
import util = require("util");
import tmp = require("tmp");
import winreg = require("winreg");
import xml = require("xml2js");
import zip = require("jszip");
import mkdirp = require('mkdirp');

export module Package {
	/**
	 * Combines the vsix and vso manifests into one object
	 */
	export interface VsixComponents {
		vsoManifest: any;
		vsixManifest: any;
		files: PackageFiles;
		resources: loc.LocPrep.ResourceSet;
	}
	
	/**
	 * Represents a part in an OPC package
	 */
	export interface PackagePart {
		contentType?: string;
		partName: string;
	}
	
	/**
	 * List of files in the package, mapped to null, or, if it can't be properly auto-
	 * detected, a content type.
	 */
	export interface PackageFiles {
		[path: string]: PackagePart;
	}

	/**
	 * Describes a screenshot in the manifest
	 */
	export interface ScreenshotDeclaration {		
		path: string;
		contentType?: string;
	}
	
	/**
	 * Describes a file in a manifest
	 */
	export interface FileDeclaration {
		/**
		 * The type of this asset (Type attribute in the vsixmanifest's <Asset> entry)
		 * Also used as the addressable name of this asset (if addressable = true)
		 */
		assetType?: string;
		
		/**
		 * Manually specified content-type/mime-type. Otherwise, try to automatically determine.
		 */
		contentType?: string;
		
		/**
		 * True means that this file was added indirectly, e.g. from a directory. Files that have
		 * auto = true will be overridden by files with the same path that do not.
		 */
		auto?: boolean;
		
		/**
		 * Path to the file on disk
		 */
		path: string;
		
		/** 
		 * Path/file name to the file in the archive
		 */
		partName?: string;
		
		/**
		 * Language of this asset, if any
		 */
		lang?: string;
		
		/**
		 * If true, this asset will be addressable via a public gallery endpoint
		 */
		addressable?: boolean;
	}
	
	/**
	 * Describes a base asset declaration
	 */
	export interface AssetDeclaration {
		path: string;
		contentType?: string;
	}
	
	/**
	 * Describes a screenshot in the manifest
	 */
	export interface ScreenshotDeclaration extends AssetDeclaration {
		
	}
	
	/**
	 * Describes a details file in the manifest
	 */
	export interface DetailsDeclaration extends AssetDeclaration {
		
	}
	
	/**
	 * Describes a link in the manifest
	 */
	export interface LinkDeclaration {
		url: string;
	}
	
	/**
	 * Describes a set of links keyed off the link type in the manifest.
	 */
	export interface Links {
		[type: string]: LinkDeclaration;
	}
	
	/**
	 * Describes a target in the manifest
	 */
	export interface TargetDeclaration {
		id: string;
		version?: string;
	}
	
	/**
	 * Describes the extension's branding in the manifest.
	 */
	export interface BrandingDeclaration {
		color: string;
		theme: string;
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
		
		private static ICON_TYPES: string[] = [ "Default", "Wide", "Small", "Large" ];
		
		private static vsixValidators: {[path: string]: (value) => string} = {
			"PackageManifest.Metadata[0].Identity[0].$.Id": (value) => {
				if (/^[A-z0-9_-]+$/.test(value)) {
					return null;
				} else {
					return "'extensionId' may only include letters, numbers, underscores, and dashes.";
				}
			},
			"PackageManifest.Metadata[0].Identity[0].$.Version": (value) => {
				if (typeof value === "string" && value.length > 0) {
					return null;
				} else {
					return "'version' must be provided.";
				}
			},
			"PackageManifest.Metadata[0].DisplayName[0]": (value) => {
				if (typeof value === "string" && value.length > 0) {
					return null;
				} else {
					return "'name' must be provided.";
				}
			},
			"PackageManifest.Assets[0].Asset": (value) => {
				let usedAssetTypes = {};
				if (_.isArray(value)) {
					for (let i = 0; i < value.length; ++i) {
						let asset = value[i].$;
						if (asset) {
							if (!asset.Path) {
								return "All 'files' must include a 'path'.";
							}
							if (asset.Type && asset.Addressable) {
								if (usedAssetTypes[asset.Type]) {
									return "Cannot have multiple 'addressable' files with the same 'assetType'.\nFile1: " + usedAssetTypes[asset.Type] + ", File 2: " + asset.Path + " (asset type: " + asset.Type + ")";
								} else {
									usedAssetTypes[asset.Type] = asset.Path;
								}
							}
						}
					}
				}
				
				return null;
			},
			"PackageManifest.Metadata[0].Identity[0].$.Publisher": (value) => {
				if (typeof value === "string" && value.length > 0) {
					return null;
				} else {
					return "'publisher' must be provided.";
				}
			},
			"PackageManifest.Metadata[0].Categories[0]": (value) => {
				if (!value) {
					return null;
				}
				let categories = value.split(",");
				if (categories.length > 1) {
					return "For now, extensions are limited to a single category.";
				}
				let validCategories = [
                    "Administration",
					"Build and release",
					"Code",
					"Collaborate",
					"Developer samples",
					"Insights",
					"Integrate",
					"Plan and track",
                    "Other",
					"Test"
				];
				_.remove(categories, c => !c);
				let badCategories = categories.filter(c => validCategories.indexOf(c) < 0);
				return badCategories.length ? "The following categories are not valid: " + badCategories.join(", ") + ". Valid categories are: " + validCategories.join(", ") + "." : null;
			},
			"PackageManifest.Installation[0].InstallationTarget": (value) => {
				if (_.isArray(value) && value.length > 0) {
					return null;
				}
				return "Your manifest must include at least one 'target'.";
			}
		}
		
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
		
		public gatherManifests(): Q.Promise<string[]> {
			let globPatterns = this.mergeSettings.manifestGlobs;
			let globs = globPatterns.map(pattern => 
				path.isAbsolute(pattern) ? pattern : path.join(this.mergeSettings.root, pattern));
			return Q.all(globs.map(pattern => this.gatherManifestsFromGlob(pattern))).then((fileLists) => {
				return _.unique(fileLists.reduce((a, b) => { return a.concat(b); }));
			}).then((paths) => {
				if (paths.length > 0) {
					log.info("Merging %s manifests from the following paths: ", 2, paths.length.toString());
					paths.forEach(path => log.info(path, 3));
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
			return this.gatherManifests().then((files: string[]) => {
				let overridesProvided = false;
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
						overridesProvided = true;
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
				};
				let packageFiles: PackageFiles = {};
				return Q.all(manifestPromises).then((partials: any[]) => {
					partials.forEach((partial, partialIndex) => {
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
						
						// Expand any directories listed in the files array
						let pathToFileDeclarations = (fsPath: string, root: string, addressable: boolean): FileDeclaration[] => {
							let files: FileDeclaration[] = [];
							if (fs.lstatSync(fsPath).isDirectory()) {
								log.debug("Path '%s` is a directory. Adding all contained files (recursive).", fsPath);
								fs.readdirSync(fsPath).forEach((dirChildPath) => {
									log.debug("-- %s", dirChildPath);
									files = files.concat(pathToFileDeclarations(path.join(fsPath, dirChildPath), root, addressable));
								});
							} else {
								let relativePath = path.relative(root, fsPath);
								files.push({path: relativePath, partName: relativePath, auto: true, addressable: addressable});
							}
							return files;
						};
						
						if (_.isArray(partial["files"])) {
							for (let i = partial["files"].length - 1; i >= 0; --i) {
								let fileDecl: FileDeclaration = partial["files"][i];
								let fsPath = path.join(vsoManifest.__meta_root, fileDecl.path);
								if (fs.lstatSync(fsPath).isDirectory()) {
									Array.prototype.splice.apply(partial["files"], (<any[]>[i, 1]).concat(pathToFileDeclarations(fsPath, vsoManifest.__meta_root, fileDecl.addressable)));
								}
							}
						}
						// Merge each key of each partial manifest into the joined manifests
						Object.keys(partial).forEach((key) => {
							this.mergeKey(key, partial[key], vsoManifest, vsixManifest, packageFiles, partials.length - 1 === partialIndex && overridesProvided);
						});
					});
					// Merge in the single-value defaults if not provided.
					let vsoDefaults = {
						manifestVersion: 1.0
					};
					Object.keys(vsoDefaults).forEach((d) => {
						if (!vsoManifest[d]) {
							vsoManifest[d] = vsoDefaults[d];
						}
					});
					
					// Default installation target to VSS if not provided (and log warning)
					let installationTarget = _.get<any[]>(vsixManifest, "PackageManifest.Installation[0].InstallationTarget");
					if (!(_.isArray(installationTarget) && installationTarget.length > 0)) {
						log.warn("No 'target' provided. Defaulting to Microsoft.VisualStudio.Services.");
						_.set(vsixManifest, "PackageManifest.Installation[0].InstallationTarget", [
							{
								$: {
									Id: "Microsoft.VisualStudio.Services"
								}
							}
						]);
					}
					
					let locPrepper = new loc.LocPrep.LocKeyGenerator(vsoManifest, vsixManifest);
					let extractedResources = locPrepper.generateLocalizationKeys();
					
					let validationResult = this.validateVsixJson(vsixManifest);
					log.debug("VSO Manifest: " + JSON.stringify(vsoManifest, null, 4));
					log.debug("VSIX Manifest: " + JSON.stringify(vsixManifest, null, 4));
					if (validationResult.length === 0 || program["bypassValidation"]) {
						return <VsixComponents>{
							vsoManifest: vsoManifest, 
							vsixManifest: vsixManifest, 
							files: packageFiles,
							resources: extractedResources
						};
					} else {
						throw "There were errors with your manifests. Address the following errors and re-run the tool.\n" + validationResult;
					}
				});
			});
		}
		
		private handleDelimitedList(value: any, object: any, path: string, delimiter: string = ",", uniq: boolean = true): void {
			if (_.isString(value)) {
				value = value.split(delimiter);
				_.remove(value, v => v === "");
			}
			var items = _.get(object, path, "").split(delimiter);
			_.remove(items, v => v === "");
			let val = items.concat(value);
			if (uniq) {
				val = _.uniq(val);
			} 
			_.set(object, path, val.join(delimiter));
		}
		
		private singleValueProperty(obj: any, path: string, value: any, manifestKey: string, override: boolean = false): boolean {
			let existingValue = _.get(obj, path); 
			if (!override && existingValue !== undefined) {
				log.warn("Multiple values found for '%s'. Ignoring future occurrences and using the value '%s'.", manifestKey, JSON.stringify(existingValue, null, 4));
				return false;
			} else {
				_.set(obj, path, value);
				return true;
			}
		}
		
		public static cleanAssetPath(assetPath: string) {
			let cleanPath = assetPath.replace(/\\/g, "/");
			if (!_.startsWith(cleanPath, "/")) {
				cleanPath = "/" + cleanPath;
			}
			return cleanPath;
		}
		
		/**
		 * Add a file to the vsix package
		 */
		private addFile(file: FileDeclaration, packageFiles: PackageFiles) {
			if (!file.partName) {
				file.partName = file.path;
			}
			
			// Files added recursively, i.e. from a directory, get lower
			// priority than those specified explicitly. Therefore, if
			// the file has already been added to the package list, don't
			// re-add (overwrite) with this file if it is an auto (from a dir)
			if (!file.auto || !packageFiles[file.path]) {
				packageFiles[file.path] = {
					partName: file.partName || file.path
				};
			}
			if (file.contentType) {
				packageFiles[file.path].contentType = file.contentType;
			}
		}
		
		/**
		 * Add an asset: add a file to the vsix package and if there is an assetType on the
		 * file, add an <Asset> entry in the vsixmanifest.
		 */
		private addAsset(file: FileDeclaration, manifest: any, packageFiles: PackageFiles) {
			file.path = Merger.cleanAssetPath(file.path);
			if (file.addressable && !file.assetType) {
				file.assetType = VsixWriter.toZipItemName(file.path);
			}
			this.addFile(file, packageFiles);
			if (file.assetType) {
				this.addAssetToManifest(manifest, file.path, file.assetType, file.addressable, file.lang);
			}
		}
		
		/**
		 * Add a property to the vsixmanifest.
		 */
		private addProperty(vsixManifest: any, id: string, value: string) {
			let defaultProperties = [];
			let existingProperties = _.get<any[]>(vsixManifest, "PackageManifest.Metadata[0].Properties[0].Property", defaultProperties);
			if (defaultProperties === existingProperties) {
				_.set(vsixManifest, "PackageManifest.Metadata[0].Properties[0].Property", defaultProperties);
			}
			existingProperties.push({
				$: {
					Id: id,
					Value: value
				}
			});
		}
		
		/**
		 * Add an <Asset> entry to the vsixmanifest.
		 */
		private addAssetToManifest(manifest: any, assetPath: string, type: string, addressable: boolean = false, lang: string = null): void {
			let cleanAssetPath = VsixWriter.toZipItemName(assetPath);
			let asset = {
				"Type": type,
				"d:Source": "File",
				"Path": cleanAssetPath
			};
			if (addressable) {
				asset["Addressable"] = "true";
			}
			if (lang) {
				asset["Lang"] = lang;
			}
			manifest.PackageManifest.Assets[0].Asset.push({
				"$": asset
			});
			
			if (type === "Microsoft.VisualStudio.Services.Icons.Default") {
				manifest.PackageManifest.Metadata[0].Icon = [cleanAssetPath];
			}
			if (type === "Microsoft.VisualStudio.Services.Content.License") {
				manifest.PackageManifest.Metadata[0].License = [cleanAssetPath];
			}
		}
		
		private mergeKey(key: string, value: any, vsoManifest: any, vsixManifest: any, packageFiles: PackageFiles, override: boolean): void {
			switch(key.toLowerCase()) {
				case "namespace":
				case "extensionid":
				case "id":
					if (_.isString(value)) {
						this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].Identity[0].$.Id", value, "namespace/extensionId/id", override);
					}
					break;
				case "version":
					this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].Identity[0].$.Version", value, key, override);
					break;
				case "name":
					this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].DisplayName[0]", value, key, override);
					break;
				case "description":
					this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].Description[0]._", value, key, override);
					break;
				case "eventcallbacks":
					if (_.isObject(value)) {
						if (!vsoManifest.eventCallbacks) {
							vsoManifest.eventCallbacks = {};
						}
						_.merge(vsoManifest.eventCallbacks, value);
					}
					break;
				case "icons":
					Object.keys(value).forEach((key) => {
						let iconType = _.startCase(key.toLowerCase());
						let fileDecl: FileDeclaration = {
							path: value[key],
							addressable: true,
							assetType: "Microsoft.VisualStudio.Services.Icons." + iconType,
							partName: value[key]
						};
						this.addAsset(fileDecl, vsixManifest, packageFiles);
					});
					break;
				case "screenshots":
					if (_.isArray(value)) {
						let screenshotIndex = 0;
						value.forEach((screenshot: ScreenshotDeclaration) => {
							let fileDecl: FileDeclaration = {
								path: screenshot.path,
								addressable: true,
								assetType: "Microsoft.VisualStudio.Services.Screenshots." + (++screenshotIndex),
								contentType: screenshot.contentType
							};
							this.addAsset(fileDecl, vsixManifest, packageFiles);
						});
					}
					break;
				case "content":
					Object.keys(value).forEach((key) => {
						let contentKey = _.startCase(key.toLowerCase());
						if (value[key].path) {
							let fileDecl: FileDeclaration = {
								path: value[key].path,
								addressable: true,
								assetType: "Microsoft.VisualStudio.Services.Content." + contentKey,
								partName: value[key].path
							};
							if (value[key].contentType) {
								fileDecl.contentType = value[key].contentType;
							}
							this.addAsset(fileDecl, vsixManifest, packageFiles);
						} else {
							log.warn("Did not find 'path' property for content item '%s'. Ignoring.", key);
						}
					});
					break;
				case "manifestversion":
					let version = value;
					if (_.isString(version)) {
						version = parseFloat(version);
					}
					if (!version) {
						version = 1;
					}
					this.singleValueProperty(vsoManifest, "manifestVersion", version, key, override);
					break;
				case "targets": 
					if (_.isArray(value)) {
						let existingTargets = _.get<any[]>(vsixManifest, "PackageManifest.Installation[0].InstallationTarget", []);
						value.forEach((target: TargetDeclaration) => {
							if (!target.id) {
								return;
							}
							let newTargetAttrs = {
								Id: target.id
							};
							if (target.version) {
								newTargetAttrs["Version"] = target.version;
							}
							existingTargets.push({
								$: newTargetAttrs
							});
						});
					}
					break;
				case "links": 
					if (_.isObject(value)) {
						Object.keys(value).forEach((linkType) => {
							let url = _.get<string>(value, linkType + ".uri") || _.get<string>(value, linkType + ".url");
							if (url) {
								let linkTypeCased = _.capitalize(_.camelCase(linkType));
								this.addProperty(vsixManifest, "Microsoft.VisualStudio.Services.Links." + linkTypeCased, url);
							} else {
								log.warn("'uri' property not found for link: '%s'... ignoring.", linkType);
							}
						});
					}
					break;
				case "branding":
					if (_.isObject(value)) {
						Object.keys(value).forEach((brandingType) => {
							let brandingTypeCased = _.capitalize(_.camelCase(brandingType));
							let brandingValue = value[brandingType];
							if (brandingTypeCased === "Color") {
								try {
									brandingValue = onecolor(brandingValue).hex();
								} catch (e) {
									throw "Could not parse branding color as a valid color. Please use a hex or rgb format, e.g. #00ff00 or rgb(0, 255, 0)";
								}
							}
							this.addProperty(vsixManifest, "Microsoft.VisualStudio.Services.Branding." + brandingTypeCased, brandingValue);
						});
					}
					break;
				case "public": 
					if (typeof value === "boolean") {
						let flags = _.get(vsixManifest, "PackageManifest.Metadata[0].GalleryFlags[0]", "").split(",");
						_.remove(flags, v => v === "");
						if (value === true) {
							flags.push("Public");
						}
						_.set(vsixManifest, "PackageManifest.Metadata[0].GalleryFlags[0]", _.uniq(flags).join(","));
					}
					break;
				case "publisher":
					this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].Identity[0].$.Publisher", value, key, override);
					break;
				case "longdescription":
					this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].ReleaseNotes[0]", value, key, override);
					this.singleValueProperty(vsixManifest, "PackageManifest.Metadata[0].LongDescription[0]", value, key, override);
					break;
				case "scopes":
					if (_.isArray(value)) {
						vsoManifest.scopes = _.uniq(vsoManifest.scopes.concat(value));
					}
					break;
				case "tags":
					this.handleDelimitedList(value, vsixManifest, "PackageManifest.Metadata[0].Tags[0]");
					break;
				case "flags":
				case "vsoflags":
				case "galleryflags":
					// Gallery Flags are space-separated since it's a Flags enum.
					this.handleDelimitedList(value, vsixManifest, "PackageManifest.Metadata[0].GalleryFlags[0]", " ");
					break;
				case "categories":
					this.handleDelimitedList(value, vsixManifest, "PackageManifest.Metadata[0].Categories[0]");
					break;
				case "baseuri":
				case "baseurl":
					this.singleValueProperty(vsoManifest, "baseUri", value, key, override);
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
				case "screenshots": 
					if (_.isArray(value)) {
						var screenshotIndex: any = 1;
						value.forEach((asset: ScreenshotDeclaration) => {
							let assetPath = asset.path.replace(/\\/g, "/");
							if (!packageFiles[assetPath]) {
								packageFiles[assetPath] = {
									partName: assetPath
								};
							}
							if (asset.contentType) {
								packageFiles[assetPath].contentType = asset.contentType;
							}							
							vsixManifest.PackageManifest.Assets[0].Asset.push({
								"$": {
									"Type": "Microsoft.VisualStudio.Services.Screenshots." + (screenshotIndex++),
									"d:Source": "File",
									"Path": assetPath,
									"Addressable": "true"
								}
							});
						});
					}
					break;												
				case "files": 
					if (_.isArray(value)) {
						value.forEach((asset: FileDeclaration) => {
							this.addAsset(asset, vsixManifest, packageFiles);
						});
					}
					break;
				default:
					if (key.substr(0, 2) !== "__") {
						this.singleValueProperty(vsoManifest, key, value, key, override);
					}
					break;
			}
		}
		
		private validateVsixJson(vsixManifest: any): string[] {
			return Object.keys(Merger.vsixValidators).map(path => Merger.vsixValidators[path](_.get(vsixManifest, path))).filter(r => !!r);
		}
	}
	
	/**
	 * Facilitates packaging the vsix and writing it to a file
	 */
	export class VsixWriter {
		private vsoManifest: any;
		private vsixManifest: any;
		private files: PackageFiles;
		private resources: loc.LocPrep.ResourceSet;
		private settings: settings.PackageSettings;
		
		private static VSO_MANIFEST_FILENAME: string = "extension.vsomanifest";
		private static VSIX_MANIFEST_FILENAME: string = "extension.vsixmanifest";
		private static CONTENT_TYPES_FILENAME: string = "[Content_Types].xml";
		public static DEFAULT_XML_BUILDER_SETTINGS: xml.BuilderOptions = {
			indent: "    ",
			newline: os.EOL,
			pretty: true,
			xmldec: {
				encoding: "utf-8",
				standalone: null,
				version: "1.0"
			}
		};
		
		/**
		 * List of known file types to use in the [Content_Types].xml file in the VSIX package.
		 */
		private static CONTENT_TYPE_MAP: {[key: string]: string} = {
			".md": "text/markdown",
			".pdf": "application/pdf",
			".png": "image/png",
			".jpeg": "image/jpeg",
			".jpg": "image/jpeg",
			".gif": "image/gif",
			".bat": "application/bat",
			".json": "application/json",
			".vsixlangpack": "text/xml",
			".vsixmanifest": "text/xml",
			".vsomanifest": "application/json",
			".ps1": "text/ps1"
		};
		
		/**
		 * constructor
		 * @param any vsoManifest JS Object representing a vso manifest
		 * @param any vsixManifest JS Object representing the XML for a vsix manifest
		 */
		constructor(settings: settings.PackageSettings, components: VsixComponents) {
			this.settings = settings;
			this.vsoManifest = components.vsoManifest;
			this.vsixManifest = components.vsixManifest;
			this.files = components.files;
			this.resources = components.resources;
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
				Path: VsixWriter.VSO_MANIFEST_FILENAME,
				Addressable: "true",
				"d:Source": "File"
			}});
			
			log.debug("Manifests finished prepping.");
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
		 * OPC Convention implementation. See
		 * http://www.ecma-international.org/news/TC45_current_work/tc45-2006-335.pdf §10.1.3.2 & §10.2.3
		 */
		public static toZipItemName(partName: string): string {
			if (_.startsWith(partName, "/")) {
				return partName.substr(1);
			} else {
				return partName;
			}
		}
		
		/**
		 * Write a vsix package to the given file name
		 * @param stream.Writable Stream to write the vsix package
		 */
		public writeVsix(): Q.Promise<any> {
			let outputPath = this.getOutputPath(this.settings.outputPath);
			let vsix = new zip();
			let root = this.vsoManifest.__meta_root;
			if (!root) {
				throw "Manifest root unknown. Manifest objects should have a __meta_root key specifying the absolute path to the root of assets.";
			}
			// Add assets to vsix archive
			let overrides: {[partName: string]: PackagePart} = {};
			Object.keys(this.files).forEach((file) => {
				if (_.endsWith(file, VsixWriter.VSO_MANIFEST_FILENAME)) {
					return;
				}
				
				let partName = Merger.cleanAssetPath(this.files[file].partName); 
				let fsPath = path.join(root, file);
				let fContents = null;
				try {
					fContents = fs.readFileSync(fsPath);
				} catch (e) {
					throw "No such file '" + fsPath + "'. Check the location of this file and update the manifest if necessary.";
				}
				vsix.file(VsixWriter.toZipItemName(partName), fContents);
				if (this.files[file].contentType) {
					overrides[partName] = this.files[file];
				}
			});
			
			return this.addResourceStrings(vsix).then(() => {
				vsix.file(VsixWriter.toZipItemName(VsixWriter.VSO_MANIFEST_FILENAME), this.getVsoManifestString(this.resources.vsoResources));
				vsix.file(VsixWriter.toZipItemName(VsixWriter.VSIX_MANIFEST_FILENAME), this.getVsixManifestString());
				
				return this.genContentTypesXml(Object.keys(vsix.files), overrides).then((contentTypesXml) => {
					vsix.file(VsixWriter.toZipItemName(VsixWriter.CONTENT_TYPES_FILENAME), contentTypesXml);
				});
			}).then(() => {
				let builder = new xml.Builder(VsixWriter.DEFAULT_XML_BUILDER_SETTINGS);
				let vsixResourcesXmlStr = builder.buildObject(this.resources.vsixResources);
				let buffer = vsix.generate({
					type: "nodebuffer",
					compression: "DEFLATE"
				});
				log.debug("Writing vsix to: %s", outputPath);
				
				return Q.nfcall(mkdirp, path.dirname(outputPath))
					.then(() => Q.nfcall(fs.writeFile, outputPath, buffer))
					.then(() => outputPath);
			});
		}
		
		private getVsoManifestString(replacements: loc.LocPrep.ResourcesFile): string {
			let eol = os.EOL;
			let defaultVsoManifest = loc.LocPrep.makeReplacements(this.vsoManifest, replacements, this.resources.vsoResources);
			return JSON.stringify(this.removeMetaKeys(defaultVsoManifest), null, 4).replace(/\n/g, eol);
		}
		
		private getVsixManifestString(): string {
			let eol = os.EOL;
			let builder = new xml.Builder(VsixWriter.DEFAULT_XML_BUILDER_SETTINGS);
			return builder.buildObject(this.removeMetaKeys(this.vsixManifest)).replace(/\n/g, eol);
		}
		
		/**
		 * For each folder F under the localization folder (--loc-root),
		 * look for a resources.resjson file within F. If it exists, split the 
		 * resources.resjson file into a vso and vsixmanifest resource file. Add 
		 * each to the vsix archive as F/Extension.resjson and F/Extension.vsixlangpack
		 */
		private addResourceStrings(vsix: zip): Q.Promise<void[]> {
			if (!this.settings.locRoot) {
				return Q.resolve<void[]>(null);
			}
			let stringsPath = path.resolve(this.settings.root, this.settings.locRoot);
			return Q.Promise((resolve, reject, notify) => {
				fs.exists(stringsPath, (exists) => {
					resolve(exists);
				});
			}).then<boolean>((exists) => {
				if (exists) {
					return Q.nfcall(fs.lstat, stringsPath).then((stats: fs.Stats) => {
						if (stats.isDirectory()) {
							return true;
						}
					});
				} else {
					return Q.resolve(false);
				}
			}).then<void[]>((stringsFolderExists) => {
				if (!stringsFolderExists) {
					return Q.resolve<void[]>(null);
				}
				return Q.nfcall(fs.readdir, stringsPath).then((files: string[]) => {
					let promises = <Q.Promise<void>[]>[];
					files.forEach((languageTag) => {
						var filePath = path.join(stringsPath, languageTag);
						let promise = Q.nfcall(fs.lstat, filePath).then((fileStats: fs.Stats) => {
							if (fileStats.isDirectory()) {
								let resourcePath = path.join(filePath, "resources.resjson");
								return Q.Promise<boolean>((resolve, reject, notify) => {
									fs.exists(resourcePath, (exists) => {
										resolve(exists);
									});
								}).then<void>((exists: boolean) => {
									if (exists) {
										return Q.nfcall<string>(fs.readFile, resourcePath, "utf8").then<void>((contents: string) => {
											let resourcesObj = JSON.parse(contents);
											let locGen = new loc.LocPrep.LocKeyGenerator(null, null);
											let splitRes = locGen.splitIntoVsoAndVsixResourceObjs(resourcesObj);
											let locManifestPath = languageTag + "/" + VsixWriter.VSO_MANIFEST_FILENAME;
											vsix.file(VsixWriter.toZipItemName(locManifestPath), this.getVsoManifestString(splitRes.vsoResources));
											this.vsixManifest.PackageManifest.Assets[0].Asset.push({
												"$": {
													Lang: languageTag,
													Type: "Microsoft.VisualStudio.Services.Manifest",
													Path: locManifestPath,
													Addressable: "true",
													"d:Source": "File"
												}
											});
											
											let builder = new xml.Builder(VsixWriter.DEFAULT_XML_BUILDER_SETTINGS);
											let vsixLangPackStr = builder.buildObject(splitRes.vsixResources);
											vsix.file(VsixWriter.toZipItemName(languageTag + "/Extension.vsixlangpack"), vsixLangPackStr);
										});
									} else {
										return Q.resolve<void>(null);
									}
								});
							}
						});
						promises.push(promise);
					});
					return Q.all(promises);
				});
			});
		}
		
		/**
		 * Generates the required [Content_Types].xml file for the vsix package.
		 * This xml contains a <Default> entry for each different file extension
		 * found in the package, mapping it to the appropriate MIME type.
		 */
		private genContentTypesXml(fileNames: string[], overrides: {[partName: string]: PackagePart}): Q.Promise<string> {
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
						overrides[f] = {partName: f, contentType: "application/octet-stream"};
					}
					if (overrides[f]) {
						// If there is an override for this file, ignore its extension
						return "";
					}
					return extName;
				}));
				uniqueExtensions.forEach((ext) => {
					if (!ext.trim()) {
						return;
					}
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
										if (overrides[fileName] && !overrides[fileName].contentType) {
											overrides[fileName].contentType = magicMime;
										}
									}
								} else {
									if (stderr) {
										reject(stderr.toString("utf8"));
									} else {
										log.warn("Could not determine content type for %s. Defaulting to application/octet-stream. To override this, add a contentType property to this file entry in the manifest.", fileName);
										overrides[fileName].contentType = "application/octet-stream";
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
								if (overrides[fileName]) {
									overrides[fileName].contentType = type;
								}
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
							ContentType: overrides[partName].contentType,
							PartName: "/" + _.trimLeft(partName, "/")
						}
					})
				});
				let builder = new xml.Builder(VsixWriter.DEFAULT_XML_BUILDER_SETTINGS);
				return builder.buildObject(contentTypes).replace(/\n/g, os.EOL);
			});
		}
		
		private removeMetaKeys(obj: any): any {
			return _.omit(obj, (v, k) => {
				return _.startsWith(k, "__meta_");
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
}