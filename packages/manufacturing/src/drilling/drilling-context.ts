import {
  ParametricPart,
  DrillingHole,
  roundMm,
  resolveHardwareProductionStatus,
} from "@birim/core";
import { getDrillingTemplateForHardware, getHardwareProductById } from "@birim/catalog";

export interface JointSpec {
  boltFromFront: number;
  dowelFromFront: number | null;
}

export interface PartDrillingContext {
  part: ParametricPart;
  holes: DrillingHole[];
  width: number;
  height: number;
  partThickness: number;
  panelT: number;
  drillTpl: ReturnType<typeof getDrillingTemplateForHardware>;
  isVisualOnlyHardware: boolean;
  mirrorX: boolean;
  insetSetbackX: number;
  connectorSys: string;
  topology: string;
  mapX: (xFromFrontEdge: number) => number;
  buildJointSpecs: (panelDepthW: number) => JointSpec[];
  buildFixedShelfCoaxialSpecs: (shelfDepthMm: number, frontOffsetOnCarcassMm: number) => JointSpec[];
  getDrawerRunnerHoleXs: (runnerLenMm: number, isInternalOrInset: boolean, panelDepthMm: number) => number[];
  pickTwoEndJoints: <T>(specs: T[]) => T[];
}

export function createPartDrillingContext(part: ParametricPart): PartDrillingContext {
  const holes: DrillingHole[] = [];
  const { width, height, depth: partThickness } = part.dimensions;
  const panelT = part.matingPanelThicknessMm || partThickness || 18;
  const drillTpl = getDrillingTemplateForHardware(part.hardwareRefId);
  const assignedHwRecord = part.hardwareRefId ? getHardwareProductById(part.hardwareRefId) : undefined;
  const isVisualOnlyHardware = assignedHwRecord
    ? resolveHardwareProductionStatus(assignedHwRecord) === "visual_only"
    : false;
  const mirrorX = Boolean(part.mirrorInnerFaceX);
  const mapX = (xFromFrontEdge: number): number =>
    roundMm(mirrorX ? width - xFromFrontEdge : xFromFrontEdge, 2);

  const insetSetbackX = roundMm(
    37 + (part.insetDoorThicknessMm || 18) + (part.insetRevealGapMm ?? 2),
    2
  );

  const pickTwoEndJoints = <T,>(specs: T[]): T[] =>
    specs.length >= 2 ? [specs[0], specs[specs.length - 1]] : specs;

  const buildJointSpecs = (panelDepthW: number): JointSpec[] => {
    const frontBoltX = part.isInsetDoor ? insetSetbackX : 37;
    if (panelDepthW < 180) {
      return [{ boltFromFront: Math.round(panelDepthW / 2), dowelFromFront: null }];
    }
    if (panelDepthW < 250) {
      const kSmall = Math.max(2, Math.floor((panelDepthW - frontBoltX - 28) / 32));
      return [
        { boltFromFront: frontBoltX, dowelFromFront: null },
        { boltFromFront: frontBoltX + kSmall * 32, dowelFromFront: null },
      ];
    }
    const kSteps = Math.max(3, Math.floor((panelDepthW - frontBoltX - 37) / 32));
    const rearBoltX = frontBoltX + kSteps * 32;
    if (part.useDepthBasedConnectorRule && panelDepthW > 500 && kSteps >= 6) {
      const midSteps = Math.floor(kSteps / 2);
      const midBoltX = frontBoltX + midSteps * 32;
      return [
        { boltFromFront: frontBoltX, dowelFromFront: frontBoltX + 32 },
        { boltFromFront: midBoltX, dowelFromFront: midBoltX + 32 },
        { boltFromFront: rearBoltX, dowelFromFront: rearBoltX - 32 },
      ];
    }
    return [
      { boltFromFront: frontBoltX, dowelFromFront: frontBoltX + 32 },
      { boltFromFront: rearBoltX, dowelFromFront: rearBoltX - 32 },
    ];
  };

  const buildFixedShelfCoaxialSpecs = (
    shelfDepthMm: number,
    frontOffsetOnCarcassMm: number
  ): JointSpec[] => {
    const baseTwo = pickTwoEndJoints(buildJointSpecs(shelfDepthMm));
    return baseTwo.map((jt) => ({
      boltFromFront: roundMm(jt.boltFromFront + frontOffsetOnCarcassMm, 2),
      dowelFromFront: jt.dowelFromFront !== null ? roundMm(jt.dowelFromFront + frontOffsetOnCarcassMm, 2) : null,
    }));
  };

  const getDrawerRunnerHoleXs = (
    runnerLenMm: number,
    isInternalOrInset: boolean,
    panelDepthMm: number
  ): number[] => {
    const x1 = isInternalOrInset ? 57 : 37;
    const x2 = x1 + 32;
    const b1 =
      runnerLenMm >= 550 ? 320 :
      runnerLenMm >= 500 ? 288 :
      runnerLenMm >= 450 ? 256 :
      runnerLenMm >= 400 ? 224 :
      runnerLenMm >= 350 ? 160 : 128;
    const x3 = Math.min(Math.max(x2 + 32, panelDepthMm - 42), x1 + b1);
    return [x1, x2, roundMm(x3, 2)];
  };

  return {
    part,
    holes,
    width,
    height,
    partThickness,
    panelT,
    drillTpl,
    isVisualOnlyHardware,
    mirrorX,
    insetSetbackX,
    connectorSys: part.connectorSystem || "minifix_dowel",
    topology: part.carcassJoineryTopology || "sides_through",
    mapX,
    buildJointSpecs,
    buildFixedShelfCoaxialSpecs,
    getDrawerRunnerHoleXs,
    pickTwoEndJoints,
  };
}
