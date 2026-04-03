/**
 * Canvas event types detected by monkey-patching.
 * These are the stable event names emitted by the patcher (Plan 04).
 */
export const CANVAS_EVENT_TYPES = {
  NODE_CREATED: 'canvas-ai:node-created',
  NODE_REMOVED: 'canvas-ai:node-removed',
  NODE_MOVED: 'canvas-ai:node-moved',
  CANVAS_CHANGED: 'canvas-ai:canvas-changed',
} as const;

export type CanvasEventType = typeof CANVAS_EVENT_TYPES[keyof typeof CANVAS_EVENT_TYPES];

/**
 * Payload for canvas events dispatched through workspace.trigger().
 */
export interface CanvasEvent {
  type: CanvasEventType;
  canvasPath: string;
  timestamp: number;
  nodeId?: string;
}
