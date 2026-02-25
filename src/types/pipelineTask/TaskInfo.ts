import { AzurePipelinesTaskDefinition } from "./AzurePipelinesTaskDefinition";

export class TaskInfo {
    fullyQualifiedTaskName: string;
    requiredInputsNames: string[];
    azurePipelineTaskDefinition: AzurePipelinesTaskDefinition;
    existsInRegistry: boolean = false;

    static createNonExistingTaskInfo(taskName: string): TaskInfo {
        const taskInfo = new TaskInfo(
            taskName,
            [],
            new AzurePipelinesTaskDefinition({
                id: taskName,
                name: taskName,
                friendlyName: taskName,
                description: "",
            }),
            false,
        );
        return taskInfo;
    }

    constructor(
        FullyQualifiedTaskName: string,
        RequiredInputs: string[],
        AzurePipelinesTaskObj: AzurePipelinesTaskDefinition,
        ExistsInRegistry: boolean,
    ) {
        this.fullyQualifiedTaskName = FullyQualifiedTaskName;
        this.requiredInputsNames = RequiredInputs;
        this.azurePipelineTaskDefinition = AzurePipelinesTaskObj;
        this.existsInRegistry = ExistsInRegistry;
    }
}