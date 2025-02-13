import {
  IngestionStrategy
} from "../../chunk-7COK3SBL.js";

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
export {
  FetchStrategy
};
