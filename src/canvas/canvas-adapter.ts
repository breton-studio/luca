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
