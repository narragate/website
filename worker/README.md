# narragate-forms

The Cloudflare Worker behind the contact form and the investor packet request.
The site is static, so this is the only server-side piece.

A submission is **written to KV before the email is sent**. A bounced or
spam-filtered notification must not lose an enquiry, so if the mail call fails
the record still exists and the browser is still told the send failed — the form
never claims a success it cannot prove.

## Before it can go live

> **The Turnstile site key in `contact.html` and `investors.html` is Cloudflare's
> public test key (`1x00000000000000000000AA`), which always passes.** It makes
> the forms work end to end before a real key exists. **Replace it with the real
> site key, and set the matching secret, or the forms have no spam protection.**

## Deploying

All of this runs from this directory.

**1. `api.narragate.com` — already created**: an `A` record to `192.0.2.1`
(a placeholder; the Worker route intercepts before the origin is reached), set
to **orange cloud / Proxied**. The route will not fire on a DNS-only record.
The apex stays DNS-only so GitHub Pages keeps its own certificate.

**2. KV namespace — already created** as `d61297aec2864132b948551b82f9a1b5` and wired
into `wrangler.toml`. Only needed again if the namespace is ever recreated:

```sh
npx wrangler kv namespace create SUBMISSIONS
```

**3. Create a Turnstile widget** (Cloudflare dashboard → Turnstile) for
`narragate.com`. Put the **site key** in the `data-sitekey` attribute in
`contact.html` and `investors.html`, replacing the test key above.

**4. Set the secrets.** These are never stored in the repo:

```sh
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SECRET
```

**5. Verify the sending domain.** In Resend, add `send.narragate.com` — a
subdomain, deliberately, so the DKIM and SPF records it asks for cannot disturb
the apex `MX` and `SPF` that carry the live iCloud mail.

**6. Deploy:**

```sh
npx wrangler deploy
```

## Running it locally

`wrangler.dev.toml` has no routes, so it needs no account auth, and KV is
simulated on disk. It uses Cloudflare's always-passes Turnstile test secret and
a deliberately invalid Resend key, so a valid submission returns
`502 email_failed` with `stored: true` — which is the useful case to exercise.

```sh
npx wrangler dev --config wrangler.dev.toml --port 8787
```

## Responses

| Status | Body | Meaning |
| --- | --- | --- |
| 200 | `{"ok":true}` | Stored and emailed. Also returned when the honeypot is filled, so a bot learns nothing. |
| 400 | `bad_request` / `unknown_form` | Malformed JSON, or no `form` field matching `contact`/`investor`. |
| 403 | `origin_not_allowed` | `Origin` is not in `ALLOWED_ORIGINS`. |
| 403 | `challenge_failed` | Turnstile rejected the token. Tokens are single-use; the client resets the widget on failure. |
| 405 | `method_not_allowed` | Not a POST. |
| 422 | `invalid` + `fields` | Validation failed. |
| 429 | `rate_limited` | More than 5 submissions from one IP in an hour. |
| 500 | `storage_failed` | KV write failed. Nothing was promised, nothing was sent. |
| 502 | `email_failed`, `stored:true` | **The submission is safe in KV** but the notification did not go out. |

## Reading stored submissions

```sh
npx wrangler kv key list --binding SUBMISSIONS --remote | grep '"sub:'
npx wrangler kv key get --binding SUBMISSIONS --remote "<key>"
```

Keys are `sub:<ISO timestamp>:<uuid>`, so they list in chronological order.
Rate-limit counters use a `rate:` prefix and expire after two hours.
