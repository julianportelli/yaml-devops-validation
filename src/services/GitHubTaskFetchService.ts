import * as https from 'https';
import { TaskInfo, TaskFetchService } from '../types';
import { AzurePipelinesTaskDefinition } from '../types/AzurePipelinesTaskDefinition';

export class GitHubTaskFetchService implements TaskFetchService {
    async fetchTaskInfo(taskDir: string): Promise<TaskInfo | undefined> {
        const taskJsonUrl = `https://raw.githubusercontent.com/microsoft/azure-pipelines-tasks/master/Tasks/${taskDir}/task.json`;

        try {
            const taskJson = await this.fetchTaskJson(taskJsonUrl);
            
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

    private async fetchTaskJson(url: string): Promise<AzurePipelinesTaskDefinition> {
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                let data = '';
                response.on('data', chunk => { data += chunk; });
                response.on('end', () => {
                    try {
                        const azurePipelinesTaskDefinition = Object.assign(new AzurePipelinesTaskDefinition(JSON.parse(data)), JSON.parse(data));
                        
                        const isinstance = azurePipelinesTaskDefinition instanceof AzurePipelinesTaskDefinition;
                        
                        resolve(
                            azurePipelinesTaskDefinition
                        );
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', reject);
        });
    }
}
