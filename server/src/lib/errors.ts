export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, 'unauthorized', 'Bitte zuerst anmelden');
export const forbidden = () => new HttpError(403, 'forbidden', 'Dafür fehlt die Berechtigung');
export const notFound = (message: string) => new HttpError(404, 'not_found', message);
export const conflict = (code: string, msg: string) => new HttpError(409, code, msg);
