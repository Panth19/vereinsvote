import { createHash, createHmac, randomBytes } from 'node:crypto';

export const randomToken = () => randomBytes(32).toString('base64url');

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

// keyed hash: can't be reversed or brute-forced without the secret
export const hmac = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('hex');
