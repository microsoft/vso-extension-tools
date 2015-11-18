/// <reference path="../../typings/tsd.d.ts" />

import _ = require("lodash");
import chalk = require("chalk");
import program = require("commander");

// Log the header.
if (!program["nologo"]) {
	console.log();
	warn("This tool is deprecated. Please switch to TFX-CLI. See http://npmjs.com/package/vset for more info.");
	console.log();
	console.log("=== Visual Studio Online Extension Tool ===");
}

export function error(str: string, ...replacements: string[]): void {
	doLog("error", str, chalk.bgRed, replacements, console.error);
}

export function success(str: string, ...replacements: string[]): void {
	doLog("success", str, chalk.green, replacements);
}

export function warn(str: string, ...replacements: string[]): void {
	doLog("warning", str, chalk.bgYellow.black, replacements);
}

export function info(str: string, level: number, ...replacements: string[]): void {
	let logStr;
	switch (level) {
		case 1:
			console.log(); // empty line before a strong message
			logStr = chalk.cyan(str);
			break;
		case 2: 
			logStr = "- " + str;
			break;
		case 3: 
			logStr = "-- " + str;
			break;
		default:
			logStr = str;
	}
	doLog("info", logStr, chalk.white, replacements);
}

export function debug(str: string, ...replacements: string[]): void {
	if (program["debug"]) {
		doLog("debug", str, chalk.gray, replacements);
	}
}

function doLog(prefix: string, str: string, color: Chalk.ChalkChain, replacements: string[], method = console.log): void {
	let toLog = doReplacements(str, replacements);
	let pre = _.padRight(prefix + ":", 10, " ");
	toLog = toLog.split(/\n|\r\n/).map(line => pre + line).join(require("os").EOL);
	method(color(toLog));
}

function doReplacements(str: string, replacements: string[]): string {
	let lcRepl = str.replace(/%S/g, "%s");
	let split = lcRepl.split("%s");
	if (split.length - 1 !== replacements.length) {
		throw "The number of replacements (" + replacements.length + ") does not match the number of placeholders (" + (split.length - 1) + ")";
	}
	
	let resultArr = [];
	split.forEach((piece, index) => {
		resultArr.push(piece);
		if (index < split.length - 1) {
			resultArr.push(replacements[index]);
		}
	});
	return resultArr.join("");
}