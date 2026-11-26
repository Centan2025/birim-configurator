export interface BirimDraggedAccessoryPayload {
  id: string;
  title?: string;
  visual?: string;
  kind?: "shelf" | "drawer" | "hanging_rail" | "special_fitting";
  label?: string;
  fittingKind?: string;
  drawerHeightMm?: number;
  fixedShelf?: boolean;
  hardwareId?: string;
  mountType?: "movable" | "fixed_minifix" | "fixed_rafix";
}

export interface BirimDraggedMaterialPayload {
  materialId: string;
  materialName?: string;
  name?: string;
  colorHex?: string;
  scope?: string;
}

declare global {
  interface Window {
    __birimActiveDraggedAccessory?: BirimDraggedAccessoryPayload | null;
    __birimDraggedMaterial?: BirimDraggedMaterialPayload | null;
    __birimSuppressNextClick?: number;
    __birimLastPartDropId?: string;
    __birimLastPartDropTs?: number;
  }
}

export {};
