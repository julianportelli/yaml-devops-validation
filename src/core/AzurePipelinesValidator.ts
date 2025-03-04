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
        private readonly taskCacheService: TaskCacheService,
        private readonly taskFetchService: TaskFetchService,
        private readonly diagnosticCollection: vscode.DiagnosticCollection,
        private readonly extensionSource: string
    ) {}

    async initialize(): Promise<void> {
        const cachedTasks = await this.taskCacheService.getCachedTasks();
        if (cachedTasks) {
            this.taskRegistryMap = cachedTasks;
        }
    }

    async validatePipelineContent(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        this.diagnosticCollection.delete(document.uri);
        
        const diagnostics: vscode.Diagnostic[] = [];
        try {
            const parsedYaml = yaml.parse(document.getText());
            await this.validatePipelineTasks(parsedYaml, diagnostics, document);
        } catch (error) {
            this.addDocumentDiagnostic(
                diagnostics, 
                0, 
                `Error encountered while parsing ${document.fileName}: ${error}`,
                vscode.DiagnosticSeverity.Error
            );
        }

        this.diagnosticCollection.set(document.uri, diagnostics);
        return diagnostics;
    }

    private async getTaskInfo(taskName: string): Promise<TaskInfo | undefined> {
        // Check cache first
        let cachedTask = this.taskRegistryMap.get(taskName);
        if (cachedTask) {
            return this.normalizeTaskDefinition(cachedTask);
        }
        
        // Fetch from service if not in cache
        try {
            const dirNameOfTask = taskName.replace("@", "V");
            const taskInfo = await this.taskFetchService.fetchTaskInfo(dirNameOfTask);
            
            if (taskInfo) {
                const normalizedTask = this.normalizeTaskDefinition(taskInfo);
                this.taskRegistryMap.set(taskName, normalizedTask);
                await this.taskCacheService.saveTasks(this.taskRegistryMap);
                return normalizedTask;
            }
        } catch (error) {
            console.error(`Error fetching task info for ${taskName}:`, error);
        }
        
        return undefined;
    }

    private normalizeTaskDefinition(taskInfo: TaskInfo): TaskInfo {
        if (!(taskInfo.azurePipelineTaskDefinition instanceof AzurePipelinesTaskDefinition)) {
            taskInfo.azurePipelineTaskDefinition = new AzurePipelinesTaskDefinition(taskInfo.azurePipelineTaskDefinition);
        }
        return taskInfo;
    }

    private async validatePipelineTasks(
        yamlContent: any,
        diagnostics: vscode.Diagnostic[],
        document: vscode.TextDocument
    ): Promise<void> {
        const processNode = async (obj: any, path: string[] = []): Promise<void> => {
            if (!obj || typeof obj !== 'object') {
                return;
            }
            
            // Check if current object is a task
            if (obj.task) {
                await this.validateTask(obj, diagnostics, document);
            }
            
            // Process arrays
            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) {
                    await processNode(obj[i], [...path, i.toString()]);
                }
                return;
            }
            
            // Process object properties
            for (const key of Object.keys(obj)) {
                await processNode(obj[key], [...path, key]);
            }
        };
        
        await processNode(yamlContent);
    }
    
    private async validateTask(
        taskObj: any, 
        diagnostics: vscode.Diagnostic[], 
        document: vscode.TextDocument
    ): Promise<void> {
        const fullTaskName = taskObj.task;
        const taskInputsInYaml: TaskInputObjectType = taskObj.inputs || {};
        const lineIndex = this.findTaskLineInDocument(document, fullTaskName);
        
        if (lineIndex === -1) {
            return;
        }
        
        const taskInfo = await this.getTaskInfo(fullTaskName);
        
        if (!taskInfo) {
            this.addDiagnostic(
                diagnostics,
                lineIndex,
                `Unknown task: '${fullTaskName}' was not found in the task registry`,
                vscode.DiagnosticSeverity.Warning
            );
            return;
        }
        
        // Validate required inputs
        for (const requiredInputName of taskInfo.requiredInputsNames) {
            const validationResult = this.validateRequiredInput(
                fullTaskName,
                requiredInputName,
                taskInputsInYaml,
                taskInfo.azurePipelineTaskDefinition
            );
            
            if (validationResult) {
                this.addDiagnostic(
                    diagnostics,
                    lineIndex,
                    validationResult.message,
                    validationResult.severity
                );
            }
        }
    }

    private findTaskLineInDocument(document: vscode.TextDocument, taskName: string): number {
        const taskPattern = new RegExp(`- task:.*${taskName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
        
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            if (taskPattern.test(line)) {
                return i;
            }
        }
        
        return -1;
    }

    private addDocumentDiagnostic(
        diagnostics: vscode.Diagnostic[],
        lineIndex: number,
        message: string,
        severity: vscode.DiagnosticSeverity
    ): void {
        const range = new vscode.Range(lineIndex, 0, lineIndex, 1);
        const diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.source = this.extensionSource;
        diagnostics.push(diagnostic);
    }

    private addDiagnostic(
        diagnostics: vscode.Diagnostic[],
        lineIndex: number,
        message: string,
        severity: vscode.DiagnosticSeverity
    ): void {
        // Avoid adding duplicate diagnostics for the same line and message
        const range = new vscode.Range(lineIndex, 0, lineIndex, 100);
        
        const isDuplicate = diagnostics.some(d => 
            d.range.start.line === lineIndex && 
            d.message === message
        );
        
        if (!isDuplicate) {
            const diagnostic = new vscode.Diagnostic(range, message, severity);
            diagnostic.source = this.extensionSource;
            diagnostics.push(diagnostic);
        }
    }

    private validateRequiredInput(
        fullTaskName: string,
        requiredInputName: string,
        taskInputsInYaml: TaskInputObjectType,
        taskDefinition: AzurePipelinesTaskDefinition
    ): Nullable<InputValidationResult> {
        // Skip validation if input is provided
        if (taskInputsInYaml[requiredInputName]) {
            return null;
        }
        
        const inputDefinition = taskDefinition.getInputDefinition(requiredInputName);
        const visibleRule = inputDefinition?.visibleRule;
        
        if (visibleRule && AdvancedVisibilityRuleParser.evaluate(visibleRule, taskInputsInYaml)) {
            return {
                message: `Since the rule '${visibleRule}' has been satisfied, the input '${requiredInputName}' is now required for task ${fullTaskName}`,
                severity: vscode.DiagnosticSeverity.Error
            };
        } else if (!visibleRule) {
            return {
                message: `Required input '${requiredInputName}' is missing for task '${fullTaskName}'`,
                severity: vscode.DiagnosticSeverity.Error
            };
        }
        
        return null;
    }
}
