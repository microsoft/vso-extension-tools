/// <reference path="../../typings/tsd.d.ts" />
var chalk = require("chalk");
var Package;
(function (Package) {
    function begin(path, command) {
        console.log(chalk.blue.bgRed("test"));
    }
    Package.begin = begin;
    var MyClass = (function () {
        function MyClass() {
        }
        return MyClass;
    })();
    Package.MyClass = MyClass;
})(Package = exports.Package || (exports.Package = {}));
