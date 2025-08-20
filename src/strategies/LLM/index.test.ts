import { describe, expect, it, vi } from "vitest";
import { LLMStrategy } from ".";

const mockEventsIngest = vi.fn();

// Mock the module before any imports
vi.mock("@polar-sh/sdk", async (importOriginal) => {
	class Polar {
		events = {
			ingest: mockEventsIngest,
		};
	}

	return {
		...(await importOriginal()),
		Polar,
	};
});

import { Ingestion } from "../../ingestion";

const mockLLMClient = {
	specificationVersion: "v1",
	provider: "test-provider",
	modelId: "test-model",
	defaultObjectGenerationMode: "json",
	doGenerate: vi.fn().mockResolvedValue({
		usage: {
			promptTokens: 1,
			completionTokens: 1,
			provider: "test-provider",
			model: "test-model",
		},
	}),
	doStream: vi.fn(),
} as const;

describe("LLMStrategy", () => {
	const customerId = "test-customer-id";

	it("should call the meter handler with the correct context", async () => {
		const input = { prompt: "Hello, world!" };

		const llm = Ingestion()
			.strategy(new LLMStrategy(mockLLMClient))
			.ingest("prompt-tokens");

		const spy = vi.spyOn(llm, "execute");

		await llm
			.client({
				customerId,
			})
			.doGenerate({
				prompt: [
					{
						role: "user",
						content: [{ type: "text", text: input.prompt }],
					},
				],
				inputFormat: "prompt",
				mode: { type: "regular" },
			});

		expect(spy).toHaveBeenCalledWith(
			{
				promptTokens: 1,
				completionTokens: 1,
				totalTokens: 2,
				provider: "test-provider",
				model: "test-model",
			},
			{
				customerId,
			},
		);
	});
});
