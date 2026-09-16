import type { Message } from "../web/conversation";
import type {
  ChatMessage,
  DocSnippet,
  EvidenceCandidate,
  TriageOutcome,
} from "../types/triage";
const stopwords = new Set(
  "a an and any are as at be been but by can could did do does for from get got had has have how i if in into is it its just like me my need not of on or our out so some that the their them then there these they this to too us use used using was we were what when where which who why will with would you your".split(
    " ",
  ),
);
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9_]+/g) || []).filter(
    (token) => token.length > 2 && !stopwords.has(token),
  );
}
export function excerpt(text: string, max = 240): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
/** Numbers the last `limit` transcript messages so evidence can be cited by id. */
export function toHistory(messages: Message[], limit = 40): ChatMessage[] {
  return messages
    .slice(Math.max(0, messages.length - Math.max(1, limit)))
    .map((message, index) => ({
      id: `M${index + 1}`,
      speaker: message.speaker?.trim() || "Unknown speaker",
      timestamp: message.timestamp?.trim() || "",
      content: message.content.replace(/\s+/g, " ").trim(),
    }))
    .filter((message) => message.content);
}
/** One snippet per documentation line, so cited evidence is a line a human can check. */
export function splitDocs(text: string): DocSnippet[] {
  const snippets: DocSnippet[] = [];
  let title = "Documentation";
  for (const block of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length && /^#{1,6}\s+/.test(lines[0]))
      title = lines.shift()!.replace(/^#{1,6}\s+/, "");
    for (const line of lines) {
      const content = line.replace(/^[-*•]\s+/, "").trim();
      if (content)
        snippets.push({ id: `D${snippets.length + 1}`, title, content });
    }
  }
  return snippets;
}
/**
 * Shortlists the messages and doc lines that share rare words with the question.
 * Jev makes the call; this only keeps the closed set of citable evidence small.
 */
export function rankEvidence(
  question: string,
  history: ChatMessage[],
  snippets: DocSnippet[],
  limit = 6,
): EvidenceCandidate[] {
  const pool = [
    ...history.map((message) => ({
      text: message.content,
      candidate: {
        id: message.id,
        kind: "message" as const,
        label: message.timestamp
          ? `${message.speaker} at ${message.timestamp}`
          : message.speaker,
        excerpt: excerpt(message.content),
        score: 0,
      },
    })),
    ...snippets.map((snippet) => ({
      text: `${snippet.title} ${snippet.content}`,
      candidate: {
        id: snippet.id,
        kind: "doc" as const,
        label: snippet.title,
        excerpt: excerpt(snippet.content),
        score: 0,
      },
    })),
  ];
  if (!pool.length) return [];
  const tokenSets = pool.map((entry) => new Set(tokenize(entry.text)));
  const frequency = new Map<string, number>();
  for (const tokens of tokenSets)
    for (const token of tokens)
      frequency.set(token, (frequency.get(token) || 0) + 1);
  const weight = (token: string) =>
    Math.log(1 + pool.length / (1 + (frequency.get(token) || 0)));
  const asked = [...new Set(tokenize(question))];
  const total = asked.reduce((sum, token) => sum + weight(token), 0);
  const ranked = pool
    .map((entry, index) => ({
      ...entry.candidate,
      score: total
        ? asked.reduce(
            (sum, token) =>
              sum + (tokenSets[index].has(token) ? weight(token) : 0),
            0,
          ) / total
        : 0,
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  // A question that shares no vocabulary still needs something to point at, or
  // Jev could only answer "none" and every outcome would look unsupported.
  const fallback = [
    ...pool.filter((entry) => entry.candidate.kind === "message").slice(-3),
    ...pool.filter((entry) => entry.candidate.kind === "doc").slice(0, 3),
  ].map((entry) => entry.candidate);
  return (ranked.length ? ranked : fallback).slice(0, limit);
}
export function findEvidence(
  candidates: EvidenceCandidate[],
  id: unknown,
): EvidenceCandidate | null {
  return typeof id === "string"
    ? (candidates.find((candidate) => candidate.id === id) ?? null)
    : null;
}
/** Canned reply text. Jev classifies; the wording here is a fixed template. */
export function suggestReply(
  outcome: TriageOutcome,
  evidence: EvidenceCandidate | null,
): string {
  if (!evidence) return "";
  if (outcome === "already_answered")
    return `This came up earlier — ${evidence.label} covered it: “${evidence.excerpt}” Give that a read and shout if it still doesn't fit.`;
  if (outcome === "answerable_by_docs")
    return `The docs answer this under ${evidence.label}: “${evidence.excerpt}” Shout if that leaves something out.`;
  return "";
}
