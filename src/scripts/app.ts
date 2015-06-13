/// <reference path="../../typings/tsd.d.ts" />

import program = require("commander");
import fs = require("fs");
import package = require("./package");
import Q = require("q");
import zip = require("adm-zip");

program
	.version("0.0.1")
	.usage("command [options]");

program
	.command("package [path]")
	.option("-m, --manifest-pattern", "Specify the pattern for manifest files to join.")
	.action((path: string, command: commander.ICommand) => {
		package.Package.begin(path, command);
	});
	
program	
	.command("publish")
	.option("-s, --publish-settings", "Path to a publish settings file.");
	
program.parse(process.argv);
	
