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
Generate 1-3 text nodes depending on the richness of the context.
Wrap each node's content in <node> tags:

<node>
Content for the first node (markdown).
</node>

<node>
Content for the second node (markdown), if warranted.
</node>

Rules:
- Each <node> block becomes a separate canvas node
- Generate 1 node for simple/focused contexts, 2-3 for rich/complex contexts
- Each node should contain a distinct idea, perspective, or connection
- Content is markdown: use headers, lists, emphasis, and code blocks naturally
- Keep each node focused on a single concept (typically 50-200 words)
- Never repeat or paraphrase existing node content
- Never prefix content with labels like "AI:" or "Generated:" -- content stands alone per D-07

## Medium Selection
For now, generate text/markdown nodes only.
- Use headers, lists, and emphasis for structure
- Include code blocks when the context is technical
- Use Mermaid code blocks (\`\`\`mermaid) when a diagram would clarify relationships

## Spatial Awareness
- Consider the spatial arrangement of nodes when generating
- Nodes near each other are conceptually related
- Dense clusters represent focus areas
- Your response should extend the thinking in the direction the user is building
- Do not merely summarize -- add new perspectives, connections, or challenges`;

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
  return 'Based on the canvas context above, generate content that extends the user\'s thinking. Follow the output format with <node> tags.';
}
