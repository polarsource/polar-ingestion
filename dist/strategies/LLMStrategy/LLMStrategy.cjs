"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/strategies/LLMStrategy/LLMStrategy.ts
var LLMStrategy_exports = {};
__export(LLMStrategy_exports, {
  LLMStrategy: () => LLMStrategy
});
module.exports = __toCommonJS(LLMStrategy_exports);

// ../adapter-utils/dist/index.js
var Ingestion = class {
  polarClient;
  transformers = [];
  constructor(polar) {
    this.polarClient = polar;
  }
  pipe(transformer) {
    this.transformers.push(transformer);
    return this;
  }
  async execute(ctx) {
    await Promise.all(this.transformers.map((transformer) => transformer(ctx)));
  }
  schedule(meter, transformer) {
    return this.pipe(async (ctx) => {
      await this.polarClient.events.ingest({
        events: [
          {
            customerId: ctx.customerId,
            name: meter,
            metadata: transformer(ctx)
          }
        ]
      });
    });
  }
};
var IngestionStrategy = class extends Ingestion {
  createExecutionHandler() {
    return async (context) => {
      await this.execute(context);
    };
  }
  ingest(eventName, metadataResolver) {
    this.schedule(eventName, metadataResolver);
    return this;
  }
};

// src/strategies/LLMStrategy/LLMStrategy.ts
var import_ai = require("ai");
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
    return (0, import_ai.wrapLanguageModel)({
      model: this.model,
      middleware: this.middleware(executionHandler, customerId)
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LLMStrategy
});
