/**
 * Types for multi-medium generation pipeline (Phase 4).
 *
 * Defines the medium types that Claude can generate and the metadata
 * parsed from typed <node type="..."> tags in the stream.
 */

/**
 * The four medium types supported in generation.
 * - text: Markdown text (progressive streaming)
 * - code: Fenced code blocks with language tag (progressive streaming)
 * - mermaid: Mermaid diagram code blocks (buffered until complete)
 * - image: Image prompt for Runware/Riverflow (async, non-blocking)
 */
export type NodeType = 'text' | 'code' | 'mermaid' | 'image';

/**
 * Metadata parsed from a typed <node> opening tag.
 * Exposed to stream callbacks so callers can route rendering by medium type.
 *
 * Examples:
 *   <node type="text">       -> { type: 'text' }
 *   <node type="code" lang="typescript"> -> { type: 'code', lang: 'typescript' }
 *   <node type="mermaid">    -> { type: 'mermaid' }
 *   <node type="image">      -> { type: 'image' }
 */
export interface TypedNodeMeta {
  type: NodeType;
  lang?: string; // Only present for type='code'
}
