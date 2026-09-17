# YouTube extract

Open `/youtube-extract`, paste a public YouTube URL, and select **Create extract · Live Jev**. The app retrieves an existing caption track and asks Jev to score each natural chunk. It never calls a text-generation, transcription, or translation model.

## Retrieval and limits

The server reads YouTube watch metadata, then uses its public player and timedtext endpoints. These are unofficial interfaces and may change or block server IPs. The official [YouTube captions download API](https://developers.google.com/youtube/v3/docs/captions/download) requires authorization; this prototype does not claim universal video coverage. Public player discovery follows the approach documented by [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api).

English captions are preferred, with manual tracks before automatic ones. If English is unavailable, an existing track in its source language is used, again preferring manual captions. Their origin is displayed. No captions means an error, never invented text. Requests use fixed YouTube hosts, disallow redirects and translated tracks, limit upstream bodies to 2 MiB, and share a 20-second abort deadline. No cookies or credentials are forwarded to YouTube. Transcript limits are 5,000 caption lines, 60,000 characters, 200 natural chunks, and 6,000 characters per natural unit. Oversized tracks fail without truncation.

## Decisions and source fidelity

Caption gaps over 1.5 seconds, terminal punctuation, and speaker markers create natural boundaries. A chunk retains original text, caption line indices, and start/end times. Multiple sentences in one caption share that caption's timestamp; these are source cue times, not inferred word timings. Unpunctuated runs remain whole until a natural boundary. Grammatical completeness is best effort.

Cleanup removes hesitation tokens, comma-delimited filler phrases, and immediate hyphenated false starts. Meaningful uses such as “I like ice” or “you know the answer” remain. Cleanup uses English filler heuristics, which can misread meaningful words, especially in other languages. Inspect original captions alongside cleaned text.

Each nonempty chunk uses one `/api/run` request containing a `score` relevance question and a yes/no `choice` key-claim question. The complete bounded transcript and video title provide topic context; source text is marked untrusted. Relevance and confidence must be finite values in [0,1]. Missing, invalid, failed, or cancelled results remain unknown; incomplete scoring stops the run. No output text is taken from a model response.

Selection excludes incomplete scores and relevance below 0.5, then sorts by descending relevance and stable source order. Lower-ranked chunks with word-set Jaccard overlap greater than 0.6 with a retained higher-ranked chunk are duplicates. It keeps up to `ceil(total chunks × length percentage / 100)` and restores chronological order. Key-claim flags are metadata, not a filter. Raising length cannot restore duplicates or below-threshold chunks.

The brief permits an empty connector and also requires every output word to trace to the transcript. This version uses the empty connector rule: existing source transitions stay, and whitespace joins the cleaned passages. It does not invent “Next” or “Finally,” or rewrite text to improve flow. The result is labeled an extract, not a true summary.

## Inspecting a run

The length slider recomputes locally without Jev requests. The raw list shows kept/dropped reasons, scores, key claims, confidence, cleaned text, originals, and source links. Kept passages link directly to their video timestamps. Human comparison with both kept and dropped source passages is the verification method; neither confidence nor extraction proves completeness.

Calls attempted, processed/total chunks, kept count, mean kept relevance, elapsed time, and running input-cost estimates update during scoring. Pricing uses the app's shared estimate function and reported input tokens; missing usage and in-flight/failed calls remain unknown. Input-only cost excludes output and hosting and is not an invoice. The shared usage dashboard retains its existing key and rate-limit behavior.

Stop, unmount, or a personal-key change cancels the run and prevents queued calls. Partial results remain labeled partial. Only URL and length persist as a browser draft; results and keys are not stored in that draft. Changing the URL clears the old result. Live scoring sends the bounded transcript to TypeSafe; shared-key deployment still needs the controls in [deployment.md](deployment.md).

Automated unit/API and browser tests use synthetic captions and mocked Jev responses; no shared credits are consumed.
