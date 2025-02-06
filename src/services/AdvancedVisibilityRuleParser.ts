import {TaskInputObjectType, TaskInputObjectValueType} from '../types';

type Operator = '=' | '||' | '&&';
type Condition = {
    field: string;
    operator: Operator
    value: TaskInputObjectValueType
};

export class AdvancedVisibilityRuleParser {
    static parseRule(rule: string): Condition[][] {
        if (!rule) {
            return [];
        };
        
        const orGroups = rule.split('||').map(group => group.trim());
        
        return orGroups.map(group => {
            const andConditions = group.split('&&').map(part => part.trim());
            
            return andConditions.map(condition => {
                const [field, op, value] = condition.trim().split(' ');
                return {
                    field: field.trim(),
                    operator: op as Operator,
                    value: value.trim()
                };
            });
        });
    }

    static evaluate(rule: string, values: TaskInputObjectType): boolean {
        if (!rule) {
            return true;
        } 
        
        const conditionGroups = this.parseRule(rule);
        
        // Return true if any OR group is true
        return conditionGroups.some(andGroup => {
            // Return true only if all conditions in AND group are true
            return andGroup.every(condition => {
                const actualValue = values[condition.field];
                return actualValue === condition.value;
            });
        });
    }
}

// Example usage with more complex rules:
const complexRule = "command = install && type = npm || command = ci";
const values = { command: 'install', type: 'npm' };

const isVisible = AdvancedVisibilityRuleParser.evaluate(complexRule, values);
console.log(isVisible); // true
