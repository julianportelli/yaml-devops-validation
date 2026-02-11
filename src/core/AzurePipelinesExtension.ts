import AzurePipelinesTaskValidator from "./AzurePipelinesValidator";
import * as vscode from "vscode";
import { VSCodeTaskCacheService } from "../services/VSCodeTaskCacheService";
import { GitHubTaskFetchService } from "../services/GitHubTaskFetchService";

export class AzurePipelinesExtension {
	private validator: AzurePipelinesTaskValidator;
	private diagnosticCollection: vscode.DiagnosticCollection;
	private context: vscode.ExtensionContext;
	private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
	private static readonly EXTENSION_SOURCE = "Azure Pipelines Task Validator";
	private static readonly VALIDATION_DELAY_MS = 1000;

	constructor(context: vscode.ExtensionContext) {
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection(
			AzurePipelinesExtension.EXTENSION_SOURCE
		);
		this.context = context;
		const cacheService = new VSCodeTaskCacheService(context);
		const fetchService = new GitHubTaskFetchService();
		this.validator = new AzurePipelinesTaskValidator(
			cacheService,
			fetchService,
			this.diagnosticCollection,
			AzurePipelinesExtension.EXTENSION_SOURCE
		);
	}

	async activate() {
		await this.validator.initialize();

		// Validate existing open documents
		vscode.workspace.textDocuments.forEach(
			this.validateYAMLDocument.bind(this)
		);

		this.context.subscriptions.push(
			vscode.workspace.onDidOpenTextDocument(
				this.validateYAMLDocument.bind(this)
			),
			vscode.workspace.onDidSaveTextDocument(
				this.validateYAMLDocument.bind(this)
			),
			vscode.workspace.onDidCloseTextDocument(
				this.clearDiagnostics.bind(this)
			),
			vscode.workspace.onDidChangeTextDocument(
				this.handleDidChangeTextDocument.bind(this)
			)
		);
	}

	private async validateYAMLDocument(document: vscode.TextDocument) {
		if (!this.isAzurePipelinesYaml(document)) {
			return;
		}

		const diagnostics =
			await this.validator.validatePipelineContent(document);
		this.diagnosticCollection.set(document.uri, diagnostics);
	}

	private clearDiagnostics(document: vscode.TextDocument) {
		if (!this.isAzurePipelinesYaml(document)) {
			return;
		}

		// Clear any pending debounce timer
		const documentKey = document.uri.toString();
		if (this.debounceTimers.has(documentKey)) {
			clearTimeout(this.debounceTimers.get(documentKey));
			this.debounceTimers.delete(documentKey);
		}

		this.diagnosticCollection.delete(document.uri);
	}

	private handleDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
		const document = event.document;
		if (!this.isAzurePipelinesYaml(document)) {
			return;
		}

		// Clear existing timer for this document
		const documentKey = document.uri.toString();
		if (this.debounceTimers.has(documentKey)) {
			clearTimeout(this.debounceTimers.get(documentKey));
		}

		// Set new timer to validate after delay
		const timer = setTimeout(
			() => {
				this.validateYAMLDocument(document);
				this.debounceTimers.delete(documentKey);
			},
			AzurePipelinesExtension.VALIDATION_DELAY_MS
		);

		this.debounceTimers.set(documentKey, timer);
	}

	private isAzurePipelinesYaml(document: vscode.TextDocument): boolean {
		return (
			document.fileName.endsWith(".yml") ||
			document.fileName.endsWith(".yaml")
		);
	}
}
