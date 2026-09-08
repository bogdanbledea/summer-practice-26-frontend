export class HttpError extends Error {
  status: number;
  /** Stable machine-readable tag, so the frontend can branch on the cause
   *  rather than on the wording of the message. */
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code?: string) =>
  new HttpError(400, message, code);
export const unauthorized = (message: string, code?: string) =>
  new HttpError(401, message, code);
export const forbidden = (message: string, code?: string) =>
  new HttpError(403, message, code);
export const notFound = (message: string, code?: string) =>
  new HttpError(404, message, code);
export const conflict = (message: string, code?: string) =>
  new HttpError(409, message, code);
