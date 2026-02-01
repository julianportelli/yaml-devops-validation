import * as vscode from "vscode";
import { AzurePipelinesExtension } from "./core/AzurePipelinesExtension";

export function activate(context: vscode.ExtensionContext) {
	const extension = new AzurePipelinesExtension(context);
	return extension.activate();
}

export function deactivate() {}
