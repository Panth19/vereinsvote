import type { ApiError } from '@vv/shared';

export class RequestError extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.message);
  }
  // first message per field, for showing errors next to the inputs.
  // "prizeShares.0" belongs to the prizeShares field.
  fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const issue of this.body.issues ?? []) errors[issue.path.split('.')[0]!] ??= issue.message;
    return errors;
  }
}

async function send<T>(method: string, url: string, init: { body?: BodyInit; type?: string } = {}): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: init.type ? { 'Content-Type': init.type } : undefined,
    body: init.body,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({ error: 'network', message: 'Unerwartete Antwort vom Server' }));
  if (!res.ok) throw new RequestError(res.status, data as ApiError);
  return data as T;
}

export const api = {
  get: <T>(url: string) => send<T>('GET', url),
  post: <T>(url: string, body: unknown = {}) =>
    send<T>('POST', url, { body: JSON.stringify(body), type: 'application/json' }),
  // the file is sent as it is, the server resizes it
  uploadPhoto: (projectId: string, file: File) =>
    send<{ photoUrl: string }>('PUT', `/api/club/projects/${projectId}/photo`, { body: file, type: file.type }),
};

export function errorMessage(err: unknown): string {
  if (err instanceof RequestError) return err.message;
  return 'Der Server ist gerade nicht erreichbar. Bitte die Verbindung prüfen und noch einmal versuchen.';
}
