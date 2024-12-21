import * as vscode from 'vscode';
import * as yaml from 'yaml';
import * as https from 'https';
import * as path from 'path';

interface TaskInfo {
    fullyQualifiedTaskName: string;
    requiredInputs: string[];
}

export default class AzurePipelinesTaskValidator {
    private taskRegistryMap: Map<string, TaskInfo> = new Map();
    private outputChannel: vscode.OutputChannel;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private readonly CACHE_KEY = 'azurePipelinesTaskCache';
    private readonly CACHE_TIMESTAMP_KEY = 'azurePipelinesTaskCacheTimestamp';
    private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Azure Pipelines Task Validator');
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('azure-pipelines');
    }

    private async loadCachedTasks(): Promise<boolean> {
        const cachedTasks = this.context.globalState.get<{ [key: string]: TaskInfo }>(this.CACHE_KEY);
        const cachedTimestamp = this.context.globalState.get<number>(this.CACHE_TIMESTAMP_KEY);

        // Check if cache exists and is not expired
        if (cachedTasks && cachedTimestamp &&
            (Date.now() - cachedTimestamp) < this.CACHE_EXPIRY) {

            // Populate the map from cached data
            Object.entries(cachedTasks).forEach(([key, value]) => {
                this.taskRegistryMap.set(key, value);
            });

            this.outputChannel.appendLine(`Loaded ${Object.keys(cachedTasks).length} tasks from cache`);
            return true;
        }

        return false;
    }

    private async fetchTaskDirectories(): Promise<string[]> {
        const baseUrl = 'https://api.github.com/repos/microsoft/azure-pipelines-tasks/contents/Tasks';

        return new Promise((resolve, reject) => {
            https.get(baseUrl, {
                headers: {
                    'User-Agent': 'VSCode-AzurePipelinesExtension'
                }
            }, (response) => {
                let data = '';
                response.on('data', chunk => { data += chunk; });
                response.on('end', () => {
                    try {
                        const dirs = JSON.parse(data)
                            .filter((item: any) => item.type === 'dir')
                            .map((item: any) => item.name);
                        resolve(dirs);
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', reject);
        });
    }

    private async fetchTaskInfo(taskDir: string): Promise<TaskInfo | undefined> {
        const taskJsonUrl = `https://raw.githubusercontent.com/microsoft/azure-pipelines-tasks/master/Tasks/${taskDir}/task.json`;

        try {
            const taskJson = await this.fetchTaskJson(taskJsonUrl);

            return {
                fullyQualifiedTaskName: `${taskJson.name}@${taskJson.version.Major}`,
                requiredInputs: taskJson.inputs
                    ?.filter((input: any) => input.required)
                    .map((input: any) => input.name) || []
            };
        } catch (error) {
            console.error(`Error fetching task.json for ${taskDir}:`, error);
            return undefined;
        }
    }

    private async fetchTaskJson(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                let data = '';
                response.on('data', chunk => { data += chunk; });
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', reject);
        });
    }

    private async getTaskInfo(taskName: string): Promise<TaskInfo | undefined> {
        // First check if task is already in memory
        const cachedTask = this.taskRegistryMap.get(taskName);
        if (cachedTask) { return cachedTask; }

        // If not in memory, try to fetch it
        try {
            const dirNameOfTask = taskName.replace("@", "V");
            const taskInfo = await this.fetchTaskInfo(dirNameOfTask);
            if (taskInfo) {
                this.taskRegistryMap.set(taskName, taskInfo);
                return taskInfo;
            }
        } catch (error) {
            console.error(`Error fetching task info for ${taskName}:`, error);
        }

        return undefined;
    }

    public async activate(context: vscode.ExtensionContext) {
        // Register validation on file open and save for Azure Pipelines YAML files
        await this.loadCachedTasks();

        const { onDidOpenTextDocument, onDidSaveTextDocument } = vscode.workspace;
        const events = [onDidOpenTextDocument, onDidSaveTextDocument];

        events.forEach(event => {
            context.subscriptions.push(
                event(async document => {
                    if (this.isAzurePipelinesYaml(document)) {
                        await this.validateYamlFile(document);
                    }
                })
            );
        });

        // Validate existing open documents
        vscode.workspace.textDocuments.forEach(async document => {
            if (this.isAzurePipelinesYaml(document)) {
                await this.validateYamlFile(document);
            }
        });
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