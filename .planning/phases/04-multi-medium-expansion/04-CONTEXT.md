# Phase 4: Multi-Medium Expansion - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Claude decides whether to generate code blocks, Mermaid diagrams, or images based on canvas context, and each medium type renders correctly on the canvas. Extends the existing text-only generation pipeline (Phase 3) to support four medium types: text, code, mermaid, and image. The one-per-content-type model (max 1 text + 1 code + 1 mermaid + 1 image per trigger), sequential streaming, and orbital placement from prior phases carry forward. Additionally, generation is edit-mode gated, AI nodes are isolated from triggering, and blank nodes are skipped.

</domain>

<decisions>
## Implementation Decisions

### Medium Signaling Protocol
- **D-01:** Typed node tags with attributes: `<node type="text">`, `<node type="code" lang="typescript">`, `<node type="mermaid">`, `<node type="image">`. Extend existing `<node>` boundary detection in stream-handler.ts to parse type attribute from opening tag.
- **D-02:** One node per content type per generation. Each trigger produces at most 1 text + 1 code + 1 mermaid + 1 image (up to 4 nodes total, each a distinct type). Never two text nodes or two code nodes in one response. This replaces Phase 3's 1-3 same-type cap.
- **D-03:** Claude can mix medium types freely within the one-per-type constraint. A single trigger might produce a text explanation + a code example + a diagram. The type attribute on `<node>` tags signals which medium each node is.
- **D-04:** Context-driven medium selection guidelines in the prompt. Claude uses judgment: text for ideas/analysis, code when technical, mermaid for relationships/flows, image when visual concept is powerful. Prefer text unless another medium adds clear value.

### Image Generation Flow
- **D-05:** Image prompt is plain natural language text inside `<node type="image">` tags. Claude writes the prompt, plugin extracts and sends to Runware/Riverflow 2.0 Pro.
- **D-06:** Image placeholder: pre-allocate a square node at placement position with pulsing border and "generating..." text (no icon). Same pulsing pattern as Phase 3 D-04. When image returns, swap placeholder for file node.
- **D-07:** Generated images saved to vault-visible folder: `canvas-ai-images/` at vault root. Naming convention: `{date}_{uuid-short}.png`. User can see and organize images.
- **D-08:** Image generation is parallel/non-blocking. When `<node type="image">` boundary is detected, fire Runware request asynchronously. The Claude stream continues to the next node immediately. Image placeholder swaps to file node when Runware returns.

### Mermaid Diagram Rendering
- **D-09:** Mermaid diagrams are fenced ```mermaid code blocks inside regular text nodes. Obsidian's canvas renders Mermaid natively in text node markdown preview. No special node type or external renderer needed.
- **D-10:** Mermaid content is buffered until complete (MMED-04). Node shows pulsing empty state (same as image/text pre-allocation pattern) while content accumulates. When `</node>` boundary is detected, flush the complete mermaid block into the node all at once.

### Code Block Rendering
- **D-11:** Code blocks are fenced code with language tags (```typescript, ```python, etc.) inside regular text nodes. Obsidian renders syntax highlighting natively. No special node type needed.
- **D-12:** Code nodes stream progressively (like text nodes), not buffered. User sees code being written line by line with live syntax highlighting.

### Generation Trigger Constraints (from CLAUDE.md #6)
- **D-13:** Edit-mode gate -- generation only triggers after user clicks out of a node (`isEditing=false`). No mid-thought interruption while user is typing.
- **D-14:** AI node isolation -- AI-created node IDs are tracked. Interactions with AI nodes (click, select, focus) never trigger new generation. Only user-created/edited nodes trigger.
- **D-15:** Blank node skip -- empty or whitespace-only trigger nodes are ignored. No generation on blank nodes.

### Node Rendering Summary
| Medium | Node Type | Streaming | Placeholder |
|--------|-----------|-----------|-------------|
| text | text node | Progressive | Pulsing empty |
| code | text node | Progressive | Pulsing empty |
| mermaid | text node | Buffered (flush at boundary) | Pulsing empty |
| image | text node -> file node | N/A (async Runware) | Pulsing + "generating..." |

### Claude's Discretion
- Runware API integration details (SDK initialization, error handling, retry strategy)
- Exact image prompt enhancement (whether to append style tokens from taste profile)
- Image file node dimensions and aspect ratio handling
- Mermaid buffer detection implementation (how to detect boundary in stream)
- Code node width adjustment logic (MMED-09 says code wider)
- Stream handler refactoring approach for typed node parsing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs
- `.planning/PROJECT.md` -- Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` -- MMED-02 through MMED-08 acceptance criteria
- `.planning/ROADMAP.md` -- Phase 4 success criteria, dependency chain

### Technical References
- `CLAUDE.md` -- Full technology stack, Runware SDK configuration, image storage decision (#3: vault files not inline base64), Mermaid decision (#4: code blocks in text nodes)
- `CLAUDE.md` "Key Technical Decisions" section -- #3 (image storage), #4 (diagram generation), #6 (one-per-type generation, edit-mode gate, AI node isolation, blank node skip)
- `CLAUDE.md` "Recommended Stack" -- @runware/sdk-js configuration, Riverflow 2.0 Pro model reference

### Phase 3 Generation Pipeline (integration points)
- `src/ai/prompt-builder.ts` -- GENERATION_INSTRUCTIONS with medium selection placeholder (line 41-45), buildSystemPrompt(), buildUserMessage()
- `src/ai/stream-handler.ts` -- streamIntoNode() with `<node>` boundary detection, onNodeBoundary callback, onTextUpdate callback
- `src/main.ts` -- streamWithRetry() pipeline wiring (line 245-335), onNodeBoundary handler creating new nodes
- `src/canvas/canvas-adapter.ts` -- createTextNodeOnCanvas() (line 151-180), updateNodeText(), addNodeCssClass()
- `src/types/settings.ts` -- CanvasAISettings with runwareApiKey field
- `src/settings.ts` -- Runware API key validation (line 219)
- `src/ui/status-bar.ts` -- StatusBarState types

### Phase 2 Spatial (placement)
- `src/spatial/placement.ts` -- Collision-free orbital placement (reused for all medium types)
- `src/types/canvas.ts` -- CanvasNodeInfo interface

### Prior Phase Context
- `.planning/phases/01-foundation/01-CONTEXT.md` -- Status bar, settings layout
- `.planning/phases/02-spatial-intelligence/02-CONTEXT.md` -- Proximity, clustering, placement strategy
- `.planning/phases/03-core-generation-loop/03-CONTEXT.md` -- Streaming UX, AI node appearance, taste profile, token budget

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `streamIntoNode()` -- Handles `<node>` boundary detection and sequential node callbacks. Needs extension to parse `type` attribute from opening tags and route by medium type.
- `createTextNodeOnCanvas()` -- Creates text nodes. Sufficient for text, code, and mermaid nodes. Image nodes need a new `createFileNodeOnCanvas()` method.
- `GENERATION_INSTRUCTIONS` in prompt-builder.ts -- Has a "Medium Selection" placeholder section (currently "For now, generate text/markdown nodes only") ready to be replaced with context-driven guidelines.
- `onNodeBoundary` callback in main.ts -- Handles sequential node creation. Needs extension to check node type and route: text/code stream progressively, mermaid buffers then flushes, image fires async Runware request.
- Settings already has `runwareApiKey` field and validation.

### Established Patterns
- Pre-allocate node + stream pattern (Phase 3 D-01) -- reuse for all medium types
- Pulsing border CSS class `canvas-ai-node--streaming` -- reuse for all placeholders
- `unknownData.canvasAiStreaming` marker for CSS re-application on re-render
- Sequential streaming via `onNodeBoundary` with mutable `activeNode` closure
- CanvasAdapter as single point of canvas interaction

### Integration Points
- Stream handler: parse `<node type="...">` opening tag attributes, expose type to callbacks
- Main.ts pipeline: route by node type in onNodeBoundary (text/code: progressive, mermaid: buffer, image: async Runware)
- CanvasAdapter: new method for creating file nodes (images) on canvas
- Prompt builder: replace medium selection placeholder with full multi-medium instructions
- New Runware client module: SDK initialization, image generation, file saving

</code_context>

<specifics>
## Specific Ideas

- The pulsing placeholder pattern should be consistent across all medium types -- same animation, same visual weight. Only the content differs (empty for text/code/mermaid, "generating..." text for images).
- Image generation should feel seamless -- the user sees a placeholder appear in the right position, and a few seconds later it resolves to an actual image. No separate UI, no modals, no interruption.
- Mermaid diagrams should "pop" into existence -- the pulsing placeholder resolves to a fully rendered diagram in one step. No jumpy intermediate renders of partial syntax.
- Code streaming should feel like watching someone type code -- progressive, line by line, with syntax highlighting updating in real time.

</specifics>

<deferred>
## Deferred Ideas

- **Code execution/preview** -- Rendering the output of generated code in a companion node (e.g., running HTML/SVG and showing the visual result alongside the code). New capability that requires sandboxed execution, security model, and multiple language runtime support. Would be a powerful future phase.

</deferred>

---

*Phase: 04-multi-medium-expansion*
*Context gathered: 2026-04-03*
