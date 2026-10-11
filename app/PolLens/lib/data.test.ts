import assert from "node:assert/strict";
import { test } from "node:test";
import { getReviewedDetections, type GrainAnnotation } from "@/lib/data";

test("a corrected model grain moves to the researcher species and retains its confidence", () => {
  const detections = [{
    speciesId: "pennisetum_polystachion" as const,
    grainCount: 1,
    avgConfidence: 0.76,
    confidenceGrainCount: 1,
  }];
  const grains = [{
    id: "G15",
    speciesId: "pennisetum_polystachion" as const,
    confidence: 0.76,
    box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
  }];
  const annotations: GrainAnnotation[] = [{
    id: "review-1",
    grainId: "G15",
    kind: "corrected",
    speciesId: "leucaena_leucocephala",
    box: grains[0].box,
    reviewedAt: "2026-10-10T10:00:00Z",
  }];

  assert.deepEqual(getReviewedDetections(detections, grains, annotations), [{
    speciesId: "leucaena_leucocephala",
    grainCount: 1,
    avgConfidence: 0.76,
    confidenceGrainCount: 1,
  }]);
});

test("a corrected grain joins existing researcher species counts", () => {
  const detections = [
    { speciesId: "pennisetum_polystachion" as const, grainCount: 1, avgConfidence: 0.76, confidenceGrainCount: 1 },
    { speciesId: "leucaena_leucocephala" as const, grainCount: 2, avgConfidence: 0.8, confidenceGrainCount: 2 },
  ];
  const grains = [{
    id: "G15",
    speciesId: "pennisetum_polystachion" as const,
    confidence: 0.76,
    box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
  }];
  const annotations: GrainAnnotation[] = [{
    id: "review-1",
    grainId: "G15",
    kind: "corrected",
    speciesId: "leucaena_leucocephala",
    box: grains[0].box,
    reviewedAt: "2026-10-10T10:00:00Z",
  }];

  const reviewed = getReviewedDetections(detections, grains, annotations);
  assert.equal(reviewed.some((detection) => detection.speciesId === "pennisetum_polystachion"), false);
  const leucaena = reviewed.find((detection) => detection.speciesId === "leucaena_leucocephala");
  assert.equal(leucaena?.grainCount, 3);
  assert.equal(leucaena?.confidenceGrainCount, 3);
  assert.ok(Math.abs((leucaena?.avgConfidence ?? 0) - 0.7866666666666667) < 0.000000001);
});
