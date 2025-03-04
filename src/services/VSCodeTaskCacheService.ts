import * as vscode from "vscode";
import { TaskInfo, TaskCacheService } from "../types";

export class VSCodeTaskCacheService implements TaskCacheService {
	private readonly CACHE_KEY = "azurePipelinesTaskCache";
	private readonly CACHE_TIMESTAMP_KEY = "azurePipelinesTaskCacheTimestamp";
	private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

	constructor(private context: vscode.ExtensionContext) {}

	async getCachedTasks(): Promise<Map<string, TaskInfo> | null> {
		const cachedTasks = this.context.globalState.get<{
			[key: string]: TaskInfo;
		}>(this.CACHE_KEY);
		const cachedTimestamp = this.context.globalState.get<number>(
			this.CACHE_TIMESTAMP_KEY
		);

		if (
			cachedTasks &&
			cachedTimestamp &&
			Date.now() - cachedTimestamp < this.CACHE_EXPIRY
		) {
			const taskMap = new Map<string, TaskInfo>();
			Object.entries(cachedTasks).forEach(([key, value]) => {
				taskMap.set(key, value);
			});
			return taskMap;
		}

		return null;
	}

	async saveTasks(tasks: Map<string, TaskInfo>): Promise<void> {
		console.log("Saving tasks to cache");
		const tasksObject = Object.fromEntries(tasks);
		await this.context.globalState.update(this.CACHE_KEY, tasksObject);
		await this.context.globalState.update(
			this.CACHE_TIMESTAMP_KEY,
			Date.now()
		);
	}
}
