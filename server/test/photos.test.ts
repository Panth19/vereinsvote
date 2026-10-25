import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, json, login, resetDb, seedVotingCompetition, type TestContext } from './helpers.ts';

let t: TestContext;
let s: Awaited<ReturnType<typeof seedVotingCompetition>>;
let clubA: string;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => t.close());
beforeEach(async () => {
  await resetDb(t.db);
  t.clock.now = new Date();
  s = await seedVotingCompetition(t.db);
  clubA = await login(t.app, 'a@club.de');
});

// a 3000x2000 JPEG with a GPS position in its EXIF data, like a phone photo
const phonePhoto = () =>
  sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#3a7d44' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'TestPhone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '51/1 45/1 0/1' } })
    .toBuffer();

const upload = (projectId: string, body: Buffer, cookie: string, type = 'image/jpeg') =>
  t.app.inject({
    method: 'PUT',
    url: `/api/club/projects/${projectId}/photo`,
    headers: { cookie, 'content-type': type },
    payload: body,
  });

describe('project photos', () => {
  it('resizes the upload to WebP and drops the metadata', async () => {
    const original = await phonePhoto();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const res = await upload(s.a.id, original, clubA);
    expect(res.statusCode).toBe(200);
    const url = json(res).photoUrl as string;
    expect(url).toMatch(new RegExp(`^/api/projects/${s.a.id}/photo\\?v=\\d+$`));

    const photo = await t.app.inject({ url });
    expect(photo.headers['content-type']).toBe('image/webp');
    expect(photo.headers['cache-control']).toContain('immutable');
    const meta = await sharp(photo.rawPayload).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(800);
    expect(meta.exif).toBeUndefined();
  });

  it('shows up in the public project list', async () => {
    await upload(s.a.id, await phonePhoto(), clubA);
    const list = json(await t.app.inject({ url: '/api/competitions/test-preis/projects' }));
    const a = list.find((p: any) => p.id === s.a.id);
    const b = list.find((p: any) => p.id === s.b.id);
    expect(a.photoUrl).toMatch(/^\/api\/projects\//);
    expect(b.photoUrl).toBeNull();
  });

  it('gets a new URL when the photo is replaced', async () => {
    const first = json(await upload(s.a.id, await phonePhoto(), clubA)).photoUrl;
    t.clock.now = new Date(Date.now() + 5000);
    const second = json(await upload(s.a.id, await phonePhoto(), clubA)).photoUrl;
    expect(second).not.toBe(first);
  });

  it("can't be changed by another club", async () => {
    const clubB = await login(t.app, 'b@club.de');
    expect((await upload(s.a.id, await phonePhoto(), clubB)).statusCode).toBe(403);
  });

  it('rejects files that are not images, even with an image content type', async () => {
    const res = await upload(s.a.id, Buffer.from('<?php echo "hi"; ?>'), clubA, 'image/png');
    expect(res.statusCode).toBe(415);
    expect(json(res).error).toBe('unsupported_image');
  });

  it('only accepts image bodies on the photo route', async () => {
    const asText = await upload(s.a.id, Buffer.from('x'), clubA, 'text/plain');
    expect(asText.statusCode).toBe(415);
    const elsewhere = await t.app.inject({
      method: 'POST',
      url: '/api/votes',
      headers: { 'content-type': 'image/jpeg' },
      payload: await phonePhoto(),
    });
    expect(elsewhere.statusCode).toBe(415);
  });

  it('rejects files over 8 MB', async () => {
    const res = await upload(s.a.id, Buffer.alloc(9 * 1024 * 1024), clubA);
    expect(res.statusCode).toBe(413);
  });
});
