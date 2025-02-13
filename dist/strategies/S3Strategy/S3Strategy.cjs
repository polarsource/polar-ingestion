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

// src/strategies/S3Strategy/S3Strategy.ts
var S3Strategy_exports = {};
__export(S3Strategy_exports, {
  S3Strategy: () => S3Strategy
});
module.exports = __toCommonJS(S3Strategy_exports);

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

// src/strategies/S3Strategy/S3Strategy.ts
var S3Strategy = class extends IngestionStrategy {
  s3Client;
  constructor(s3Client, polar) {
    super(polar);
    this.s3Client = s3Client;
  }
  wrapS3Client({
    s3Client,
    execute: _execute,
    customerId: _customerId
  }) {
    const plugin = {
      applyToStack: (stack) => {
        stack.add(
          (next, context) => async (args) => {
            const result = await next(args);
            console.log({ args, context, result });
            return result;
          },
          {
            step: "deserialize",
            priority: "high"
          }
        );
      }
    };
    s3Client.middlewareStack.use(plugin);
    return s3Client;
  }
  client(customerId) {
    const execute = this.createExecutionHandler();
    return this.wrapS3Client({
      s3Client: this.s3Client,
      execute,
      customerId
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  S3Strategy
});
