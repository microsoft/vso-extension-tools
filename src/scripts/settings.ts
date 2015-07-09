/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import fs = require("fs");
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
}
export interface CommandLineOptions {
	root?: string;
	manifestGlob?: string;
	outputPath?: string;
	token?: string;
	galleryUrl?: string;
	vsix?: string;
	publisher?: string;
	extension?: string;
	settings?: string;
	forceOverwrite?: boolean;
	overrides?: any;
	shareWith?: string;
	unshareWith?: string;
}


export function resolveSettings(options: CommandLineOptions, defaults?: AppSettings): Q.Promise<AppSettings> {
	let passedOptions = <AppSettings>{};
	let settingsPath: string = path.resolve("settings.vset.json");
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
	if (options.settings) {
		settingsPath = options.settings;
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
	if (options.publisher) {
		_.set(passedOptions, "publish.publisher", options.publisher);
	}
	if (options.extension) {
		_.set(passedOptions, "publish.extensionId", options.extension);
	}
	if (options.shareWith) {
		_.set(passedOptions, "publish.shareWith", options.shareWith.split(/,|;/));
	}
	if (options.unshareWith) {
		_.set(passedOptions, "publish.shareWith", options.unshareWith.split(/,|;/));
	}
	
	// Parse any overrides passed in as a command line option.
	// Using this pattern to prevent commander from auto-documenting this feature.
	let parsedOverrides: any, args = process.argv.slice(2);
	for (let i = 0; i < args.length; ++i) {
		let arg = args[i];
		if (arg === "--override") {
			if (args[i+1]) {
				try {
					parsedOverrides = JSON.parse(args[i+1]); // Can't use let here without ES6
					_.set(passedOptions, "package.overrides", parsedOverrides);
				} catch(e) {
					
				}
			}
			break;
		}
	}
	return Q.Promise<AppSettings>((resolve, reject, notify) => {
		try {
			if (settingsPath) {
				resolve(parseSettingsFile(settingsPath).then<AppSettings>((settings: AppSettings) => {
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
			return settings;
		});
	});
}

function parseSettingsFile(settingsPath: string): Q.Promise<AppSettings> {
	return Q.Promise<AppSettings>((resolve, reject, notify) => {
		try {
			if (fs.existsSync(settingsPath)) {
				resolve(JSON.parse(fs.readFileSync(settingsPath, "utf8").replace(/^\uFEFF/, "")));
			} else {
				resolve({});
			}
		} catch (err) {
			reject(err);
		}
	});
}