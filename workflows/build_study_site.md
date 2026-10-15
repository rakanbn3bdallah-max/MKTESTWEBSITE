# Workflow: Build and Update the MKT301 Study Site ("Rakan's World 301")

## Objective
Keep the MKT301 Consumer Behavior study website current: every slide viewable, the in-scope test-bank questions with
slide-first explanations, a textbook-depth tag (book chapter + page) where the slide only names a topic, and exam countdowns.
The deliverable is the published site: https://claude.ai/artifact/AN7mQTtqJnLmYNyhqAJYFJ

Group-project material (guidelines, gates, deadlines, team) never goes on the site.

## Required inputs
| Input | Location |
|---|---|
| Slide decks (chapter numbers come from the slides) | `Chapter N ….pptx`, `Chapter 6 Consumer Attitude Formation.pdf` (project root) |
| Test banks (studocu PDFs) | `TestBank/[studocu.com] N- ….pdf` |
| Textbook | `TEXTBOOK/MKT301-TEXTBOOK.PDF.pdf` |
| Syllabus (dates and exam scope only) | `TestBank/CB Syllabus Fall 2026 2643 v3.pdf` |
| Brand art | `Brand_assest/` (Mario sprite sheet; infographic for the visual style) |

## Exam facts (from the syllabus)
- Midterm: Wed 21 Oct 2026, in class (3:00 PM Riyadh). Chapters 1–5 + "15". "15" is the doctor's typo for **Chapter 14,
  Consumer Decision-Making and Diffusion of Innovations** (confirmed by the user). The site shows it as Chapter 14.
- Chapter 6 (Attitude Formation) is taught on 26 Oct, after the midterm, so it is **final only**.
- Final: Thu 24 Dec 2026, 8:00 AM, comprehensive. It also covers Chapters 7, 9 and 11, which have no slides here yet.

## Steps (tools in run order)
1. **Export slides** (PowerPoint must be installed):
   `powershell -File tools/export_pptx_slides.ps1` writes `site/slides/chN/NN.jpg` and slide text to `.tmp/chN-slides.json`.
   Add a new deck to the `$decks` map inside the script first.
2. **PDF slide decks:** `tools/render_pdf_pages.ps1 -Pdf <pdf> -OutDir .tmp/<name>pages -Width 2600`. If the PDF is a printed
   web-viewer capture (gray background, several slides per page, slides split across pages), then run
   `tools/crop_viewer_slides.ps1 -InDir .tmp/<name>pages -OutDir site/slides/chN`. It stitches the pages and crops each slide.
   Image-only decks have no text: type the slide text into `.tmp/chN-slides.json` and the titles into `CH6_TITLES` / `TITLE_FIX`
   in `tools/build_site_data.js`.
2b. **Textbook reader:** `powershell -File tools/render_book_chapters.ps1` renders ONLY the book chapters that match a slide chapter
   (1–6 and 14; ranges in the script and in `tools/textbook_lookup.js`) to `site/book/chN/pNNN.jpg` (960px, JPEG quality 50,
   about 28 MB for 182 pages). The build writes their text to `site/book.js`, which the page loads only when someone opens the textbook or searches.
3. **Parse test banks:** `pdftotext <tb.pdf> .tmp/tb-N.txt` (raw mode, not `-layout`), then
   `node tools/parse_testbank.js .tmp/tb-N.txt > .tmp/tb-N.json`. Review with `node tools/print_tb.js .tmp/tb-N.json`.
4. **Annotate (the judgment step):** in `tools/annotations/chN.js`, add `n: [slide, explanation, textbookNote?, fixedStem?]`
   for each question the slides cover. Explanations quote the slide first. Leave out questions on topics the slides never
   mention, mini-case questions whose case text is missing, and questions with a wrong answer key.
5. **Textbook depth:** in `tools/annotations/textbook.js`, map each question whose tested detail is only named on the slide
   to a phrase that finds its page. Check a phrase with `node tools/textbook_lookup.js <ch> "<phrase>"`.
6. **Build:** `node tools/build_site_data.js` (add `--review` to print every textbook hit with context), then
   `node tools/build_index.js` (writes the standalone `site/index.html` and syntax-checks the page script).
   The build exits non-zero and names the problem for a bad slide number, a TF explanation that contradicts the key,
   or a textbook phrase that is not found.
7. **Publish:** Artifact publish of `site/page.html` with `root: site` and `files: [data.js]` (plus any new or changed slide images).
   Omit `capabilities` on a redeploy so the stored `db` + `user` declaration carries forward.

7b. **Vercel (GitHub) version:** the `site/` folder is the repo root. Vercel serves `index.html` and runs `site/api/*.js`
   (username + password accounts, progress per account). Storage is Upstash Redis from the Vercel Marketplace
   (`KV_REST_API_URL` / `KV_REST_API_TOKEN`). Deploy steps are in `site/README.md`. Test locally with
   `node tools/dev_server.js [port]` (in-memory accounts). Always run `build_index.js` before pushing, since Vercel serves index.html.

## Outputs
- `site/data.js`: chapters, slides (image, title, text) and questions (`slide`, `exp`, `book`, `depth`, `ref`).
- `site/page.html`: the page as published (artifact-style body, no `<html>`/`<head>`).
- `site/index.html`: the same page wrapped for offline use.
- Viewer progress: browser storage, plus `data/users/<id>/progress` in the artifact database when the viewer can sync.

## Edge cases and lessons learned
- **No Python on this machine.** agent-instructions.md asks for Python tools; they are Node.js and PowerShell instead.
  Check `python`/`py` again before assuming it is available.
- **PowerShell variables are case-insensitive.** `$h` overwrites `$H` and `$w` overwrites `$W`. This broke the slide stitching once.
- **PowerShell `GetPixel` loops are very slow** (a 200×200 region took over 2 minutes). For pixel work, convert to BMP once and
  read it in Node (`tools/trace_sprite.js`).
- **The Chapter 6 PDF has no text layer** and is a viewer capture, 4 slides per page with slides split across page breaks.
  The pages join seamlessly once the gray margins are trimmed.
- **pdftotext `-layout` mangles test-bank question stems**, because the LO text bleeds into the lines. Raw mode is cleaner but
  sometimes moves a blank (`________`) out of the stem; fix the stem through the 4th annotation field.
- **Studocu page junk** (`lOMoARcPSD`, `Downloaded by`, `messages.pdf_cover…`) must be filtered, or it attaches to the last
  answer on the page.
- **Test-bank keys with known errors** (removed): Ch4 Q44 (reference price keyed as perceived price), Ch5 Q18,
  Ch3 Q109 (physical vs achievement vanity). Ch4's positioning-steps questions conflict with the doctor's 6-step process (removed).
- **Interpersonal gifting** is in the book but not on the Ch14 slides (the slides list four types), so those questions are out.
- **Textbook pages:** book page = PDF page − 31. The book's chapter numbers match the slides for all seven decks
  (book Ch 14 = Decision-Making). Lookups match whole words; end a phrase with `*` for a prefix match (`customiz*`).
  Short phrases can hit an unrelated page first, so always check with `--review`.
- **Headless Edge screenshots below ~500px width** are clamped, which looks like horizontal overflow. Don't trust them for phone layout.
- **The standalone index.html needs `[hidden]{display:none!important}`.** The artifact skeleton provides it, a local file does not.
- **Sync limits:** on a personal plan, only people invited by email as Editor can write to the artifact database. Everyone
  else keeps progress in the browser and can move it between devices with a progress code (`RW1.…`). The code depends on
  question order, so a rebuild that adds or removes questions changes the code format; bump the prefix if that matters.
- **No slide numbers on questions** (the user's decision): annotations keep a slide number for build checks only.
  `noSlideRefs()` and `chapterize()` in the build rewrite explanations to cite "Chapter N" instead, and the build fails if a slide number is left.
- **Textbook depth links** open the textbook pop-up at the cited page (`q.page`), never a slide.
- **`[ordered]` dictionaries in PowerShell:** indexing with an int returns the entry at that position, not the key. Use string keys (`"14"`).
- **pdftotext emits U+FFFD** for the textbook's bullet glyphs. The Artifact publish refuses files containing it, so the build replaces it with `•`.
- **Dark pages** are recolored in the browser (canvas). 16px tiles with almost no white paper and mostly mid-tones or color count as
  pictures and are left untouched (grown by one tile). Everywhere else gray pixels are remapped and colored ink keeps its color.
  Don't detect pictures by mid-tones alone, because dense body text is mostly mid-tone at this resolution.
- **Dark-mode borders:** box borders and pixel shadows use `--edge`/`--shade`, never `--ink` (ink turns light in dark mode and showed as white edges).
- **Sound** plays only in the quiz (right, wrong, next, run finished), never on the home page, and starts only after a tap.
- **Sound toggle lives in the HUD** (`#snd-btn`, next to DARK), not in the quiz toolbar. Inside the quiz toolbar it was missing everywhere
  else and the user reported it as gone. Sounds still play only in the quiz.
- **Unknown hash routes show the 404 view** (`#view-lost`, "Wrong pipe!", ported from 8bitcn NotFound1 into vanilla CSS with the `oops`
  sprite). If you add a new home section id, add it to the allow-list in `route()`, or its links will land on the 404.
- **The site is plain HTML, not React/shadcn/Tailwind.** Port pasted shadcn components to the page's own CSS tokens; don't add a React toolchain.
- **Two sync modes, one page:** on claude.ai the page uses the artifact `db`/`user` runtime. Anywhere else it calls `GET api/session`;
  if that returns JSON with a `user` key, the HUD button becomes SIGN IN and the account form shows. Static hosts and local files stay browser-only.
  Signing out clears this browser's progress so the next person on a shared computer starts clean. Signing in merges the browser's answers into the account (account wins on conflicts).
- **Account API rules:** usernames are case-insensitive (`[a-z0-9_.]{3,20}`), passwords are 6+ characters, there are 30 auth attempts per IP per 15 min,
  and state-changing calls must be `application/json` (CSRF guard together with the SameSite=Lax cookie). Files in `api/` starting with `_` are not routes.
- **Stopping the dev server:** kill only the node process whose command line contains `dev_server`, never every node.exe.
- **Backups before changes:** copy `site/page.html`, `index.html`, `data.js`, `book.js`, `tools/` and this workflow into
  `backups/<date>_<reason>/`. Restore = copy the files back and republish `page.html` to the same URL.
