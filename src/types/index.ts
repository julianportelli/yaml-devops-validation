export interface TaskInfo {
    fullyQualifiedTaskName: string;
    requiredInputs: string[];
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