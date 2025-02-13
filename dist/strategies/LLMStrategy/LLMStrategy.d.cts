import { LanguageModelV1 } from '@ai-sdk/provider';
import { IngestionStrategy, IngestionContext } from '@polar-sh/adapter-utils';
import { Polar } from '@polar-sh/sdk';

type LLMStrategyContext = IngestionContext<{
    promptTokens: number;
    completionTokens: number;
}>;
declare class LLMStrategy extends IngestionStrategy<LLMStrategyContext, LanguageModelV1> {
    private model;
    constructor(model: LanguageModelV1, polar: Polar);
    private middleware;
    client(customerId: string): LanguageModelV1;
}

export { LLMStrategy };
