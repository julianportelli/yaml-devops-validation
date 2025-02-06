import {AzurePipelinesTaskDefinition}  from './AzurePipelinesTaskDefinition';
import * as vscode from 'vscode';

export class Dictionary<T> extends Map<string, T> {
    constructor(entries?: readonly (readonly [string, T])[] | null) {
        super(entries);
    }
}
export class TaskInfo {
    fullyQualifiedTaskName: string;
    requiredInputsNames: string[];
    azurePipelineTaskDefinition: AzurePipelinesTaskDefinition;
    
    constructor(FullyQualifiedTaskName: string, RequiredInputs: string[], AzurePipelinesTaskObj: AzurePipelinesTaskDefinition){
        this.fullyQualifiedTaskName = FullyQualifiedTaskName;
        this.requiredInputsNames = RequiredInputs;
        this.azurePipelineTaskDefinition = AzurePipelinesTaskObj;
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

export type InputValidationResult = {
    message: string,
    severity: vscode.DiagnosticSeverity
}

export type Nullable<T> = T | null;

export type TaskInputObjectValueType = string | number

export type TaskInputObjectType = Record<string, TaskInputObjectValueType>
