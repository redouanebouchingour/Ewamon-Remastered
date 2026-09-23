/**
 * The REST failure type, split out of api.ts so the shell's error elements can use it without pulling protocol's
 * route table (zod schemas for every route) into the entry chunk (SPEC §20.10.2 rule 7).
 */
export interface ApiError {
  readonly status: number;
  readonly code: string;
  readonly detail: string | null;
  /** every other field of the error body (`field`, `badge`, `zoneId`, `issues`, `retryAfterS`, …) */
  readonly extra?: Readonly<Record<string, unknown>>;
}

export class ApiFailure extends Error {
  constructor(readonly error: ApiError) {
    super(error.code);
    this.name = 'ApiFailure';
  }
}

export function isApiFailure(e: unknown, status?: number): e is ApiFailure {
  return e instanceof ApiFailure && (status === undefined || e.error.status === status);
}
