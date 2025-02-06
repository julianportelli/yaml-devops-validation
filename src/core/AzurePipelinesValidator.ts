import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { TaskCacheService, TaskFetchService, type Dictionary, type InputValidationResult, type Nullable, type TaskInfo, type TaskInputObjectType } from '../types';
import { AzurePipelinesTaskDefinition, type TaskInput } from '../types/AzurePipelinesTaskDefinition';
import {AdvancedVisibilityRuleParser } from '../services/AdvancedVisibilityRuleParser';

export default class AzurePipelinesTaskValidator {
    private taskRegistryMap: Map<string, TaskInfo> = new Map();
    private outputChannel: vscode.OutputChannel;

    private readonly diagnosticSource = 'Azure Pipelines Task Validator';

    constructor(
        private taskCacheService: TaskCacheService,
        private taskFetchService: TaskFetchService,

    ) {
        this.outputChannel = vscode.window.createOutputChannel('Azure Pipelines Task Validator');
    }

    async initialize(): Promise<void> {
        const cachedTasks = await this.taskCacheService.getCachedTasks();
        if (cachedTasks) {
            this.taskRegistryMap = cachedTasks;
        }
    }

    async validatePipelineContent(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];
        try {
            const yamlContent = document.getText();
            const parsedYaml = yaml.parse(yamlContent);

            await this.validatePipelineTasks(parsedYaml, diagnostics, document);
        } catch (error) {
            // Create diagnostic at the start of the document
            const range = new vscode.Range(0, 0, 0, 1);
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Error encountered while parsing ${document.fileName}: ${error}`,
                vscode.DiagnosticSeverity.Error
            ));
        }

        return diagnostics;
    }

    private async getTaskInfo(taskName: string): Promise<TaskInfo | undefined> {
        var resultTaskInfo : TaskInfo | undefined = undefined;
        
        // First check if task is already in memory
        let cachedTask = this.taskRegistryMap.get(taskName);
        // cachedTask = undefined;

        if (cachedTask) {
            cachedTask = this.ensureTaskDefinitionIsInstanceOfAzurePipelinesTaskDefinition(cachedTask);
            
            resultTaskInfo = cachedTask;
        }
        else{
        // If not in memory, try to fetch it via HTTP
        try {
            const dirNameOfTask = taskName.replace("@", "V");
            let taskInfoRetrievedViaHTTP = await this.taskFetchService.fetchTaskInfo(dirNameOfTask);

            if (taskInfoRetrievedViaHTTP) {
                // Ensure azurePipelineTaskDefinition is an instance of AzurePipelinesTaskDefinition
                taskInfoRetrievedViaHTTP = this.ensureTaskDefinitionIsInstanceOfAzurePipelinesTaskDefinition(taskInfoRetrievedViaHTTP);
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
                    const taskInputsInYaml : TaskInputObjectType  = obj['inputs'] || {};

                    // Fetch task info with lazy loading
                    const taskInfo = await this.getTaskInfo(fullTaskName);

                    if (taskInfo) {
                        // Check for missing required inputs
                        for (const requiredInputName of taskInfo.requiredInputsNames) {
                            const validationResult = this.validateRequiredInput(fullTaskName, requiredInputName, taskInputsInYaml, taskInfo.azurePipelineTaskDefinition);
                            
                            if(validationResult){
                                const lineIndex = this.findLineForTask(document, fullTaskName);
                                
                                this.addDiagnostic(diagnostics, lineIndex, validationResult.message, validationResult.severity);
                            }
                            
                            // if (!taskInputsInYaml[requiredInputName]) {
                            //     // Find the line for this task
                            //     const lineIndex = this.findLineForTask(document, fullTaskName);

                            //     if (lineIndex !== -1) {                                    
                            //         const message = `Required input '${requiredInputName}' is missing for task '${fullTaskName}'`;
                                    
                            //         this.addDiagnostic(diagnostics, lineIndex, message, vscode.DiagnosticSeverity.Error);
                            //     }
                            // }
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
    
    private addDiagnostic(diags: vscode.Diagnostic[], lineIndex: number, message: string, severity: vscode.DiagnosticSeverity){
        const range = new vscode.Range(
            new vscode.Position(lineIndex, 0),
            new vscode.Position(lineIndex, 100)
        );
        
        diags.push({
            range,
            message: message,
            severity: severity,
            source: this.diagnosticSource
        });
    }
    
    
    private validateRequiredInput(fullTaskName:string, requiredInputName: string, taskInputsInYaml : TaskInputObjectType, taskDefinition: AzurePipelinesTaskDefinition) : Nullable<InputValidationResult> {
        var validationResult: Nullable<InputValidationResult> = null;
        
        //If required input is not present in the inputs property in the YAML task defined in the YAML file
        if (!taskInputsInYaml[requiredInputName]){
            //Check if this is actually required by checking the 'visibleRule' property            
            const reqPropertyInputDefinition = taskDefinition.getInputDefinition(requiredInputName);
            
            const visibleRule = reqPropertyInputDefinition?.visibleRule;
            
            if(!!visibleRule){
                //Parse visible rule value
                const isRuleSatisfied = AdvancedVisibilityRuleParser.evaluate(visibleRule, taskInputsInYaml);
                
                if(isRuleSatisfied){
                    validationResult = {
                        message: `Since the rule \'${visibleRule}\' has been satisfied, the input '${requiredInputName}' is required for task ${fullTaskName}`,
                        severity: vscode.DiagnosticSeverity.Error
                    };
                }
            }
            else{
                validationResult = {
                    message: `Required input '${requiredInputName}' is missing for task '${fullTaskName}'`,
                    severity: vscode.DiagnosticSeverity.Error
                };
            }

        }
        
        return validationResult;
    }
}
