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

// src/strategies/FetchStrategy/FetchStrategy.ts
var FetchStrategy_exports = {};
__export(FetchStrategy_exports, {
  FetchStrategy: () => FetchStrategy
});
module.exports = __toCommonJS(FetchStrategy_exports);

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

// src/strategies/FetchStrategy/FetchStrategy.ts
var wrapFetch = (httpClient, execute, customerId) => {
  return async (input, init) => {
    const response = await httpClient(input, init);
    const url = typeof input === "string" ? input : "url" in input ? input.url : input.toString();
    execute({
      url,
      method: init?.method ?? "GET",
      customerId
    });
    return response;
  };
};
var FetchStrategy = class extends IngestionStrategy {
  fetchClient;
  constructor(fetchClient, polar) {
    super(polar);
    this.fetchClient = fetchClient;
  }
  client(customerId) {
    const executionHandler = this.createExecutionHandler();
    return wrapFetch(this.fetchClient, executionHandler, customerId);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FetchStrategy
});
