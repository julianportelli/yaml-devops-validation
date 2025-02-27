import AzurePipelinesTaskValidator from "./AzurePipelinesValidator";
import * as vscode from 'vscode';
import { VSCodeTaskCacheService } from '../services/VSCodeTaskCacheService';
import { GitHubTaskFetchService } from '../services/GitHubTaskFetchService';

export class AzurePipelinesExtension {
    private validator: AzurePipelinesTaskValidator;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private context: vscode.ExtensionContext;
    private static readonly EXTENSION_SOURCE = 'Azure Pipelines Task Validator';

    constructor(context: vscode.ExtensionContext) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection(AzurePipelinesExtension.EXTENSION_SOURCE); 
        this.context = context;
        const cacheService = new VSCodeTaskCacheService(context);
        const fetchService = new GitHubTaskFetchService();
        this.validator = new AzurePipelinesTaskValidator(cacheService, fetchService, this.diagnosticCollection, AzurePipelinesExtension.EXTENSION_SOURCE);
    }

    async activate() {
        await this.validator.initialize();

        // Validate existing open documents
        vscode.workspace.textDocuments.forEach(this.validateYAMLDocument.bind(this));
        
        this.context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(this.validateYAMLDocument.bind(this)),
            vscode.workspace.onDidSaveTextDocument(this.validateYAMLDocument.bind(this))
        );

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
