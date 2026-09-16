export type Question = { type: 'noul' | 'choice' | 'score'; instructions: string; criteria?: Record<string, string> | string[] };
export type RunPayload = { model: string; state: unknown; questions: Record<string, Question> };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function nonempty(v: unknown): v is string { return typeof v === 'string' && !!v.trim(); }
export function validatePayload(value: unknown): RunPayload {
  if (!object(value)) throw Error('Request must be an object.');
  if (!(nonempty(value.state) || object(value.state) || Array.isArray(value.state))) throw Error('Add source text or structured state.');
  if (!object(value.questions) || !Object.keys(value.questions).length || Object.keys(value.questions).length > 100) throw Error('Use between 1 and 100 questions.');
  const questions: Record<string, Question> = Object.create(null);
  for (const [key, q] of Object.entries(value.questions)) {
    if (!nonempty(key) || Object.hasOwn(questions,key.trim()) || !object(q) || !nonempty(q.instructions) || !['noul','choice','score'].includes(String(q.type))) throw Error('Every question needs a unique name, valid type, and instructions.');
    const clean: Question = {type:q.type as Question['type'],instructions:q.instructions.trim()};
    if (q.type === 'choice') {
      if (!object(q.criteria) || Object.keys(q.criteria).length < 2 || Object.entries(q.criteria).some(([k,v]) => !nonempty(k) || !nonempty(v))) throw Error('Choice questions need at least two named candidates.');
      const entries = Object.entries(q.criteria).map(([k,v]) => [k.trim(), (v as string).trim()]);
      if (new Set(entries.map(e=>e[0])).size !== entries.length) throw Error('Candidate names must be unique.');
      clean.criteria = Object.fromEntries(entries);
    }
    if (q.type === 'score') {
      if (!Array.isArray(q.criteria) || q.criteria.length < 2 || !q.criteria.every(nonempty)) throw Error('Score questions need at least two levels.');
      clean.criteria = q.criteria.map(v=>v.trim());
    }
    questions[key.trim()] = clean;
  }
  return {state:value.state,model:nonempty(value.model) ? value.model.trim() : 'jev-latest',questions};
}
export async function readBoundedBody(body: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!body) throw Error('Request is empty.');
  const reader = body.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw Error('Body exceeds the size limit.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const merged = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { merged.set(chunk,offset); offset += chunk.length; }
  return new TextDecoder().decode(merged);
}
