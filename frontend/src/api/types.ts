export interface ApiErrorDetail {
  loc?: (string | number)[];
  msg: string;
  type?: string;
}

export interface ApiErrorResponse {
  detail?: string | ApiErrorDetail[] | Record<string, unknown>;
  message?: string;
  status_code?: number;
  error?: {
    code?: number;
    message?: string;
    error_type?: string;
    details?: ApiErrorDetail[];
  };
}

export class ApiClientError extends Error {
  public status: number;
  public isUnavailable: boolean;
  public fieldErrors: Record<string, string>;
  public rawDetail?: string | ApiErrorDetail[] | Record<string, unknown>;
  public errorType?: string;

  constructor(
    message: string,
    status = 0,
    rawDetail?: string | ApiErrorDetail[] | Record<string, unknown>,
    fieldErrors: Record<string, string> = {},
    errorType?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.rawDetail = rawDetail;
    this.fieldErrors = fieldErrors;
    this.errorType = errorType;
    this.isUnavailable = status === 0 || status === 404 || status === 503 || status === 502;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined>;
  requiresAuth?: boolean;
}
