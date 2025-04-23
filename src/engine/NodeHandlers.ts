import {
  DelayNodeData,
  LogNodeData,
  TransformNodeData,
} from "../models/Workflow";
import { NodeHandler } from "./NodeHandler";

/**
 * Handler for a simple log node
 */
export class LogNodeHandler implements NodeHandler {
  async execute(
    nodeData: LogNodeData,
    input: Record<string, any>
  ): Promise<Record<string, any>> {
    const message = nodeData.message || "Log node executed";
    console.log(`[LOG] ${message}`, input);
    // return { logged: true, timestamp: new Date(),};
    // We don't need to return anything from the log node
    return input;
  }
}

/**
 * Handler for a transform node
 */
export class TransformNodeHandler implements NodeHandler {
  async execute(
    nodeData: TransformNodeData,
    input: Record<string, any>
  ): Promise<Record<string, any>> {
    // Get the transformation type
    const transformType = nodeData.transformType || "uppercase";

    // Get the input field to transform
    const inputField = nodeData.inputField || "text";

    // Get the value to transform
    let value = "";

    // // Check if the input field uses dot notation (e.g., "user.name")
    // if (inputField.includes(".")) {
    //   const parts = inputField.split(".");
    //   let current = input;
    //   for (const part of parts) {
    //     if (current === undefined || current === null) {
    //       break;
    //     }
    //     current = current[part];
    //   }
    //   value =
    //     typeof current === "string" ? current : JSON.stringify(current || "");
    // } else {
    //   value = input[inputField] || "";
    // }

    value = input[inputField] || "";

    // Apply the transformation
    let result;
    switch (transformType) {
      case "uppercase":
        result = String(value).toUpperCase();
        break;
      case "lowercase":
        result = String(value).toLowerCase();
        break;
      case "reverse":
        result = String(value).split("").reverse().join("");
        break;
      default:
        result = value;
    }

    console.log(
      `#### Transforming value: ${value} using transformType: ${transformType} to result: ${result}`
    );

    // return {
    //   [inputField]: result,
    //   transformed: true,
    //   transformType,
    // };
    // Return the transformed input with the new value
    return {
      ...input,
      [inputField]: result,
    };
  }
}

/**
 * Handler for a delay node
 */
export class DelayNodeHandler implements NodeHandler {
  async execute(
    nodeData: DelayNodeData,
    input: Record<string, any>
  ): Promise<Record<string, any>> {
    // Get the delay duration in milliseconds
    const duration = nodeData.duration || 1000;

    // Wait for the specified duration
    await new Promise((resolve) => setTimeout(resolve, duration));

    // return { delayed: true, duration, timestamp: new Date() };
    // We don't need to return anything from the delay node
    return input;
  }
}
