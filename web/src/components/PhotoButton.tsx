import { useRef, useState } from 'react';
import { api, errorMessage } from '../lib/api.ts';

interface Props {
  projectId: string;
  hasPhoto: boolean;
  onUploaded: () => void;
}

export function PhotoButton({ projectId, hasPhoto, onUploaded }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await api.uploadPhoto(projectId, file);
      onUploaded();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <>
      <button type="button" className="linklike small" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Wird hochgeladen...' : hasPhoto ? 'Foto ändern' : 'Foto hinzufügen'}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => upload(e.target.files?.[0])}
      />
      {error && <div className="err small">{error}</div>}
    </>
  );
}
