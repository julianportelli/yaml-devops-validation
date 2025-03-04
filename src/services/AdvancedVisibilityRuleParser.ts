import { TaskInputObjectType, TaskInputObjectValueType } from '../types';

type Operator = '=' | '==' | '||' | '&&';

interface Condition {
    field: string;
    operator: Operator;
    value: TaskInputObjectValueType;
}

export class AdvancedVisibilityRuleParser {
    /**
     * Parses a visibility rule string into a structured format for evaluation
     * @param rule The rule string to parse (e.g., "command = install && type = npm || command = ci")
     * @returns A nested array representing OR groups containing AND conditions
     */
    static parseRule(rule: string): Condition[][] {
        if (!rule || rule.trim() === '') {
            return [];
        }
        
        // Split the rule into OR groups
        const orGroups = rule.split('||').map(group => group.trim());
        
        return orGroups.map(group => {
            // Split each OR group into AND conditions
            const andConditions = group.split('&&').map(condition => condition.trim());
            
            return andConditions.map(condition => {
                // Extract field, operator, and value
                const parts = condition.split(' ').filter(part => part !== '');
                
                if (parts.length !== 3) {
                    console.warn(`Invalid condition format: ${condition}`);
                    return { field: '', operator: '=' as Operator, value: '' };
                }
                
                return {
                    field: parts[0],
                    operator: parts[1] as Operator,
                    value: parts[2]
                };
            });
        });
    }
    
    /**
     * Evaluates a visibility rule against a set of input values
     * @param rule The rule string to evaluate
     * @param values The object containing field values to check against
     * @returns True if the rule is satisfied, false otherwise
     */
    static evaluate(rule: string, values: TaskInputObjectType): boolean {
        if (!rule || rule.trim() === '') {
            return true; // Empty rules are always satisfied
        }
        
        if (!values || typeof values !== 'object') {
            return false; // Can't evaluate without values
        }
        
        const conditionGroups = this.parseRule(rule);
        
        // A rule is satisfied if any OR group is satisfied
        return conditionGroups.some(andGroup => {
            // An OR group is satisfied if all its AND conditions are satisfied
            return andGroup.every(condition => {
                // Skip invalid conditions (protects against parsing errors)
                if (!condition.field) {
                    return false;
                }
                
                const actualValue = values[condition.field];
                
                // Currently only supporting equality operator
                if (condition.operator === '=' || condition.operator === '==') {
                    return actualValue === condition.value;
                }
                
                // We shouldn't reach here if parsing is correct, but just in case
                console.warn(`Unsupported operator: ${condition.operator}`);
                return false;
            });
        });
    }
    
    /**
     * Validates if a rule string has correct syntax
     * @param rule The rule string to validate
     * @returns True if the rule has valid syntax, false otherwise
     */
    static isValidRule(rule: string): boolean {
        if (!rule || rule.trim() === '') {
            return true; // Empty rules are valid
        }
        
        try {
            const conditionGroups = this.parseRule(rule);
            
            // Check if any group contains invalid conditions
            return conditionGroups.every(andGroup => 
                andGroup.every(condition => 
                    condition.field && condition.operator === '='
                )
            );
        } catch (error) {
            console.error(`Error validating rule: ${rule}`, error);
            return false;
        }
    }
}
