import * as vscode from 'vscode';
import * as yaml from 'yaml';
import {
    TaskCacheService,
    TaskFetchService,
    type InputValidationResult,
    type Nullable,
    type TaskInfo,
    type TaskInputObjectType
} from '../types';
import { AzurePipelinesTaskDefinition, type TaskInput } from '../types/AzurePipelinesTaskDefinition';
import { AdvancedVisibilityRuleParser } from '../services/AdvancedVisibilityRuleParser';

export default class AzurePipelinesTaskValidator {
    private taskRegistryMap: Map<string, TaskInfo> = new Map();

    constructor(
        private taskCacheService: TaskCacheService,
        private taskFetchService: TaskFetchService,
        private diagnosticCollection: vscode.DiagnosticCollection,
        private readonly extensionSource: string
    ) {}

    async initialize(): Promise<void> {
        const cachedTasks = await this.taskCacheService.getCachedTasks();
        if (cachedTasks) {
            this.taskRegistryMap = cachedTasks;
        }
    }

    async validatePipelineContent(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        // Clear any diagnostics from our extension for this document
        this.clearExtensionDiagnostics(document.uri);

        const diagnostics: vscode.Diagnostic[] = [];
        try {
            const yamlContent = document.getText();
            const parsedYaml = yaml.parse(yamlContent);
            await this.validatePipelineTasks(parsedYaml, diagnostics, document);
        } catch (error) {
            // Create a diagnostic at the start of the document
            const range = new vscode.Range(0, 0, 0, 1);
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Error encountered while parsing ${document.fileName}: ${error}`,
                vscode.DiagnosticSeverity.Error
            ));
            diagnostics[diagnostics.length - 1].source = this.extensionSource;
        }

        // Update the DiagnosticCollection with our diagnostics
        this.diagnosticCollection.set(document.uri, diagnostics);
        return diagnostics;
    }

    private clearExtensionDiagnostics(uri: vscode.Uri): void {
        this.diagnosticCollection.delete(uri);
    }

    private async getTaskInfo(taskName: string): Promise<TaskInfo | undefined> {
        let resultTaskInfo: TaskInfo | undefined = undefined;
        let cachedTask = this.taskRegistryMap.get(taskName);

        if (cachedTask) {
            resultTaskInfo = this.ensureTaskDefinitionIsInstanceOfAzurePipelinesTaskDefinition(cachedTask);
        } else {
            try {
                const dirNameOfTask = taskName.replace("@", "V");
                let taskInfoRetrievedViaHTTP = await this.taskFetchService.fetchTaskInfo(dirNameOfTask);
                if (taskInfoRetrievedViaHTTP) {
                    taskInfoRetrievedViaHTTP =
                        this.ensureTaskDefinitionIsInstanceOfAzurePipelinesTaskDefinition(taskInfoRetrievedViaHTTP);
                    this.taskRegistryMap.set(taskName, taskInfoRetrievedViaHTTP);
                    await this.taskCacheService.saveTasks(this.taskRegistryMap);
                    return taskInfoRetrievedViaHTTP;
                }
            } catch (error) {
                console.error(`Error fetching task info for ${taskName}:`, error);
            }
        }
        return resultTaskInfo;
    }

    private ensureTaskDefinitionIsInstanceOfAzurePipelinesTaskDefinition(taskInfo: TaskInfo) {
        if (!(taskInfo.azurePipelineTaskDefinition instanceof AzurePipelinesTaskDefinition)) {
            taskInfo.azurePipelineTaskDefinition = new AzurePipelinesTaskDefinition(taskInfo.azurePipelineTaskDefinition);
        }
        return taskInfo;
    }

    private async validatePipelineTasks(
        yamlContent: any,
        diagnostics: vscode.Diagnostic[],
        document: vscode.TextDocument
    ) {
        const traverseAndValidate = async (obj: any) => {
            if (typeof obj !== 'object' || obj === null) { return; }
            for (const [key, value] of Object.entries(obj)) {
                if (key === 'task') {
                    const fullTaskName = value as string;
                    const taskInputsInYaml: TaskInputObjectType = obj['inputs'] || {};
                    const taskInfo = await this.getTaskInfo(fullTaskName);
                    if (taskInfo) {
                        for (const requiredInputName of taskInfo.requiredInputsNames) {
                            const validationResult = this.validateRequiredInput(
                                fullTaskName,
                                requiredInputName,
                                taskInputsInYaml,
                                taskInfo.azurePipelineTaskDefinition
                            );
                            if (validationResult) {
                                const lineIndex = this.findLineForTask(document, fullTaskName);
                                if (lineIndex !== -1) {
                                    this.addDiagnostic(diagnostics, lineIndex, validationResult.message, validationResult.severity);
                                }
                            }
                        }
                    }
                    else{
                        const lineIndex = this.findLineForTask(document, fullTaskName);
                        if (lineIndex !== -1) {
                            this.addDiagnostic(diagnostics, lineIndex, `Unknown task: '${fullTaskName}' was not found in the task registry`, vscode.DiagnosticSeverity.Warning);
                        }
                    }
                }
                // Recursively traverse nested objects and arrays
                if (Array.isArray(value)) {
                    for (const item of value) {
                        await traverseAndValidate(item);
                    }
                } else if (typeof value === 'object') {
                    await traverseAndValidate(value);
                }
            }
        };

        await traverseAndValidate(yamlContent);
    }

    private findLineForTask(document: vscode.TextDocument, taskName: string): number {
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text.trim();
            if (line.startsWith('- task:') && line.includes(taskName)) {
                return i;
            }
        }
        return -1;
    }

    private addDiagnostic(
        diags: vscode.Diagnostic[],
        lineIndex: number,
        message: string,
        severity: vscode.DiagnosticSeverity
    ): void {
        const range = new vscode.Range(new vscode.Position(lineIndex, 0), new vscode.Position(lineIndex, 100));
        // Prevent duplicates by checking if the message already exists
        if (!diags.some(d => d.message === message)) {
            const diagnostic: vscode.Diagnostic = new vscode.Diagnostic(range, message, severity);
            diagnostic.source = this.extensionSource;
            diags.push(diagnostic);
        }
    }

    private validateRequiredInput(
        fullTaskName: string,
        requiredInputName: string,
        taskInputsInYaml: TaskInputObjectType,
        taskDefinition: AzurePipelinesTaskDefinition
    ): Nullable<InputValidationResult> {
        let validationResult: Nullable<InputValidationResult> = null;
        if (!taskInputsInYaml[requiredInputName]) {
            const reqPropertyInputDefinition = taskDefinition.getInputDefinition(requiredInputName);
            const visibleRule = reqPropertyInputDefinition?.visibleRule;
            if (visibleRule) {
                const isRuleSatisfied = AdvancedVisibilityRuleParser.evaluate(visibleRule, taskInputsInYaml);
                if (isRuleSatisfied) {
                    validationResult = {
                        message: `Since the rule '${visibleRule}' has been satisfied, the input '${requiredInputName}' is required for task ${fullTaskName}`,
                        severity: vscode.DiagnosticSeverity.Error
                    };
                }
            } else {
                validationResult = {
                    message: `Required input '${requiredInputName}' is missing for task '${fullTaskName}'`,
                    severity: vscode.DiagnosticSeverity.Error
                };
            }
        }
        return validationResult;
    }
}
