import * as https from 'https';
import { TaskInfo, TaskFetchService } from '../types';

export class GitHubTaskFetchService implements TaskFetchService {
    async fetchTaskInfo(taskDir: string): Promise<TaskInfo | undefined> {
        const taskJsonUrl = `https://raw.githubusercontent.com/microsoft/azure-pipelines-tasks/master/Tasks/${taskDir}/task.json`;

        try {
            const taskJson = await this.fetchTaskJson(taskJsonUrl);

            return {
                fullyQualifiedTaskName: `${taskJson.name}@${taskJson.version.Major}`,
                requiredInputs: taskJson.inputs
                    ?.filter((input: any) => input.required)
                    .map((input: any) => input.name) || []
            };
        } catch (error) {
            console.error(`Error fetching task.json for ${taskDir}:`, error);
            return undefined;
        }
    }

    private async fetchTaskJson(url: string): Promise<any> {
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