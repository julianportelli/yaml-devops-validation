import { TaskInputObjectType } from "../pipelineTask";
import { RuleCondition } from "../rules";

export interface IAdvancedVisibilityRuleParserService {
    parseRule(rule: string): RuleCondition[][]
    evaluate(rule: string, values: TaskInputObjectType): boolean;
    isValidRule(rule: string): boolean;
}