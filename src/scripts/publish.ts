/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import chalk = require("chalk");
import errHandler = require("./errorhandler");
import fs= require("fs");
import GalleryClient = require("../lib/VSS/Gallery/RestClient");
import GalleryContracts = require("../lib/VSS/Gallery/Contracts");
import log = require("./logger");
import RestClient = require("../lib/VSS/WebApi/RestClient");
import Q = require("q");
import settings = require("./settings");
import xml2js = require("xml2js");
import zip = require("jszip");

export module Publish {
	
	export interface CoreExtInfo {
		id: string;
		publisher: string;
		version: string;
		published?: boolean;
	}
	
	export class GalleryBase {
		protected settings: settings.PublishSettings;
		protected galleryClient: GalleryClient.GalleryHttpClient;
		private vsixInfoPromise: Q.Promise<CoreExtInfo>;
		
		/**
		 * Constructor
		 * @param PublishSettings
		 */
		constructor(settings: settings.PublishSettings) {
			if (!settings.galleryUrl || !/^https?:\/\//.test(settings.galleryUrl)) {
				throw "Invalid or missing gallery URL.";
			}
			if (!settings.token || !/^[A-z0-9]{52}$/.test(settings.token)) {
				throw "Invalid or missing personal access token.";
			}
			this.settings = settings;
			this.galleryClient = RestClient.VssHttpClient.getClient(GalleryClient.GalleryHttpClient, this.settings.galleryUrl, this.settings.token);
		}
		
		protected getExtInfo(): Q.Promise<CoreExtInfo> {
			if (!this.vsixInfoPromise) {
				if (this.settings.extensionId && this.settings.publisher) {
					this.vsixInfoPromise = Q.resolve({id: this.settings.extensionId, publisher: this.settings.publisher, version: null});
				} else {
					this.vsixInfoPromise = Q.Promise<JSZip>((resolve, reject, notify) => {
						fs.readFile(this.settings.vsixPath, function(err, data) {
							if (err) reject(err);
							log.debug("Read vsix as zip... Size (bytes): %s", data.length.toString());
							try {
								resolve(new zip(data));
							} catch (err) {
								reject(err);
							}
						});
					}).then((zip) => {
						log.debug("Files in the zip: %s", Object.keys(zip.files).join(", "));
						let vsixManifestFileNames = Object.keys(zip.files).filter(key => _.endsWith(key, "vsixmanifest"));
						if (vsixManifestFileNames.length > 0) {
							return Q.nfcall(xml2js.parseString, zip.files[vsixManifestFileNames[0]].asText());
						} else {
							throw "Could not locate vsix manifest!";
						}
					}).then((vsixManifestAsJson) => {
						let extensionId: string = this.settings.extensionId || _.get<string>(vsixManifestAsJson, "PackageManifest.Metadata[0].Identity[0].$.Id");
						let extensionPublisher: string = this.settings.publisher || _.get<string>(vsixManifestAsJson, "PackageManifest.Metadata[0].Identity[0].$.Publisher");
						let extensionVersion: string = _.get<string>(vsixManifestAsJson, "PackageManifest.Metadata[0].Identity[0].$.Version");
						if (extensionId && extensionPublisher) {
							return {id: extensionId, publisher: extensionPublisher, version: extensionVersion};
						} else {
							throw "Could not locate both the extension id and publisher in vsix manfiest! Ensure your manifest includes both a namespace and a publisher property, or specify the necessary --publisher and/or --extension options.";
						}
					});
				} 
			}
			return this.vsixInfoPromise;
		}
	}
	
	/**
	 * Class that handles creating and deleting publishers
	 */
	export class PublisherManager extends GalleryBase {
		
		/**
		 * Constructor
		 * @param PublishSettings
		 */
		constructor(settings: settings.PublishSettings) {
			super(settings);
		}
		
		/**
		 * Create a a publisher with the given name, displayName, and description
		 * @param string Publisher's unique name
		 * @param string Publisher's display name
		 * @param string Publisher description
		 * @return Q.Promise that is resolved when publisher is created
		 */
		public createPublisher(name: string, displayName: string, description: string): Q.Promise<any> {
			return this.galleryClient.createPublisher(<GalleryContracts.Publisher>{
				publisherName: name,
				displayName: displayName,
				longDescription: description,
				shortDescription: description
			}).catch(errHandler.httpErr);
		}
		
		/**
		 * Delete the publisher with the given name
		 * @param string Publisher's unique name
		 * @return Q.promise that is resolved when publisher is deleted
		 */
		public deletePublisher(name: string): Q.Promise<any> {
			return this.galleryClient.deletePublisher(name).catch(errHandler.httpErr);
		}
	}
	
	export class SharingManager extends GalleryBase {
		
		private id: Q.Promise<string>;
		private publisher: Q.Promise<string>;
		
		/**
		 * Constructor
		 * @param PublishSettings
		 */
		constructor(settings: settings.PublishSettings) {
			super(settings);
		}
		
		public shareWith(accounts: string[]): Q.Promise<any> {
			return this.getExtInfo().then((extInfo) => {
				return Q.all(accounts.map((account) => {
					return this.galleryClient.shareExtension(extInfo.publisher, extInfo.id, account).catch(errHandler.httpErr);
				}));
			});
		}
		
		public unshareWith(accounts: string[]): Q.Promise<any> {
			return this.getExtInfo().then((extInfo) => {
				return Q.all(accounts.map((account) => {
					return this.galleryClient.unshareExtension(extInfo.publisher, extInfo.id, account).catch(errHandler.httpErr);
				}));
			});
		}
		
		public unshareWithAll(): Q.Promise<any> {
			return this.getSharedWithAccounts().then((accounts) => {
				return this.unshareWith(accounts);
			});
		}
		
		public getSharedWithAccounts() {
			return this.getExtensionInfo().then((ext) => {
				return ext.allowedAccounts.map(acct => acct.accountName);
			});
		}
		
		public getExtensionInfo(): Q.Promise<GalleryContracts.PublishedExtension> {
			return this.getExtInfo().then((extInfo) => {
				return this.galleryClient.getExtension(
					extInfo.publisher, 
					extInfo.id, 
					null, 
					GalleryContracts.ExtensionQueryFlags.IncludeVersions |
						GalleryContracts.ExtensionQueryFlags.IncludeFiles |
						GalleryContracts.ExtensionQueryFlags.IncludeCategoryAndTags |
						GalleryContracts.ExtensionQueryFlags.IncludeSharedAccounts).then((extension) => {
						
						return extension;
				}).catch(errHandler.httpErr);
			});
		}
	}
	
	export class PackagePublisher extends GalleryBase {
		
		private static validationPending = "__validation_pending";
		private static validated = "__validated";
		private static validationInterval = 1000;
		private static validationRetries = 50;
		
		/**
		 * Constructor
		 * @param PublishSettings settings
		 */
		constructor(settings: settings.PublishSettings) {
			super(settings);
		}
		
		private checkVsixPublished(): Q.Promise<CoreExtInfo> {
			return this.getExtInfo().then((extInfo) => {
				return this.galleryClient.getExtension(extInfo.publisher, extInfo.id).then((ext) => {
					if (ext) {
						extInfo.published = true;
						return extInfo;
					}
					return extInfo;
				}).catch<{id: string, publisher: string, version: string}>(() => {return extInfo;});
			});
		}
		
		/**
		 * Publish the VSIX extension given by vsixPath
		 * @param string path to a VSIX extension to publish
		 * @return Q.Promise that is resolved when publish is complete
		 */
		public publish(): Q.Promise<any> {
			
			let extPackage: GalleryContracts.ExtensionPackage = {
				extensionManifest: fs.readFileSync(this.settings.vsixPath, "base64")
			};
			log.debug("Publishing %s", this.settings.vsixPath);
			
			// Check if the app is already published. If so, call the update endpoint. Otherwise, create.
			log.info("Checking if this extension is already published", 2);
			return this.createOrUpdateExtension(extPackage).then((extInfo) => {
				log.info("Waiting for server to validate extension package...", 1);
				return this.waitForValidation(extInfo.version).then((result) => {
					if (result === PackagePublisher.validated) {
						return "success";
					} else {
						throw "Extension validation failed. Please address the following issues and retry publishing.\n" + result;
					}
				});
			});
		}
		
		private createOrUpdateExtension(extPackage: GalleryContracts.ExtensionPackage): Q.Promise<CoreExtInfo> {
			return this.checkVsixPublished().then((extInfo) => {
				if (extInfo && extInfo.published) {
					log.info("It is, %s the extension", 3, chalk.cyan("update").toString());
					return this.galleryClient.updateExtension(extPackage, extInfo.publisher, extInfo.id).catch(errHandler.httpErr).then((publishedExtension) => {
						return extInfo;
					});
				} else {
					log.info("It isn't, %s a new extension.", 3, chalk.cyan("create").toString());
					return this.galleryClient.createExtension(extPackage).catch(errHandler.httpErr).then((publishedExtension) => {
						return extInfo;
					});
				}
			});
		}
		
		public waitForValidation(version?: string, interval = PackagePublisher.validationInterval, retries = PackagePublisher.validationRetries): Q.Promise<string> {
			if (retries === 0) {
				throw "Validation timed out. There may be a problem validating your extension. Please try again later.";
			} else if (retries === 25) {
				log.info("This is taking longer than usual. Hold tight...", 2);
			}
			log.debug("Polling for validation (%s retries remaining).", retries.toString());
			return Q.delay(this.getValidationStatus(version), interval).then((status) => {
				log.debug("--Retrieved validation status: %s", status);
				if (status === PackagePublisher.validationPending) {
					return this.waitForValidation(version, interval, retries - 1);
				} else {
					return status;
				}
			});
		}
		
		public getValidationStatus(version?: string): Q.Promise<string> {
			return this.getExtInfo().then((extInfo) => {
				return this.galleryClient.getExtension(extInfo.publisher, extInfo.id, extInfo.version, GalleryContracts.ExtensionQueryFlags.IncludeVersions).then((ext) => {
					if (!ext || ext.versions.length === 0) {
						throw "Extension not published.";
					}
					let extVersion = ext.versions[0];
					if (version) {
						extVersion = this.getVersionedExtension(ext, version);
					}
					// If there is a validationResultMessage, validation failed and this is the error
					// If the validated flag is missing and there is no validationResultMessage, validation is pending
					// If the validated flag is present and there is no validationResultMessage, the extension is validated.
					if (extVersion.validationResultMessage) {
						return extVersion.validationResultMessage;
					} else if ((extVersion.flags & GalleryContracts.ExtensionVersionFlags.Validated) === 0) {
						return PackagePublisher.validationPending;
					} else {
						return PackagePublisher.validated;
					}
				});
			});
		}
		
		private getVersionedExtension(extension: GalleryContracts.PublishedExtension, version: string): GalleryContracts.ExtensionVersion {
			let matches = extension.versions.filter(ev => ev.version === version);
			if (matches.length > 0) {
				return matches[0];
			} else {
				return null;
			}
		}
	}
}