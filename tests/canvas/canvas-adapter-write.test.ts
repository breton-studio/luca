import { CanvasAdapter } from '../../src/canvas/canvas-adapter';

// Minimal App mock -- write methods don't use this.app
const mockApp = {} as any;

function createMockCanvas() {
  const nodesMap = new Map();
  return {
    createTextNode: jest.fn((opts: any) => {
      const node = createMockNode(opts);
      nodesMap.set(node.id, node);
      return node;
    }),
    addNode: jest.fn(),
    nodes: nodesMap,
    requestSave: jest.fn(),
  };
}

function createMockNode(opts?: any) {
  return {
    id: 'mock-node-id',
    x: opts?.pos?.x ?? 0,
    y: opts?.pos?.y ?? 0,
    width: opts?.size?.width ?? 300,
    height: opts?.size?.height ?? 200,
    setText: jest.fn(),
    setData: jest.fn(),
    moveAndResize: jest.fn(),
    nodeEl: {
      addClass: jest.fn(),
      removeClass: jest.fn(),
    },
    unknownData: {},
  };
}

describe('CanvasAdapter write methods', () => {
  let adapter: CanvasAdapter;

  beforeEach(() => {
    adapter = new CanvasAdapter(mockApp);
  });

  describe('createTextNodeOnCanvas', () => {
    it('calls canvas.createTextNode with correct pos and size args', () => {
      const canvas = createMockCanvas();
      const position = { x: 100, y: 200, width: 300, height: 150 };

      adapter.createTextNodeOnCanvas(canvas, position);

      expect(canvas.createTextNode).toHaveBeenCalledWith({
        pos: { x: 100, y: 200 },
        size: { width: 300, height: 150 },
        text: '',
        focus: false,
      });
    });

    it('calls node.setData with color when color param is provided', () => {
      const canvas = createMockCanvas();
      const position = { x: 0, y: 0, width: 300, height: 200 };

      const node = adapter.createTextNodeOnCanvas(canvas, position, '4');

      expect(node.setData).toHaveBeenCalledWith({ color: '4' });
    });

    it('does NOT call node.setData when no color param is provided', () => {
      const canvas = createMockCanvas();
      const position = { x: 0, y: 0, width: 300, height: 200 };

      const node = adapter.createTextNodeOnCanvas(canvas, position);

      expect(node.setData).not.toHaveBeenCalled();
    });

    it('calls canvas.addNode if node not already in canvas.nodes', () => {
      const canvas = createMockCanvas();
      // Override createTextNode to return a node that is NOT in the map
      const node = createMockNode();
      node.id = 'not-in-map';
      canvas.createTextNode.mockReturnValue(node);

      adapter.createTextNodeOnCanvas(canvas, { x: 0, y: 0, width: 300, height: 200 });

      expect(canvas.addNode).toHaveBeenCalledWith(node);
    });

    it('returns null and does not throw when canvas.createTextNode throws', () => {
      const canvas = createMockCanvas();
      canvas.createTextNode.mockImplementation(() => {
        throw new Error('internal API error');
      });

      const result = adapter.createTextNodeOnCanvas(canvas, { x: 0, y: 0, width: 300, height: 200 });

      expect(result).toBeNull();
    });
  });

  describe('updateNodeText', () => {
    it('calls node.setText with provided text', () => {
      const node = createMockNode();

      adapter.updateNodeText(node, 'Hello, world!');

      expect(node.setText).toHaveBeenCalledWith('Hello, world!');
    });

    it('does not throw when node.setText throws', () => {
      const node = createMockNode();
      node.setText.mockImplementation(() => {
        throw new Error('node destroyed');
      });

      expect(() => adapter.updateNodeText(node, 'test')).not.toThrow();
    });
  });

  describe('addNodeCssClass', () => {
    it('calls node.nodeEl.addClass with the class name', () => {
      const node = createMockNode();

      adapter.addNodeCssClass(node, 'canvas-ai-node--streaming');

      expect(node.nodeEl.addClass).toHaveBeenCalledWith('canvas-ai-node--streaming');
    });

    it('sets canvasAiStreaming in node.unknownData', () => {
      const node = createMockNode();

      adapter.addNodeCssClass(node, 'canvas-ai-node--streaming');

      expect(node.unknownData.canvasAiStreaming).toBe(true);
    });
  });

  describe('removeNodeCssClass', () => {
    it('calls node.nodeEl.removeClass and clears unknownData marker', () => {
      const node = createMockNode();
      node.unknownData = { canvasAiStreaming: true };

      adapter.removeNodeCssClass(node, 'canvas-ai-node--streaming');

      expect(node.nodeEl.removeClass).toHaveBeenCalledWith('canvas-ai-node--streaming');
      expect(node.unknownData.canvasAiStreaming).toBeUndefined();
    });
  });

  describe('resizeNode', () => {
    it('calls node.moveAndResize with original x, y, width and new height', () => {
      const node = createMockNode({ pos: { x: 50, y: 75 }, size: { width: 400, height: 200 } });

      adapter.resizeNode(node, 500);

      expect(node.moveAndResize).toHaveBeenCalledWith({
        x: 50,
        y: 75,
        width: 400,
        height: 500,
      });
    });

    it('does not throw when node.moveAndResize throws', () => {
      const node = createMockNode();
      node.moveAndResize.mockImplementation(() => {
        throw new Error('node destroyed');
      });

      expect(() => adapter.resizeNode(node, 500)).not.toThrow();
    });
  });

  describe('requestCanvasSave', () => {
    it('calls canvas.requestSave()', () => {
      const canvas = createMockCanvas();

      adapter.requestCanvasSave(canvas);

      expect(canvas.requestSave).toHaveBeenCalled();
    });

    it('does not throw when canvas.requestSave throws', () => {
      const canvas = createMockCanvas();
      canvas.requestSave.mockImplementation(() => {
        throw new Error('canvas closed');
      });

      expect(() => adapter.requestCanvasSave(canvas)).not.toThrow();
    });
  });
});
