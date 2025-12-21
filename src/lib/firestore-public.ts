import 'server-only';

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { bytesValue: string }
  | { referenceValue: string }
  | { geoPointValue: { latitude: number; longitude: number } }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function valueToJson(v: FirestoreValue): any {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('stringValue' in v) return v.stringValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valueToJson);
  if ('mapValue' in v) {
    const fields = v.mapValue.fields || {};
    const out: Record<string, any> = {};
    for (const [k, fv] of Object.entries(fields)) out[k] = valueToJson(fv);
    return out;
  }
  return null;
}

function fieldsToJson(fields: Record<string, FirestoreValue> | undefined) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = valueToJson(v);
  return out;
}

export async function fetchPublicFirestoreDoc(path: string): Promise<{ id: string; data: any } | null> {
  const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '').trim();
  const apiKey = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '').trim();
  if (!projectId || !apiKey) return null;

  const safePath = String(path || '').replace(/^\/+/, '');
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId,
  )}/databases/(default)/documents/${safePath}?key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) {
    // Avoid logging the full URL (contains API key).
    if (resp.status !== 404) {
      const body = await resp.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error('[FirestorePublic] fetch failed', {
        path: safePath,
        status: resp.status,
        body: body.slice(0, 200),
      });
    }
    return null;
  }
  const j: any = await resp.json().catch(() => null);
  if (!j?.fields) return null;
  const name: string = j?.name || '';
  const id = name.split('/').pop() || safePath.split('/').pop() || '';
  return { id, data: fieldsToJson(j.fields as any) };
}
