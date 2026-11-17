"""
Headless Blender 4.2+ Cycles Studio Renderer for Birim Configurator.
Usage:
  blender --background --python blender_studio_render.py -- <input.glb> <output.png> <meta.json>
"""

import json
import math
import os
import sys
import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    if len(argv) < 3:
        raise RuntimeError("Usage: blender --background --python blender_studio_render.py -- <input.glb> <output.png> <meta.json>")
    return argv[0], argv[1], argv[2]


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def three_to_blender_vec(v, scale=0.001):
    # Three.js (X right, Y up, Z front) -> Blender (X right, Y back, Z up)
    return Vector((float(v[0]) * scale, -float(v[2]) * scale, float(v[1]) * scale))


def configure_cycles(scene, samples, bounces):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = max(16, min(256, int(samples)))
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.015
    scene.cycles.max_bounces = max(4, min(8, int(bounces)))
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 3
    scene.cycles.transmission_bounces = 4
    scene.cycles.transparent_max_bounces = 4
    scene.cycles.sample_clamp_indirect = 10.0
    if hasattr(scene.cycles, "use_auto_tile"):
        scene.cycles.use_auto_tile = False
    if hasattr(scene.render, "use_persistent_data"):
        scene.render.use_persistent_data = True

    # Denoising (OpenImageDenoise)
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
        scene.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    except Exception:
        pass

    # Auto-detect GPU (OptiX -> CUDA -> HIP), skipping legacy GTX 400-700/GT cards that hit Windows 2s TDR timeout
    selected_device = "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for backend in ("OPTIX", "CUDA", "HIP"):
            try:
                prefs.compute_device_type = backend
                prefs.refresh_devices()
                gpu_devs = [
                    d for d in prefs.devices
                    if d.type == backend and not any(tag in d.name.upper() for tag in ("GTX 4", "GTX 5", "GTX 6", "GTX 7", "GT 4", "GT 5", "GT 6", "GT 7"))
                ]
                if gpu_devs:
                    for d in prefs.devices:
                        d.use = d in gpu_devs
                    scene.cycles.device = "GPU"
                    selected_device = backend
                    break
            except Exception:
                continue
    except Exception:
        pass

    if selected_device == "CPU":
        scene.cycles.device = "CPU"

    return selected_device


def setup_color_management(scene):
    try:
        scene.view_settings.view_transform = "AgX"
        try:
            scene.view_settings.look = "AgX - Medium High Contrast"
        except Exception:
            scene.view_settings.look = "None"
    except Exception:
        scene.view_settings.view_transform = "Filmic"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0


def setup_studio_world(scene, is_dark=False):
    world = bpy.data.worlds.new("BirimStudioWorld")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    sep_xyz = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")

    # Balanced architectural studio dome for clean GI fill in interiors & cabinets
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[1].position = 0.8
    if is_dark:
        ramp.color_ramp.elements[0].color = (0.03, 0.035, 0.045, 1.0)
        ramp.color_ramp.elements[1].color = (0.10, 0.11, 0.13, 1.0)
        bg.inputs["Strength"].default_value = 0.18
    else:
        ramp.color_ramp.elements[0].color = (0.70, 0.69, 0.67, 1.0)
        ramp.color_ramp.elements[1].color = (0.90, 0.92, 0.96, 1.0)
        bg.inputs["Strength"].default_value = 0.24

    nt.links.new(tex_coord.outputs["Generated"], sep_xyz.inputs["Vector"])
    nt.links.new(sep_xyz.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def compute_scene_bounds(meshes):
    min_v = Vector((1e9, 1e9, 1e9))
    max_v = Vector((-1e9, -1e9, -1e9))
    found = False
    for obj in meshes:
        if obj.type != "MESH" or not obj.data or len(obj.data.vertices) == 0:
            continue
        found = True
        for corner in obj.bound_box:
            wc = obj.matrix_world @ Vector(corner)
            min_v.x = min(min_v.x, wc.x)
            min_v.y = min(min_v.y, wc.y)
            min_v.z = min(min_v.z, wc.z)
            max_v.x = max(max_v.x, wc.x)
            max_v.y = max(max_v.y, wc.y)
            max_v.z = max(max_v.z, wc.z)
    if not found:
        return Vector((0, 0, 0)), Vector((1.5, 1.5, 1.5))
    center = (min_v + max_v) * 0.5
    size = max_v - min_v
    return center, size


def add_area_light(name, location, target, energy, size_x, size_y, color, cast_shadow=True, spread_deg=85.0):
    light_data = bpy.data.lights.new(name=name, type="AREA")
    light_data.shape = "RECTANGLE"
    light_data.size = size_x
    light_data.size_y = size_y
    light_data.energy = energy
    light_data.color = color
    light_data.use_shadow = cast_shadow
    if hasattr(light_data, "spread"):
        light_data.spread = math.radians(spread_deg)

    light_obj = bpy.data.objects.new(name=name, object_data=light_data)
    bpy.context.collection.objects.link(light_obj)
    light_obj.location = location
    direction = target - location
    light_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    if not cast_shadow:
        light_obj.visible_shadow = False
    return light_obj


def has_existing_floor(meshes):
    for obj in meshes:
        if obj.type != "MESH" or not obj.data:
            continue
        zs = [(obj.matrix_world @ Vector(c)).z for c in obj.bound_box]
        xs = [(obj.matrix_world @ Vector(c)).x for c in obj.bound_box]
        ys = [(obj.matrix_world @ Vector(c)).y for c in obj.bound_box]
        dz = max(zs) - min(zs)
        dx = max(xs) - min(xs)
        dy = max(ys) - min(ys)
        if dz < 0.05 and max(zs) <= 0.02 and dx > 3.0 and dy > 3.0:
            return True
    return False


def setup_studio_lights_and_floor(center, size, meshes, cam_pos, cam_target, is_dark=False):
    span = max(size.x, size.y, size.z, 1.8)
    has_room = has_existing_floor(meshes)

    # Add matte studio floor only if room architecture didn't already export one
    if not has_room:
        bpy.ops.mesh.primitive_plane_add(size=max(24.0, span * 10.0), location=(center.x, center.y, -0.003))
        floor = bpy.context.active_object
        floor.name = "BirimStudioFloor"
        floor_mat = bpy.data.materials.new("BirimStudioFloorMat")
        floor_mat.use_nodes = True
        bsdf = floor_mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            if is_dark:
                bsdf.inputs["Base Color"].default_value = (0.06, 0.065, 0.075, 1.0)
            else:
                bsdf.inputs["Base Color"].default_value = (0.72, 0.70, 0.67, 1.0)
            bsdf.inputs["Roughness"].default_value = 0.88
            if "Specular IOR Level" in bsdf.inputs:
                bsdf.inputs["Specular IOR Level"].default_value = 0.2
        floor.data.materials.append(floor_mat)

    # Camera-relative studio softbox rig so room walls/ceiling never occlude the lights
    to_cam = cam_pos - cam_target
    cam_dist = max(to_cam.length, 1.5)
    forward = to_cam.normalized() if to_cam.length > 1e-4 else Vector((0.0, -1.0, 0.35)).normalized()
    world_up = Vector((0.0, 0.0, 1.0))
    right = world_up.cross(forward)
    if right.length < 1e-4:
        right = Vector((1.0, 0.0, 0.0))
    right.normalize()

    rig_dist = min(cam_dist * 0.85, max(span * 0.95, 2.2)) if has_room else max(span * 1.4, cam_dist * 0.85)
    rig_height = min(size.z * 0.9, rig_dist * 0.65) if has_room else rig_dist * 0.85
    # Normalize energy at 3.0m reference distance to prevent overexposure under AgX
    dist_scale = (rig_dist / 3.0) ** 2

    # 1. Large Window-Style Key Softbox (wide area = silky feathered shadows, no hard rectangular wall halo)
    key_loc = cam_target + forward * (rig_dist * 0.65) - right * (rig_dist * 0.85) + Vector((0.0, 0.0, rig_height * 1.1))
    add_area_light(
        "StudioKeySoftbox",
        key_loc,
        cam_target,
        energy=115.0 * dist_scale,
        size_x=max(2.2, rig_dist * 1.15),
        size_y=max(1.8, rig_dist * 0.95),
        color=(1.0, 0.96, 0.91),
        cast_shadow=True,
        spread_deg=105.0,
    )

    # 2. Broad Cool Fill Softbox (gentle bounce light for natural interior gradient)
    fill_loc = cam_target + forward * (rig_dist * 0.9) + right * (rig_dist * 0.85) + Vector((0.0, 0.0, rig_height * 0.55))
    add_area_light(
        "StudioFillSoftbox",
        fill_loc,
        cam_target,
        energy=32.0 * dist_scale,
        size_x=max(2.0, rig_dist * 1.1),
        size_y=max(1.5, rig_dist * 0.85),
        color=(0.90, 0.95, 1.0),
        cast_shadow=False,
        spread_deg=125.0,
    )

    # 3. Overhead Soft Accent (defines wardrobe top & wood grain sheen without harsh wall shadows)
    rim_loc = cam_target + forward * (rig_dist * 0.3) + right * (rig_dist * 0.25) + Vector((0.0, 0.0, rig_height * 1.25))
    add_area_light(
        "StudioRimSoftbox",
        rim_loc,
        cam_target,
        energy=38.0 * dist_scale,
        size_x=max(1.8, rig_dist * 0.9),
        size_y=max(1.2, rig_dist * 0.65),
        color=(1.0, 0.98, 0.96),
        cast_shadow=False,
        spread_deg=100.0,
    )


def enhance_imported_materials():
    for mat in bpy.data.materials:
        if not mat.use_nodes or not mat.node_tree:
            continue
        nt = mat.node_tree
        bsdf = None
        for node in nt.nodes:
            if node.type == "BSDF_PRINCIPLED":
                bsdf = node
                break
        if not bsdf:
            continue

        # Ensure glass / transmissive materials have clean IOR
        if "Transmission Weight" in bsdf.inputs and bsdf.inputs["Transmission Weight"].default_value > 0.05:
            bsdf.inputs["IOR"].default_value = 1.51
            continue

        # Tight crevice-only Ambient Occlusion (4.5cm) so door/drawer gaps pop without creating a wall halo
        base_in = bsdf.inputs.get("Base Color")
        if base_in:
            ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
            ao.samples = 8
            ao.inputs["Distance"].default_value = 0.045
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 0.22
            if base_in.is_linked:
                orig_link = base_in.links[0]
                orig_socket = orig_link.from_socket
                nt.links.remove(orig_link)
                nt.links.new(orig_socket, mix.inputs[6])  # A (Color)
            else:
                mix.inputs[6].default_value = tuple(base_in.default_value)
            nt.links.new(ao.outputs["Color"], mix.inputs[7])  # B (Color)
            nt.links.new(mix.outputs[2], base_in)  # Result (Color)

        # Tactile wood/parquet micro-bump + satin sheen from existing diffuse texture
        tex_nodes = [n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image]
        if tex_nodes:
            tex = tex_nodes[0]
            if "Normal" in bsdf.inputs and not bsdf.inputs["Normal"].is_linked:
                bump = nt.nodes.new("ShaderNodeBump")
                bump.inputs["Strength"].default_value = 0.045
                bump.inputs["Distance"].default_value = 0.001
                nt.links.new(tex.outputs["Color"], bump.inputs["Height"])
                nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
            if "Coat Weight" in bsdf.inputs:
                bsdf.inputs["Coat Weight"].default_value = 0.12
                if "Coat Roughness" in bsdf.inputs:
                    bsdf.inputs["Coat Roughness"].default_value = 0.24


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True)
    input_glb, output_png, meta_json = parse_args()
    with open(meta_json, "r", encoding="utf-8-sig") as f:
        meta = json.load(f)

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=input_glb)
    print("[BIRIM_CYCLES] Scene imported, configuring studio...", flush=True)

    # Scale root objects from mm -> meters (0.001)
    root_objs = [o for o in bpy.context.scene.objects if o.parent is None]
    for obj in root_objs:
        obj.scale = (obj.scale.x * 0.001, obj.scale.y * 0.001, obj.scale.z * 0.001)
        obj.location = (obj.location.x * 0.001, obj.location.y * 0.001, obj.location.z * 0.001)

    bpy.context.view_layer.update()

    enhance_imported_materials()

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    center, size = compute_scene_bounds(meshes)

    # Camera coordinates in Blender meter space (needed for camera-relative studio lighting)
    cam_meta = meta.get("camera", {})
    cam_pos = three_to_blender_vec(cam_meta.get("position", [2000, 1400, 3800]), 0.001)
    cam_target = three_to_blender_vec(cam_meta.get("target", [900, 1000, 300]), 0.001)
    fov_deg = float(cam_meta.get("fov", 42))

    is_dark = bool(meta.get("isDark", False))
    scene = bpy.context.scene
    setup_studio_world(scene, is_dark=is_dark)
    setup_studio_lights_and_floor(center, size, meshes, cam_pos, cam_target, is_dark=is_dark)

    # Camera setup matching Three.js PerspectiveCamera

    cam_data = bpy.data.cameras.new("BirimStudioCam")
    cam_data.lens_unit = "FOV"
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle = math.radians(max(12.0, min(95.0, fov_deg)))
    cam_data.clip_start = 0.04
    cam_data.clip_end = 100.0

    cam_obj = bpy.data.objects.new("BirimStudioCam", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = cam_pos
    direction = cam_target - cam_pos
    if direction.length > 1e-5:
        cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam_obj

    # Render output configuration
    width = max(320, min(3840, int(meta.get("width", 1920))))
    height = max(240, min(2160, int(meta.get("height", 1080))))
    samples = int(meta.get("samples", 48))
    bounces = int(meta.get("bounces", 5))

    device_used = configure_cycles(scene, samples=samples, bounces=bounces)
    setup_color_management(scene)

    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = output_png

    print(f"[BIRIM_CYCLES] Rendering {width}x{height} @ {samples} SPP on {device_used}...", flush=True)
    bpy.ops.render.render(write_still=True)
    print(f"[BIRIM_CYCLES] Done: {output_png} (device={device_used})", flush=True)


if __name__ == "__main__":
    main()
