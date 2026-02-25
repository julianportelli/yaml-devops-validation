import { TaskInfo } from "../pipelineTask";

export interface ITaskCacheService {
    getCachedTasks(): Promise<Map<string, TaskInfo> | null>;
    saveTasks(tasks: Map<string, TaskInfo>): Promise<void>;
}