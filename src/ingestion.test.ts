import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolarIngestion } from "./ingestion";

const mockEventsIngest = vi.fn();

// Mock the Polar SDK
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

import { Polar } from "@polar-sh/sdk";

describe("PolarIngestion Batching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("should batch multiple events within 500ms into a single request", async () => {
    const ingestion = new PolarIngestion();
    ingestion.polarClient = new Polar();

    ingestion.schedule("test-meter");

    const customerId = "customer-1";

    // Execute multiple times within 500ms
    await ingestion.execute({ value: 1 }, { customerId });
    await ingestion.execute({ value: 2 }, { customerId });
    await ingestion.execute({ value: 3 }, { customerId });

    // Should not have called ingest yet
    expect(mockEventsIngest).not.toHaveBeenCalled();

    // Fast-forward time by 500ms to trigger batch flush
    await vi.advanceTimersByTimeAsync(500);

    // Should have called ingest once with all 3 events
    expect(mockEventsIngest).toHaveBeenCalledTimes(1);
    expect(mockEventsIngest).toHaveBeenCalledWith({
      events: [
        { customerId, name: "test-meter", metadata: { value: 1 } },
        { customerId, name: "test-meter", metadata: { value: 2 } },
        { customerId, name: "test-meter", metadata: { value: 3 } },
      ],
    });
  });

  it("should reset timer when new events arrive within timeout period", async () => {
    const ingestion = new PolarIngestion();
    ingestion.polarClient = new Polar();

    ingestion.schedule("test-meter");

    const customerId = "customer-1";

    // First event
    await ingestion.execute({ value: 1 }, { customerId });

    // Advance time by 300ms (less than 500ms)
    await vi.advanceTimersByTimeAsync(300);

    // Second event - should reset timer
    await ingestion.execute({ value: 2 }, { customerId });

    // Advance another 300ms (total 600ms from first event, but only 300ms from second)
    await vi.advanceTimersByTimeAsync(300);

    // Should not have flushed yet
    expect(mockEventsIngest).not.toHaveBeenCalled();

    // Advance final 200ms to complete 500ms from second event
    await vi.advanceTimersByTimeAsync(200);

    // Now should have flushed
    expect(mockEventsIngest).toHaveBeenCalledTimes(1);
    expect(mockEventsIngest).toHaveBeenCalledWith({
      events: [
        { customerId, name: "test-meter", metadata: { value: 1 } },
        { customerId, name: "test-meter", metadata: { value: 2 } },
      ],
    });
  });

  it("should create separate batches when events are more than 500ms apart", async () => {
    const ingestion = new PolarIngestion();
    ingestion.polarClient = new Polar();

    ingestion.schedule("test-meter");

    const customerId = "customer-1";

    // First batch
    await ingestion.execute({ value: 1 }, { customerId });
    await ingestion.execute({ value: 2 }, { customerId });

    // Flush first batch
    await vi.advanceTimersByTimeAsync(500);

    expect(mockEventsIngest).toHaveBeenCalledTimes(1);
    expect(mockEventsIngest).toHaveBeenCalledWith({
      events: [
        { customerId, name: "test-meter", metadata: { value: 1 } },
        { customerId, name: "test-meter", metadata: { value: 2 } },
      ],
    });

    // Second batch
    await ingestion.execute({ value: 3 }, { customerId });
    await ingestion.execute({ value: 4 }, { customerId });

    // Flush second batch
    await vi.advanceTimersByTimeAsync(500);

    expect(mockEventsIngest).toHaveBeenCalledTimes(2);
    expect(mockEventsIngest).toHaveBeenNthCalledWith(2, {
      events: [
        { customerId, name: "test-meter", metadata: { value: 3 } },
        { customerId, name: "test-meter", metadata: { value: 4 } },
      ],
    });
  });

  it("should handle metadata resolver correctly in batching", async () => {
    const ingestion = new PolarIngestion<{ value: number }>();
    ingestion.polarClient = new Polar();

    ingestion.schedule("test-meter", (ctx) => ({
      doubled: ctx.value * 2,
    }));

    const customerId = "customer-1";

    await ingestion.execute({ value: 5 }, { customerId });
    await ingestion.execute({ value: 10 }, { customerId });

    await vi.advanceTimersByTimeAsync(500);

    expect(mockEventsIngest).toHaveBeenCalledWith({
      events: [
        { customerId, name: "test-meter", metadata: { doubled: 10 } },
        { customerId, name: "test-meter", metadata: { doubled: 20 } },
      ],
    });
  });

  it("should batch events for different customers together", async () => {
    const ingestion = new PolarIngestion();
    ingestion.polarClient = new Polar();

    ingestion.schedule("test-meter");

    await ingestion.execute({ value: 1 }, { customerId: "customer-1" });
    await ingestion.execute({ value: 2 }, { customerId: "customer-2" });
    await ingestion.execute({ value: 3 }, { customerId: "customer-3" });

    await vi.advanceTimersByTimeAsync(500);

    expect(mockEventsIngest).toHaveBeenCalledTimes(1);
    expect(mockEventsIngest).toHaveBeenCalledWith({
      events: [
        {
          customerId: "customer-1",
          name: "test-meter",
          metadata: { value: 1 },
        },
        {
          customerId: "customer-2",
          name: "test-meter",
          metadata: { value: 2 },
        },
        {
          customerId: "customer-3",
          name: "test-meter",
          metadata: { value: 3 },
        },
      ],
    });
  });
});
