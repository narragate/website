# Narragate website

The website for Narragate Entertainment LLC, an independent film company in West Lawn, Pennsylvania. Plain HTML, CSS and JavaScript, with no build step and no dependencies.

## Pages

| File | Page |
| --- | --- |
| `index.html` | Home |
| `films.html` | Films |
| `duet.html` | *Duet* film page |
| `aileen.html` | *Aileen* film page |
| `music.html` | Music |
| `journal.html` | Journal |
| `about.html` | About |
| `investors.html` | Investors, with the packet request form |
| `contact.html` | Contact |
| `privacy.html` | Privacy |
| `404.html` | Page not found |

## Folders

| Folder | Contents |
| --- | --- |
| `assets/css/` | `narragate.css` (the stylesheet) and `fonts.css` (the three `@font-face` rules) |
| `assets/js/` | `site.js`: the menu, the song player and the forms |
| `assets/fonts/` | EB Garamond and Outfit as variable `.woff2` files, with their licenses |
| `assets/img/` | The colored Narragate logos and the film-grain texture |
| `assets/favicon/` | The favicon set from the brand bundle |
| `worker/` | The Cloudflare Worker behind the two forms. Not part of the published site. |

## Viewing it locally

Fonts load as files, so serve the folder rather than opening it directly:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publishing on GitHub Pages

In the repository, open **Settings > Pages**, set **Source** to **Deploy from a branch**, and choose `main` and `/ (root)`. The `.nojekyll` file tells GitHub to serve the files exactly as they are.

There is deliberately no `CNAME` file yet. Adding the custom domain under **Settings > Pages** creates one; do that when the DNS for narragate.com is ready to switch, so the site stays viewable at its github.io address until then.

`404.html` is served automatically for missing addresses. Its links are relative, so it keeps its styling for missing pages at the top level of the site but not for addresses inside folders.

## Before it goes live

- **The forms need the Worker deployed.** `site.js` posts to `api.narragate.com`, a Cloudflare Worker that records each submission in KV and emails the notification. The code is in `worker/`; see `worker/README.md` for the deploy steps. **Until it is deployed the forms show their failure state** — which is correct behaviour, but it does mean they cannot be used yet.
- **The Turnstile site key is Cloudflare's test key** (`1x00000000000000000000AA`), which always passes. Replace it in `contact.html` and `investors.html` with the real key before launch, or the forms have no spam protection.
- **The songs are silent.** The player shows its playing state, but no audio files have been supplied.
- **The teaser and short films open YouTube** in a new tab.
- **The investor legal notice is a draft that counsel has not reviewed.** It is live on `investors.html` and is marked with an HTML comment in the source. It was written to be conventional and accurate for a pre-offering page, but securities wording is a lawyer's call. Replace it before relying on it.
- **The privacy notice describes the system as built** — what the two forms collect, the IP, country and user-agent recorded with a submission, Cloudflare and Resend as processors, and a two-year retention period. If the forms or the Worker change, `privacy.html` has to change with them.

## Previewing states you cannot reach by clicking

| Address | Shows |
| --- | --- |
| `investors.html?form=failure` | The message shown when a request fails to send |
| `investors.html?form=sent` | The confirmation, with step 1 ticked |
| `duet.html?teaser=ended` | What the teaser frame offers once the teaser ends |

## Fonts

EB Garamond and Outfit are licensed under the SIL Open Font License 1.1. The license texts are in `assets/fonts/`.
