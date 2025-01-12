import {AzurePipelinesTaskObject}  from './AzurePipelinesTask';

export class Dictionary<T> extends Map<string, T> {
    constructor(entries?: readonly (readonly [string, T])[] | null) {
        super(entries);
    }
}
export class TaskInfo {
    fullyQualifiedTaskName: string;
    requiredInputsNames: string[];
    azurePipelineTaskObject: AzurePipelinesTaskObject;
    
    constructor(FullyQualifiedTaskName: string, RequiredInputs: string[], AzurePipelinesTaskObj: AzurePipelinesTaskObject){
        this.fullyQualifiedTaskName = FullyQualifiedTaskName;
        this.requiredInputsNames = RequiredInputs;
        this.azurePipelineTaskObject = AzurePipelinesTaskObj;
    }
}

export interface TaskCacheService {
    getCachedTasks(): Promise<Map<string, TaskInfo> | null>;
    saveTasks(tasks: Map<string, TaskInfo>): Promise<void>;
}

export interface TaskFetchService {
    fetchTaskInfo(taskDir: string): Promise<TaskInfo | undefined>;
}

export interface CustomDiagnosticResult {
    line: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
}

export { AzurePipelinesTaskObject };
