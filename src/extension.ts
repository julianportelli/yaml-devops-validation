import * as vscode from 'vscode';
import AzurePipelinesValidator from './BusinessLogic/AzurePipelinesValidatior';

export function activate(context: vscode.ExtensionContext) {
	const validator = new AzurePipelinesValidator(context);
	validator.activate(context);
}

export function deactivate() { }