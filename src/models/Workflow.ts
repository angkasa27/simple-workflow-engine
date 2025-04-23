/**
 * Represents a node in a workflow
 */
interface NodeBase {
  id: string;
  type: string;
  data: Record<string, any>;
}

export interface LogNodeData {
  message: string;
}

export interface LogNode extends NodeBase {
  type: "log";
  data: LogNodeData;
}

export interface TransformNodeData {
  transformType: "uppercase" | "lowercase" | "reverse" | string;
  inputField: string;
}

export interface TransformNode extends NodeBase {
  type: "transform";
  data: TransformNodeData;
}

export interface DelayNodeData {
  duration: number;
}

export interface DelayNode extends NodeBase {
  type: "delay";
  data: DelayNodeData;
}

export type Node = LogNode | TransformNode | DelayNode;

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
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
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
