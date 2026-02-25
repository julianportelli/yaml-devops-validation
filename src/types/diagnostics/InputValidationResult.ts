import * as vscode from "vscode";

export type InputValidationResult = {
    message: string;
    severity: vscode.DiagnosticSeverity;
};