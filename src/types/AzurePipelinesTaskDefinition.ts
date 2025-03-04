import type { Dictionary } from ".";

// Types for nested objects
export type Version = {
	Major: number;
	Minor: number;
	Patch: number;
};

export type Group = {
	name: string;
	displayName: string;
	isExpanded: boolean;
};

export type TaskInput = {
	name: string;
	aliases?: string[];
	type: string;
	label: string;
	required: boolean;
	defaultValue?: string;
	visibleRule?: string;
	helpMarkDown?: string;
	options?: Record<string, string>;
	properties?: Dictionary<string>;
	groupName?: string;
};

export type Execution = Dictionary<Dictionary<string>>;

export class AzurePipelinesTaskDefinition {
	id: string;
	name: string;
	friendlyName: string;
	description: string;
	author: string;
	helpUrl: string;
	helpMarkDown: string;
	releaseNotes: string;
	category: string;
	visibility: string[];
	runsOn: string[];
	minimumAgentVersion: string;
	version: Version;
	instanceNameFormat: string;
	showEnvironmentVariables: boolean;
	groups: Group[];
	inputs: TaskInput[];
	execution: Execution;
	messages: Record<string, string>;

	constructor (data: any) {
		this.id = data.id;
		this.name = data.name;
		this.friendlyName = data.friendlyName;
		this.description = data.description;
		this.helpUrl = data.helpUrl;
		this.helpMarkDown = data.helpMarkDown;
		this.category = data.category;
		this.visibility = data.visibility;
		this.runsOn = data.runsOn;
		this.author = data.author;
		this.version = data.version;
		this.releaseNotes = data.releaseNotes;
		this.minimumAgentVersion = data.minimumAgentVersion;
		this.showEnvironmentVariables = data.showEnvironmentVariables;
		this.groups = data.groups;
		this.inputs = data.inputs;
		this.instanceNameFormat = data.instanceNameFormat;
		this.execution = data.execution;
		this.messages = data.messages;
	}

	getInputDefinition (name: string): TaskInput | undefined {
		return this.inputs.find(input => input.name === name);
	}

	getFullVersionString (): string {
		return `${this.version.Major}.${this.version.Minor}.${this.version.Patch}`;
	}
}
