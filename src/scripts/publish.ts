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
	
	class GalleryBase {
		protected settings: settings.PublishSettings;
		protected galleryClient: GalleryClient.GalleryHttpClient;
		private vsixInfoPromise: Q.Promise<{id: string, publisher: string}>;
		
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
		
		protected getExtensionIdAndPublisher(): Q.Promise<{id: string, publisher: string}> {
			if (!this.vsixInfoPromise) {
				if (this.settings.extensionId && this.settings.publisher) {
					this.vsixInfoPromise = Q.resolve({id: this.settings.extensionId, publisher: this.settings.publisher});
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
						let extensionId: string = _.get<string>(vsixManifestAsJson, "PackageManifest.Metadata[0].Identity[0].$.Id");
						let extensionPublisher: string = _.get<string>(vsixManifestAsJson, "PackageManifest.Metadata[0].Identity[0].$.Publisher");
						if (extensionId && extensionPublisher) {
							return {id: extensionId, publisher: extensionPublisher};
						} else {
							throw "Could not locate both the extension id and publisher in vsix manfiest! Ensure your manifest includes both a namespace and a publisher property.";
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
			return this.getExtensionIdAndPublisher().then((extInfo) => {
				return Q.all(accounts.map((account) => {
					return this.galleryClient.shareExtension(extInfo.publisher, extInfo.id, account).catch(errHandler.httpErr);
				}));
			});
		}
		
		public unshareWith(accounts: string[]): Q.Promise<any> {
			return this.getExtensionIdAndPublisher().then((extInfo) => {
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
			return this.getExtensionIdAndPublisher().then((extInfo) => {
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
		
		/**
		 * Constructor
		 * @param PublishSettings settings
		 */
		constructor(settings: settings.PublishSettings) {
			super(settings);
		}
		
		private checkVsixPublished(vsixPath: string): Q.Promise<{id: string, publisher: string}> {
			return this.getExtensionIdAndPublisher().then((extInfo) => {
				return this.galleryClient.getExtension(extInfo.publisher, extInfo.id).then((ext) => {
					if (ext) {
						return extInfo;
					}
					return null;
				}).catch<{id: string, publisher: string}>(() => {return null;});
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
			return this.checkVsixPublished(this.settings.vsixPath).then((publishedExtInfo) => {
				if (publishedExtInfo) {
					log.info("It is, %s the extension", 3, chalk.cyan("update").toString());
					return this.galleryClient.updateExtension(extPackage, publishedExtInfo.publisher, publishedExtInfo.id).then(() => {
						
					}).catch(errHandler.httpErr);
				} else {
					log.info("It isn't, %s a new extension.", 3, chalk.cyan("create").toString());
					return this.galleryClient.createExtension(extPackage).then(() => {
						
					}).catch<any>(errHandler.httpErr);
				}
			});
		}
	}
}