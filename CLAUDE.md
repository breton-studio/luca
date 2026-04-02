<!-- GSD:project-start source:PROJECT.md -->
## Project

**Obsidian Canvas AI**

An Obsidian plugin that integrates Claude Opus 4.6 into the canvas as a spatial thinking partner. When users write, move, or cluster nodes on the canvas, Opus reads the spatial state after a brief idle pause and auto-generates new nodes nearby — text, code, diagrams, or images — turning the canvas into a real-time AI-powered ideation surface.

**Core Value:** After any canvas action, Opus reads spatial context and generates relevant multi-medium content that feels like a natural extension of your thinking — fast enough that it doesn't break flow.

### Constraints

- **API**: Claude API (Opus 4.6) for reasoning, Runware API for image generation
- **Platform**: Obsidian plugin (TypeScript, Obsidian API)
- **Latency**: Content must begin appearing within a few seconds of idle trigger
- **Image model**: Riverflow 2.0 Pro specifically, accessed through Runware
- **Distribution**: Small team — no public plugin store requirements
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Platform
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Obsidian Plugin API (`obsidian`) | ^1.12.3 | Plugin framework, workspace access, vault I/O | Official API; provides Plugin lifecycle, PluginSettingTab, requestUrl, Vault read/write, Workspace events. This is non-negotiable. | HIGH |
| TypeScript | ^5.5 | Language | Obsidian sample plugin uses TS. Required for type safety with undocumented canvas internals. | HIGH |
| esbuild | ^0.24 | Bundler | Official Obsidian sample plugin uses esbuild. Fast, simple, proven pattern. Do NOT use webpack/vite/rollup. | HIGH |
| Node.js | ^20 LTS | Dev runtime | Required by esbuild and the Anthropic SDK. Use LTS only. | HIGH |
### AI / LLM Integration
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@anthropic-ai/sdk` | ^0.82.0 | Claude Opus 4.6 API calls | Official Anthropic TypeScript SDK. Supports streaming via SSE, custom fetch injection, dual CJS/ESM. **Critical:** Must configure `dangerouslyAllowBrowser: true` since Obsidian runs in Electron (browser-like env). Better: inject Node.js `fetch` as custom fetch to bypass CORS entirely. | HIGH |
### Image Generation
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@runware/sdk-js` | ^1.2.3 | Runware API client for Riverflow 2.0 Pro | Official Runware JS/TS SDK. WebSocket-based with auto-reconnect, Promise API, TypeScript types included. Supports text-to-image, image-to-image, inpainting. Returns images as URL, base64, or dataURI. | HIGH |
### Canvas Interaction (Internal APIs)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `obsidian-typings` | ^4.88.0 | Type definitions for undocumented Obsidian internals | Community-maintained TS definitions for Canvas internals (CanvasView, Canvas, CanvasNode, etc.). Based on reverse engineering -- types may drift between Obsidian versions. Essential for type-safe access to undocumented canvas APIs. | MEDIUM |
| `monkey-around` | ^3.0.0 | Safe monkey-patching of canvas methods | De-duplicated, uninstallable patches. Used by Advanced Canvas and other major canvas plugins. Essential for intercepting canvas events (node create, move, edit, delete). | MEDIUM |
### Supporting Libraries
| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `uuid` | ^9.0 | Unique ID generation for canvas nodes | Every generated node needs a unique ID within its canvas file | HIGH |
| `zod` | ^3.25 | Runtime type validation | Validate Claude API responses, parse structured output, validate settings | MEDIUM |
### NOT Recommended / Explicitly Excluded
| Library | Why Not |
|---------|---------|
| `mermaid` (npm package) | Obsidian ships with Mermaid built-in. Use Obsidian's native Mermaid rendering by generating mermaid code blocks in text nodes. Do NOT bundle a separate Mermaid library. |
| `axios` / `node-fetch` (as primary HTTP) | Use `@anthropic-ai/sdk` with custom fetch for Claude calls. Use `@runware/sdk-js` for Runware (WebSocket-based). Use Obsidian's `requestUrl()` for any other HTTP needs. No need for generic HTTP libraries. |
| `react` / `svelte` / `vue` | Obsidian plugins use vanilla DOM manipulation or Obsidian's built-in Component/Setting APIs for UI. Framework overhead is unnecessary and complicates the build. |
| `webpack` / `vite` / `rollup` | esbuild is the official Obsidian plugin build tool. Others add complexity with no benefit. |
| `@runware/ai-sdk-provider` | This is a Vercel AI SDK adapter for Runware. We don't use Vercel AI SDK. Use `@runware/sdk-js` directly. |
| `obsidian-canvas-event-patcher` | Git submodule approach is awkward. Use `monkey-around` directly -- it's the same underlying technique with better ergonomics. |
## Build Configuration
### esbuild.config.mjs (follows official Obsidian sample plugin pattern)
- `obsidian` and `electron` are external -- provided by Obsidian at runtime.
- `@codemirror/*` and `@lezer/*` are external -- Obsidian's editor stack, provided at runtime.
- Node.js builtins are external -- available in Electron's Node context.
- `@anthropic-ai/sdk` and `@runware/sdk-js` WILL be bundled (they are NOT external). esbuild handles their CJS/ESM compilation.
### tsconfig.json
### package.json (dependencies)
### Project Structure
## Canvas Data Format Reference
## Obsidian Plugin Lifecycle
## Key Technical Decisions
### 1. Streaming: Node.js fetch in Electron, NOT requestUrl
### 2. Canvas Manipulation: Dual approach (Internal API + File I/O fallback)
- **Primary:** Monkey-patch canvas internal APIs for real-time node creation with visual feedback.
- **Fallback:** File-based JSON manipulation via `vault.modify()` for reliability.
- **Caveat:** `vault.modify()` conflicts with canvas's own `requestSave` debounce (2-second window). When canvas is actively saving, file writes may be lost. Use internal API as primary; file I/O only for batch operations or when canvas view is not active.
### 3. Image Storage: Vault files, not inline base64
### 4. Diagram Generation: Mermaid code blocks in text nodes
### 5. Taste Profile: Markdown file in vault
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| LLM SDK | `@anthropic-ai/sdk` | Raw `fetch` calls | SDK handles streaming, retries, types, error handling. Rolling your own SSE parser is error-prone. |
| Image Gen SDK | `@runware/sdk-js` | Raw WebSocket | SDK handles reconnection, auth, retry, typing. WebSocket management is complex. |
| Canvas Events | `monkey-around` patches | `obsidian-canvas-event-patcher` | monkey-around is an npm package; event-patcher requires git submodule. Same technique, better DX. |
| Canvas Types | `obsidian-typings` | `@ts-ignore` everywhere | Typed access reduces bugs and enables IDE completion. Types may drift, but better than no types. |
| Build Tool | esbuild | webpack / vite | Official Obsidian pattern. esbuild is faster and simpler. No reason to diverge. |
| UI Framework | Vanilla DOM + Obsidian API | React / Svelte | Plugin UI is settings tab + canvas nodes. Obsidian's Setting API covers settings. Canvas nodes are data, not UI components. Framework is pure overhead. |
| Diagram Rendering | Obsidian native Mermaid | Bundled mermaid.js | Obsidian already includes Mermaid. Bundling another copy wastes ~2MB and creates version conflicts. |
| HTTP Client | SDK-specific (Anthropic SDK, Runware SDK) | axios / got | Each SDK manages its own transport. No general HTTP needs remain. Obsidian's requestUrl for any edge cases. |
## Version Pinning Strategy
- Pin Obsidian API to the minimum version that supports canvas (`^1.1.0` introduced canvas). Target `^1.12.0` for current features.
- Pin `obsidian-typings` to match your target Obsidian version branch.
- Pin `@anthropic-ai/sdk` and `@runware/sdk-js` with caret (`^`) -- these are actively maintained and backward-compatible within major versions.
- Pin `monkey-around` exactly (`3.0.0`) -- breaking changes in patch utilities can be catastrophic.
## Installation
# Clone from template
# Core dependencies
# Dev dependencies (obsidian types already in template)
# Verify build
## Sources
- [Obsidian Sample Plugin (official template)](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Obsidian API Type Definitions](https://github.com/obsidianmd/obsidian-api)
- [Obsidian Canvas Type Definitions (canvas.d.ts)](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts)
- [Obsidian Developer Documentation](https://docs.obsidian.md/Home)
- [obsidian-typings (undocumented API types)](https://github.com/Fevol/obsidian-typings)
- [Obsidian Advanced Canvas Plugin (canvas internal API patterns)](https://github.com/Developer-Mike/obsidian-advanced-canvas)
- [Obsidian Link Nodes in Canvas (canvas manipulation example)](https://github.com/Quorafind/Obsidian-Link-Nodes-In-Canvas)
- [obsidian-canvas-event-patcher (monkey-patch patterns)](https://github.com/neonpalms/obsidian-canvas-event-patcher)
- [monkey-around npm](https://www.npmjs.com/package/monkey-around/v/3.0.0)
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk)
- [Claude API Streaming Docs](https://platform.claude.com/docs/en/api/sdks/typescript)
- [Runware JS SDK](https://github.com/Runware/sdk-js)
- [@runware/sdk-js npm](https://www.npmjs.com/package/@runware/sdk-js)
- [Runware Image Inference API](https://runware.ai/docs/image-inference/api-reference)
- [Riverflow 2.0 Pro Model](https://runware.ai/models/sourceful-riverflow-2-0-pro)
- [Obsidian requestUrl streaming limitation (Forum)](https://forum.obsidian.md/t/support-streaming-the-request-and-requesturl-response-body/87381)
- [Obsidian Canvas API discussion (Forum)](https://forum.obsidian.md/t/any-details-on-the-canvas-api/57120)
- [vault.modify + requestSave conflict (Forum)](https://forum.obsidian.md/t/vault-process-and-vault-modify-dont-work-when-there-is-a-requestsave-debounce-event/107862)
- [Creating canvas programmatically (Forum)](https://forum.obsidian.md/t/creating-a-canvas-programmatically/101850)
- [Making HTTP requests in plugins (Forum)](https://forum.obsidian.md/t/make-http-requests-from-plugins/15461)
- [Obsidian Plugin Settings Pattern](https://marcusolsson.github.io/obsidian-plugin-docs/user-interface/settings)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
