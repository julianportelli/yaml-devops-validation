import * as vscode from 'vscode';
import * as yaml from 'yaml';
import * as https from 'https';
import * as path from 'path';
import { CustomDiagnosticResult, TaskCacheService, TaskFetchService } from '../types';

interface TaskInfo {
    fullyQualifiedTaskName: string;
    requiredInputs: string[];
}

export default class AzurePipelinesTaskValidator {
    private taskRegistryMap: Map<string, TaskInfo> = new Map();
    private outputChannel: vscode.OutputChannel;
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(
        private taskCacheService: TaskCacheService,
        private taskFetchService: TaskFetchService

    ) {
        this.outputChannel = vscode.window.createOutputChannel('Azure Pipelines Task Validator');
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('azure-pipelines');
    }

    async initialize(): Promise<void> {
        const cachedTasks = await this.taskCacheService.getCachedTasks();
        if (cachedTasks) {
            this.taskRegistryMap = cachedTasks;
        }
    }

    async validatePipelineContent(yamlContent: string): Promise<CustomDiagnosticResult[]> {
        const diagnostics: CustomDiagnosticResult[] = [];
        // try {
        //     const parsedYaml = yaml.parse(yamlContent);
        //     await this.validatePipelineTasks(parsedYaml, diagnostics);
        // } catch (error) {
        //     diagnostics.push({
        //         line: 0,
        //         message: 'Error parsing YAML file',
        //         severity: 'error'
        //     });
        // }
        return diagnostics;
    }


    private async getTaskInfo(taskName: string): Promise<TaskInfo | undefined> {
        // First check if task is already in memory
        const cachedTask = this.taskRegistryMap.get(taskName);
        if (cachedTask) { return cachedTask; }

        // If not in memory, try to fetch it
        try {
            const dirNameOfTask = taskName.replace("@", "V");
            const taskInfo = await this.taskFetchService.fetchTaskInfo(dirNameOfTask);
            if (taskInfo) {
                this.taskRegistryMap.set(taskName, taskInfo);
                return taskInfo;
            }
        } catch (error) {
            console.error(`Error fetching task info for ${taskName}:`, error);
        }

        return undefined;
    }

    public async validateYamlFile(document: vscode.TextDocument) {
        // Clear previous diagnostics
        this.diagnosticCollection.delete(document.uri);

        try {
            const yamlContent = document.getText();
            const parsedYaml = yaml.parse(yamlContent);
            const diagnostics: vscode.Diagnostic[] = [];

            const promise = await this.validatePipelineTasks(parsedYaml, diagnostics, document)
                .then(() => {

                    diagnostics.push({
                        range: new vscode.Range(
                            new vscode.Position(0, 0),
                            new vscode.Position(0, 10)
                        ),
                        message: "Test diagnostic",
                        severity: vscode.DiagnosticSeverity.Error,
                        source: "Test Source"
                    });
                    console.log("Diagnostics after test:", diagnostics);

                    // Set diagnostics for this document
                    this.diagnosticCollection.set(document.uri, diagnostics);
                });
        } catch (error) {
            console.error('Error parsing YAML file:', error);
            vscode.window.showErrorMessage('Error parsing YAML file');
        }
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
                    const taskInputs = obj['inputs'] || {};

                    // Fetch task info with lazy loading
                    const taskInfo = await this.getTaskInfo(fullTaskName);

                    if (taskInfo) {
                        console.log("Retrieving task info for task named " + fullTaskName);
                        // Check for missing required inputs
                        for (const requiredInput of taskInfo.requiredInputs) {
                            if (!taskInputs[requiredInput]) {
                                // Find the line for this task
                                const lineIndex = this.findLineForTask(document, fullTaskName);

                                if (lineIndex !== -1) {
                                    const range = new vscode.Range(
                                        new vscode.Position(lineIndex, 0),
                                        new vscode.Position(lineIndex, 100)
                                    );

                                    diagnostics.push({
                                        range,
                                        message: `Required input '${requiredInput}' is missing for task '${fullTaskName}'`,
                                        severity: vscode.DiagnosticSeverity.Error,
                                        source: 'Azure Pipelines Task Validator'
                                    });
                                }
                            }
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

    private isAzurePipelinesYaml(document: vscode.TextDocument): boolean {
        return (document.fileName.endsWith('.yml') || document.fileName.endsWith('.yaml'));
    }
}