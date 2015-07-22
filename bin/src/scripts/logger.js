/// <reference path="../../typings/tsd.d.ts" />
var _ = require("lodash");
var chalk = require("chalk");
var program = require("commander");
if (!program["nologo"]) {
    console.log("=== Visual Studio Online Extension Tool ===");
}
function error(str) {
    var replacements = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        replacements[_i - 1] = arguments[_i];
    }
    doLog("error", str, chalk.bgRed, replacements, console.error);
}
exports.error = error;
function success(str) {
    var replacements = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        replacements[_i - 1] = arguments[_i];
    }
    doLog("success", str, chalk.green, replacements);
}
exports.success = success;
function warn(str) {
    var replacements = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        replacements[_i - 1] = arguments[_i];
    }
    doLog("warning", str, chalk.bgYellow.black, replacements);
}
exports.warn = warn;
function info(str, level) {
    var replacements = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        replacements[_i - 2] = arguments[_i];
    }
    var logStr;
    switch (level) {
        case 1:
            console.log();
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
exports.info = info;
function debug(str) {
    var replacements = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        replacements[_i - 1] = arguments[_i];
    }
    if (program["debug"]) {
        doLog("debug", str, chalk.gray, replacements);
    }
}
exports.debug = debug;
function doLog(prefix, str, color, replacements, method) {
    if (method === void 0) { method = console.log; }
    var toLog = doReplacements(str, replacements);
    var pre = _.padRight(prefix + ":", 10, " ");
    toLog = toLog.split(/\n|\r\n/).map(function (line) { return pre + line; }).join(require("os").EOL);
    method(color(toLog));
}
function doReplacements(str, replacements) {
    var lcRepl = str.replace(/%S/g, "%s");
    var split = lcRepl.split("%s");
    if (split.length - 1 !== replacements.length) {
        throw "The number of replacements (" + replacements.length + ") does not match the number of placeholders (" + (split.length - 1) + ")";
    }
    var resultArr = [];
    split.forEach(function (piece, index) {
        resultArr.push(piece);
        if (index < split.length - 1) {
            resultArr.push(replacements[index]);
        }
    });
    return resultArr.join("");
}
