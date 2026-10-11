export class ApiError extends Error {
    status;
    code;
    problem;
    constructor(problem) {
        super(problem.detail ?? problem.title ?? problem.code);
        this.name = "ApiError";
        this.status = problem.status;
        this.code = problem.code;
        this.problem = problem;
    }
}
export function toProblem(status, body) {
    if (body && typeof body === "object" && "code" in body) {
        return { ...body, status };
    }
    return { status, code: status >= 500 ? "SERVICE_UNAVAILABLE" : "UNKNOWN_ERROR" };
}
