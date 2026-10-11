/** RFC 9457 Problem Details with stable business `code` (API Contract README §6). */
export interface Problem {
  type?: string;
  title?: string;
  status: number;
  code: string;
  detail?: string;
  traceId?: string;
  errors?: { field: string; code: string; message?: string }[];
  [extra: string]: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.detail ?? problem.title ?? problem.code);
    this.name = "ApiError";
    this.status = problem.status;
    this.code = problem.code;
    this.problem = problem;
  }
}

export function toProblem(status: number, body: unknown): Problem {
  if (body && typeof body === "object" && "code" in body) {
    return { ...(body as Problem), status };
  }
  return { status, code: status >= 500 ? "SERVICE_UNAVAILABLE" : "UNKNOWN_ERROR" };
}
