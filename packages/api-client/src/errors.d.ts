/** RFC 9457 Problem Details with stable business `code` (API Contract README §6). */
export interface Problem {
    type?: string;
    title?: string;
    status: number;
    code: string;
    detail?: string;
    traceId?: string;
    errors?: {
        field: string;
        code: string;
        message?: string;
    }[];
    [extra: string]: unknown;
}
export declare class ApiError extends Error {
    readonly status: number;
    readonly code: string;
    readonly problem: Problem;
    constructor(problem: Problem);
}
export declare function toProblem(status: number, body: unknown): Problem;
