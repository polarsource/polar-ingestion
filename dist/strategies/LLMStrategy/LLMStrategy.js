import {
  IngestionStrategy
} from "../../chunk-7COK3SBL.js";

// src/strategies/LLMStrategy/LLMStrategy.ts
import { wrapLanguageModel } from "ai";
var LLMStrategy = class extends IngestionStrategy {
  model;
  constructor(model, polar) {
    super(polar);
    this.model = model;
  }
  middleware(execute, customerId) {
    const wrapGenerate = async (options) => {
      const result = await options.doGenerate();
      await execute({
        ...result.usage,
        customerId
      });
      return result;
    };
    const wrapStream = async ({
      doStream
    }) => {
      const { stream, ...rest } = await doStream();
      const transformStream = new TransformStream({
        transform: async (chunk, controller) => {
          if (chunk.type === "finish") {
            await execute({
              ...chunk.usage,
              customerId
            });
          }
          controller.enqueue(chunk);
        }
      });
      return {
        stream: stream.pipeThrough(transformStream),
        ...rest
      };
    };
    return {
      wrapGenerate,
      wrapStream
    };
  }
  client(customerId) {
    const executionHandler = this.createExecutionHandler();
    return wrapLanguageModel({
      model: this.model,
      middleware: this.middleware(executionHandler, customerId)
    });
  }
};
export {
  LLMStrategy
};
