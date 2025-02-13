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

// src/strategy.ts
var strategy_exports = {};
__export(strategy_exports, {
  IngestionStrategy: () => IngestionStrategy
});
module.exports = __toCommonJS(strategy_exports);

// src/ingestion.ts
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

// src/strategy.ts
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  IngestionStrategy
});
