import { TaskInputObjectValueType } from "../pipelineTask";
import { ConditionOperator } from "./ConditionOperator";

export interface RuleCondition {
    field: string;
    operator: ConditionOperator;
    value: TaskInputObjectValueType;
}