# Phase 5: Taste Profile and Polish - Research

**Researched:** 2026-04-03
**Domain:** Taste profile evolution, system prompt engineering, canvas placement algorithms, sandboxed HTML rendering in Electron
**Confidence:** HIGH

## Summary

Phase 5 spans five distinct technical areas: (1) evolving the taste profile YAML structure from flat to nested `style:/substance:` groups with backward-compatible parsing, (2) injecting hardcoded counter-sycophancy instructions into the system prompt, (3) adding a settings UI button to open the profile file via Obsidian's workspace API, (4) replacing the orbital placement algorithm with right-edge-aligned placement, and (5) creating companion render nodes for code output using sandboxed iframes.

The taste profile and counter-sycophancy work is straightforward -- extending existing parser functions and prompt-builder modules with well-understood patterns. The placement algorithm replacement is medium complexity -- the existing `computeOrbitalPlacements` in `src/spatial/placement.ts` needs to be replaced with a right-edge-aligned stacking algorithm while preserving collision detection. The companion node feature is the most technically involved -- it requires creating sandboxed iframes in canvas text nodes for HTML/CSS/JS preview, rendering Mermaid via Obsidian's built-in renderer, and displaying SVG inline.

No new npm dependencies are required. All work uses existing libraries and Obsidian/Electron platform capabilities.

**Primary recommendation:** Work in dependency order -- taste profile format migration first (unblocks prompt changes), counter-sycophancy instructions second (prompt-only change), settings UI button third (minimal), placement algorithm fourth (spatial module change), companion nodes last (most complex, independent from other work).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** YAML frontmatter split into two nested groups: `style:` (tone, voice, formatting preferences) and `substance:` (depth, domains, thinking approach). Single file, clear separation.
- **D-02:** Freeform body uses markdown headers: `## Style Philosophy` and `## Substance Philosophy`. Optional -- if omitted, treated as combined.
- **D-03:** Existing 4-field format (tone, depth, visual_preference, thinking_style) migrated into the new grouped structure. Backward-compatible parsing: detect flat vs nested and handle both.
- **D-04:** Hardcoded instructions in the system prompt -- not user-configurable. Claude should always push back occasionally regardless of taste profile settings.
- **D-05:** Four behaviors: (1) Devil's advocate -- argue against user's apparent direction, (2) Unexpected connections -- surprising analogies from unrelated domains, (3) Uncomfortable questions -- surface assumptions the user may be avoiding, (4) Contrarian references -- cite thinkers/works that disagree with user's philosophy.
- **D-06:** Counter-sycophancy is probabilistic, not every generation -- Claude uses judgment on when it's appropriate.
- **D-07:** "Open profile" button in settings tab that opens the taste profile markdown file in an Obsidian editor tab. No inline editing -- leverages Obsidian's full editor capabilities.
- **D-08:** Per-member profiles (TAST-04) deferred -- single global profile for now.
- **D-09:** Generated nodes flow rightward from trigger node, aligned to its right edge. Natural left-to-right reading flow.
- **D-10:** Multiple generated nodes stack vertically along the right edge with consistent gap spacing.
- **D-11:** Collision detection must still apply -- if rightward space is blocked, fall back to next available direction.
- **D-12:** Code nodes get a companion node showing rendered/interactive output. Placed adjacent to the code node.
- **D-13:** Supported types: HTML/CSS/JS (sandboxed iframe with interactivity), Mermaid (source+diagram side-by-side), SVG (visual render).
- **D-14:** Companion node is a separate canvas node linked visually to the code node. Created after code streaming completes.

### Claude's Discretion
- System prompt wording for counter-sycophancy instructions
- Exact placement gap sizes and vertical stacking offsets
- Companion node sizing relative to code node
- How to sandbox HTML/JS execution safely in Electron
- Migration strategy for existing taste profiles to new format
- Companion node sizing relative to code node

### Deferred Ideas (OUT OF SCOPE)
- **TAST-04: Per-member profile switching** -- Each team member having their own taste profile file with a dropdown selector. Deferred from this phase to reduce scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAST-04 | Per-team-member profiles supported | DEFERRED per D-08 -- single global profile only in this phase |
| TAST-05 | Taste profile editable through settings UI or by editing the file directly | D-07: "Open profile" button uses `workspace.openLinkText()` (already implemented in `openTasteProfile()` in main.ts). Settings UI button wiring needed in settings.ts. |
| TAST-06 | Structured separation of style vs substance | D-01/D-02/D-03: Nested YAML frontmatter with `style:` and `substance:` groups. Parser update with backward compatibility. New `formatTasteForPrompt()` output structure. |
| TAST-07 | Counter-sycophancy instructions prevent taste profile from suppressing novelty | D-04/D-05/D-06: Hardcoded block in `GENERATION_INSTRUCTIONS` constant in prompt-builder.ts. Four specific behaviors. Probabilistic application by Claude. |
</phase_requirements>

## Standard Stack

### Core (No new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Obsidian Plugin API | ^1.12.3 | `workspace.openLinkText()`, `Setting` API, `PluginSettingTab` | Already used. Settings button and file opening are standard API calls. |
| TypeScript | ^5.5 | Language | Already in use. |

### Supporting (Already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None new | - | - | All dependencies already in package.json |

**No new packages required.** The YAML frontmatter parser uses simple string splitting (established project pattern per Phase 3 decision). Sandboxed iframes use native browser/Electron APIs. Mermaid rendering uses Obsidian's built-in renderer.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple string YAML parsing | `js-yaml` npm package | Overkill for 6-field nested YAML. Project has established pattern of manual parsing. Adding a YAML library for nested keys adds a dependency for minimal gain. |
| iframe `srcdoc` for HTML preview | `webview` tag in Electron | Electron officially recommends iframes over webview tags. webview is deprecated/unstable. |
| Obsidian `MarkdownRenderer.render()` for Mermaid | Manual Mermaid library | Obsidian bundles Mermaid. Using MarkdownRenderer to render a mermaid code block is the standard approach -- no extra library needed. |

## Architecture Patterns

### Taste Profile Format Migration

**Current format (flat):**
```yaml
---
tone: Restrained, considered, unhurried.
depth: Deep structural analysis.
visual_preference: Monochromatic default.
thinking_style: Swiss rational tradition.
---
```

**New format (nested per D-01):**
```yaml
---
style:
  tone: Restrained, considered, unhurried.
  voice: Direct without being blunt.
  formatting: Clean, minimal markup.
substance:
  depth: Deep structural analysis. First-principles thinking.
  domains: Architecture, design systems, typography.
  thinking_approach: Swiss rational tradition. Systematic over intuitive.
---

## Style Philosophy
[optional freeform content about HOW to communicate]

## Substance Philosophy
[optional freeform content about WHAT to communicate]
```

**Backward compatibility (D-03):** The parser detects flat vs nested by checking if the first non-empty value line contains a colon-prefixed sub-key or not. If `tone:` appears at the top level, it is flat format. If `style:` appears with indented sub-keys, it is nested format. Both formats produce the same `TasteProfile` interface output.

### Parser Approach for Nested YAML (No Library)

The existing parser uses `line.indexOf(':')` to split key-value pairs. For nested YAML, extend this:

```typescript
// Detection: if a key's value is empty and next line is indented, it's a group
// Example: "style:" has no value, next line "  tone: ..." is indented

interface TasteProfileFields {
  // Style group
  style: {
    tone: string;
    voice: string;
    formatting: string;
  };
  // Substance group
  substance: {
    depth: string;
    domains: string;
    thinking_approach: string;
  };
}
```

The parsing strategy:
1. Split frontmatter into lines
2. Track current group (null = top-level, 'style' or 'substance')
3. Lines starting with whitespace belong to current group
4. Lines without leading whitespace that have empty values start a new group
5. Flat-format detection: if `tone:` appears without indentation, treat as legacy format and map fields into the new structure

### Updated TasteProfile Interface

```typescript
export interface TasteStyleFields {
  tone: string;
  voice: string;
  formatting: string;
}

export interface TasteSubstanceFields {
  depth: string;
  domains: string;
  thinking_approach: string;
}

export interface TasteProfileFields {
  style: TasteStyleFields;
  substance: TasteSubstanceFields;
}

export interface TasteProfile {
  fields: TasteProfileFields;
  body: string;
  stylePhilosophy: string;   // Content under ## Style Philosophy header
  substancePhilosophy: string; // Content under ## Substance Philosophy header
  raw: string;
}
```

### Backward-Compatible Migration (D-03)

```typescript
// Legacy flat fields map to new structure:
// tone -> style.tone
// depth -> substance.depth
// visual_preference -> style.formatting (closest match)
// thinking_style -> substance.thinking_approach
```

### Counter-Sycophancy System Prompt Block (D-04, D-05, D-06)

Added as a new section in the `GENERATION_INSTRUCTIONS` constant in `src/ai/prompt-builder.ts`:

```typescript
// Appended to GENERATION_INSTRUCTIONS:
`## Intellectual Honesty

You are not a yes-machine. While you respect the user's taste profile, you must
occasionally challenge their thinking. Use your judgment on timing -- not every
response, but regularly enough that your contributions feel genuinely independent.

When appropriate, deploy these strategies:
- **Devil's advocate:** Argue against the user's apparent direction. If they're
  converging on a solution, present the strongest case for an alternative.
- **Unexpected connections:** Draw surprising analogies from unrelated domains.
  Connect their work to ideas they wouldn't expect.
- **Uncomfortable questions:** Surface assumptions the user may be avoiding.
  Ask what they haven't considered.
- **Contrarian references:** Cite thinkers, works, or precedents that disagree
  with the user's apparent philosophy. Not to dismiss, but to sharpen.

These are NOT random provocations. They should feel like a sharp thinking partner
who respects you enough to disagree. Never flag these as "playing devil's advocate"
-- just do it naturally as part of extending their thinking.`
```

This is hardcoded (D-04), probabilistic (D-06 -- "use your judgment on timing"), and covers all four behaviors (D-05).

### Right-Edge Aligned Placement (D-09, D-10, D-11)

**Replace** `computeOrbitalPlacements()` with `computeEdgeAlignedPlacements()`:

```typescript
export function computeEdgeAlignedPlacements(
  triggerNode: CanvasNodeInfo,
  count: number,
  nodeSizes: Array<{ width: number; height: number }>,
  existingNodes: CanvasNodeInfo[],
  gap: number = DEFAULT_SPATIAL_CONFIG.placementGap
): PlacementCoordinate[] {
  // Primary direction: rightward from trigger's right edge (D-09)
  // x = trigger.x + trigger.width + gap
  // y = trigger.y (first node top-aligned with trigger)
  // Subsequent nodes stack vertically below (D-10):
  //   y += previousNode.height + gap
  
  // Collision detection (D-11): if rightward space blocked,
  // try below, then left, then above (clockwise fallback)
}
```

Key differences from the orbital approach:
- **Fixed x-position:** All nodes share the same x-coordinate (trigger right edge + gap), not an orbital radius
- **Vertical stacking:** Nodes stack downward, not fanned in an arc
- **Per-node sizing:** Accept `nodeSizes` array instead of single `nodeSize`, since companion nodes may differ in size from their parent code node
- **Directional fallback order:** Right -> Below -> Left -> Above (clockwise), not "most open direction"

### Companion Render Node Architecture (D-12, D-13, D-14)

**When:** After code streaming completes (in `onNodeBoundary` callback when `meta.type === 'code'`)

**What:** Create a second canvas text node adjacent to the code node, containing rendered output

**How per content type:**

1. **HTML/CSS/JS:** Create a text node containing an HTML block with a sandboxed iframe:
   ```typescript
   // Create text node, set content to iframe HTML via data URI or inline
   const companionContent = createHtmlPreview(codeContent);
   ```
   
   The iframe approach:
   - Create an iframe element programmatically in the canvas node's DOM
   - Use `srcdoc` attribute to inject the HTML content
   - Sandbox with `sandbox="allow-scripts"` (NO `allow-same-origin` -- this is critical for security)
   - The lack of `allow-same-origin` prevents the iframe from accessing the parent DOM or Electron APIs
   
2. **Mermaid:** The code node already contains the mermaid source as a fenced code block. The companion node contains the same content -- Obsidian renders `\`\`\`mermaid` blocks natively. This gives side-by-side source + rendered diagram.

3. **SVG:** Create a text node containing the SVG markup directly. Obsidian renders inline SVG in markdown preview mode.

**Companion node creation flow:**
```
onNodeBoundary(content, index, meta) {
  if (meta.type === 'code') {
    // 1. Finalize code node as usual
    // 2. Detect content type (HTML/Mermaid/SVG)
    // 3. Create companion node at code node's right edge
    // 4. For HTML: inject sandboxed iframe into node DOM
    // 5. For Mermaid: set node text to ```mermaid\n{content}\n```
    // 6. For SVG: set node text to raw SVG markup
  }
}
```

### Companion Node DOM Injection for HTML/JS

Canvas text nodes render markdown. For interactive HTML preview, we cannot rely on markdown rendering -- we need to inject an iframe directly into the node's DOM element after the node is created:

```typescript
function injectHtmlPreview(node: any, htmlContent: string): void {
  const nodeEl = node.nodeEl;
  if (!nodeEl) return;
  
  // Find or create preview container
  const container = nodeEl.querySelector('.markdown-rendered') 
    ?? nodeEl.createDiv();
  container.empty();
  
  const iframe = document.createElement('iframe');
  iframe.sandbox.add('allow-scripts'); // JS execution
  // NO allow-same-origin -- isolates from parent
  iframe.srcdoc = htmlContent;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  
  container.appendChild(iframe);
}
```

**Security model:** `sandbox="allow-scripts"` without `allow-same-origin` means:
- JavaScript CAN execute inside the iframe (user's HTML/JS code runs)
- The iframe CANNOT access the parent document's DOM
- The iframe CANNOT access Electron's Node.js APIs
- The iframe CANNOT escape its sandbox
- This is the standard approach recommended by both Electron docs and web security best practices

### Project Structure Changes

```
src/
├── taste/
│   └── taste-profile.ts      # UPDATE: nested YAML parsing, new interface
├── ai/
│   └── prompt-builder.ts     # UPDATE: counter-sycophancy section, style/substance formatting
├── spatial/
│   └── placement.ts          # REWRITE: edge-aligned placement replacing orbital
├── canvas/
│   ├── canvas-adapter.ts     # No changes needed
│   └── companion-node.ts     # NEW: companion render node creation + iframe injection
├── settings.ts               # UPDATE: "Open profile" button already wired (verify)
└── main.ts                   # UPDATE: companion node creation in onNodeBoundary
```

### Anti-Patterns to Avoid
- **Parsing YAML with regex:** Use line-by-line iteration with indentation tracking. Regex-based YAML parsing breaks on multi-line values and edge cases.
- **`allow-same-origin` with `allow-scripts` in iframe sandbox:** This combination allows the iframe to remove its own sandbox attribute, defeating all security. NEVER use both together.
- **Modifying orbital placement in-place:** Create a new function `computeEdgeAlignedPlacements` rather than adding flags to `computeOrbitalPlacements`. The algorithms are fundamentally different.
- **Bundling a Mermaid library:** Obsidian has Mermaid built-in. For the companion node, just create a text node with a mermaid fenced code block -- Obsidian renders it automatically.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mermaid rendering in companion node | Custom Mermaid parser/renderer | Obsidian's built-in Mermaid via fenced code blocks in text nodes | Obsidian bundles Mermaid. A text node with ` ```mermaid ` content renders automatically. |
| HTML sandbox isolation | Custom iframe security layer | Browser-native `sandbox` attribute with `allow-scripts` only | The sandbox attribute is the W3C-standard way to isolate iframe content. No custom code needed. |
| YAML library for 6-field nested config | Full YAML parser import | Simple string splitting with indentation detection | Project pattern established in Phase 3. The YAML structure is controlled (we define the format). A full parser is unnecessary overhead. |
| SVG rendering in companion node | SVG renderer library | Direct SVG markup in text node | Obsidian's markdown renderer handles inline SVG natively. |
| Opening files in editor | Custom editor pane creation | `workspace.openLinkText(path, '', false)` | Already implemented in `openTasteProfile()` in main.ts. |

**Key insight:** All three companion node render types (HTML/CSS/JS, Mermaid, SVG) can be achieved with platform capabilities already available in Obsidian/Electron. No new libraries needed.

## Common Pitfalls

### Pitfall 1: Backward-Compatible YAML Parsing Breaks on Edge Cases
**What goes wrong:** The flat-to-nested format detection fails when a user has custom fields or unexpected whitespace patterns in their frontmatter.
**Why it happens:** Simple heuristic (check for `style:` key) can be fooled if a user adds a field literally named `style:` with a value.
**How to avoid:** Use a strict detection approach: flat format is identified by the presence of the original four keys (`tone`, `depth`, `visual_preference`, `thinking_style`) at the top level. If any of these four appear without indentation, parse as flat format. Otherwise parse as nested.
**Warning signs:** Existing taste profile tests fail after parser change.

### Pitfall 2: Counter-Sycophancy Wording That Creates Hostile AI
**What goes wrong:** System prompt instructions are too aggressive, making Claude argumentative on every response rather than occasionally challenging.
**Why it happens:** Imperative language in prompts ("always challenge", "never agree") overrides the "use your judgment" intent.
**How to avoid:** Use permissive language ("when appropriate", "occasionally", "use your judgment on timing"). Frame it as a thinking partner quality, not a rule to follow on every turn.
**Warning signs:** During manual testing, every single generated node contains a "however" or "on the other hand" pattern.

### Pitfall 3: iframe srcdoc Content Escaping
**What goes wrong:** HTML content with quotes, backticks, or special characters breaks when injected via `srcdoc` attribute.
**Why it happens:** The `srcdoc` attribute value is HTML-escaped. Content with `"` or `&` needs proper escaping.
**How to avoid:** Use the DOM property `iframe.srcdoc = content` (JavaScript string, no HTML attribute escaping needed) rather than setting it as an HTML attribute string. The DOM API handles escaping correctly.
**Warning signs:** Companion nodes show garbled HTML or fail to render.

### Pitfall 4: Companion Node Placement Conflicts with Edge-Aligned Placement
**What goes wrong:** The companion node (placed to the right of the code node) overlaps with the next generated node (also placed to the right of the trigger).
**Why it happens:** The edge-aligned placement algorithm doesn't know about companion nodes that will be created later.
**How to avoid:** Create companion nodes AFTER all primary nodes are placed. Use the code node's position (not the trigger node's position) as the reference for companion placement. The companion goes to the RIGHT of the code node, which is further right than the primary placement zone.
**Warning signs:** Companion nodes overlap with text or image nodes from the same generation.

### Pitfall 5: Obsidian Text Node Not Rendering Mermaid in Companion
**What goes wrong:** A text node with mermaid fenced code block content doesn't render the diagram visually.
**Why it happens:** Canvas text nodes may need a re-render trigger after content is set programmatically. The `setText()` method may not trigger Obsidian's markdown renderer for preview.
**How to avoid:** After setting the mermaid content, call `canvas.requestSave()` and potentially trigger a re-render. The existing streaming pattern already handles this -- follow the same approach used for regular text nodes.
**Warning signs:** Companion mermaid node shows raw code instead of diagram.

### Pitfall 6: Edge-Aligned Placement Falls Back Too Aggressively
**What goes wrong:** With even one node blocking the rightward path, the algorithm immediately jumps to a completely different direction, placing nodes in unexpected locations.
**Why it happens:** Collision detection triggers on the first candidate position, and the fallback jumps too far instead of trying slight adjustments.
**How to avoid:** Before falling back to a different direction, try adjusting the y-position (sliding down) within the rightward zone. Only fall back to a different direction if the entire right column is blocked.
**Warning signs:** Nodes appear below or to the left of the trigger when there was clearly space to the right (just not at the exact y-position first tried).

## Code Examples

### Nested YAML Frontmatter Parsing

```typescript
// Source: Project-specific pattern extending Phase 3's parseTasteProfileFrontmatter()

function parseNestedFrontmatter(frontmatterBlock: string): TasteProfileFields {
  const lines = frontmatterBlock.split('\n');
  let currentGroup: 'style' | 'substance' | null = null;
  const fields: TasteProfileFields = {
    style: { tone: '', voice: '', formatting: '' },
    substance: { depth: '', domains: '', thinking_approach: '' },
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const isIndented = line.startsWith('  ') || line.startsWith('\t');
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    
    const key = trimmed.substring(0, colonIdx).trim();
    const value = trimmed.substring(colonIdx + 1).trim();
    
    if (!isIndented) {
      // Top-level key
      if (key === 'style' || key === 'substance') {
        currentGroup = key;
        continue;
      }
      // If we see a flat-format key at top level, it's legacy format
      if (['tone', 'depth', 'visual_preference', 'thinking_style'].includes(key)) {
        return migrateFlatToNested(frontmatterBlock);
      }
    } else if (currentGroup) {
      // Indented key belongs to current group
      if (currentGroup === 'style' && key in fields.style) {
        (fields.style as Record<string, string>)[key] = value;
      } else if (currentGroup === 'substance' && key in fields.substance) {
        (fields.substance as Record<string, string>)[key] = value;
      }
    }
  }
  
  return fields;
}
```

### Edge-Aligned Placement

```typescript
// Source: Project-specific replacement for computeOrbitalPlacements()

export function computeEdgeAlignedPlacements(
  triggerNode: CanvasNodeInfo,
  count: number,
  nodeSizes: Array<{ width: number; height: number }>,
  existingNodes: CanvasNodeInfo[],
  gap: number = DEFAULT_SPATIAL_CONFIG.placementGap
): PlacementCoordinate[] {
  const placements: PlacementCoordinate[] = [];
  const existingBoxes = existingNodes
    .filter(n => n.id !== triggerNode.id)
    .map(n => ({ x: n.x, y: n.y, width: n.width, height: n.height }));
  
  // Primary: stack rightward from trigger's right edge (D-09, D-10)
  const baseX = triggerNode.x + triggerNode.width + gap;
  let currentY = triggerNode.y; // Top-aligned with trigger
  
  for (let i = 0; i < count; i++) {
    const size = nodeSizes[i] ?? nodeSizes[0];
    const candidate = { x: baseX, y: currentY, width: size.width, height: size.height };
    
    // Check collision including already-placed nodes
    const allBoxes = [...existingBoxes, ...placements];
    
    if (!checkCollision(candidate, allBoxes, gap)) {
      placements.push(candidate);
    } else {
      // Slide down to find space, then fall back to other directions (D-11)
      const placed = findSpaceWithFallback(
        triggerNode, size, allBoxes, gap, baseX, currentY
      );
      placements.push(placed);
    }
    
    // Next node stacks below this one
    currentY = placements[placements.length - 1].y 
      + placements[placements.length - 1].height + gap;
  }
  
  return placements;
}
```

### Sandboxed HTML Preview in Companion Node

```typescript
// Source: Electron security docs + MDN iframe sandbox spec

function createHtmlCompanionContent(codeContent: string, lang: string): string | null {
  // Detect content type
  if (lang === 'html' || lang === 'htm' || 
      codeContent.includes('<html') || codeContent.includes('<!DOCTYPE')) {
    return codeContent; // Full HTML document
  }
  if (lang === 'svg' || codeContent.trimStart().startsWith('<svg')) {
    return null; // SVG handled differently (inline in text node)
  }
  return null;
}

function injectHtmlPreview(node: any, htmlContent: string): void {
  const nodeEl = node.nodeEl;
  if (!nodeEl) return;
  
  // Clear markdown renderer content
  const renderEl = nodeEl.querySelector('.markdown-rendered');
  if (renderEl) renderEl.empty();
  
  const container = renderEl ?? nodeEl.createDiv();
  
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  // Critical: NO allow-same-origin
  iframe.srcdoc = htmlContent;
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:white;';
  
  container.appendChild(iframe);
}
```

### formatTasteForPrompt with Style/Substance Structure

```typescript
// Source: Evolution of existing formatTasteForPrompt()

export function formatTasteForPrompt(profile: TasteProfile): string {
  const { fields, body, stylePhilosophy, substancePhilosophy } = profile;
  const parts: string[] = [];
  
  // Style section
  parts.push('### Style (how to communicate)');
  if (fields.style.tone) parts.push(`Tone: ${fields.style.tone}`);
  if (fields.style.voice) parts.push(`Voice: ${fields.style.voice}`);
  if (fields.style.formatting) parts.push(`Formatting: ${fields.style.formatting}`);
  if (stylePhilosophy) {
    parts.push('');
    parts.push(stylePhilosophy);
  }
  
  // Substance section
  parts.push('');
  parts.push('### Substance (what to communicate)');
  if (fields.substance.depth) parts.push(`Depth: ${fields.substance.depth}`);
  if (fields.substance.domains) parts.push(`Domains: ${fields.substance.domains}`);
  if (fields.substance.thinking_approach) parts.push(`Thinking Approach: ${fields.substance.thinking_approach}`);
  if (substancePhilosophy) {
    parts.push('');
    parts.push(substancePhilosophy);
  }
  
  // Combined body (if no separate sections)
  if (body && !stylePhilosophy && !substancePhilosophy) {
    parts.push('');
    parts.push(body);
  }
  
  return parts.join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat YAML frontmatter (4 fields) | Nested YAML with style/substance groups | Phase 5 | Parser needs backward compat |
| Orbital placement (arc fan) | Edge-aligned rightward stacking | Phase 5 | Completely different algorithm |
| No counter-sycophancy | Hardcoded system prompt instructions | Phase 5 | Prompt builder update |
| Code nodes as final output | Code nodes + companion render nodes | Phase 5 | New node creation in pipeline |

**Deprecated/outdated:**
- `computeOrbitalPlacements()` -- replaced by `computeEdgeAlignedPlacements()` but the collision detection helpers (`checkCollision`, `BoundingBox`) are reused
- `TasteProfileFields` as flat interface -- replaced by nested `TasteStyleFields` / `TasteSubstanceFields` structure, but flat format still parsed for backward compat
- Electron `webview` tag -- officially deprecated in favor of iframes by Electron documentation

## Open Questions

1. **Companion node persistence across canvas reload**
   - What we know: Canvas nodes are persisted as JSON in the .canvas file. Text nodes store their markdown content. An iframe injected via DOM manipulation will be lost on reload.
   - What's unclear: Whether the companion node should re-inject its iframe on canvas re-open, or just show the HTML source code as a fallback.
   - Recommendation: Store the HTML source in the text node as a fenced code block. On canvas load, use a post-processor or mutation observer to detect companion nodes and re-inject iframes. Mark companion nodes with `unknownData.companionOf = codeNodeId` for identification.

2. **Mermaid companion node rendering timing**
   - What we know: Obsidian renders mermaid code blocks in markdown preview. Canvas text nodes use markdown rendering.
   - What's unclear: Whether programmatically setting text content triggers Mermaid rendering immediately or requires a re-render cycle.
   - Recommendation: After `setText()`, call `canvas.requestSave()` which typically triggers a re-render. If mermaid doesn't render, investigate `node.render()` or `MarkdownRenderer.render()` as alternatives. Test empirically during implementation.

3. **Edge-aligned placement signature change**
   - What we know: `computeOrbitalPlacements` takes a single `nodeSize` param. The new function needs `nodeSizes[]` array for heterogeneous node types.
   - What's unclear: How many callers depend on the current signature and need updating.
   - Recommendation: The only caller is `main.ts` in the `streamWithRetry` method. Change the call site to pass an array of sizes based on the typed nodes being created. Keep `computeOrbitalPlacements` as a deprecated alias if needed, but since there is only one caller, a clean replacement is safer.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 + ts-jest |
| Config file | `jest.config.cjs` |
| Quick run command | `npx jest --bail` |
| Full suite command | `npx jest` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAST-05 | Settings UI button opens profile file | manual-only | N/A (requires Obsidian runtime) | N/A |
| TAST-06 | Nested YAML parsing with style/substance | unit | `npx jest tests/taste/taste-profile.test.ts -x` | Exists (needs update) |
| TAST-06 | Backward-compatible flat format parsing | unit | `npx jest tests/taste/taste-profile.test.ts -x` | Exists (needs update) |
| TAST-06 | formatTasteForPrompt with style/substance output | unit | `npx jest tests/taste/taste-profile.test.ts -x` | Exists (needs update) |
| TAST-07 | Counter-sycophancy instructions in system prompt | unit | `npx jest tests/ai/prompt-builder.test.ts -x` | Exists (needs update) |
| TAST-07 | Counter-sycophancy block contains four behaviors | unit | `npx jest tests/ai/prompt-builder.test.ts -x` | Exists (needs update) |
| D-09/D-10 | Edge-aligned rightward placement | unit | `npx jest tests/spatial/placement.test.ts -x` | Exists (needs rewrite) |
| D-11 | Collision fallback for blocked rightward space | unit | `npx jest tests/spatial/placement.test.ts -x` | Exists (needs rewrite) |
| D-12 | Companion node content detection (HTML/Mermaid/SVG) | unit | `npx jest tests/canvas/companion-node.test.ts -x` | Wave 0 |
| D-13 | HTML sanitization for iframe srcdoc | unit | `npx jest tests/canvas/companion-node.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --bail`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/canvas/companion-node.test.ts` -- covers D-12, D-13 (companion node content detection, HTML handling)
- [ ] Update `tests/taste/taste-profile.test.ts` -- covers TAST-06 (nested YAML parsing, backward compat, new formatTasteForPrompt)
- [ ] Update `tests/ai/prompt-builder.test.ts` -- covers TAST-07 (counter-sycophancy block presence, four behaviors)
- [ ] Update `tests/spatial/placement.test.ts` -- covers D-09, D-10, D-11 (edge-aligned placement replacing orbital)

## Sources

### Primary (HIGH confidence)
- `src/taste/taste-profile.ts` -- Current parser implementation, interface definitions, adapter pattern
- `src/ai/prompt-builder.ts` -- Current system prompt structure, cache control blocks, GENERATION_INSTRUCTIONS constant
- `src/spatial/placement.ts` -- Current orbital placement with collision detection
- `src/main.ts` -- Generation pipeline, onNodeBoundary callback, companion node creation point
- `src/settings.ts` -- Current settings tab layout, existing taste profile section
- `src/canvas/canvas-adapter.ts` -- Node creation methods, DOM manipulation patterns
- [Electron Web Embeds docs](https://www.electronjs.org/docs/latest/tutorial/web-embeds) -- iframe vs webview recommendation
- [Electron Security docs](https://www.electronjs.org/docs/latest/tutorial/security) -- sandbox best practices

### Secondary (MEDIUM confidence)
- [MDN iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) -- sandbox attribute specification
- [Obsidian Forum: iframe sandbox restrictions](https://forum.obsidian.md/t/can-iframe-sandbox-restrictions-be-removed-via-a-plugin/27909) -- Obsidian's default sandbox config
- [obsidian-iframe-renderer](https://github.com/natarslan/obsidian-iframe-renderer) -- Pattern for iframe DOM injection in Obsidian plugins
- [Obsidian MarkdownRenderer API](https://docs.obsidian.md/Reference/TypeScript+API/MarkdownRenderer/render) -- render() for mermaid in text nodes
- [web.dev sandboxed iframes](https://web.dev/articles/sandboxed-iframes) -- Best practices for iframe isolation

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies. All existing libraries are well-understood.
- Taste profile evolution: HIGH -- Extending existing parser with clear patterns. Backward compat approach is straightforward.
- Counter-sycophancy: HIGH -- Pure prompt text addition to existing constant. No code complexity.
- Placement algorithm: HIGH -- Pure math module with comprehensive existing tests. Replacement is well-defined.
- Companion nodes: MEDIUM -- iframe injection in canvas DOM is not a standard Obsidian pattern. Persistence across canvas reload needs empirical validation. Mermaid re-render timing unclear.
- Settings UI: HIGH -- Button already partially implemented in `openTasteProfile()`. Just needs wiring.

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable domain, no fast-moving dependencies)
