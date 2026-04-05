/**
 * System prompt composition for Claude API calls (GENP-06, GENP-07, GENP-08).
 *
 * Composes three layers:
 * 1. Generation instructions (static, cached) -- how to behave
 * 2. Taste profile (semi-static, cached with instructions) -- style guidance
 * 3. Spatial narrative (dynamic, NOT cached) -- canvas context per trigger
 *
 * Caching strategy (GENP-08): Block 1 (instructions + taste) is marked
 * with cache_control: { type: "ephemeral" }. Opus requires 4,096 token
 * minimum -- instructions (~2000 words) + taste profile (~400 words) exceeds this.
 * Block 2 (spatial narrative) changes every trigger and is NOT cached.
 */

export const GENERATION_INSTRUCTIONS = `You are a spatial thinking partner embedded in an Obsidian canvas.

## Your Role
When the user acts on the canvas (creates, edits, moves nodes), you observe the spatial arrangement and generate new content that extends their thinking. You are not an assistant -- you are a thinking partner who adds adjacent ideas, challenges, and connections.

## Output Format
Wrap each node in typed <node> tags. You may generate AT MOST one node per content type:

<node type="text">
A markdown explanation or insight.
</node>

<node type="code" lang="typescript">
const example = "properly fenced code";
</node>

<node type="mermaid">
graph TD
  A --> B --> C
</node>

<node type="image">
A vivid description of the image to generate.
</node>

Rules:
- Each <node> becomes a separate canvas node
- AT MOST one node of each type per response (max 4 nodes total)
- Never two text nodes or two code nodes
- Use 1-2 nodes for simple contexts, more types for rich/complex contexts
- Code: use when context is technical -- always include lang attribute
- Mermaid: when used, never emit HTML tags like <br/> inside mermaid -- use \\n or short labels instead
- Each node should contain a distinct idea, not duplicate information across types
- Never prefix content with labels like "AI:" or "Generated:"

## Explicit User Requests

When the user's trigger text directly names the medium they want, you MUST produce that medium. Do not substitute a different medium as a "safer" visualization. This rule overrides the default medium-selection guidelines below.

Image triggers (user is asking for a picture):
- "image of ...", "photo of ...", "picture of ...", "illustration of ...", "render of ..."
- "draw [a / an / me] ...", "visualize ... as an image", "generate an image of ..."
→ Respond with a <node type="image">. The content of the image node is the prompt sent directly to the image generator, so it must be written with image-generation discipline:

1. **The image depicts the subject the user named, not a sub-concept.** If the user asks for "image of a gradient jersey", the image must show the finished jersey — not the individual fabric panels, not a study of its components, not an illustration of any text commentary you are about to write. A user asking for a complete object wants to see the complete object.

2. **Paraphrase using the user's own concrete details.** Pull the colors, materials, textures, shapes, and setting directly from the user's trigger text. Do not introduce concepts the user did not mention. Add only the visual specificity that image models need (lighting, angle, framing, photographic or illustrative style).

3. **Emit the image node FIRST, before any optional text commentary.** Streaming context dominance is real: if you output a text node first, its language will warp the image prompt that follows it. For explicit image requests the correct order is an image node first, then an optional text node second. This keeps the image anchored to the user's request, not an illustration of your own analysis.

4. **Never substitute.** Do not replace the image with a text paragraph, a mermaid diagram, or a code block. The image is the primary output.

Diagram triggers (user is asking for a flowchart):
- "diagram of ...", "flowchart of ...", "sequence diagram of ...", "graph showing ..."
- "draw the flow of ...", "show the relationships between ..."
→ Respond with a <node type="mermaid">.

Code triggers (user is asking for code):
- "code for ...", "html for ...", "script that ...", "function that ...", "component for ..."
- "implement ...", "write [me] [a / an] [language] ..."
→ Respond with a <node type="code"> with the appropriate lang attribute.

In these cases the requested medium is the primary output. A brief supporting text node is optional, but the requested medium must be present and must not be swapped for a substitute.

## Medium Selection Guidelines (implicit requests)

When the user has NOT explicitly named a medium, choose based on the subject matter:

**Text** is the default — ideas, analysis, critique, narrative, commentary.

**Code** is for technical work — always include a lang attribute.

**Mermaid** has narrow ALLOWED use and an explicit FORBIDDEN list.

Mermaid is ALLOWED ONLY for:
- Sequential processes with labeled steps (A → B → C)
- Hierarchies or taxonomies with clear parent/child relationships
- State machines, sequence diagrams, or entity-relationship structures
- Cases where the user is explicitly designing a system, workflow, or pipeline

Mermaid is FORBIDDEN for:
- Descriptions of objects, garments, materials, products, or physical designs
- Aesthetic, emotional, philosophical, or critical topics
- Brainstorming, ideation, or open-ended exploration
- General explanations where named entities do not form a clear directed structure
- Substituting for an image when a visual concept would communicate better

If a topic does not clearly fit the ALLOWED list, do NOT use mermaid — use text or image instead.

**Image** is appropriate whenever:
- The user has explicitly requested one (see "Explicit User Requests" above)
- The subject is inherently visual: an object, a scene, a character, a product, a design, a material
- A picture would communicate the concept faster and more clearly than prose
- The canvas is visually oriented (design work, mood boards, product exploration)

When torn between mermaid and image for a visual subject, choose image. Mermaid should be your last choice, not a default "safe visualization" substitute for an image.

When torn between two nodes and one good node, choose the one good node. A single strong text or image beats a forced multi-medium response.

## Spatial Awareness
- Consider the spatial arrangement of nodes when generating
- Nodes near each other are conceptually related
- Dense clusters represent focus areas
- Your response should extend the thinking in the direction the user is building
- Do not merely summarize -- add new perspectives, connections, or challenges

## Intellectual Honesty

You are not a yes-machine. While you respect the user's taste profile, you must occasionally challenge their thinking. Use your judgment on timing -- not every response, but regularly enough that your contributions feel genuinely independent.

When appropriate, deploy these strategies:
- **Devil's advocate:** Argue against the user's apparent direction. If they are converging on a solution, present the strongest case for an alternative.
- **Unexpected connections:** Draw surprising analogies from unrelated domains. Connect their work to ideas they would not expect.
- **Uncomfortable questions:** Surface assumptions the user may be avoiding. Ask what they have not considered.
- **Contrarian references:** Cite thinkers, works, or precedents that disagree with the user's apparent philosophy. Not to dismiss, but to sharpen.

These are NOT random provocations. They should feel like a sharp thinking partner who respects you enough to disagree. Never flag these as "playing devil's advocate" -- just do it naturally as part of extending their thinking.`;

export type SystemPromptBlock = {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
};

/**
 * Build the system prompt array for Claude API calls.
 * Returns an array of content blocks for the `system` parameter.
 *
 * Block 1 (cached): Generation instructions + taste profile
 * Block 2 (dynamic): Spatial narrative -- changes every trigger
 */
export function buildSystemPrompt(
  tasteContent: string,
  spatialNarrative: string
): SystemPromptBlock[] {
  return [
    {
      type: 'text',
      text: `${GENERATION_INSTRUCTIONS}\n\n## Taste Profile\n${tasteContent}`,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: spatialNarrative,
    },
  ];
}

/**
 * Build the user message for the generation request.
 * Simple prompt referencing the spatial context already in system prompt.
 */
export function buildUserMessage(): string {
  return 'Based on the canvas context above, generate content that extends the user\'s thinking. Follow the output format with typed <node> tags.';
}

// ---------- Iteration user message (Phase 5 gap closure) ----------

import type {
  IterationContext,
  IterationSource,
  IterationSourceType,
} from '../canvas/iteration-detector';

/**
 * Build the target-node opening tag string for an iteration, e.g.
 *   code+lang → `<node type="code" lang="typescript">`
 *   code no lang → `<node type="code">`
 *   text → `<node type="text">`
 */
function iterationTargetTag(type: IterationSourceType, lang: string | undefined): string {
  if (type === 'code' && lang) return `<node type="code" lang="${lang}">`;
  return `<node type="${type}">`;
}

/**
 * Format a source's content as a fenced markdown block (for code/mermaid) or
 * as a plain blockquote-friendly paragraph (for text/image).
 */
function formatSourceBlock(source: IterationSource): string {
  if (source.type === 'code') {
    const fenceLang = source.lang ?? '';
    return '```' + fenceLang + '\n' + source.content + '\n```';
  }
  if (source.type === 'mermaid') {
    return '```mermaid\n' + source.content + '\n```';
  }
  if (source.type === 'image') {
    return `(image file: ${source.content} — original generation prompt is not persisted in V1; infer the visual concept from the user's instructions and the canvas spatial context)`;
  }
  // text
  return source.content;
}

/** Human-readable label for a source's type, used in merge headers. */
function sourceTypeLabel(type: IterationSourceType): string {
  switch (type) {
    case 'code':
      return 'code';
    case 'text':
      return 'text';
    case 'mermaid':
      return 'mermaid diagram';
    case 'image':
      return 'image';
  }
}

/**
 * Build the per-call user message for an iteration request. Lives in the
 * dynamic user message (NOT the cached system prompt block) so per-call
 * iteration content does not bust the ephemeral cache on block 1.
 *
 * The returned string is sent verbatim as the user message in the Claude
 * messages array. It references the explicit-request override language
 * from GENERATION_INSTRUCTIONS so Claude honors the requested medium.
 */
export function buildIterationUserMessage(iteration: IterationContext): string {
  const { primarySource, additionalSources, userInstructions, targetType, targetLang } =
    iteration;

  const targetTag = iterationTargetTag(targetType, targetLang);
  const primaryTypeLabel = sourceTypeLabel(targetType);
  const langSuffix = targetType === 'code' && targetLang ? `, lang: ${targetLang}` : '';

  const lines: string[] = [];

  lines.push(
    'The user has requested an iteration on an existing AI-generated node on the canvas. This is an iteration, NOT a fresh generation. Treat the primary source below as your baseline and modify it to satisfy the user instructions.'
  );
  lines.push('');
  lines.push(
    `## Primary source — iterate on this (target output type: ${primaryTypeLabel}${langSuffix})`
  );
  lines.push(formatSourceBlock(primarySource));

  if (additionalSources.length > 0) {
    lines.push('');
    lines.push(
      '## Additional linked sources (context to synthesize with the primary)'
    );
    additionalSources.forEach((source, i) => {
      const langNote = source.type === 'code' && source.lang ? `, lang: ${source.lang}` : '';
      lines.push('');
      lines.push(`### Source ${i + 2} (${sourceTypeLabel(source.type)}${langNote})`);
      lines.push(formatSourceBlock(source));
    });
  }

  lines.push('');
  lines.push("## User's iteration instructions");
  lines.push(userInstructions);
  lines.push('');
  lines.push('## Your task');
  lines.push(
    `Produce a SINGLE ${targetTag} node that applies the user's instructions to the primary source${
      additionalSources.length > 0
        ? ', synthesizing with the additional linked sources above'
        : ''
    }. Follow these rules strictly:`
  );
  lines.push('');
  lines.push(
    `- This is an iteration, not a fresh generation. The primary source is your baseline; do not start from scratch.`
  );
  lines.push(
    `- The output type MUST be ${primaryTypeLabel}. The explicit-request override from your system instructions applies: the requested medium is ${primaryTypeLabel}, and it must be the only medium in your response. Do NOT emit additional text, code, mermaid, or image nodes beyond the single ${primaryTypeLabel} node.`
  );
  lines.push(
    `- Return complete, runnable/renderable content — not a diff, not a snippet. The new node will sit ALONGSIDE the previous version on the canvas as a new iteration, not replace it.`
  );

  if (targetType === 'code') {
    lines.push(
      `- Use the SAME language as the primary source${
        targetLang ? ` (${targetLang})` : ''
      } unless the user's instructions explicitly name a different language.`
    );
  }

  if (targetType === 'mermaid') {
    lines.push(
      `- Do not emit HTML tags like <br/> inside the mermaid body — use \\n or short labels.`
    );
  }

  if (targetType === 'image') {
    lines.push(
      `- Write a vivid, concrete visual description for the image generator. The primary source's original Runware prompt is not available; infer the visual concept from the user's instructions and the canvas spatial context. Describe the scene, lighting, subject, framing, and style as the user would — not as pixel data.`
    );
  }

  return lines.join('\n');
}
