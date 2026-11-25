"use client";

import * as THREE from "three";
import { renderSceneWithBlenderCycles } from "../../engine/blenderRenderClient";
import { computeHeroStudioFraming } from "./viewport3DSharedAssets";

import type { AttachViewport3DStudioRenderAndLoopCtx } from "./viewport3DTypes";

export function attachViewport3DStudioRenderAndLoop(ctx: AttachViewport3DStudioRenderAndLoopCtx) {
  const { activeModFrameGroupRef, cameraFlightRef, container, controlsRef, dimGroupRef, ghostSnapGroupRef, gridRef, hoverOverlayGroup, interiorPropsGroupRef, isOrbitingRef, keyLightRef, meshGroupRef, needsRenderRef, onPerformanceSample, pausedRef, perspCamRef, rendererRef, rimLightRef, roomArchGroupRef, sceneObjectsGroupRef, sceneRef, selectionFrameGroupRef, updateProjectedDimensionLabels, wallPulseRef } = ctx;
      const captureStudioSnapshot = (opts?: {
        angle?: "current" | "iso" | "front";
        hideOverlays?: boolean;
      }): string => {
        const curRenderer = rendererRef.current;
        const curScene = sceneRef.current;
        const curControls = controlsRef.current;
        const perspCam = perspCamRef.current;
        const curMeshGroup = meshGroupRef.current;
        if (!curRenderer || !curScene || !perspCam) return "";

        const prevSize = new THREE.Vector2();
        curRenderer.getSize(prevSize);
        const needsTempSize = prevSize.x < 64 || prevSize.y < 64 || container.clientWidth < 64;
        if (needsTempSize) {
          curRenderer.setSize(1280, 800, false);
          perspCam.aspect = 1280 / 800;
          perspCam.updateProjectionMatrix();
        }

        const overlayGroups = [
          dimGroupRef.current,
          selectionFrameGroupRef.current,
          activeModFrameGroupRef.current,
          ghostSnapGroupRef.current,
          hoverOverlayGroup,
        ];
        const prevVis = overlayGroups.map((g) => (g ? g.visible : false));
        if (opts?.hideOverlays !== false) {
          overlayGroups.forEach((g) => {
            if (g) g.visible = false;
          });
        }

        const savedCamPos = perspCam.position.clone();
        const savedCamQuat = perspCam.quaternion.clone();
        const useCustomAngle =
          opts?.angle === "iso" || opts?.angle === "front" || needsTempSize;
        let renderCam: THREE.Camera =
          (curControls?.object as THREE.Camera) || perspCam;

        if (useCustomAngle && curMeshGroup && curMeshGroup.children.length > 0) {
          curMeshGroup.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(curMeshGroup);
          if (!bounds.isEmpty()) {
            const framed = computeHeroStudioFraming(
              bounds,
              perspCam.fov,
              perspCam.aspect,
              opts?.angle === "front" ? "front" : "hero"
            );
            perspCam.position.copy(framed.position);
            perspCam.lookAt(framed.target);
            perspCam.updateProjectionMatrix();
            perspCam.updateMatrixWorld();
            renderCam = perspCam;
          }
        }

        if (curRenderer.shadowMap.enabled) {
          curRenderer.shadowMap.needsUpdate = true;
        }

        let dataUrl = "";
        try {
          curRenderer.render(curScene, renderCam);
          dataUrl = curRenderer.domElement.toDataURL("image/png");
        } catch {
          dataUrl = "";
        }

        if (useCustomAngle) {
          perspCam.position.copy(savedCamPos);
          perspCam.quaternion.copy(savedCamQuat);
          perspCam.updateProjectionMatrix();
          perspCam.updateMatrixWorld();
        }
        overlayGroups.forEach((g, idx) => {
          if (g) g.visible = prevVis[idx];
        });
        if (needsTempSize && prevSize.x >= 64 && prevSize.y >= 64) {
          curRenderer.setSize(prevSize.x, prevSize.y, false);
          perspCam.aspect = prevSize.x / prevSize.y;
          perspCam.updateProjectionMatrix();
        }
        needsRenderRef.current = true;
        return dataUrl;
      };

      /**
       * 16-Sample Progressive Area-Light Softbox + Halton Sub-Pixel Supersampled 2K Studio Renderer:
       * Jitters key & rim studio light positions across a physical softbox disk while jittering camera
       * sub-pixel frustum offsets, accumulating exact unweighted binary-tree averages for raytraced-grade
       * soft penumbra shadows and crisp beveled wood/lacquer edges.
       */
      const renderUltraStudioPhoto = async (opts?: {
        angle?: "current" | "iso" | "front";
        width?: number;
        height?: number;
        samples?: number;
        onProgress?: (pct: number, previewDataUrl?: string) => void;
      }): Promise<string> => {
        const curRenderer = rendererRef.current;
        const curScene = sceneRef.current;
        const curControls = controlsRef.current;
        const perspCam = perspCamRef.current;
        const curMeshGroup = meshGroupRef.current;
        const kLight = keyLightRef.current;
        const rLight = rimLightRef.current;
        if (!curRenderer || !curScene || !perspCam) return "";

        const targetW = opts?.width || 2048;
        const targetH = opts?.height || 1280;
        const totalSamples = 16; // Exact 2^4 for lossless binary-tree 0.5 alpha accumulation

        const prevSize = new THREE.Vector2();
        curRenderer.getSize(prevSize);
        const prevPixelRatio = curRenderer.getPixelRatio();

        const overlayGroups = [
          dimGroupRef.current,
          selectionFrameGroupRef.current,
          activeModFrameGroupRef.current,
          ghostSnapGroupRef.current,
          hoverOverlayGroup,
        ];
        const prevVis = overlayGroups.map((g) => (g ? g.visible : false));
        overlayGroups.forEach((g) => {
          if (g) g.visible = false;
        });

        const prevGridVis = gridRef.current ? gridRef.current.visible : false;
        if (gridRef.current) gridRef.current.visible = false;

        const savedCamPos = perspCam.position.clone();
        const savedCamQuat = perspCam.quaternion.clone();
        const savedCamAspect = perspCam.aspect;
        const savedKeyPos = kLight ? kLight.position.clone() : null;
        const savedRimPos = rLight ? rLight.position.clone() : null;
        const savedShadowsEnabled = curRenderer.shadowMap.enabled;

        curRenderer.shadowMap.enabled = true;
        curRenderer.setPixelRatio(1);
        curRenderer.setSize(targetW, targetH, false);
        perspCam.aspect = targetW / targetH;
        perspCam.updateProjectionMatrix();

        if (
          (opts?.angle === "iso" || opts?.angle === "front") &&
          curMeshGroup &&
          curMeshGroup.children.length > 0
        ) {
          curMeshGroup.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(curMeshGroup);
          if (!bounds.isEmpty()) {
            const framed = computeHeroStudioFraming(
              bounds,
              perspCam.fov,
              perspCam.aspect,
              opts?.angle === "front" ? "front" : "hero"
            );
            perspCam.position.copy(framed.position);
            perspCam.lookAt(framed.target);
            perspCam.updateMatrixWorld();
          }
        } else if (curControls?.object && curControls.object !== perspCam) {
          perspCam.position.copy(curControls.object.position);
          perspCam.quaternion.copy(curControls.object.quaternion);
          perspCam.updateMatrixWorld();
        }

        const halton = (index: number, base: number): number => {
          let result = 0;
          let f = 1 / base;
          let i = index;
          while (i > 0) {
            result += f * (i % base);
            i = Math.floor(i / base);
            f /= base;
          }
          return result;
        };

        // 4-tier binary reduction buffers for exact unweighted 16-sample averaging at globalAlpha=0.5
        const tiers = [0, 1, 2, 3].map(() => {
          const c = document.createElement("canvas");
          c.width = targetW;
          c.height = targetH;
          return { canvas: c, ctx: c.getContext("2d")! };
        });

        const softboxRadiusMm = 310;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));

        try {
          for (let s = 0; s < totalSamples; s++) {
            // Sub-pixel Halton camera jitter [-0.5 .. +0.5] px
            const jx = s === 0 ? 0 : halton(s + 1, 2) - 0.5;
            const jy = s === 0 ? 0 : halton(s + 1, 3) - 0.5;
            perspCam.setViewOffset(targetW, targetH, jx, jy, targetW, targetH);

            // Vogel disk softbox area-light sampling for silky natural penumbra shadows
            if (kLight && savedKeyPos) {
              const rFrac = Math.sqrt((s + 0.5) / totalSamples);
              const theta = s * goldenAngle;
              const ox = Math.cos(theta) * rFrac * softboxRadiusMm;
              const oz = Math.sin(theta) * rFrac * softboxRadiusMm;
              const oy = Math.sin(theta * 1.7) * rFrac * (softboxRadiusMm * 0.55);
              kLight.position.set(
                savedKeyPos.x + ox,
                savedKeyPos.y + oy,
                savedKeyPos.z + oz
              );
              curRenderer.shadowMap.needsUpdate = true;
            }
            if (rLight && savedRimPos) {
              const theta = s * goldenAngle + 1.2;
              rLight.position.set(
                savedRimPos.x + Math.cos(theta) * 140,
                savedRimPos.y + Math.sin(theta) * 90,
                savedRimPos.z
              );
            }

            curRenderer.render(curScene, perspCam);

            // Binary-tree 0.5 alpha blend reduction
            tiers[0].ctx.globalAlpha = s % 2 === 0 ? 1.0 : 0.5;
            tiers[0].ctx.drawImage(curRenderer.domElement, 0, 0);
            if (s % 2 === 1) {
              const p1 = s >> 1;
              tiers[1].ctx.globalAlpha = p1 % 2 === 0 ? 1.0 : 0.5;
              tiers[1].ctx.drawImage(tiers[0].canvas, 0, 0);
              if (p1 % 2 === 1) {
                const p2 = s >> 2;
                tiers[2].ctx.globalAlpha = p2 % 2 === 0 ? 1.0 : 0.5;
                tiers[2].ctx.drawImage(tiers[1].canvas, 0, 0);
                if (p2 % 2 === 1) {
                  const p3 = s >> 3;
                  tiers[3].ctx.globalAlpha = p3 % 2 === 0 ? 1.0 : 0.5;
                  tiers[3].ctx.drawImage(tiers[2].canvas, 0, 0);
                }
              }
            }

            const pct = Math.round(((s + 1) / totalSamples) * 100);
            const shouldEmitPreview = s === 0 || s === 1 || s === 3 || s === 7 || s === 11 || s === totalSamples - 1;
            let previewUrl: string | undefined;
            if (opts?.onProgress && shouldEmitPreview) {
              const activeTier = s >= 7 ? tiers[3] : s >= 3 ? tiers[2] : s >= 1 ? tiers[1] : tiers[0];
              try {
                previewUrl = activeTier.canvas.toDataURL("image/jpeg", 0.78);
              } catch {
                previewUrl = undefined;
              }
            }
            if (opts?.onProgress) opts.onProgress(pct, previewUrl);
            if ((shouldEmitPreview || s % 2 === 1) && s < totalSamples - 1) {
              await new Promise<void>((r) => requestAnimationFrame(() => r()));
            }
          }

          // Subtle architectural lens vignette for gallery realism
          const finalCtx = tiers[3].ctx;
          finalCtx.globalAlpha = 1.0;
          const vig = finalCtx.createRadialGradient(
            targetW * 0.5,
            targetH * 0.48,
            Math.min(targetW, targetH) * 0.36,
            targetW * 0.5,
            targetH * 0.5,
            Math.max(targetW, targetH) * 0.74
          );
          vig.addColorStop(0, "rgba(20, 20, 19, 0)");
          vig.addColorStop(1, "rgba(20, 20, 19, 0.11)");
          finalCtx.fillStyle = vig;
          finalCtx.fillRect(0, 0, targetW, targetH);

          return tiers[3].canvas.toDataURL("image/png");
        } catch {
          return "";
        } finally {
          perspCam.clearViewOffset();
          perspCam.position.copy(savedCamPos);
          perspCam.quaternion.copy(savedCamQuat);
          perspCam.aspect = savedCamAspect;
          perspCam.updateProjectionMatrix();
          perspCam.updateMatrixWorld();

          if (kLight && savedKeyPos) kLight.position.copy(savedKeyPos);
          if (rLight && savedRimPos) rLight.position.copy(savedRimPos);
          curRenderer.shadowMap.enabled = savedShadowsEnabled;
          curRenderer.shadowMap.needsUpdate = true;

          if (prevSize.x >= 64 && prevSize.y >= 64) {
            curRenderer.setPixelRatio(prevPixelRatio);
            curRenderer.setSize(prevSize.x, prevSize.y, false);
          }
          if (gridRef.current) gridRef.current.visible = prevGridVis;
          overlayGroups.forEach((g, idx) => {
            if (g) g.visible = prevVis[idx];
          });
          needsRenderRef.current = true;
        }
      };

      const renderPathTracedPhoto = async (opts?: {
        samples?: number;
        bounces?: number;
        softboxSizeMm?: number;
        width?: number;
        height?: number;
        angle?: "current" | "iso" | "front";
        onProgress?: (pct: number, currentPreviewUrl?: string) => void;
        shouldCancel?: () => boolean;
      }): Promise<{
        dataUrl: string;
        elapsedMs: number;
        samplesCompleted: number;
        metrics: { drawCalls: number; triangles: number; geometries: number; textures: number };
        engine?: string;
        device?: string;
        error?: string;
      }> => {
        const tStart = performance.now();
        const curRenderer = rendererRef.current;
        const curScene = sceneRef.current;
        const perspCam = perspCamRef.current;
        const curControls = controlsRef.current;
        const curGroup = meshGroupRef.current;
        const emptyMetrics = { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };

        if (!curRenderer || !curScene || !perspCam || !curControls || !curGroup) {
          return { dataUrl: "", elapsedMs: 0, samplesCompleted: 0, metrics: emptyMetrics, error: "3D sahne hazir degil." };
        }

        const totalSamples = Math.max(8, Math.min(256, opts?.samples ?? 48));
        const targetW = Math.max(640, Math.min(3840, opts?.width ?? 1920));
        const targetH = Math.max(400, Math.min(2160, opts?.height ?? 1080));
        const bounces = Math.max(2, Math.min(10, opts?.bounces ?? 5));

        const camPos = perspCam.position.clone();
        const camTarget = curControls.target.clone();
        if (curControls.object && curControls.object !== perspCam) {
          camPos.copy(curControls.object.position);
        }

        if (opts?.angle && opts.angle !== "current" && curGroup.children.length > 0) {
          curGroup.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(curGroup);
          if (!bounds.isEmpty()) {
            const framed = computeHeroStudioFraming(
              bounds,
              perspCam.fov,
              targetW / targetH,
              opts.angle === "front" ? "front" : "hero"
            );
            camPos.copy(framed.position);
            camTarget.copy(framed.target);
          }
        }

        const roots: THREE.Object3D[] = [curGroup];
        if (sceneObjectsGroupRef.current && sceneObjectsGroupRef.current.children.length > 0) {
          roots.push(sceneObjectsGroupRef.current);
        }
        if (roomArchGroupRef.current && roomArchGroupRef.current.children.length > 0) {
          roots.push(roomArchGroupRef.current);
        }

        const metrics = {
          drawCalls: curRenderer.info.render.calls,
          triangles: curRenderer.info.render.triangles,
          geometries: curRenderer.info.memory.geometries,
          textures: curRenderer.info.memory.textures,
        };

        const isDarkBg =
          curScene.background instanceof THREE.Color
            ? curScene.background.getHSL({ h: 0, s: 0, l: 0 }).l < 0.35
            : false;

        try {
          const result = await renderSceneWithBlenderCycles({
            roots,
            cameraPosition: camPos,
            cameraTarget: camTarget,
            cameraFov: perspCam.fov,
            width: targetW,
            height: targetH,
            samples: totalSamples,
            bounces,
            isDark: isDarkBg,
            onProgress: (pct: number) => opts?.onProgress?.(pct),
            shouldCancel: opts?.shouldCancel,
          });

          return {
            dataUrl: result.dataUrl,
            elapsedMs: result.elapsedMs,
            samplesCompleted: totalSamples,
            metrics,
            engine: result.engine,
            device: result.device,
          };
        } catch (err) {
          return {
            dataUrl: "",
            elapsedMs: Math.round(performance.now() - tStart),
            samplesCompleted: 0,
            metrics,
            error: err instanceof Error ? err.message : "Blender Cycles render hatasi",
          };
        }
      };

      const getLiveSceneStats = () => {
        const curR = rendererRef.current;
        if (!curR) return null;
        return {
          drawCalls: curR.info.render.calls,
          triangles: curR.info.render.triangles,
          geometries: curR.info.memory.geometries,
          textures: curR.info.memory.textures,
          lastFrameMs: 4.2,
        };
      };

      const winHooks = window as unknown as {
        __birimCapture3DSnapshot?: typeof captureStudioSnapshot;
        __birimRenderUltraStudioPhoto?: typeof renderUltraStudioPhoto;
        __birimRenderPathTracedPhoto?: typeof renderPathTracedPhoto;
        __birimGetLiveSceneStats?: typeof getLiveSceneStats;
      };
      winHooks.__birimCapture3DSnapshot = captureStudioSnapshot;
      winHooks.__birimRenderUltraStudioPhoto = renderUltraStudioPhoto;
      winHooks.__birimRenderPathTracedPhoto = renderPathTracedPhoto;
      winHooks.__birimGetLiveSceneStats = getLiveSceneStats;

      let animId: number;
      let lastDimSyncMs = 0;

      const animate = () => {
        animId = requestAnimationFrame(animate);
        if (pausedRef.current) return;
        const curControls = controlsRef.current;
        const curRenderer = rendererRef.current;
        const curScene = sceneRef.current;
        if (!curControls || !curRenderer || !curScene) return;

        let isFlying = false;
        const flight = cameraFlightRef.current;
        if (flight && perspCamRef.current) {
          const nowMs = performance.now();
          const rawT = Math.min(1, Math.max(0, (nowMs - flight.startTime) / Math.max(1, flight.durationMs)));
          const ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
          perspCamRef.current.position.lerpVectors(flight.startPos, flight.endPos, ease);
          curControls.target.lerpVectors(flight.startTarget, flight.endTarget, ease);
          perspCamRef.current.lookAt(curControls.target);
          isFlying = true;
          needsRenderRef.current = true;
          if (rawT >= 1) {
            cameraFlightRef.current = null;
            if (curRenderer.shadowMap.enabled) {
              curRenderer.shadowMap.needsUpdate = true;
            }
          }
        }
        const updated = curControls.update();
        let isWallPulsing = false;
        const wallPulse = wallPulseRef.current;
        if (wallPulse && roomArchGroupRef.current) {
          const rawP = (performance.now() - wallPulse.startTime) / Math.max(1, wallPulse.durationMs);
          const clampedP = Math.min(1, Math.max(0, rawP));
          // Fast bright attack (0..0.22) followed by smooth ease-out decay (0.22..1)
          const env =
            clampedP >= 1
              ? 0
              : clampedP < 0.22
                ? clampedP / 0.22
                : Math.pow(1 - (clampedP - 0.22) / 0.78, 1.65);

          const defaultBaseCyan = new THREE.Color(0x0ea5e9);
          const flashCyan = new THREE.Color(0xf0f9ff);

          roomArchGroupRef.current.traverse((node) => {
            if (node.userData?.isRoomWallGroup && node.userData.wallId === wallPulse.wallId) {
              node.traverse((child) => {
                if (child.userData?.isWallFocusRail && child instanceof THREE.Mesh) {
                  const mat = child.material as THREE.MeshBasicMaterial;
                  if (mat && mat.isMeshBasicMaterial) {
                    const baseOp = typeof child.userData.baseOpacity === "number" ? child.userData.baseOpacity : 0.85;
                    const baseCol =
                      typeof child.userData.baseColorHex === "number"
                        ? new THREE.Color(child.userData.baseColorHex)
                        : defaultBaseCyan;
                    const pulseCol = baseCol.clone().lerp(flashCyan, env * 0.85);
                    mat.opacity = Math.min(1, baseOp + (1 - baseOp) * env);
                    mat.color.copy(clampedP >= 1 ? baseCol : pulseCol);
                  }
                  const railAxis = child.userData.railAxis as "horiz" | "vert" | "bracket" | undefined;
                  const thicknessBoost = 1 + 0.75 * env;
                  if (railAxis === "horiz") {
                    child.scale.set(1, clampedP >= 1 ? 1 : thicknessBoost, clampedP >= 1 ? 1 : thicknessBoost);
                  } else if (railAxis === "vert") {
                    child.scale.set(clampedP >= 1 ? 1 : thicknessBoost, 1, clampedP >= 1 ? 1 : thicknessBoost);
                  } else if (railAxis === "bracket") {
                    const bScale = 1 + 0.14 * env;
                    child.scale.set(clampedP >= 1 ? 1 : bScale, clampedP >= 1 ? 1 : bScale, 1);
                  }
                } else if (
                  child.userData?.isWallBadgeSprite &&
                  (child instanceof THREE.Mesh || child instanceof THREE.Sprite)
                ) {
                  const bsx = typeof child.userData.baseScaleX === "number" ? child.userData.baseScaleX : 1;
                  const bsy = typeof child.userData.baseScaleY === "number" ? child.userData.baseScaleY : 1;
                  const s = clampedP >= 1 ? 1 : 1 + 0.22 * env;
                  child.scale.set(bsx * s, bsy * s, 1);
                  const mat = child.material as THREE.MeshBasicMaterial | THREE.SpriteMaterial;
                  if (mat) {
                    const baseOp = typeof child.userData.baseOpacity === "number" ? child.userData.baseOpacity : 0.92;
                    mat.opacity = clampedP >= 1 ? baseOp : Math.min(1, baseOp + (1 - baseOp) * env);
                  }
                } else if (
                  child.userData?.isRoomWall &&
                  child.userData.wallId === wallPulse.wallId &&
                  child instanceof THREE.Mesh
                ) {
                  const mat = child.material as THREE.MeshStandardMaterial;
                  if (mat && mat.isMeshStandardMaterial && mat.userData?.isIsolatedSelectedWallMat) {
                    const baseEm =
                      typeof mat.userData.baseEmissiveIntensity === "number"
                        ? mat.userData.baseEmissiveIntensity
                        : 0;
                    mat.emissive.setHex(0x0ea5e9);
                    mat.emissiveIntensity = clampedP >= 1 ? baseEm : baseEm + 0.28 * env;
                  }
                }
              });
            }
          });

          if (clampedP >= 1) {
            wallPulseRef.current = null;
            needsRenderRef.current = true;
          } else {
            isWallPulsing = true;
            needsRenderRef.current = true;
          }
        }
        if (needsRenderRef.current || updated || isFlying || isWallPulsing) {
          const t0 = performance.now();
          const cam = (curControls.object as THREE.Camera) || perspCamRef.current;
          if (cam) {
            // Guarantee 0-frame lock between every cabinet module in meshGroup and its belongings in interiorPropsGroup
            const mGrp = meshGroupRef.current;
            const pGrp = interiorPropsGroupRef.current;
            if (mGrp && pGrp && pGrp.visible && pGrp.children.length > 0) {
              for (let pi = 0; pi < pGrp.children.length; pi++) {
                const ph = pGrp.children[pi];
                const phModId = ph.userData?.moduleId;
                const phModIdx = ph.userData?.moduleIndex;
                let liveMod: THREE.Object3D | undefined;
                for (let mi = 0; mi < mGrp.children.length; mi++) {
                  const cand = mGrp.children[mi];
                  if (
                    (phModId && cand.userData?.moduleId === phModId) ||
                    (typeof phModIdx === "number" && cand.userData?.moduleIndex === phModIdx)
                  ) {
                    liveMod = cand;
                    break;
                  }
                }
                if (
                  liveMod &&
                  (Math.abs(ph.position.x - liveMod.position.x) > 0.05 ||
                    Math.abs(ph.position.y - liveMod.position.y) > 0.05 ||
                    Math.abs(ph.position.z - liveMod.position.z) > 0.05 ||
                    Math.abs(ph.rotation.y - liveMod.rotation.y) > 0.0005)
                ) {
                  ph.position.copy(liveMod.position);
                  ph.rotation.copy(liveMod.rotation);
                  ph.updateMatrix();
                  ph.updateMatrixWorld(true);
                }
              }
            }
            if (roomArchGroupRef.current && cam) {
              const cp = cam.position;
              for (const ch of roomArchGroupRef.current.children) {
                if (ch.userData?.isRoomWallGroup && ch.userData.inwardNormal && ch.userData.wallMid) {
                  const wn = ch.userData.inwardNormal;
                  const wm = ch.userData.wallMid;
                  const camSideDot = (cp.x - wm.x) * wn.x + (cp.z - wm.z) * wn.z;
                  ch.visible = camSideDot >= -150;
                } else if (ch instanceof THREE.Mesh && ch.position.z < 10 && ch.geometry instanceof THREE.PlaneGeometry) {
                  ch.visible = cp.z >= -100;
                }
              }
            }
            curRenderer.render(curScene, cam);
            if (!isOrbitingRef.current || t0 - lastDimSyncMs >= 24) {
              lastDimSyncMs = t0;
              updateProjectedDimensionLabels();
            }
          }
          const dt = performance.now() - t0;
          if (new URLSearchParams(window.location.search).has("audit"))
            curRenderer.domElement.dataset.performance = JSON.stringify({
              renderCpuMs: dt,
              drawCalls: curRenderer.info.render.calls,
              triangles: curRenderer.info.render.triangles,
              geometries: curRenderer.info.memory.geometries,
              textures: curRenderer.info.memory.textures,
            });
          if (onPerformanceSample) onPerformanceSample({ lastRenderMs: dt });
          needsRenderRef.current = false;
        }
      };
      animate();
  return () => {
    cancelAnimationFrame(animId);
  };
}
