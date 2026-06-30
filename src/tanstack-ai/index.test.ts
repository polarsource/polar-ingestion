import type {
	ChatMiddlewareContext,
	FinishInfo,
	UsageInfo,
} from "@tanstack/ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { polarTanStackAIMiddleware } from ".";

const mockEventsIngest = vi.fn();

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

type TestContext = {
	customerId: string;
};

const finishInfo: FinishInfo = {
	finishReason: "stop",
	duration: 1,
	content: "ok",
};

const usage = (
	promptTokens: number,
	completionTokens: number,
	totalTokens: number,
	cachedTokens = 0,
): UsageInfo => ({
	promptTokens,
	completionTokens,
	totalTokens,
	promptTokensDetails: {
		cachedTokens,
	},
});

const ctx = (
	requestId: string,
	context: TestContext = { customerId: "customer-id" },
	provider = "openrouter",
	model = "openai/gpt-4o",
) => {
	const deferred: Promise<unknown>[] = [];

	return {
		context: {
			requestId,
			context,
			defer: vi.fn((promise: Promise<unknown>) => {
				deferred.push(promise);
			}),
			provider,
			model,
		} as unknown as ChatMiddlewareContext<TestContext>,
		deferred,
	};
};

describe("polarTanStackAIMiddleware", () => {
	beforeEach(() => {
		mockEventsIngest.mockReset();
	});

	it("ingests aggregated TanStack usage on finish", async () => {
		mockEventsIngest.mockResolvedValueOnce({});
		const middleware = polarTanStackAIMiddleware<TestContext>({
			eventName: "tanstack-ai-usage",
			customer: { customerId: "customer-id" },
		});
		const request = ctx("req-1");

		middleware.onUsage?.(request.context, usage(10, 5, 15, 2));
		middleware.onUsage?.(request.context, usage(3, 7, 10));
		middleware.onFinish?.(request.context, finishInfo);

		await Promise.all(request.deferred);

		expect(mockEventsIngest).toHaveBeenCalledWith({
			events: [
				{
					customerId: "customer-id",
					name: "tanstack-ai-usage",
					metadata: {
						inputTokens: 13,
						outputTokens: 12,
						cachedInputTokens: 2,
						totalTokens: 25,
						vendor: "openrouter",
						model: "openai/gpt-4o",
						strategy: "LLM",
						_llm: {
							vendor: "openrouter",
							model: "openai/gpt-4o",
							inputTokens: 13,
							outputTokens: 12,
							cachedInputTokens: 2,
							totalTokens: 25,
						},
					},
				},
			],
		});
	});

	it("supports customer and cost resolvers", async () => {
		mockEventsIngest.mockResolvedValueOnce({});
		const middleware = polarTanStackAIMiddleware<TestContext>({
			eventName: "tanstack-ai-usage",
			customer: (middlewareCtx) => ({
				customerId: middlewareCtx.context.customerId,
			}),
			cost: (metadata) => ({
				amount: metadata.totalTokens * 100,
				currency: "USD",
			}),
		});
		const request = ctx("req-1", { customerId: "dynamic-customer" });

		middleware.onUsage?.(request.context, usage(1, 2, 3));
		middleware.onFinish?.(request.context, finishInfo);

		await Promise.all(request.deferred);

		expect(mockEventsIngest).toHaveBeenCalledWith({
			events: [
				expect.objectContaining({
					customerId: "dynamic-customer",
					metadata: expect.objectContaining({
						_cost: {
							amount: 300,
							currency: "USD",
						},
					}),
				}),
			],
		});
	});

	it("passes through provider-reported cost", async () => {
		mockEventsIngest.mockResolvedValueOnce({});
		const middleware = polarTanStackAIMiddleware<TestContext>({
			eventName: "tanstack-ai-usage",
			customer: { customerId: "customer-id" },
		});
		const request = ctx("req-1");

		middleware.onUsage?.(request.context, {
			...usage(1, 2, 3),
			cost: 0.0012,
			costDetails: {
				upstreamCost: 0.001,
				upstreamInputCost: 0.0002,
				upstreamOutputCost: 0.0008,
			},
		});
		middleware.onFinish?.(request.context, finishInfo);

		await Promise.all(request.deferred);

		expect(mockEventsIngest).toHaveBeenCalledWith({
			events: [
				expect.objectContaining({
					metadata: expect.objectContaining({
						providerCost: 0.0012,
					}),
				}),
			],
		});
	});

	it("lets callers override vendor and model", async () => {
		mockEventsIngest.mockResolvedValueOnce({});
		const middleware = polarTanStackAIMiddleware<TestContext>({
			eventName: "tanstack-ai-usage",
			customer: { externalCustomerId: "external-id" },
			vendor: "openrouter",
			model: "anthropic/claude-sonnet-4",
		});
		const request = ctx("req-1", undefined, "ignored", "ignored");

		middleware.onUsage?.(request.context, usage(1, 1, 2));
		middleware.onFinish?.(request.context, finishInfo);

		await Promise.all(request.deferred);

		expect(mockEventsIngest).toHaveBeenCalledWith({
			events: [
				expect.objectContaining({
					externalCustomerId: "external-id",
					metadata: expect.objectContaining({
						vendor: "openrouter",
						model: "anthropic/claude-sonnet-4",
					}),
				}),
			],
		});
	});

	it("keeps concurrent requests isolated", async () => {
		mockEventsIngest.mockResolvedValue({});
		const middleware = polarTanStackAIMiddleware<TestContext>({
			eventName: "tanstack-ai-usage",
			customer: (middlewareCtx) => ({
				customerId: middlewareCtx.context.customerId,
			}),
		});
		const first = ctx("req-1", { customerId: "first" });
		const second = ctx("req-2", { customerId: "second" });

		middleware.onUsage?.(first.context, usage(1, 1, 2));
		middleware.onUsage?.(second.context, usage(10, 10, 20));
		middleware.onFinish?.(second.context, finishInfo);
		middleware.onFinish?.(first.context, finishInfo);

		await Promise.all([...first.deferred, ...second.deferred]);

		expect(mockEventsIngest).toHaveBeenCalledTimes(2);
		expect(mockEventsIngest.mock.calls).toEqual(
			expect.arrayContaining([
				[
					expect.objectContaining({
						events: [
							expect.objectContaining({
								customerId: "second",
								metadata: expect.objectContaining({ totalTokens: 20 }),
							}),
						],
					}),
				],
				[
					expect.objectContaining({
						events: [
							expect.objectContaining({
								customerId: "first",
								metadata: expect.objectContaining({ totalTokens: 2 }),
							}),
						],
					}),
				],
			]),
		);
	});

	it("does not ingest without usage", () => {
		const middleware = polarTanStackAIMiddleware<TestContext>({
			eventName: "tanstack-ai-usage",
			customer: { customerId: "customer-id" },
		});
		const request = ctx("req-1");

		middleware.onFinish?.(request.context, finishInfo);

		expect(mockEventsIngest).not.toHaveBeenCalled();
		expect(request.deferred).toEqual([]);
	});

	it("cleans up aborted requests", () => {
		const middleware = polarTanStackAIMiddleware<TestContext>({
			eventName: "tanstack-ai-usage",
			customer: { customerId: "customer-id" },
		});
		const request = ctx("req-1");

		middleware.onUsage?.(request.context, usage(1, 1, 2));
		middleware.onAbort?.(request.context, { reason: "stop", duration: 1 });
		middleware.onFinish?.(request.context, finishInfo);

		expect(mockEventsIngest).not.toHaveBeenCalled();
	});

	it("ingests finish usage when onUsage did not run", async () => {
		mockEventsIngest.mockResolvedValueOnce({});
		const middleware = polarTanStackAIMiddleware<TestContext>({
			eventName: "tanstack-ai-usage",
			customer: { customerId: "customer-id" },
		});
		const request = ctx("req-1");

		middleware.onFinish?.(request.context, {
			...finishInfo,
			usage: usage(2, 3, 5, 1),
		});

		await Promise.all(request.deferred);

		expect(mockEventsIngest).toHaveBeenCalledWith({
			events: [
				expect.objectContaining({
					metadata: expect.objectContaining({
						inputTokens: 2,
						outputTokens: 3,
						cachedInputTokens: 1,
						totalTokens: 5,
					}),
				}),
			],
		});
	});

	it("cleans up errored requests", () => {
		const middleware = polarTanStackAIMiddleware<TestContext>({
			eventName: "tanstack-ai-usage",
			customer: { customerId: "customer-id" },
		});
		const request = ctx("req-1");

		middleware.onUsage?.(request.context, usage(1, 1, 2));
		middleware.onError?.(request.context, {
			error: new Error("boom"),
			duration: 1,
		});
		middleware.onFinish?.(request.context, finishInfo);

		expect(mockEventsIngest).not.toHaveBeenCalled();
	});

	it("does not reject the chat when Polar ingestion fails", async () => {
		mockEventsIngest.mockRejectedValueOnce(new Error("polar down"));
		const middleware = polarTanStackAIMiddleware<TestContext>({
			eventName: "tanstack-ai-usage",
			customer: { customerId: "customer-id" },
		});
		const request = ctx("req-1");

		middleware.onUsage?.(request.context, usage(1, 1, 2));
		expect(() =>
			middleware.onFinish?.(request.context, finishInfo),
		).not.toThrow();
		await expect(Promise.all(request.deferred)).resolves.toEqual([undefined]);
	});
});
