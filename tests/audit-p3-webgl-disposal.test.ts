import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import {
  disposeObject3DTree,
  markSharedGeometry,
  markSharedMaterial,
} from "../apps/configurator/src/v3/materials/webglResourceGuard";

describe("Audit Phase 3 — 3D WebGL Memory Management & Disposal Guard", () => {
  it("1. disposes InstancedMesh instance buffers, Sprite materials, and MeshPhysicalMaterial clearcoat/env maps while sparing shared resources", () => {
    const root = new THREE.Group();

    const sharedGeo = markSharedGeometry(new THREE.BoxGeometry(1, 1, 1));
    const sharedMat = markSharedMaterial(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const sharedGeoDispose = vi.spyOn(sharedGeo, "dispose");
    const sharedMatDispose = vi.spyOn(sharedMat, "dispose");

    const inst = new THREE.InstancedMesh(sharedGeo, sharedMat, 8);
    const instDispose = vi.spyOn(inst, "dispose");
    root.add(inst);

    const clearcoatTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const envTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const ccSpy = vi.spyOn(clearcoatTex, "dispose");
    const envSpy = vi.spyOn(envTex, "dispose");

    const physMat = new THREE.MeshPhysicalMaterial({
      clearcoatMap: clearcoatTex,
      envMap: envTex,
    });
    const physMatDispose = vi.spyOn(physMat, "dispose");
    const ownedGeo = new THREE.BoxGeometry(10, 10, 10);
    const ownedGeoDispose = vi.spyOn(ownedGeo, "dispose");
    root.add(new THREE.Mesh(ownedGeo, physMat));

    const spriteTex = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
    const spriteTexSpy = vi.spyOn(spriteTex, "dispose");
    const spriteMat = new THREE.SpriteMaterial({ map: spriteTex });
    const spriteMatSpy = vi.spyOn(spriteMat, "dispose");
    root.add(new THREE.Sprite(spriteMat));

    disposeObject3DTree(root);

    expect(instDispose).toHaveBeenCalledTimes(1);
    expect(sharedGeoDispose).not.toHaveBeenCalled();
    expect(sharedMatDispose).not.toHaveBeenCalled();
    expect(ownedGeoDispose).toHaveBeenCalledTimes(1);
    expect(physMatDispose).toHaveBeenCalledTimes(1);
    expect(ccSpy).toHaveBeenCalledTimes(1);
    expect(envSpy).toHaveBeenCalledTimes(1);
    expect(spriteMatSpy).toHaveBeenCalledTimes(1);
    expect(spriteTexSpy).toHaveBeenCalledTimes(1);
    expect(root.children.length).toBe(0);
  });
});
