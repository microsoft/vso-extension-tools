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
}
export interface PackageSettings {
	root: string;
	manifestGlobs: string[];
	outputPath: string;
}
export interface CommandLineOptions {
	root?: string;
	manifestGlob?: string;
	outputPath?: string;
	vsix?: string;
	settings?: string;
}


export function resolveSettings(options: CommandLineOptions, defaults?: AppSettings): Q.Promise<AppSettings> {
		let passedOptions = <AppSettings>{};
		let settingsPath: string = path.resolve("settings.json");
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
		if (options.vsix) {
			_.set(passedOptions, "publish.vsixPath", options.vsix);
		}
		return Q.Promise<AppSettings>((resolve, reject, notify) => {
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
		}).then((settings) => {
			if (!_.get(settings, "publish.vsixPath") && settings.package) {
				_.set(settings, "publish.vsixPath", _.get(settings, "package.outputPath"));
			} else if (_.get(settings, "publish.vsixPath") && _.get(program, "args[0]._name", "") === "publish") {
				settings.package = null;
			}
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
				if (_.get<string>(settings, "package.outputPath", "").indexOf("{tmp}") === 0) {
					outPathPromise = Q.Promise<string>((resolve, reject, notify) => {
						tmp.dir({unsafeCleanup: true}, (err, tmpPath, cleanupCallback) => {
							if (err) {
								reject(err);
							}
							resolve(settings.package["outPath"].replace("{tmp}", tmpPath));
						});
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
				return settings;
			});
		});
	}
	
	function parseSettingsFile(settingsPath: string): Q.Promise<AppSettings> {
		return Q.Promise<AppSettings>((resolve, reject, notify) => {
			if (fs.existsSync(settingsPath)) {
				resolve(JSON.parse(fs.readFileSync(settingsPath, "utf8")));
			} else {
				resolve({});
			}
		});
	}