import type { RadarDeepLaneAdapter, RadarDeepLaneInvocation, RadarDeepLaneRequest } from "@/lib/radar/deep-lane";

export class FixtureDeepLaneProvider implements RadarDeepLaneAdapter {
  readonly provider = "fixture";
  readonly model = "fixture-model";
  readonly modelRevision = "fixture-v1";
  readonly adapterVersion = "fixture-deep-lane-v1";
  readonly supportsIdempotencyKey = true;
  invocationCount = 0;
  readonly invocationKeys: string[] = [];
  async request(input: RadarDeepLaneRequest, invocation?: RadarDeepLaneInvocation) { this.invocationCount += 1; if (invocation) this.invocationKeys.push(invocation.providerIdempotencyKey); return { schemaVersion: input.outputSchemaVersion, provider: this.provider, model: this.model, modelRevision: this.modelRevision, requestHash: input.requestHash, generatedAt: "2026-09-19T00:00:00.000Z", inferences: [{ key: "fixture-context", label: "Fixture context", statement: "This is a development-only inference fixture.", uncertainty: "Fixture output is not production intelligence.", evidenceIds: [input.evidence[0]?.evidenceId ?? "missing"] }] };
  }
}
