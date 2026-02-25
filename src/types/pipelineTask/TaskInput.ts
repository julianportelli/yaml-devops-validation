import { Dictionary } from "../common/Dictionary";

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