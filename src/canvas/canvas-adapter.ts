import type { App, TFile, WorkspaceLeaf } from 'obsidian';
import type { CanvasView } from 'obsidian-typings';
import type { CanvasData, AllCanvasNodeData } from 'obsidian/canvas';
import type { CanvasNodeInfo, CanvasSnapshot, CanvasEdgeInfo } from '../types/canvas';
import type { ViewportState } from '../spatial/types';

/**
 * Canvas Adapter Layer (FOUN-02).
 *
 * Single point of contact between the plugin and Obsidian's undocumented
 * canvas internals. If canvas internal APIs change in an Obsidian update,
 * only this file needs updating.
 *
 * Primary path: Internal Canvas API (fast, real-time, typed via obsidian-typings).
 * Fallback path: File-based JSON via vault.read() (FOUN-03).
 *
 * IMPORTANT (FOUN-13): This adapter NEVER uses vault.modify() when a canvas
 * view is active, because canvas's requestSave has a 2-second debounce that
 * would overwrite our changes. All live manipulation uses internal API.
 * File I/O is read-only or used only when no canvas view is active.
 */
export class CanvasAdapter {
  constructor(private app: App) {}

  /**
   * Get the canvas object from the active leaf, or null if not a canvas view.
   * Returns the internal Canvas object (typed via obsidian-typings).
   */
  getActiveCanvas(): any | null {
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf || leaf.view.getViewType() !== 'canvas') return null;
    try {
      return (leaf.view as unknown as CanvasView).canvas ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get the active canvas view's file path.
   */
  getActiveCanvasPath(): string | null {
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf || leaf.view.getViewType() !== 'canvas') return null;
    return (leaf.view as any).file?.path ?? null;
  }

  /**
   * Get the Canvas prototype from a live canvas instance.
   * Used by the patcher (Plan 04) to apply monkey-patches once.
   */
  getCanvasPrototype(leaf: WorkspaceLeaf): object | null {
    if (leaf.view.getViewType() !== 'canvas') return null;
    try {
      const canvas = (leaf.view as unknown as CanvasView).canvas;
      return Object.getPrototypeOf(canvas);
    } catch {
      return null;
    }
  }

  /**
   * Read all nodes from the active canvas via internal API (primary path).
   * Returns normalized CanvasNodeInfo[] for plugin consumption.
   */
  getNodesFromCanvas(canvas: any): CanvasNodeInfo[] {
    try {
      const nodes: CanvasNodeInfo[] = [];
      // canvas.nodes is a Map<string, CanvasViewCanvasNode>
      if (canvas.nodes && typeof canvas.nodes.values === 'function') {
        for (const node of canvas.nodes.values()) {
          nodes.push(this.normalizeNode(node));
        }
      }
      return nodes;
    } catch {
      return [];
    }
  }

  /**
   * Get canvas file path from a canvas internal object.
   */
  getCanvasFilePath(canvas: any): string | null {
    try {
      return canvas?.view?.file?.path ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Read all edges from the active canvas via internal API.
   * Returns normalized CanvasEdgeInfo[] for spatial analysis.
   * Follows the same defensive pattern as getNodesFromCanvas (Pitfall 5).
   */
  getEdgesFromCanvas(canvas: any): CanvasEdgeInfo[] {
    try {
      const edges: CanvasEdgeInfo[] = [];
      // canvas.edges is a Map<string, CanvasEdge> (similar to canvas.nodes)
      if (canvas.edges && typeof canvas.edges.values === 'function') {
        for (const edge of canvas.edges.values()) {
          const fromNode = edge.from?.node?.id ?? '';
          const toNode = edge.to?.node?.id ?? '';
          // Filter out edges with missing endpoint references
          if (fromNode === '' || toNode === '') continue;
          edges.push({
            id: edge.id ?? '',
            fromNode,
            toNode,
            label: edge.label ?? undefined,
          });
        }
      }
      return edges;
    } catch {
      return [];
    }
  }

  /**
   * Read viewport state (pan and zoom) from the active canvas.
   * Returns null if viewport data is unavailable.
   */
  getViewportState(canvas: any): ViewportState | null {
    try {
      return {
        x: canvas.x ?? 0,
        y: canvas.y ?? 0,
        zoom: canvas.zoom ?? 1,
      };
    } catch {
      return null;
    }
  }

  // ─── Write Methods (Phase 3) ──────────────────────────────────────
  // IMPORTANT (FOUN-13): All write methods use internal Canvas API ONLY.
  // Never use vault.modify() while a canvas view is active -- canvas's
  // requestSave debounce (2-second window) would overwrite file changes.

  /**
   * Create a text node on the canvas at the specified position.
   * Uses internal Canvas API createTextNode (Obsidian ^1.12 object format).
   *
   * @param canvas - Internal canvas object
   * @param position - Node position and dimensions
   * @param color - Optional canvas color preset ("1"-"6") for AI node (MMED-10)
   * @returns The created node, or null on failure
   */
  createTextNodeOnCanvas(
    canvas: any,
    position: { x: number; y: number; width: number; height: number },
    color?: string
  ): any | null {
    try {
      const node = canvas.createTextNode({
        pos: { x: position.x, y: position.y },
        size: { width: position.width, height: position.height },
        text: '',
        focus: false,
      });

      // Set AI node color if provided (MMED-10).
      // Must use setData() for persistence -- direct property assignment is runtime-only (Pitfall 5).
      if (color !== undefined) {
        node.setData({ color });
      }

      // Defensively add to canvas if createTextNode didn't auto-add (Open Question 1).
      if (!canvas.nodes.has(node.id)) {
        canvas.addNode(node);
      }

      return node;
    } catch (e) {
      console.error('CanvasAdapter: createTextNodeOnCanvas failed (internal API unavailable)', e);
      return null;
    }
  }

  /**
   * Update the text content of an existing canvas node.
   * Fire-and-forget for intermediate streaming flushes (Open Question 2).
   * Wraps silently -- node may have been destroyed.
   *
   * @param node - Internal canvas node object
   * @param text - New text content
   */
  updateNodeText(node: any, text: string): void {
    try {
      node.setText(text);
    } catch {
      // Silently catch -- node may have been destroyed during streaming
    }
  }

  /**
   * Add a CSS class to a canvas node's DOM element.
   * Also sets a persistent marker in unknownData for re-application on re-render (Pitfall 8).
   *
   * @param node - Internal canvas node object
   * @param className - CSS class name to add
   */
  addNodeCssClass(node: any, className: string): void {
    node.nodeEl?.addClass(className);
    node.unknownData = { ...node.unknownData, canvasAiStreaming: true };
  }

  /**
   * Remove a CSS class from a canvas node's DOM element.
   * Clears the persistent marker in unknownData.
   *
   * @param node - Internal canvas node object
   * @param className - CSS class name to remove
   */
  removeNodeCssClass(node: any, className: string): void {
    node.nodeEl?.removeClass(className);
    if (node.unknownData) {
      delete node.unknownData.canvasAiStreaming;
    }
  }

  /**
   * Resize a canvas node (e.g., after streaming completes to fit content).
   * Preserves original x, y, and width; only changes height.
   *
   * @param node - Internal canvas node object
   * @param height - New height value
   */
  resizeNode(node: any, height: number): void {
    try {
      node.moveAndResize({
        x: node.x,
        y: node.y,
        width: node.width,
        height,
      });
    } catch {
      // Silently catch -- node may have been destroyed
    }
  }

  /**
   * Request the canvas to persist its current state.
   * Call after streaming completes to ensure final node state is saved.
   *
   * @param canvas - Internal canvas object
   */
  requestCanvasSave(canvas: any): void {
    try {
      canvas.requestSave();
    } catch {
      // Silently catch -- canvas may have been closed
    }
  }

  /**
   * Create a file node on the canvas at the specified position.
   * Used for displaying generated images (MMED-07).
   * Uses internal Canvas API createFileNode.
   * Parameter shape: { pos, size, file, focus } -- inferred from createTextNode pattern.
   *
   * @param canvas - Internal canvas object
   * @param position - Node position and dimensions
   * @param filePath - Vault-relative path to the file (e.g., 'canvas-ai-images/2026-04-03_abc12345.png')
   * @param color - Optional canvas color preset for AI node (MMED-10)
   * @returns The created node, or null on failure
   */
  createFileNodeOnCanvas(
    canvas: any,
    position: { x: number; y: number; width: number; height: number },
    filePath: string,
    color?: string
  ): any | null {
    try {
      const node = canvas.createFileNode({
        pos: { x: position.x, y: position.y },
        size: { width: position.width, height: position.height },
        file: filePath,
        focus: false,
      });

      if (!node) {
        console.error('CanvasAdapter: createFileNode returned undefined');
        return null;
      }

      // Set AI node color if provided (MMED-10)
      if (color !== undefined) {
        node.setData({ color });
      }

      // Defensively add to canvas if createFileNode didn't auto-add
      if (!canvas.nodes.has(node.id)) {
        canvas.addNode(node);
      }

      return node;
    } catch (e) {
      console.error('CanvasAdapter: createFileNodeOnCanvas failed (internal API unavailable)', e);
      return null;
    }
  }

  /**
   * Remove a node from the canvas.
   * Used during image placeholder-to-file-node swap (MMED-08).
   *
   * @param canvas - Internal canvas object
   * @param node - The node to remove
   */
  removeNodeFromCanvas(canvas: any, node: any): void {
    try {
      canvas.removeNode(node);
    } catch {
      // Silently catch -- node may already be removed
    }
  }

  /**
   * FALLBACK (FOUN-03): Read canvas data from file when internal API is unavailable.
   * Used when: canvas view is not active, internal API breaks, or batch reading.
   */
  async readCanvasFile(file: TFile): Promise<CanvasSnapshot | null> {
    try {
      const content = await this.app.vault.read(file);
      const data: CanvasData = JSON.parse(content);
      const nodes = (data.nodes || []).map((nodeData: AllCanvasNodeData) =>
        this.normalizeNodeData(nodeData)
      );
      const edges: CanvasEdgeInfo[] = (data.edges || []).map((e) => ({
        id: e.id,
        fromNode: e.fromNode,
        toNode: e.toNode,
        label: e.label ?? undefined,
      }));
      return { nodes, edges, filePath: file.path };
    } catch {
      return null;
    }
  }

  /**
   * Normalize an internal canvas node object to CanvasNodeInfo.
   * Internal API node properties (from obsidian-typings CanvasViewCanvasNode):
   *   id, x, y, width, height, color, filePath, bbox, unknownData
   * Content is resolved via getData() or direct properties.
   */
  private normalizeNode(node: any): CanvasNodeInfo {
    const bbox = node.bbox ?? {
      minX: node.x,
      minY: node.y,
      maxX: node.x + node.width,
      maxY: node.y + node.height,
    };
    return {
      id: node.id ?? '',
      type: this.resolveNodeType(node),
      x: node.x ?? bbox.minX ?? 0,
      y: node.y ?? bbox.minY ?? 0,
      width: node.width ?? ((bbox.maxX - bbox.minX) || 300),
      height: node.height ?? ((bbox.maxY - bbox.minY) || 200),
      content: this.resolveContent(node),
      color: node.color ?? undefined,
    };
  }

  /**
   * Normalize a canvas file node data object to CanvasNodeInfo.
   * Uses the standard CanvasData JSON format from obsidian/canvas.
   */
  private normalizeNodeData(nodeData: AllCanvasNodeData): CanvasNodeInfo {
    return {
      id: nodeData.id,
      type: nodeData.type as CanvasNodeInfo['type'],
      x: nodeData.x,
      y: nodeData.y,
      width: nodeData.width,
      height: nodeData.height,
      content: this.resolveContentFromData(nodeData),
      color: nodeData.color ?? undefined,
    };
  }

  /**
   * Determine node type from internal canvas node object.
   * Internal nodes expose filePath, url, or label depending on type.
   */
  private resolveNodeType(node: any): CanvasNodeInfo['type'] {
    if (node.filePath !== undefined) return 'file';
    if (node.url !== undefined) return 'link';
    if (node.label !== undefined) return 'group';
    return 'text';
  }

  /**
   * Extract content from an internal canvas node object.
   * Tries direct properties first, then getData() as fallback.
   */
  private resolveContent(node: any): string {
    if (node.text !== undefined) return node.text;
    if (node.filePath !== undefined) return node.filePath;
    if (node.url !== undefined) return node.url;
    if (node.label !== undefined) return node.label;
    // Try getData() if available (some internal nodes expose content this way)
    try {
      const data = node.getData?.();
      if (data?.text) return data.text;
      if (data?.file) return data.file;
      if (data?.url) return data.url;
    } catch {
      /* getData() may not exist on all node types */
    }
    return '';
  }

  /**
   * Extract content from a canvas file JSON node data object.
   * Each node type stores content in a different field per the CanvasData spec.
   */
  private resolveContentFromData(nodeData: AllCanvasNodeData): string {
    switch (nodeData.type) {
      case 'text':
        return nodeData.text ?? '';
      case 'file':
        return nodeData.file ?? '';
      case 'link':
        return nodeData.url ?? '';
      case 'group':
        return nodeData.label ?? '';
      default:
        return '';
    }
  }
}
