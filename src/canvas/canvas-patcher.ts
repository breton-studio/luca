import { Plugin, WorkspaceLeaf } from 'obsidian';
import { around } from 'monkey-around';
import { CANVAS_EVENT_TYPES } from './canvas-events';
import type { CanvasEvent } from './canvas-events';

/**
 * Initialize canvas prototype monkey-patching (FOUN-04, FOUN-05, FOUN-06, FOUN-07).
 *
 * Patches Canvas.prototype methods via `monkey-around`:
 * - addNode -> fires NODE_CREATED (FOUN-04)
 * - requestSave -> fires CANVAS_CHANGED (FOUN-05, edit detection)
 * - markMoved -> fires NODE_MOVED (FOUN-06)
 * - removeNode -> fires NODE_REMOVED (FOUN-07)
 *
 * Patches are applied ONCE to the prototype (not per-instance) and
 * automatically cleaned up on plugin unload via plugin.register().
 *
 * @param plugin - The CanvasAIPlugin instance for event registration and settings access
 */
export function initCanvasPatching(plugin: Plugin & { settings: { debugMode: boolean } }): void {
  let patched = false;

  plugin.registerEvent(
    plugin.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {
      if (patched) return;
      if (!leaf || leaf.view.getViewType() !== 'canvas') return;

      const canvas = (leaf.view as any).canvas;
      if (!canvas) return;

      const canvasProto = Object.getPrototypeOf(canvas);
      if (!canvasProto) return;

      // Helper: get canvas file path from a canvas instance
      const getPath = (canvasInstance: any): string => {
        return canvasInstance?.view?.file?.path ?? 'unknown';
      };

      // Helper: emit a canvas event via workspace.trigger
      const emit = (type: string, canvasInstance: any, nodeId?: string): void => {
        const canvasPath = getPath(canvasInstance);
        const event: CanvasEvent = {
          type: type as CanvasEvent['type'],
          canvasPath,
          timestamp: Date.now(),
          nodeId,
        };
        plugin.app.workspace.trigger(type, event);

        // D-14: Debug mode logging
        if ((plugin as any).settings?.debugMode) {
          console.log(`[Canvas AI] ${type}`, {
            canvas: canvasPath,
            nodeId: nodeId ?? '(none)',
            time: new Date().toISOString(),
          });
        }
      };

      // FOUN-04: Detect node create events
      const uninstallAddNode = around(canvasProto, {
        addNode(oldMethod: any) {
          return function (this: any, ...args: any[]) {
            const result = oldMethod.apply(this, args);
            const nodeId = args[0]?.id ?? result?.id ?? undefined;
            emit(CANVAS_EVENT_TYPES.NODE_CREATED, this, nodeId);
            return result;
          };
        },
      });

      // FOUN-07: Detect node delete events
      const uninstallRemoveNode = around(canvasProto, {
        removeNode(oldMethod: any) {
          return function (this: any, ...args: any[]) {
            const nodeId = args[0]?.id ?? undefined;
            emit(CANVAS_EVENT_TYPES.NODE_REMOVED, this, nodeId);
            return oldMethod.apply(this, args);
          };
        },
      });

      // FOUN-06: Detect node move events
      const uninstallMarkMoved = around(canvasProto, {
        markMoved(oldMethod: any) {
          return function (this: any, ...args: any[]) {
            const nodeId = args[0]?.id ?? undefined;
            emit(CANVAS_EVENT_TYPES.NODE_MOVED, this, nodeId);
            return oldMethod.apply(this, args);
          };
        },
      });

      // FOUN-05: Detect edits via requestSave (catch-all change detector)
      const uninstallRequestSave = around(canvasProto, {
        requestSave(oldMethod: any) {
          return function (this: any, ...args: any[]) {
            emit(CANVAS_EVENT_TYPES.CANVAS_CHANGED, this);
            return oldMethod.apply(this, args);
          };
        },
      });

      // Register all uninstallers for automatic cleanup on plugin unload
      plugin.register(uninstallAddNode);
      plugin.register(uninstallRemoveNode);
      plugin.register(uninstallMarkMoved);
      plugin.register(uninstallRequestSave);

      patched = true;

      if ((plugin as any).settings?.debugMode) {
        console.log('[Canvas AI] Canvas prototype patched successfully');
      }
    })
  );
}
