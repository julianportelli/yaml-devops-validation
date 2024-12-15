import * as vscode from 'vscode';
import * as yaml from 'yaml';
import * as https from 'https';
import * as path from 'path';

interface TaskInfo {
    fullyQualifiedTaskName: string;
    requiredInputs: string[];
}

export default class AzurePipelinesTaskValidator {
    private taskRegistry: TaskInfo[] = [];
    private outputChannel: vscode.OutputChannel;
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Azure Pipelines Task Validator');
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('azure-pipelines');
    }

    public async initialize() {
        try {
            // Base URL for the Azure Pipelines tasks repository
            const baseUrl = 'https://api.github.com/repos/microsoft/azure-pipelines-tasks/contents/Tasks';

            // Fetch the list of task directories
            const taskDirs = await this.fetchTaskDirectories(baseUrl);

            // Fetch task information for each directory
            for (const taskDir of taskDirs) {
                try {
                    await this.processTaskDirectory(taskDir);
                } catch (error) {
                    console.error(`Error processing task directory ${taskDir}:`, error);
                }
            }

            // Log the loaded tasks
            this.logTaskRegistry();
        } catch (error) {
            vscode.window.showErrorMessage('Failed to initialize Azure Pipelines task validator');
            console.error(error);
        }
    }

    private async fetchTaskDirectories(url: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            https.get(url, {
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

    private async processTaskDirectory(dirName: string): Promise<void> {
        const taskJsonUrl = `https://raw.githubusercontent.com/microsoft/azure-pipelines-tasks/master/Tasks/${dirName}/task.json`;

        try {
            const taskJson = await this.fetchTaskJson(taskJsonUrl);

            // Extract required inputs
            const requiredInputs = taskJson.inputs
                ?.filter((input: any) => input.required)
                .map((input: any) => input.name) || [];

            // Create fully qualified task name
            const fullyQualifiedTaskName = `${taskJson.name}@${taskJson.version.Major}`;

            // Add to task registry
            this.taskRegistry.push({
                fullyQualifiedTaskName,
                requiredInputs
            });
        } catch (error) {
            console.error(`Error fetching task.json for ${dirName}:`, error);
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

    private logTaskRegistry() {
        this.outputChannel.appendLine(`Total tasks loaded: ${this.taskRegistry.length}`);
        this.taskRegistry.forEach(task => {
            this.outputChannel.appendLine(`Task: ${task.fullyQualifiedTaskName}`);
            this.outputChannel.appendLine(`  Required Inputs: ${task.requiredInputs.join(', ')}`);
        });
    }

    public validateYamlFile(document: vscode.TextDocument) {
        // Clear previous diagnostics
        this.diagnosticCollection.delete(document.uri);

        try {
            const yamlContent = document.getText();
            const parsedYaml = yaml.parse(yamlContent);
            const diagnostics: vscode.Diagnostic[] = [];

            this.validatePipelineTasks(parsedYaml, diagnostics, document);

            // Set diagnostics for this document
            this.diagnosticCollection.set(document.uri, diagnostics);
        } catch (error) {
            console.error('Error parsing YAML file:', error);
            vscode.window.showErrorMessage('Error parsing YAML file');
        }
    }

    private validatePipelineTasks(
        yamlContent: any,
        diagnostics: vscode.Diagnostic[],
        document: vscode.TextDocument
    ) {
        const traverseAndValidate = (obj: any) => {
            if (typeof obj !== 'object' || obj === null) { return; }

            for (const [key, value] of Object.entries(obj)) {
                if (key === 'task') {
                    const fullTaskName = value as string;
                    const taskInputs = obj['inputs'] || {};

                    // Find the task in our registry
                    const taskInfo = this.taskRegistry.find(
                        task => task.fullyQualifiedTaskName === fullTaskName
                    );

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
                    value.forEach(item => traverseAndValidate(item));
                } else if (typeof value === 'object') {
                    traverseAndValidate(value);
                }
            }
        };

        traverseAndValidate(yamlContent);
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

    public activate(context: vscode.ExtensionContext) {
        // Initialize task registry
        this.initialize();

        // Register validation on file open and save for Azure Pipelines YAML files
        const { onDidOpenTextDocument, onDidSaveTextDocument, onDidChangeTextDocument } = vscode.workspace;
        const events = [onDidOpenTextDocument, onDidSaveTextDocument];

        events.forEach(event => {
            context.subscriptions.push(
                event(document => {
                    if (this.isAzurePipelinesYaml(document)) {
                        this.validateYamlFile(document);
                    }
                })
            );
        });

        // Validate existing open documents
        vscode.workspace.textDocuments.forEach(document => {
            if (this.isAzurePipelinesYaml(document)) {
                this.validateYamlFile(document);
            }
        });
    }

    private isAzurePipelinesYaml(document: vscode.TextDocument): boolean {
        return (document.fileName.endsWith('.yml') || document.fileName.endsWith('.yaml'));
    }
}