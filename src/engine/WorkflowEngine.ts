import {
  Workflow,
  Node,
  WorkflowExecution,
  ExecutionStatus,
  NodeResult,
} from "../models/Workflow";
import { NodeHandlerRegistry } from "./NodeHandler";

/**
 * Simple workflow engine
 */
export class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();

  constructor(private nodeHandlerRegistry: NodeHandlerRegistry) {}

  /**
   * Register a workflow
   */
  registerWorkflow(workflow: Workflow): void {
    // Validate the workflow
    this.validateWorkflow(workflow);

    // Store the workflow
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    input: Record<string, any> = {}
  ): Promise<string> {
    // Get the workflow
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Create execution record
    const executionId = `exec-${Date.now()}`;
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: ExecutionStatus.PENDING,
      startTime: new Date(),
      input,
      nodeResults: {},
    };

    // Store execution
    this.executions.set(executionId, execution);

    // Start execution
    this.runWorkflow(executionId).catch((error) => {
      console.error(`Workflow execution failed: ${error.message}`);
    });

    return executionId;
  }

  /**
   * Get an execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Run a workflow
   */
  private async runWorkflow(executionId: string): Promise<void> {
    // Get the execution
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    // Get the workflow
    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${execution.workflowId}`);
    }

    try {
      // Update status to running
      execution.status = ExecutionStatus.RUNNING;

      // Find start nodes (nodes with no incoming connections)
      const startNodes = this.findStartNodes(workflow);

      // Execute start nodes
      for (const node of startNodes) {
        await this.executeNode(node.id, executionId);
      }

      // Update status to completed
      execution.status = ExecutionStatus.COMPLETED;
      execution.endTime = new Date();

      // Set output to the results of end nodes (nodes with no outgoing connections)
      const endNodes = this.findEndNodes(workflow);
      if (endNodes.length > 0) {
        execution.output = {};
        for (const node of endNodes) {
          const nodeResult = execution.nodeResults[node.id];
          if (nodeResult && nodeResult.output) {
            execution.output[node.id] = nodeResult.output;
          }
        }
      }
    } catch (error) {
      // Update status to failed
      execution.status = ExecutionStatus.FAILED;
      execution.endTime = new Date();
      throw error;
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    nodeId: string,
    executionId: string
  ): Promise<void> {
    // Get the execution
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    // Get the workflow
    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${execution.workflowId}`);
    }

    // Find the node
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Skip if already executed
    if (execution.nodeResults[nodeId]) {
      return;
    }

    try {
      // Prepare node input
      const nodeInput = this.prepareNodeInput(node, execution);
      // Get the node handler
      const handler = this.nodeHandlerRegistry.getHandler(node.type);
      if (!handler) {
        throw new Error(`No handler registered for node type: ${node.type}`);
      }
      console.log("###Node Input:", nodeInput);
      // Execute the node
      const nodeOutput = await handler.execute(node.data, nodeInput);

      // Store the result
      execution.nodeResults[nodeId] = {
        status: ExecutionStatus.COMPLETED,
        input: nodeInput,
        output: nodeOutput,
      };

      // Find and execute next nodes
      const nextNodes = this.findNextNodes(workflow, nodeId);
      for (const nextNode of nextNodes) {
        await this.executeNode(nextNode.id, executionId);
      }
    } catch (error: any) {
      // Store the error
      execution.nodeResults[nodeId] = {
        status: ExecutionStatus.FAILED,
        input: this.prepareNodeInput(node, execution),
        error: error.message,
      };

      throw error;
    }
  }

  /**
   * Find nodes with no incoming connections
   */
  private findStartNodes(workflow: Workflow): Node[] {
    const nodesWithIncomingConnections = new Set<string>();

    workflow.connections.forEach((conn) => {
      nodesWithIncomingConnections.add(conn.targetNodeId);
    });

    return workflow.nodes.filter(
      (node) => !nodesWithIncomingConnections.has(node.id)
    );
  }

  /**
   * Find nodes with no outgoing connections
   */
  private findEndNodes(workflow: Workflow): Node[] {
    const nodesWithOutgoingConnections = new Set<string>();

    workflow.connections.forEach((conn) => {
      nodesWithOutgoingConnections.add(conn.sourceNodeId);
    });

    return workflow.nodes.filter(
      (node) => !nodesWithOutgoingConnections.has(node.id)
    );
  }

  /**
   * Find nodes that come after a given node
   */
  private findNextNodes(workflow: Workflow, nodeId: string): Node[] {
    // Find connections from this node
    const outgoingConnections = workflow.connections.filter(
      (conn) => conn.sourceNodeId === nodeId
    );

    // Get the target nodes
    return outgoingConnections
      .map((conn) =>
        workflow.nodes.find((node) => node.id === conn.targetNodeId)
      )
      .filter((node): node is Node => node !== undefined);
  }

  /**
   * Prepare input for a node
   */
  // private prepareNodeInput(
  //   node: Node,
  //   execution: WorkflowExecution
  // ): Record<string, any> {
  //   // For start nodes, use the workflow input
  //   if (this.isStartNode(node.id, execution.workflowId)) {
  //     return { ...execution.input };
  //   }

  //   // For other nodes, combine outputs from predecessor nodes
  //   const workflow = this.workflows.get(execution.workflowId)!;
  //   const predecessors = this.findPredecessorNodes(workflow, node.id);

  //   const input: Record<string, any> = {
  //     // Include workflow input
  //     workflowInput: execution.input,
  //   };

  //   // Add outputs from predecessor nodes
  //   for (const pred of predecessors) {
  //     const predResult = execution.nodeResults[pred.id];
  //     if (predResult && predResult.output) {
  //       input[pred.id] = predResult.output;
  //     }
  //   }

  //   return input;
  // }
  private prepareNodeInput(
    node: Node,
    execution: WorkflowExecution
  ): Record<string, any> {
    // For start nodes, use the workflow input
    if (this.isStartNode(node.id, execution.workflowId)) {
      return { ...execution.input };
    }

    // For other nodes, combine outputs from predecessor nodes
    const workflow = this.workflows.get(execution.workflowId)!;
    const predecessors = this.findPredecessorNodes(workflow, node.id);

    let input: Record<string, any> = {
      // Include workflow input
      ...execution.input,
    };

    // Add outputs from predecessor nodes
    for (const pred of predecessors) {
      const predResult = execution.nodeResults[pred.id];
      if (predResult && predResult.output) {
        input = { ...input, ...predResult.output };
      }
    }

    return input;
  }

  /**
   * Find nodes that come before a given node
   */
  private findPredecessorNodes(workflow: Workflow, nodeId: string): Node[] {
    // Find connections to this node
    const incomingConnections = workflow.connections.filter(
      (conn) => conn.targetNodeId === nodeId
    );

    // Get the source nodes
    return incomingConnections
      .map((conn) =>
        workflow.nodes.find((node) => node.id === conn.sourceNodeId)
      )
      .filter((node): node is Node => node !== undefined);
  }

  /**
   * Check if a node is a start node
   */
  private isStartNode(nodeId: string, workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId)!;
    const startNodes = this.findStartNodes(workflow);
    return startNodes.some((node) => node.id === nodeId);
  }

  /**
   * Validate a workflow
   */
  private validateWorkflow(workflow: Workflow): void {
    // Check for duplicate node IDs
    const nodeIds = new Set<string>();
    for (const node of workflow.nodes) {
      if (nodeIds.has(node.id)) {
        throw new Error(`Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);
    }

    // Check for duplicate connection IDs
    const connectionIds = new Set<string>();
    for (const conn of workflow.connections) {
      if (connectionIds.has(conn.id)) {
        throw new Error(`Duplicate connection ID: ${conn.id}`);
      }
      connectionIds.add(conn.id);
    }

    // Check that connections reference valid nodes
    for (const conn of workflow.connections) {
      if (!workflow.nodes.some((node) => node.id === conn.sourceNodeId)) {
        throw new Error(
          `Connection ${conn.id} references non-existent source node: ${conn.sourceNodeId}`
        );
      }
      if (!workflow.nodes.some((node) => node.id === conn.targetNodeId)) {
        throw new Error(
          `Connection ${conn.id} references non-existent target node: ${conn.targetNodeId}`
        );
      }
    }

    // Check for cycles
    this.checkForCycles(workflow);

    // Check that there's at least one start node
    const startNodes = this.findStartNodes(workflow);
    if (startNodes.length === 0 && workflow.nodes.length > 0) {
      throw new Error(
        "Workflow has no start nodes (all nodes have incoming connections)"
      );
    }
  }

  /**
   * Check for cycles in the workflow
   */
  private checkForCycles(workflow: Workflow): void {
    // Build adjacency list
    const adjacencyList: Record<string, string[]> = {};
    workflow.nodes.forEach((node) => {
      adjacencyList[node.id] = [];
    });

    workflow.connections.forEach((conn) => {
      adjacencyList[conn.sourceNodeId].push(conn.targetNodeId);
    });

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      // Mark the current node as visited and part of recursion stack
      visited.add(nodeId);
      recursionStack.add(nodeId);

      // Recur for all the vertices adjacent to this vertex
      for (const neighbor of adjacencyList[nodeId]) {
        // If not visited, check if cycle exists starting from neighbor
        if (!visited.has(neighbor) && hasCycle(neighbor)) {
          return true;
        }
        // If the neighbor is in recursion stack, then there is a cycle
        else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      // Remove the vertex from recursion stack
      recursionStack.delete(nodeId);
      return false;
    };

    // Check for cycle in each unvisited node
    for (const node of workflow.nodes) {
      if (!visited.has(node.id) && hasCycle(node.id)) {
        throw new Error("Workflow contains cycles, which are not allowed");
      }
    }
  }
}
