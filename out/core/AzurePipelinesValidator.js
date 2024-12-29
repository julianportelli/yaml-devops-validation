"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var vscode = require("vscode");
var yaml = require("yaml");
var AzurePipelinesTaskValidator = /** @class */ (function () {
    function AzurePipelinesTaskValidator(taskCacheService, taskFetchService) {
        this.taskCacheService = taskCacheService;
        this.taskFetchService = taskFetchService;
        this.taskRegistryMap = new Map();
        this.outputChannel = vscode.window.createOutputChannel('Azure Pipelines Task Validator');
    }
    AzurePipelinesTaskValidator.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var cachedTasks;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.taskCacheService.getCachedTasks()];
                    case 1:
                        cachedTasks = _a.sent();
                        if (cachedTasks) {
                            this.taskRegistryMap = cachedTasks;
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    AzurePipelinesTaskValidator.prototype.validatePipelineContent = function (document) {
        return __awaiter(this, void 0, void 0, function () {
            var diagnostics, yamlContent, parsedYaml, error_1, range;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        diagnostics = [];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        yamlContent = document.getText();
                        parsedYaml = yaml.parse(yamlContent);
                        //Test code. To remove
                        diagnostics.push({
                            range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10)),
                            message: "Test diagnostic",
                            severity: vscode.DiagnosticSeverity.Error,
                            source: "Test Source"
                        });
                        return [4 /*yield*/, this.validatePipelineTasks(parsedYaml, diagnostics, document)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        range = new vscode.Range(0, 0, 0, 1);
                        diagnostics.push(new vscode.Diagnostic(range, "Error encountered while parsing ".concat(document.fileName, ": ").concat(error_1), vscode.DiagnosticSeverity.Error));
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, diagnostics];
                }
            });
        });
    };
    AzurePipelinesTaskValidator.prototype.getTaskInfo = function (taskName) {
        return __awaiter(this, void 0, void 0, function () {
            var cachedTask, dirNameOfTask, taskInfo, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cachedTask = this.taskRegistryMap.get(taskName);
                        if (cachedTask) {
                            return [2 /*return*/, cachedTask];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        dirNameOfTask = taskName.replace("@", "V");
                        return [4 /*yield*/, this.taskFetchService.fetchTaskInfo(dirNameOfTask)];
                    case 2:
                        taskInfo = _a.sent();
                        if (!taskInfo) return [3 /*break*/, 4];
                        this.taskRegistryMap.set(taskName, taskInfo);
                        return [4 /*yield*/, this.taskCacheService.saveTasks(this.taskRegistryMap)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, taskInfo];
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        error_2 = _a.sent();
                        console.error("Error fetching task info for ".concat(taskName, ":"), error_2);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, undefined];
                }
            });
        });
    };
    AzurePipelinesTaskValidator.prototype.validatePipelineTasks = function (yamlContent, diagnostics, document) {
        return __awaiter(this, void 0, void 0, function () {
            var traverseAndValidate;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        traverseAndValidate = function (obj) { return __awaiter(_this, void 0, void 0, function () {
                            var _i, _a, _b, key, value, fullTaskName, taskInputs, taskInfo, _c, _d, requiredInput, lineIndex, range, _e, value_1, item;
                            return __generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0:
                                        if (typeof obj !== 'object' || obj === null) {
                                            return [2 /*return*/];
                                        }
                                        _i = 0, _a = Object.entries(obj);
                                        _f.label = 1;
                                    case 1:
                                        if (!(_i < _a.length)) return [3 /*break*/, 11];
                                        _b = _a[_i], key = _b[0], value = _b[1];
                                        if (!(key === 'task')) return [3 /*break*/, 3];
                                        fullTaskName = value;
                                        taskInputs = obj['inputs'] || {};
                                        return [4 /*yield*/, this.getTaskInfo(fullTaskName)];
                                    case 2:
                                        taskInfo = _f.sent();
                                        if (taskInfo) {
                                            // Check for missing required inputs
                                            for (_c = 0, _d = taskInfo.requiredInputs; _c < _d.length; _c++) {
                                                requiredInput = _d[_c];
                                                if (!taskInputs[requiredInput]) {
                                                    lineIndex = this.findLineForTask(document, fullTaskName);
                                                    if (lineIndex !== -1) {
                                                        range = new vscode.Range(new vscode.Position(lineIndex, 0), new vscode.Position(lineIndex, 100));
                                                        diagnostics.push({
                                                            range: range,
                                                            message: "Required input '".concat(requiredInput, "' is missing for task '").concat(fullTaskName, "'"),
                                                            severity: vscode.DiagnosticSeverity.Error,
                                                            source: 'Azure Pipelines Task Validator'
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                        _f.label = 3;
                                    case 3:
                                        if (!Array.isArray(value)) return [3 /*break*/, 8];
                                        _e = 0, value_1 = value;
                                        _f.label = 4;
                                    case 4:
                                        if (!(_e < value_1.length)) return [3 /*break*/, 7];
                                        item = value_1[_e];
                                        return [4 /*yield*/, traverseAndValidate(item)];
                                    case 5:
                                        _f.sent();
                                        _f.label = 6;
                                    case 6:
                                        _e++;
                                        return [3 /*break*/, 4];
                                    case 7: return [3 /*break*/, 10];
                                    case 8:
                                        if (!(typeof value === 'object')) return [3 /*break*/, 10];
                                        return [4 /*yield*/, traverseAndValidate(value)];
                                    case 9:
                                        _f.sent();
                                        _f.label = 10;
                                    case 10:
                                        _i++;
                                        return [3 /*break*/, 1];
                                    case 11: return [2 /*return*/];
                                }
                            });
                        }); };
                        return [4 /*yield*/, traverseAndValidate(yamlContent)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AzurePipelinesTaskValidator.prototype.findLineForTask = function (document, taskName) {
        for (var i = 0; i < document.lineCount; i++) {
            var line = document.lineAt(i).text.trim();
            if (line.startsWith('- task:') && line.includes(taskName)) {
                return i;
            }
        }
        return -1;
    };
    return AzurePipelinesTaskValidator;
}());
exports.default = AzurePipelinesTaskValidator;
