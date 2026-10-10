# Interactive HTML lessons

In Manage Lessons → Import ZIP, choose **Interactive HTML**. Upload a self-contained `.html`/`.htm` file or a ZIP containing HTML and its local CSS, classic JavaScript, PNG/JPEG/WebP/SVG images, and WOFF fonts. Review the actual interactive page, save private drafts, reopen if needed, and explicitly publish. Existing standard imports still use the inert structured-content renderer.

The original source and bundled assets are stored as a private draft and, after publication, inside the existing course lesson document. Course/lesson permissions and paywall checks still govern retrieval. Publishing is transactional and uses stable IDs; retrying does not create duplicates. Title editing preserves the imported source; content changes require editing and reimporting the source package.

## Isolation

Uploaded markup is never inserted into the Academy DOM, opened as a top-level page, or exposed through a raw HTML response on the Academy origin. The player loads a `data:text/html` document with a browser-created opaque origin, inside `sandbox="allow-scripts"`. It never grants `allow-same-origin`, forms, popups, downloads or top navigation. The frame has no bridge to account data or host actions. This provides origin separation without provisioning a public content host.

A Content Security Policy is prepended before every uploaded byte on every preview and student render. It permits inline lesson scripts/styles and bundled data assets, and blocks fetch/network APIs, external script/style/image dependencies, nested frames, workers, objects, base URL changes and form submission. Camera, microphone, geolocation, payment and clipboard access are disabled. Stored documents cannot weaken the prepended policy. The browser sandbox, not parsing or trust in the uploaded script, enforces account isolation.

Reference links may navigate within the sandbox; use Restart lesson to return. The player does not offer an unsandboxed Open original link. Standalone quizzes and UI state stay inside the page; they do not become trusted Academy grades or certificates. Files using clipboard, printing dialogs, network services, external embeds, CSS `@import`, or JavaScript module imports may require adaptation. Multi-file packages become separate Academy lessons; use the Academy lesson navigation between HTML pages. Fragment navigation inside an HTML page is preserved.

## Limits

- ZIP: 60 MiB compressed, 100 MiB declared expansion, 8 MiB selected assets, 1,000 entries, 20 HTML lessons.
- HTML/CSS/JS files: 250 KB each; image/font assets: 400 KB each.
- Bundled HTML: 650 KB; serialized lesson: 750 KB; total request: 3 MB.
- Traversal/absolute paths, control characters, duplicate case-insensitive names, unknown executable types, missing dependencies and over-limit content are rejected before save.

Limits support offline lessons rather than arbitrary hosted applications. Teachers must review the preview before publishing. Sandbox isolation does not impose a CPU quota on lesson scripts; a script with an infinite loop can still harm browser responsiveness. Content authors remain responsible for reliable lesson code.

## Verification

Parser/API regressions cover preserved scripts/SVG/styles, bundled assets, invalid archives, missing/external dependencies, access denial, private draft resume and retry-safe publication. A headless browser test runs the actual player and verifies origin `null`, denied parent DOM/cookie/storage access, blocked top navigation and fetch, plus working inline quiz code and SVG animation.

The supplied Tailscale HTML was tested locally (not committed or published): Direct/DERP switches work, quiz scores 5/5, dark styling and animated routes remain, and the page fits a 390px viewport. Existing standard import regressions pass. The CI sample test is optional because user lesson files are not included in the repository; the synthetic browser isolation test is mandatory.

To run browser tests locally, install the Playwright test browser or set `INTERACTIVE_TEST_BROWSER` to an existing Chromium/Edge executable. `INTERACTIVE_SAMPLE_HTML` optionally supplies a local Tailscale sample for the additional UI checks. This test uses only an isolated localhost fixture and no live account or database.
