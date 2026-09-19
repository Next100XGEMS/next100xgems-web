import type { RadarDeepLaneAdapter, RadarDeepLaneRequest } from "@/lib/radar/deep-lane";

export class FixtureDeepLaneProvider implements RadarDeepLaneAdapter {
  readonly provider = "fixture";
  readonly model = "fixture-model";
  readonly modelRevision = "fixture-v1";
  async request(input: RadarDeepLaneRequest) { return { schemaVersion: input.outputSchemaVersion, provider: this.provider, model: "fixture-model", modelRevision: "fixture-v1", requestHash: input.inputHash, generatedAt: "2026-09-19T00:00:00.000Z", inferences: [{ key: "fixture-context", label: "Fixture context", statement: "This is a development-only inference fixture.", uncertainty: "Fixture output is not production intelligence.", evidenceIds: [input.evidence[0]?.evidenceId ?? "missing"] }] };
  }
}
