import { TaskInfo } from "../pipelineTask";

export interface ITaskFetchService {
    fetchTaskInfo(taskDir: string): Promise<TaskInfo | undefined>;
}