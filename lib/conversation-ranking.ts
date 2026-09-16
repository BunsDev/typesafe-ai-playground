import {
  gate,
  type Row,
  type Candidate,
  type Message,
} from "../web/conversation";
export function candidateMessage(candidate: Candidate): Message | undefined {
  const payload = candidate.payload as { state?: { messages?: Message[] } };
  const message = payload.state?.messages?.at(-1);
  return message ? { ...message } : undefined;
}
export function rankConversationRows(rows: Row[]) {
  const sorted = rows
    .map((row, index) => ({
      row,
      index,
      score:
        gate(row.response?.answers.should_respond, 0) === "Unavailable"
          ? null
          : row.response!.answers.should_respond.noul!,
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.index - b.index);
  return sorted.map((item) => ({
    ...item,
    rank:
      item.score === null
        ? null
        : sorted.findIndex((other) => other.score === item.score) + 1,
  }));
}
