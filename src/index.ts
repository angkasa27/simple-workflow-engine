import {
  Workflow,
  ExecutionStatus,
  WorkflowExecution,
} from "./models/Workflow";
import { WorkflowEngine } from "./engine/WorkflowEngine";
import { NodeHandlerRegistry } from "./engine/NodeHandler";
import {
  LogNodeHandler,
  TransformNodeHandler,
  DelayNodeHandler,
} from "./engine/NodeHandlers";

async function main() {
  // Create node handler registry
  const registry = new NodeHandlerRegistry();

  // Register node handlers
  registry.registerHandler("log", new LogNodeHandler());
  registry.registerHandler("transform", new TransformNodeHandler());
  registry.registerHandler("delay", new DelayNodeHandler());

  // Create workflow engine
  const engine = new WorkflowEngine(registry);

  // Define a simple workflow
  const workflow: Workflow = {
    id: "simple-workflow",
    name: "Simple Workflow",
    nodes: [
      {
        id: "start",
        type: "log",
        data: {
          message: "Starting workflow",
        },
      },
      {
        id: "transform",
        type: "transform",
        data: {
          transformType: "uppercase",
          inputField: "text",
        },
      },
      {
        id: "delay",
        type: "delay",
        data: {
          duration: 2000,
        },
      },
      {
        id: "transform-again",
        type: "transform",
        data: {
          transformType: "reverse",
          inputField: "text",
        },
      },
      {
        id: "end",
        type: "log",
        data: {
          message: "Workflow completed",
        },
      },
    ],
    connections: [
      {
        id: "conn1",
        sourceNodeId: "start",
        targetNodeId: "transform",
      },
      {
        id: "conn2",
        sourceNodeId: "transform",
        targetNodeId: "delay",
      },
      {
        id: "conn3",
        sourceNodeId: "delay",
        targetNodeId: "transform-again",
      },
      {
        id: "conn4",
        sourceNodeId: "transform-again",
        targetNodeId: "end",
      },
    ],
  };

  // Register the workflow
  engine.registerWorkflow(workflow);

  // Execute the workflow
  const executionId = await engine.executeWorkflow("simple-workflow", {
    text: "Hello, world!",
  });

  console.log(`Started workflow execution: ${executionId}`);

  // Wait for the workflow to complete
  await waitForExecution(engine, executionId);

  // Get the execution result
  const execution: WorkflowExecution = engine.getExecution(
    executionId
  ) as WorkflowExecution;

  console.log("\nWorkflow execution completed:");
  console.log(`Status: ${execution?.status}`);
  console.log(
    `Duration: ${
      execution.endTime!.getTime() - execution?.startTime.getTime()
    }ms`
  );

  console.log("\nNode Results:");
  if (execution) {
    Object.entries(execution.nodeResults).forEach(([nodeId, result]) => {
      console.log(`\n${nodeId} (${result.status}):`);
      if (result.output) {
        console.log("Output:", result.output);
      }
      if (result.error) {
        console.log("Error:", result.error);
      }
    });
  }

  console.log("\nWorkflow Output:");
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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Execution timed out: ${executionId}`);
}

// Run the example
main().catch((error) => {
  console.error("Error:", error);
});
