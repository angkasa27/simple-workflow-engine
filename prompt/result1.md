# Building a Simple Workflow Engine from Scratch

Let's start with a simpler approach to help you understand the core concepts. We'll build a minimal workflow engine step by step.

## Step 1: Set Up the Project

First, let's set up a basic TypeScript project:

```bash
# Create a project directory
mkdir simple-workflow-engine
cd simple-workflow-engine

# Initialize npm
npm init -y

# Install TypeScript and other dependencies
npm install typescript ts-node @types/node --save-dev

# Create tsconfig.json
npx tsc --init
```

Edit the `tsconfig.json` file to include these settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

Create the basic project structure:

```bash
mkdir -p src/models src/engine
```

## Step 2: Define Basic Models

Let's create the core models for our workflow engine:

### `src/models/Workflow.ts`

```typescript
/**
 * Represents a node in a workflow
 */
export interface Node {
  id: string;
  type: string;
  data: Record<string, any>;
}

/**
 * Represents a connection between two nodes
 */
export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
}

/**
 * Represents a workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  nodes: Node[];
  connections: Connection[];
}

/**
 * Status of a workflow execution
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Result of a node execution
 */
export interface NodeResult {
  status: ExecutionStatus;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
}

/**
 * Represents an execution of a workflow
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  input: Record<string, any>;
  output?: Record<string, any>;
  nodeResults: Record<string, NodeResult>;
}
```

## Step 3: Create the Node Handler Interface

### `src/engine/NodeHandler.ts`

```typescript
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
```

## Step 4: Create the Workflow Engine

### `src/engine/WorkflowEngine.ts`

```typescript
import { 
  Workflow, 
  Node, 
  WorkflowExecution, 
  ExecutionStatus, 
  NodeResult 
} from '../models/Workflow';
import { NodeHandlerRegistry } from './NodeHandler';

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
      nodeResults: {}
    };
    
    // Store execution
    this.executions.set(executionId, execution);
    
    // Start execution
    this.runWorkflow(executionId).catch(error => {
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
    const node = workflow.nodes.find(n => n.id === nodeId);
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
      
      // Execute the node
      const nodeOutput = await handler.execute(node.data, nodeInput);
      
      // Store the result
      execution.nodeResults[nodeId] = {
        status: ExecutionStatus.COMPLETED,
        input: nodeInput,
        output: nodeOutput
      };
      
      // Find and execute next nodes
      const nextNodes = this.findNextNodes(workflow, nodeId);
      for (const nextNode of nextNodes) {
        await this.executeNode(nextNode.id, executionId);
      }
    } catch (error) {
      // Store the error
      execution.nodeResults[nodeId] = {
        status: ExecutionStatus.FAILED,
        input: this.prepareNodeInput(node, execution),
        error: error.message
      };
      
      throw error;
    }
  }

  /**
   * Find nodes with no incoming connections
   */
  private findStartNodes(workflow: Workflow): Node[] {
    const nodesWithIncomingConnections = new Set<string>();
    
    workflow.connections.forEach(conn => {
      nodesWithIncomingConnections.add(conn.targetNodeId);
    });
    
    return workflow.nodes.filter(node => !nodesWithIncomingConnections.has(node.id));
  }

  /**
   * Find nodes with no outgoing connections
   */
  private findEndNodes(workflow: Workflow): Node[] {
    const nodesWithOutgoingConnections = new Set<string>();
    
    workflow.connections.forEach(conn => {
      nodesWithOutgoingConnections.add(conn.sourceNodeId);
    });
    
    return workflow.nodes.filter(node => !nodesWithOutgoingConnections.has(node.id));
  }

  /**
   * Find nodes that come after a given node
   */
  private findNextNodes(workflow: Workflow, nodeId: string): Node[] {
    // Find connections from this node
    const outgoingConnections = workflow.connections.filter(
      conn => conn.sourceNodeId === nodeId
    );
    
    // Get the target nodes
    return outgoingConnections
      .map(conn => workflow.nodes.find(node => node.id === conn.targetNodeId))
      .filter((node): node is Node => node !== undefined);
  }

  /**
   * Prepare input for a node
   */
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
    
    const input: Record<string, any> = {
      // Include workflow input
      workflowInput: execution.input
    };
    
    // Add outputs from predecessor nodes
    for (const pred of predecessors) {
      const predResult = execution.nodeResults[pred.id];
      if (predResult && predResult.output) {
        input[pred.id] = predResult.output;
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
      conn => conn.targetNodeId === nodeId
    );
    
    // Get the source nodes
    return incomingConnections
      .map(conn => workflow.nodes.find(node => node.id === conn.sourceNodeId))
      .filter((node): node is Node => node !== undefined);
  }

  /**
   * Check if a node is a start node
   */
  private isStartNode(nodeId: string, workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId)!;
    const startNodes = this.findStartNodes(workflow);
    return startNodes.some(node => node.id === nodeId);
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
      if (!workflow.nodes.some(node => node.id === conn.sourceNodeId)) {
        throw new Error(`Connection ${conn.id} references non-existent source node: ${conn.sourceNodeId}`);
      }
      if (!workflow.nodes.some(node => node.id === conn.targetNodeId)) {
        throw new Error(`Connection ${conn.id} references non-existent target node: ${conn.targetNodeId}`);
      }
    }
    
    // Check for cycles
    this.checkForCycles(workflow);
    
    // Check that there's at least one start node
    const startNodes = this.findStartNodes(workflow);
    if (startNodes.length === 0 && workflow.nodes.length > 0) {
      throw new Error('Workflow has no start nodes (all nodes have incoming connections)');
    }
  }

  /**
   * Check for cycles in the workflow
   */
  private checkForCycles(workflow: Workflow): void {
    // Build adjacency list
    const adjacencyList: Record<string, string[]> = {};
    workflow.nodes.forEach(node => {
      adjacencyList[node.id] = [];
    });
    
    workflow.connections.forEach(conn => {
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
        throw new Error('Workflow contains cycles, which are not allowed');
      }
    }
  }
}
```

## Step 5: Create Some Example Node Handlers

### `src/engine/NodeHandlers.ts`

```typescript
import { NodeHandler } from './NodeHandler';

/**
 * Handler for a simple log node
 */
export class LogNodeHandler implements NodeHandler {
  async execute(
    nodeData: Record<string, any>,
    input: Record<string, any>
  ): Promise<Record<string, any>> {
    const message = nodeData.message || 'Log node executed';
    console.log(`[LOG] ${message}`, input);
    return { logged: true, timestamp: new Date() };
  }
}

/**
 * Handler for a transform node
 */
export class TransformNodeHandler implements NodeHandler {
  async execute(
    nodeData: Record<string, any>,
    input: Record<string, any>
  ): Promise<Record<string, any>> {
    // Get the transformation type
    const transformType = nodeData.transformType || 'uppercase';
    
    // Get the input field to transform
    const inputField = nodeData.inputField || 'text';
    
    // Get the value to transform
    let value = '';
    
    // Check if the input field uses dot notation (e.g., "user.name")
    if (inputField.includes('.')) {
      const parts = inputField.split('.');
      let current = input;
      for (const part of parts) {
        if (current === undefined || current === null) {
          break;
        }
        current = current[part];
      }
      value = current || '';
    } else {
      value = input[inputField] || '';
    }
    
    // Apply the transformation
    let result;
    switch (transformType) {
      case 'uppercase':
        result = String(value).toUpperCase();
        break;
      case 'lowercase':
        result = String(value).toLowerCase();
        break;
      case 'reverse':
        result = String(value).split('').reverse().join('');
        break;
      default:
        result = value;
    }
    
    return { 
      original: value,
      transformed: result,
      transformType
    };
  }
}

/**
 * Handler for a delay node
 */
export class DelayNodeHandler implements NodeHandler {
  async execute(
    nodeData: Record<string, any>,
    input: Record<string, any>
  ): Promise<Record<string, any>> {
    // Get the delay duration in milliseconds
    const duration = nodeData.duration || 1000;
    
    // Wait for the specified duration
    await new Promise(resolve => setTimeout(resolve, duration));
    
    return { 
      delayed: true,
      duration,
      timestamp: new Date()
    };
  }
}
```

## Step 6: Create a Simple Example

### `src/index.ts`

```typescript
import { 
  Workflow, 
  ExecutionStatus 
} from './models/Workflow';
import { 
  WorkflowEngine 
} from './engine/WorkflowEngine';
import { 
  NodeHandlerRegistry 
} from './engine/NodeHandler';
import { 
  LogNodeHandler, 
  TransformNodeHandler, 
  DelayNodeHandler 
} from './engine/NodeHandlers';

async function main() {
  // Create node handler registry
  const registry = new NodeHandlerRegistry();
  
  // Register node handlers
  registry.registerHandler('log', new LogNodeHandler());
  registry.registerHandler('transform', new TransformNodeHandler());
  registry.registerHandler('delay', new DelayNodeHandler());
  
  // Create workflow engine
  const engine = new WorkflowEngine(registry);
  
  // Define a simple workflow
  const workflow: Workflow = {
    id: 'simple-workflow',
    name: 'Simple Workflow',
    nodes: [
      {
        id: 'start',
        type: 'log',
        data: {
          message: 'Starting workflow'
        }
      },
      {
        id: 'transform',
        type: 'transform',
        data: {
          transformType: 'uppercase',
          inputField: 'text'
        }
      },
      {
        id: 'delay',
        type: 'delay',
        data: {
          duration: 2000
        }
      },
      {
        id: 'end',
        type: 'log',
        data: {
          message: 'Workflow completed'
        }
      }
    ],
    connections: [
      {
        id: 'conn1',
        sourceNodeId: 'start',
        targetNodeId: 'transform'
      },
      {
        id: 'conn2',
        sourceNodeId: 'transform',
        targetNodeId: 'delay'
      },
      {
        id: 'conn3',
        sourceNodeId: 'delay',
        targetNodeId: 'end'
      }
    ]
  };
  
  // Register the workflow
  engine.registerWorkflow(workflow);
  
  // Execute the workflow
  const executionId = await engine.executeWorkflow('simple-workflow', {
    text: 'Hello, world!'
  });
  
  console.log(`Started workflow execution: ${executionId}`);
  
  // Wait for the workflow to complete
  await waitForExecution(engine, executionId);
  
  // Get the execution result
  const execution = engine.getExecution(executionId);
  
  console.log('\nWorkflow execution completed:');
  console.log(`Status: ${execution?.status}`);
  console.log(`Duration: ${execution?.endTime?.getTime() - execution?.startTime.getTime()}ms`);
  
  console.log('\nNode Results:');
  if (execution) {
    Object.entries(execution.nodeResults).forEach(([nodeId, result]) => {
      console.log(`\n${nodeId} (${result.status}):`);
      if (result.output) {
        console.log('Output:', result.output);
      }
      if (result.error) {
        console.log('Error:', result.error);
      }
    });
  }
  
  console.log('\nWorkflow Output:');
  console.log(execution?.output);
}

/**
 * Wait for a workflow execution to complete
 */
async function waitForExecution(
  engine: WorkflowEngine, 
  executionId: string, 
  timeout = 30000
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const execution = engine.getExecution(executionId);
    
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }
    
    if (
      execution.status === ExecutionStatus.COMPLETED || 
      execution.status === ExecutionStatus.FAILED
    ) {
      return;
    }
    
    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Execution timed out: ${executionId}`);
}

// Run the example
main().catch(error => {
  console.error('Error:', error);
});
```

## Step 7: Run the Example

Add a script to your `package.json`:

```json
"scripts": {
  "start": "ts-node src/index.ts"
}
```

Then run:

```bash
npm start
```

## Understanding the Code

This simplified workflow engine demonstrates the core concepts:

1. **Workflow Definition**: A workflow consists of nodes and connections between them.

2. **Node Handlers**: Each node type has a handler that knows how to execute it.

3. **Workflow Execution**: The engine executes nodes in the correct order, passing data between them.

4. **Data Flow**: Each node receives inputs from its predecessors and produces outputs for its successors.

The execution process follows these steps:

1. Find start nodes (nodes with no incoming connections)
2. Execute each start node
3. For each executed node, find its successor nodes
4. Execute each successor node
5. Continue until all reachable nodes have been executed
6. Set the workflow output to the outputs of end nodes (nodes with no outgoing connections)

This simple implementation includes basic validation to ensure workflows are valid:
- No duplicate node or connection IDs
- All connections reference valid nodes
- No cycles in the workflow
- At least one start node

## Next Steps

Once you understand this basic implementation, you can extend it with more features:

1. **Conditional Connections**: Add conditions to connections to control workflow paths
2. **Error Handling**: Add retry logic and error handling for node execution
3. **Persistence**: Store workflows and executions in a database
4. **Parallel Execution**: Execute independent branches in parallel
5. **UI Integration**: Create a visual editor for workflows

Would you like me to explain any specific part of this implementation in more detail?