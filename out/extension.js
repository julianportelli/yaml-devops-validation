"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
var AzurePipelinesExtension_1 = require("./core/AzurePipelinesExtension");
function activate(context) {
    var extension = new AzurePipelinesExtension_1.AzurePipelinesExtension(context);
    return extension.activate(context);
}
function deactivate() { }
