import * as vscode from 'vscode';
import { VSCodeTaskCacheService } from './services/VSCodeTaskCacheService';
import { GitHubTaskFetchService } from './services/GitHubTaskFetchService';
import AzurePipelinesTaskValidator from './core/AzurePipelinesValidatior';
import { CustomDiagnosticResult } from './types';

export class AzurePipelinesExtension {
    private validator: AzurePipelinesTaskValidator;
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(context: vscode.ExtensionContext) {
        const cacheService = new VSCodeTaskCacheService(context);
        const fetchService = new GitHubTaskFetchService();
        this.validator = new AzurePipelinesTaskValidator(cacheService, fetchService);
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('azure-pipelines');
    }

    async activate(context: vscode.ExtensionContext) {
        await this.validator.initialize();

        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(this.validateDocument.bind(this)),
            vscode.workspace.onDidSaveTextDocument(this.validateDocument.bind(this))
        );

        // Validate existing open documents
        vscode.workspace.textDocuments.forEach(this.validateDocument.bind(this));
    }

    private async validateDocument(document: vscode.TextDocument) {
        if (!this.isAzurePipelinesYaml(document)) {
            return;
        }

        const diagnostics = await this.validator.validatePipelineContent(document.getText());
        this.updateDiagnostics(document.uri, diagnostics);
    }

    private updateDiagnostics(uri: vscode.Uri, results: CustomDiagnosticResult[]) {
        const diagnostics = results.map(result => new vscode.Diagnostic(
            new vscode.Range(result.line, 0, result.line, 100),
            result.message,
            this.mapSeverity(result.severity)
        ));

        this.diagnosticCollection.set(uri, diagnostics);
    }

    private mapSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            default: return vscode.DiagnosticSeverity.Information;
        }
    }

    private isAzurePipelinesYaml(document: vscode.TextDocument): boolean {
        return (document.fileName.endsWith('.yml') || document.fileName.endsWith('.yaml'));
    }
}