/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import fs = require("fs");
import log = require("./logger");
import Q = require("q");
import path = require("path");
import program = require("commander");
import tmp = require("tmp");

export interface AppSettings {
	publish?: PublishSettings;
	package?: PackageSettings;
}
export interface PublishSettings {
	galleryUrl: string;
	token: string;
	vsixPath: string;
	publisher: string;
	extensionId: string;
	shareWith: string[];
}
export interface PackageSettings {
	root: string;
	manifestGlobs: string[];
	outputPath: string;
	overrides: any;
	locRoot: string;
}
export interface CommandLineOptions {
	root?: string;
	manifestGlob?: string;
	outputPath?: string;
	token?: string;
	galleryUrl?: string;
	vsix?: string;
	settings?: string;
	forceOverwrite?: boolean;
	override?: string;
	shareWith?: string;
	unshareWith?: string;
	publisher?: string;
	extension?: string;
	locRoot?: string;
	writeResjson?: string;
}


export function resolveSettings(options: CommandLineOptions, defaults?: AppSettings): Q.Promise<AppSettings> {
	let passedOptions = <AppSettings>{package: <PackageSettings>{}, publish: <PublishSettings>{}};
	let settingsPath: string = path.resolve("settings.vset.json");
	let customSettings = false;
	let defaultSettings = defaults || {};
	if (options.manifestGlob) {
		_.set(passedOptions, "package.manifestGlobs", [options.manifestGlob]);
	}
	if (options.outputPath) {
		_.set(passedOptions, "package.outputPath", options.outputPath);
	}
	if (options.root) {
		_.set(passedOptions, "package.root", options.root);
	}
	if (options.writeResjson) {
		_.set(passedOptions, "package.resjsonPath", options.writeResjson);
	}
	if (options.locRoot) {
		_.set(passedOptions, "package.locRoot", options.locRoot);
	}
	if (options.settings) {
		settingsPath = options.settings;
		customSettings = true;
	}
	if (options.galleryUrl) {
		_.set(passedOptions, "publish.galleryUrl", options.galleryUrl);
	}
	if (options.token) {
		_.set(passedOptions, "publish.token", options.token);
	}
	if (options.vsix) {
		_.set(passedOptions, "publish.vsixPath", options.vsix);
	}
	if (options.shareWith) {
		_.set(passedOptions, "publish.shareWith", options.shareWith.split(/,|;/));
	}
	if (options.unshareWith) {
		_.set(passedOptions, "publish.shareWith", options.unshareWith.split(/,|;/));
	}
	if (options.publisher) {
		_.set(passedOptions, "publish.publisher", options.publisher);
	}
	if (options.extension) {
		_.set(passedOptions, "publish.extensionId", options.extension);
	}
	if (options.override) {
		try {
			_.set(passedOptions, "package.overrides", JSON.parse(options.override));
		} catch(e) {
			log.warn("Could not parse override JSON.");
			log.info(options.override, 2);
		}
	}
	if (!passedOptions.package.overrides) {
		passedOptions.package.overrides = {};
	}
	if (options.publisher) {
		passedOptions.package.overrides.publisher = options.publisher;
	}
	if (options.extension) {
		passedOptions.package.overrides.extensionId = options.extension;
	}
	return saveCliOptions(passedOptions, settingsPath).then(() => {
		return Q.Promise<AppSettings>((resolve, reject, notify) => {
			try {
				if (settingsPath) {
					resolve(parseSettingsFile(settingsPath, !customSettings).then<AppSettings>((settings: AppSettings) => {
						return _.merge<
							any, 
							AppSettings,
							AppSettings, 
							AppSettings, 
							AppSettings, 
							any, 
							any>(<AppSettings>{}, defaultSettings, settings, passedOptions);
					}));
				} else {
					resolve(_.merge<
						any, 
						AppSettings, 
						AppSettings, 
						AppSettings, 
						any, 
						any>(<AppSettings>{}, defaultSettings, passedOptions));
				}
			} catch (err) {
				reject(err);
			}
		}).then((settings) => {
			if (_.get(settings, "package.manifestGlobs")) {
				if (_.isString(settings.package.manifestGlobs)) {
					settings.package.manifestGlobs = [<any>settings.package.manifestGlobs];
				}
				if (settings.package.root) {
					settings.package.root = path.resolve(settings.package.root);
					settings.package.manifestGlobs = settings.package.manifestGlobs.map(glob => path.join(settings.package.root, glob));
				}
			}
			// Replace {tmp} at beginning of outPath with a temporary directory path
			let outPathPromise: Q.Promise<string>;
			if (settings.package) {
				if (_.get<string>(settings, "package.outputPath", "") === "{tmp}") {
					outPathPromise = Q.Promise<string>((resolve, reject, notify) => {
						try {
							tmp.dir({unsafeCleanup: true}, (err, tmpPath, cleanupCallback) => {
								if (err) {
									reject(err);
								}
								resolve(path.join(tmpPath, "extension.vsix"));
							});
						} catch (err) {
							reject(err);
						}
					})
				} else {
					outPathPromise = Q.resolve<string>(settings.package["outputPath"]);
				}
			} else {
				outPathPromise = Q.resolve<string>(null);
			}
			return outPathPromise.then((outPath) => {
				if (outPath) {
					settings.package.outputPath = outPath;	
				}
				if (!_.get(settings, "publish.vsixPath") && settings.package) {
					_.set(settings, "publish.vsixPath", _.get(settings, "package.outputPath"));
				} else if (_.get(settings, "publish.vsixPath") && _.get(program, "args[0]._name", "") === "publish") {
					settings.package = null;
				}
				log.debug("Parsed settings: %s", JSON.stringify(settings, null, 4));
				return settings;
			});
		});
	});
}

function saveCliOptions(cliOptions: AppSettings, settingsPath: string): Q.Promise<any> {
	if (program["save"]) {
		log.info("Saving CLI options to %s.", 1, settingsPath);
		return Q.Promise((resolve, reject, notify) => {
			try {
				fs.exists(settingsPath, (exists: boolean) => {
					resolve(exists);
				});
			} catch (err) {
				reject(err);
			}
		}).then((exists: boolean) => {
			if (exists) {
				log.info("Settings file exists. Merging settings.", 2);
				return Q.nfcall<string>(fs.readFile, settingsPath, "utf8").then(content => content.replace(/^\uFEFF/, ""));
			} else {
				log.info("Settings file does not exist. Writing file.", 2);
				return "{}";
			}
		}).then((settingsStr: string) => {
			let settings = JSON.parse(settingsStr);
			_.merge(settings, cliOptions);
			if (Object.keys(settings).length > 0) {
				let fileContents = JSON.stringify(settings, null, 4);
				log.debug("Content: %s", fileContents);
				return Q.nfcall(fs.writeFile, settingsPath, fileContents, "utf8");
			} else {
				return;
			}
		});
	} else {
		return Q.resolve(null);
	}
}

function parseSettingsFile(settingsPath: string, noWarn: boolean): Q.Promise<AppSettings> {
	return Q.Promise<AppSettings>((resolve, reject, notify) => {
		try {
			if (fs.existsSync(settingsPath)) {
				let settingsStr = fs.readFileSync(settingsPath, "utf8").replace(/^\uFEFF/, "");
				let settingsJSON;
				try {
					resolve(JSON.parse(settingsStr)) 
				} catch (err) {
					log.warn("Could not parse settings file as JSON. No settings were read from %s.", settingsPath);
					resolve({});
				}
			} else {
				if (!program["save"]) {
					if (!noWarn) {
						log.warn("No settings file found at %s.", settingsPath);
					}
				}
				resolve({});
			}
		} catch (err) {
			reject(err);
		}
	});
}