/**
 * Interface for node handlers
 */
export interface NodeHandler {
  /**
   * Execute a node with the given data and input
   */
  execute(
    nodeData: Record<string, any>,
    input: Record<string, any>
  ): Promise<Record<string, any>>;
}

/**
 * Registry for node handlers
 */
export class NodeHandlerRegistry {
  private handlers: Map<string, NodeHandler> = new Map();

  /**
   * Register a handler for a node type
   */
  registerHandler(nodeType: string, handler: NodeHandler): void {
    this.handlers.set(nodeType, handler);
  }

  /**
   * Get a handler for a node type
   */
  getHandler(nodeType: string): NodeHandler | undefined {
    return this.handlers.get(nodeType);
  }
}
