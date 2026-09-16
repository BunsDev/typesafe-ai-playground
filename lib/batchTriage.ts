import { parseTranscript, runBatches } from "../web/conversation";
import { buildTriagePayload } from "./classifyQuestionWithJev";
import { splitDocs, toHistory } from "./matchEvidence";
import type {
  AnnoyanceTally,
  ChatMessage,
  TriageDecision,
  TriageRequest,
} from "../types/triage";
export { runBatches };
const opener =
  /^(how|what|why|when|where|which|who|whose|can|could|does|do|did|is|are|was|were|should|would|will|has|have|any|anyone|anybody|am)\b/i;
/** A message worth gating: it either asks outright or opens like a question. */
export function isQuestion(content: string): boolean {
  const text = content.trim();
  return !!text && (text.includes("?") || opener.test(text));
}
export interface BatchItem {
  index: number;
  message: ChatMessage;
  request: TriageRequest;
}
/**
 * Triages every question in a dump against only what came before it, the same
 * prefix-slicing the Conversation lab uses to score one speaker at a time.
 */
export function buildBatch(input: {
  transcript: string;
  format: string;
  docs: string;
  model: string;
  historyLimit: number;
}): BatchItem[] {
  const parsed = parseTranscript(input.transcript, input.format).messages;
  const messages = toHistory(parsed, parsed.length);
  const snippets = input.docs.trim() ? splitDocs(input.docs) : [];
  const items: BatchItem[] = [];
  messages.forEach((message, index) => {
    if (!isQuestion(message.content)) return;
    const history = messages.slice(
      Math.max(0, index - Math.max(1, input.historyLimit)),
      index,
    );
    if (!history.length && !snippets.length) return;
    items.push({
      index,
      message,
      request: buildTriagePayload(
        message.content,
        history,
        snippets,
        input.model,
      ),
    });
  });
  if (!items.length)
    throw Error(
      "No questions found in this transcript. Paste messages that ask something.",
    );
  return items;
}
const annoyanceLabel = (total: number, ratio: number) =>
  !total
    ? "Nothing triaged yet."
    : ratio === 0
      ? "Everyone read up first. Rare."
      : ratio < 0.25
        ? "A calm channel."
        : ratio < 0.5
          ? "Mild déjà vu."
          : ratio < 0.75
            ? "The answer was right there."
            : "Have you tried reading up?";
/** Questions that could have been avoided by reading up, counted for the demo. */
export function tally(
  decisions: (TriageDecision | undefined)[],
): AnnoyanceTally {
  const known = decisions.filter((d): d is TriageDecision => !!d);
  const count = (...outcomes: TriageDecision["outcome"][]) =>
    known.filter((d) => outcomes.includes(d.outcome)).length;
  const avoidable = count("already_answered", "answerable_by_docs");
  const ratio = known.length ? avoidable / known.length : 0;
  return {
    total: known.length,
    avoidable,
    needsHuman: count("needs_human"),
    unclear: count("needs_more_context"),
    ratio,
    label: annoyanceLabel(known.length, ratio),
  };
}
