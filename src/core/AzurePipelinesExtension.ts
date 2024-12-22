import AzurePipelinesTaskValidator from "./AzurePipelinesValidator";
import * as vscode from 'vscode';
import { VSCodeTaskCacheService } from '../services/VSCodeTaskCacheService';
import { GitHubTaskFetchService } from '../services/GitHubTaskFetchService';

export class AzurePipelinesExtension {
    private validator: AzurePipelinesTaskValidator;
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(context: vscode.ExtensionContext) {
        const cacheService = new VSCodeTaskCacheService(context);
        const fetchService = new GitHubTaskFetchService();
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('azure-pipelines');
        this.validator = new AzurePipelinesTaskValidator(cacheService, fetchService);
    }

    async activate(context: vscode.ExtensionContext) {
        await this.validator.initialize();

        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(this.validateYAMLDocument.bind(this)),
            vscode.workspace.onDidSaveTextDocument(this.validateYAMLDocument.bind(this))
        );

        // Validate existing open documents
        vscode.workspace.textDocuments.forEach(this.validateYAMLDocument.bind(this));
    }

    private async validateYAMLDocument(document: vscode.TextDocument) {
        if (!this.isAzurePipelinesYaml(document)) {
            return;
        }

        // Clear previous diagnostics
        this.diagnosticCollection.delete(document.uri);

        const diagnostics = await this.validator.validatePipelineContent(document);
        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private isAzurePipelinesYaml(document: vscode.TextDocument): boolean {
        return (document.fileName.endsWith('.yml') || document.fileName.endsWith('.yaml'));
    }
}