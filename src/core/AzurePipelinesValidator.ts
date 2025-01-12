import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { TaskCacheService, TaskFetchService } from '../types';

interface TaskInfo {
    fullyQualifiedTaskName: string;
    requiredInputs: string[];
}

export default class AzurePipelinesTaskValidator {
    private taskRegistryMap: Map<string, TaskInfo> = new Map();
    private outputChannel: vscode.OutputChannel;

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
        // First check if task is already in memory
        const cachedTask = this.taskRegistryMap.get(taskName);

        if (cachedTask) {
            return cachedTask;
        }

        // If not in memory, try to fetch it via HTTP
        try {
            const dirNameOfTask = taskName.replace("@", "V");
            const taskInfo = await this.taskFetchService.fetchTaskInfo(dirNameOfTask);

            if (taskInfo) {
                this.taskRegistryMap.set(taskName, taskInfo);
                await this.taskCacheService.saveTasks(this.taskRegistryMap);
                return taskInfo;
            }
        } catch (error) {
            console.error(`Error fetching task info for ${taskName}:`, error);
        }

        return undefined;
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
}
