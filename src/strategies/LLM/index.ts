import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3StreamPart
} from "@ai-sdk/provider";
import type { CostMetadataInput } from "@polar-sh/sdk/models/components/costmetadatainput.js";
import type { LLMMetadata } from "@polar-sh/sdk/models/components/llmmetadata.js";
import { type LanguageModelMiddleware, wrapLanguageModel } from "ai";
import type { IngestionContext } from "../../ingestion";
import {
  type IngestionExecutionHandler,
  IngestionStrategy,
  type IngestionStrategyCustomer,
  type IngestionStrategyExternalCustomer,
} from "../../strategy";

export type LLMStrategyContext = IngestionContext<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  vendor: LanguageModelV3["provider"];
  model: LanguageModelV3["modelId"];
  strategy: "LLM";
  _llm: LLMMetadata;
  _cost?: CostMetadataInput;
}>;

export type CostResolver = (context: LLMStrategyContext) => CostMetadataInput;

export class LLMStrategy extends IngestionStrategy<
  LLMStrategyContext,
  LanguageModelV3
> {
  private model: LanguageModelV3;

  constructor(model: LanguageModelV3) {
    super();

    this.model = model;
  }

  private middleware(
    execute: IngestionExecutionHandler<LLMStrategyContext>,
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ): LanguageModelMiddleware {
    const wrapGenerate = async (options: {
      doGenerate: () => ReturnType<LanguageModelV3["doGenerate"]>;
      params: LanguageModelV3CallOptions;
      model: LanguageModelV3;
    }): Promise<Awaited<ReturnType<LanguageModelV3["doGenerate"]>>> => {
      const result = await options.doGenerate();

      const llmEvent: LLMStrategyContext = {
        vendor: this.model.provider,
        model: this.model.modelId,
        inputTokens: result.usage.inputTokens.total ?? 0,
        cachedInputTokens: result.usage.inputTokens.cacheRead ?? 0,
        outputTokens: result.usage.outputTokens.total ?? 0,
        totalTokens: (result.usage.inputTokens.total ?? 0) + (result.usage.outputTokens.total ?? 0),
        strategy: "LLM",
        _llm: {
          vendor: this.model.provider,
          model: this.model.modelId,
          inputTokens: result.usage.inputTokens.total ?? 0,
          cachedInputTokens: result.usage.inputTokens.cacheRead ?? 0,
          outputTokens: result.usage.outputTokens.total ?? 0,
          totalTokens: (result.usage.inputTokens.total ?? 0) + (result.usage.outputTokens.total ?? 0),
        },
      };

      await execute(llmEvent, customer);

      return result;
    };

    const wrapStream = async ({
      doStream,
    }: {
      doStream: () => ReturnType<LanguageModelV3["doStream"]>;
      params: LanguageModelV3CallOptions;
      model: LanguageModelV3;
    }) => {
      const { stream, ...rest } = await doStream();

      const transformStream = new TransformStream<
        LanguageModelV3StreamPart,
        LanguageModelV3StreamPart
      >({
        transform: async (chunk, controller) => {
          if (chunk.type === "finish") {
            const llmEvent: LLMStrategyContext = {
              vendor: this.model.provider,
              model: this.model.modelId,
              inputTokens: chunk.usage.inputTokens.total ?? 0,
              cachedInputTokens: chunk.usage.inputTokens.cacheRead ?? 0,
              outputTokens: chunk.usage.outputTokens.total ?? 0,
              totalTokens: (chunk.usage.inputTokens.total ?? 0) + (chunk.usage.outputTokens.total ?? 0),
              strategy: "LLM",
              _llm: {
                vendor: this.model.provider,
                model: this.model.modelId,
                inputTokens: chunk.usage.inputTokens.total ?? 0,
                cachedInputTokens: chunk.usage.inputTokens.cacheRead ?? 0,
                outputTokens: chunk.usage.outputTokens.total ?? 0,
                totalTokens: (chunk.usage.inputTokens.total ?? 0) + (chunk.usage.outputTokens.total ?? 0),
              },
            };

            await execute(llmEvent, customer);
          }

          controller.enqueue(chunk);
        },
      });

      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      };
    };

    return {
      specificationVersion: "v3",
      wrapGenerate,
      wrapStream,
    };
  }

  override client(
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ): LanguageModelV3 {
    const executionHandler = this.createExecutionHandler();

    return wrapLanguageModel({
      model: this.model,
      middleware: this.middleware(executionHandler, customer),
    });
  }
}
