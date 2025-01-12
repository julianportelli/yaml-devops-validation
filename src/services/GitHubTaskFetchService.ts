import * as https from 'https';
import { TaskInfo, TaskFetchService, type AzurePipelinesTaskObject } from '../types';

export class GitHubTaskFetchService implements TaskFetchService {
    async fetchTaskInfo(taskDir: string): Promise<TaskInfo | undefined> {
        const taskJsonUrl = `https://raw.githubusercontent.com/microsoft/azure-pipelines-tasks/master/Tasks/${taskDir}/task.json`;

        try {
            const taskJson: AzurePipelinesTaskObject = await this.fetchTaskJson(taskJsonUrl);
            
            const fullyQualifiedTaskName = `${taskJson.name}@${taskJson.version.Major}`;
            
            const requiredInputsNames =  taskJson.inputs
                    ?.filter((input) => input.required)
                    .map((input) => input.name) || [];
            
            const taskInfo = new TaskInfo(
                fullyQualifiedTaskName,
                requiredInputsNames,
                taskJson
            );

            return taskInfo;
        } catch (error) {
            console.error(`Error fetching task.json for ${taskDir}:`, error);
            return undefined;
        }
    }

    private async fetchTaskJson(url: string): Promise<AzurePipelinesTaskObject> {
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                let data = '';
                response.on('data', chunk => { data += chunk; });
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', reject);
        });
    }
}
