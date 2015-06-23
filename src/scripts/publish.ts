/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import errHandler = require("./errorhandler");
import fs= require("fs");
import GalleryClient = require("../lib/VSS/Gallery/RestClient");
import GalleryContracts = require("../lib/VSS/Gallery/Contracts");
import RestClient = require("../lib/VSS/WebApi/RestClient");
import Q = require("q");
import xml2js = require("xml2js");
import zip = require("jszip");

export module Publish {
	
	class GalleryBase {
		protected token: string;
		protected galleryUrl: string;
		protected galleryClient: GalleryClient.GalleryHttpClient;
		
		/**
		 * Constructor
		 * @param string baseUrl of the Gallery
		 * @param string personal access token with all accounts and all scopes access
		 */
		constructor(baseUrl: string, token: string) {
			this.galleryUrl = baseUrl;
			this.token = token;
			this.galleryClient = RestClient.VssHttpClient.getClient(GalleryClient.GalleryHttpClient, this.galleryUrl, this.token);
		}
	}
	
	/**
	 * Class that handles creating and deleting publishers
	 */
	export class PublisherManager extends GalleryBase {
		
		/**
		 * Constructor
		 * @param string baseUrl of the Gallery
		 * @param string personal access token with all accounts and all scopes access
		 */
		constructor(baseUrl: string, token: string) {
			super(baseUrl, token);
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
			}).catch(errHandler.err);
		}
		
		/**
		 * Delete the publisher with the given name
		 * @param string Publisher's unique name
		 * @return Q.promise that is resolved when publisher is deleted
		 */
		public deletePublisher(name: string): Q.Promise<any> {
			return this.galleryClient.deletePublisher(name).catch(errHandler.err);
		}
	}
	
	export class PackagePublisher extends GalleryBase {
		
		/**
		 * Constructor
		 * @param string baseUrl of the Gallery
		 * @param string personal access token with all accounts and all scopes access
		 */
		constructor(baseUrl: string, token: string) {
			super(baseUrl, token);
		}
		
		private getExtensionIdAndPublisher(vsixPath: string): Q.Promise<{id: string, publisher: string}> {
			return Q.Promise<JSZip>((resolve, reject, notify) => {
				fs.readFile(vsixPath, function(err, data) {
					if (err) reject(err);
					console.log("Read vsix as zip... Size (bytes): " + data.length);
					resolve (new zip(data));
				});
			}).then((zip) => {
				console.log("Files in the zip: " + Object.keys(zip.files).join(", "));
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
		
		private checkVsixPublished(vsixPath: string): Q.Promise<{id: string, publisher: string}> {
			return this.getExtensionIdAndPublisher(vsixPath).then((extInfo) => {
				return this.galleryClient.getExtension(extInfo.publisher, extInfo.id).then((ext) => {
					if (ext) {
						return extInfo;
					}
					return null;
				}).catch<{id: string, publisher: string}>(errHandler.err);
			});
		}
		
		/**
		 * Publish the VSIX extension given by vsixPath
		 * @param string path to a VSIX extension to publish
		 * @return Q.Promise that is resolved when publish is complete
		 */
		public publish(vsixPath: string): Q.Promise<any> {
			
			let extPackage: GalleryContracts.ExtensionPackage = {
				extensionManifest: fs.readFileSync(vsixPath, "base64")
			};
			console.log("Begin publish for vsix at " + vsixPath);
			
			// Check if the app is already published. If so, call the update endpoint. Otherwise, create.
			console.log("Checking if this extension is already published...");
			return this.checkVsixPublished(vsixPath).then((publishedExtInfo) => {
				if (publishedExtInfo) {
					console.log("It is, update the extension");
					return this.galleryClient.updateExtension(extPackage, publishedExtInfo.publisher, publishedExtInfo.id).then(() => {
						
					}).catch(errHandler.err);
				} else {
					console.log("It isn't, create a new extension.");
					return this.galleryClient.createExtension(extPackage).then(() => {
						
					}).catch<any>(errHandler.err);
				}
			});
		}
	}
}