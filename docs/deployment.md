# Deployment configuration

Vercel project: `0xbuns/typesafe-ai-playground`.
Production: https://typesafe-ai-playground.vercel.app.

Set `TYPESAFE_API_KEY` as a sensitive server-only production environment variable.
Never use `NEXT_PUBLIC_TYPESAFE_API_KEY`. The app exposes a shared-key demo, so its
request limits belong at the edge, before serverless instances scale out.

The production Vercel Firewall uses these project-level, per-IP limits:

| Endpoint            | Fixed-window limit         |
| ------------------- | -------------------------- |
| `/api/run`          | 60 requests per 60 seconds |
| `/api/meme-image`   | 12 requests per 60 seconds |
| `/api/pull-request` | 6 requests per 60 seconds  |
| `/api/solve`        | 20 requests per 60 seconds |

To reproduce on a new linked project:

```sh
vercel firewall overview
vercel firewall diff
vercel firewall rules add 'Limit shared Jev API usage' \
  --condition '{"type":"path","op":"eq","value":"/api/run"}' \
  --action rate_limit --rate-limit-requests 60 --rate-limit-window 60 \
  --rate-limit-keys ip --yes
vercel firewall rules add 'Limit meme image downloads' \
  --condition '{"type":"path","op":"eq","value":"/api/meme-image"}' \
  --action rate_limit --rate-limit-requests 12 --rate-limit-window 60 \
  --rate-limit-keys ip --yes
vercel firewall rules add 'Limit public PR lookups' \
  --condition '{"type":"path","op":"eq","value":"/api/pull-request"}' \
  --action rate_limit --rate-limit-requests 6 --rate-limit-window 60 \
  --rate-limit-keys ip --yes
vercel firewall rules add 'Limit exact solver checks' \
  --condition '{"type":"path","op":"eq","value":"/api/solve"}' \
  --action rate_limit --rate-limit-requests 20 --rate-limit-window 60 \
  --rate-limit-keys ip --yes
vercel firewall diff
vercel firewall publish --yes
```

Review existing rules and unpublished changes first; do not create duplicates or
publish unrelated changes. These are persistent edge limits, not an in-memory
counter that resets on cold starts. They do not authenticate users or establish a
global budget across IPs. Configure spending limits on your provider key for that.
Local development does not pass through the Vercel Firewall.

`/api/meme-image` also restricts schemes, destinations, redirects, downloaded bytes,
and decoded pixels. It resolves each destination, rejects private/reserved IPs,
and pins the actual TLS connection to the validated address. No TypeSafe key or
browser cookies are forwarded to image hosts.

Each workspace has a statically generated 1200 × 630 `opengraph-image` route. `lib/social.ts` supplies per-page titles, descriptions, canonical paths and matching Twitter metadata; `lib/social-image.tsx` renders the shared charcoal/lavender design. When adding a page, add its registry entry, call `pageMetadata`, and add a small `opengraph-image.tsx` entry point. `public/og.png` remains the README artwork.

The SMT endpoint uses the Node.js `z3-solver` WASM package. `next.config.ts` externalizes it and traces the WASM/runtime files into `/api/solve`; do not move it to the Edge runtime. Queue, input, timeout and solver-resource limits are also enforced locally.
