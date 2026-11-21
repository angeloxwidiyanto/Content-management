/**
 * Sinkronisasi workspace Cadence ke server portal (gky-internal).
 *
 * Server menyimpan satu dokumen berversi. Klien mengirim versi yang dipegang;
 * bila sudah ada yang menyimpan lebih dulu, server membalas 409 dan klien wajib
 * memuat ulang sebelum menimpa.
 */

export type WorkspacePayload = {
  projects: unknown[];
  activityLogs: unknown[];
};

export type WorkspaceResponse = {
  version: number;
  payload: WorkspacePayload | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export class ConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('conflict');
  }
}

export async function fetchWorkspace(): Promise<WorkspaceResponse> {
  const response = await fetch('/api/content/workspace', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Gagal memuat workspace (${response.status})`);
  }
  const data = (await response.json()) as WorkspaceResponse & {
    payload: WorkspacePayload | string | null;
  };
  // Baris lama mungkin tersimpan sebagai string JSON.
  if (typeof data.payload === 'string') {
    try {
      data.payload = JSON.parse(data.payload) as WorkspacePayload;
    } catch {
      data.payload = null;
    }
  }
  return data as WorkspaceResponse;
}

export async function saveWorkspace(
  version: number,
  payload: WorkspacePayload
): Promise<{ version: number }> {
  const response = await fetch('/api/content/workspace', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version, payload }),
  });

  if (response.status === 409) {
    const data = (await response.json().catch(() => ({}))) as {
      version?: number;
    };
    throw new ConflictError(data.version ?? version);
  }

  if (!response.ok) {
    throw new Error(`Gagal menyimpan workspace (${response.status})`);
  }

  return (await response.json()) as { version: number };
}
