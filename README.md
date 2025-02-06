# Azure Pipelines YAML Task Validator

## Description

A Visual Studio code extension that analyzes Azure Pipelines YAML files and validates task requirements and conditions.

## Features

- Validates Azure Pipelines YAML files.
- Checks for required task inputs and conditions.
- Provides diagnostics and error messages for missing or incorrect task inputs.

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/your-username/azure-pipelines-yaml-task-validator.git
    ```
2. Navigate to the project directory:
    ```sh
    cd azure-pipelines-yaml-task-validator
    ```
3. Install dependencies using `pnpm`:
    ```sh
    pnpm install
    ```

## Usage
**NOTICE**: This extension has not yet been published to the Visual Studio marketplace. Therefore you will not find this extension if you search for it in VS Code's `Extensions` tab.
<br/>
If you wish to use this extension on your copy of VS Code, you will need to package the extension, which will produce a `.vsix` file which allows this extension to be installed.
To do this simply follow the steps as indicated below:
1. Open a terminal and run the command `pnpm package`
2. A `.vsix` file should be generated in the project directory. Verify that it's there an copy the file name
3. Install the extension by running `code --install-extension <generated VSIX file name>.vsix` e.g. `code --install-extension azure-pipelines-yaml-task-validator-0.1.0.vsix`
4. Done!
<br>

## Development/Debugging

1. Install [PNPM](https://pnpm.io/)
1. Open the project in Visual Studio Code.
2. **IMPORTANT** Install this extension: [`connor4312.esbuild-problem-matchers`](https://marketplace.visualstudio.com/items?itemName=connor4312.esbuild-problem-matchers)
3. Open a terminal and run the command `pnpm install`
4. Press `F5` to start debugging the extension.
5. In the Extension Development Host window that appears, open an Azure Pipelines YAML file to see the validation in action.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
