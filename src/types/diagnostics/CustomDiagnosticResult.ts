export interface CustomDiagnosticResult {
    line: number;
    message: string;
    severity: "error" | "warning" | "info";
}