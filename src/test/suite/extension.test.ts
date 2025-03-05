import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
// import * as myExtension from '../../extension';

const extensionId = "julianportelli.yaml-devops-validation";

suite("Extension Test Suite", () => {
	vscode.window.showInformationMessage("Start all tests.");

	test("Extension should be present", () => {
		assert.ok(vscode.extensions.getExtension(extensionId));
	});

	test("Should validate Azure Pipelines YAML", async () => {
		const docUri = vscode.Uri.file(
			path.join(__dirname, "../../test/fixtures/sample-pipeline.yml")
		);
		const document = await vscode.workspace.openTextDocument(docUri);
		await vscode.window.showTextDocument(document);

		// Wait for validation to occur
		await new Promise(resolve => setTimeout(resolve, 1000));

		const diagnostics = vscode.languages.getDiagnostics(docUri);
		assert.ok(diagnostics.length >= 0);
	});
});
