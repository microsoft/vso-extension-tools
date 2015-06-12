/// <reference path="../../typings/tsd.d.ts" />
var program = require("commander");
var package = require("./package");
program
    .version("0.0.1")
    .usage("command [options]");
program
    .command("package [path]")
    .option("-m, --manifest-pattern", "Specify the pattern for manifest files to join.")
    .action(function (path, command) {
    package.Package.begin(path, command);
});
program
    .command("publish")
    .option("-s, --publish-settings", "Path to a publish settings file.");
program.parse(process.argv);
