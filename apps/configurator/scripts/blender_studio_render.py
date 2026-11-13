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
    scene.cycles.adaptive_threshold = 0.01
    scene.cycles.max_bounces = max(4, min(12, int(bounces) + 2))
    scene.cycles.diffuse_bounces = max(2, min(6, int(bounces)))
    scene.cycles.glossy_bounces = max(2, min(6, int(bounces)))
    scene.cycles.transmission_bounces = 8
    scene.cycles.transparent_max_bounces = 8
    scene.cycles.sample_clamp_indirect = 10.0

    # Denoising (OpenImageDenoise)
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
        scene.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    except Exception:
        pass

    # Auto-detect GPU (OptiX -> CUDA -> HIP), fallback to CPU
    selected_device = "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for backend in ("OPTIX", "CUDA", "HIP"):
            try:
                prefs.compute_device_type = backend
                prefs.refresh_devices()
                gpu_devs = [d for d in prefs.devices if d.type == backend]
                if gpu_devs:
                    for d in prefs.devices:
                        d.use = d.type == backend
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
    scene.view_settings.exposure = 0.35
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

    # Subtle architectural studio dome (low ambient so softboxes sculpt 3D depth & shadows)
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[1].position = 0.8
    if is_dark:
        ramp.color_ramp.elements[0].color = (0.03, 0.035, 0.045, 1.0)
        ramp.color_ramp.elements[1].color = (0.10, 0.11, 0.13, 1.0)
        bg.inputs["Strength"].default_value = 0.25
    else:
        ramp.color_ramp.elements[0].color = (0.65, 0.62, 0.58, 1.0)
        ramp.color_ramp.elements[1].color = (0.94, 0.95, 0.98, 1.0)
        bg.inputs["Strength"].default_value = 0.28

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


def add_area_light(name, location, target, energy, size_x, size_y, color, cast_shadow=True):
    light_data = bpy.data.lights.new(name=name, type="AREA")
    light_data.shape = "RECTANGLE"
    light_data.size = size_x
    light_data.size_y = size_y
    light_data.energy = energy
    light_data.color = color
    light_data.use_shadow = cast_shadow
    if hasattr(light_data, "spread"):
        light_data.spread = math.radians(95.0)

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


def setup_studio_lights_and_floor(center, size, meshes, is_dark=False):
    span = max(size.x, size.y, size.z, 1.8)

    # Add matte studio floor only if room architecture didn't already export one
    if not has_existing_floor(meshes):
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
                bsdf.inputs["Base Color"].default_value = (0.82, 0.80, 0.76, 1.0)
            bsdf.inputs["Roughness"].default_value = 0.88
            if "Specular IOR Level" in bsdf.inputs:
                bsdf.inputs["Specular IOR Level"].default_value = 0.2
        floor.data.materials.append(floor_mat)

    # Single-Shadow Architectural Softbox Rig (prevents double/shifted silhouette shadows on back wall!)
    scale_pow = (span * 0.55) ** 2

    # 1. Primary Key Softbox (front-left-top, warm 4500K, casts soft natural shadow)
    key_loc = Vector((center.x - span * 1.35, center.y - span * 1.55, center.z + span * 1.35))
    add_area_light(
        "StudioKeySoftbox",
        key_loc,
        center,
        energy=620.0 * scale_pow,
        size_x=span * 1.15,
        size_y=span * 0.90,
        color=(1.0, 0.95, 0.88),
        cast_shadow=True,
    )

    # 2. Shadowless Fill Softbox (front-right, cool-neutral, lifts dark interiors without double shadow)
    fill_loc = Vector((center.x + span * 1.55, center.y - span * 1.45, center.z + span * 0.75))
    add_area_light(
        "StudioFillSoftbox",
        fill_loc,
        center,
        energy=175.0 * scale_pow,
        size_x=span * 1.4,
        size_y=span * 1.0,
        color=(0.91, 0.95, 1.0),
        cast_shadow=False,
    )

    # 3. Shadowless Top/Rim Specular Accent (defines wood grain & metal edge highlights)
    rim_loc = Vector((center.x + span * 0.4, center.y - span * 0.6, center.z + span * 1.85))
    add_area_light(
        "StudioRimSoftbox",
        rim_loc,
        center,
        energy=120.0 * scale_pow,
        size_x=span * 1.2,
        size_y=span * 0.75,
        color=(1.0, 0.98, 0.95),
        cast_shadow=False,
    )


def enhance_imported_materials():
    for mat in bpy.data.materials:
        if not mat.use_nodes or not mat.node_tree:
            continue
        bsdf = None
        for node in mat.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                bsdf = node
                break
        if not bsdf:
            continue

        # Ensure glass / transmissive materials have clean IOR
        if "Transmission Weight" in bsdf.inputs and bsdf.inputs["Transmission Weight"].default_value > 0.05:
            bsdf.inputs["IOR"].default_value = 1.51


def main():
    input_glb, output_png, meta_json = parse_args()
    with open(meta_json, "r", encoding="utf-8-sig") as f:
        meta = json.load(f)

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=input_glb)

    # Scale root objects from mm -> meters (0.001)
    root_objs = [o for o in bpy.context.scene.objects if o.parent is None]
    for obj in root_objs:
        obj.scale = (obj.scale.x * 0.001, obj.scale.y * 0.001, obj.scale.z * 0.001)
        obj.location = (obj.location.x * 0.001, obj.location.y * 0.001, obj.location.z * 0.001)

    bpy.context.view_layer.update()

    enhance_imported_materials()

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    center, size = compute_scene_bounds(meshes)

    is_dark = bool(meta.get("isDark", False))
    scene = bpy.context.scene
    setup_studio_world(scene, is_dark=is_dark)
    setup_studio_lights_and_floor(center, size, meshes, is_dark=is_dark)

    # Camera setup matching Three.js PerspectiveCamera
    cam_meta = meta.get("camera", {})
    cam_pos = three_to_blender_vec(cam_meta.get("position", [2000, 1400, 3800]), 0.001)
    cam_target = three_to_blender_vec(cam_meta.get("target", [900, 1000, 300]), 0.001)
    fov_deg = float(cam_meta.get("fov", 42))

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

    print(f"[BIRIM_CYCLES] Rendering {width}x{height} @ {samples} SPP on {device_used}...")
    bpy.ops.render.render(write_still=True)
    print(f"[BIRIM_CYCLES] Done: {output_png} (device={device_used})")


if __name__ == "__main__":
    main()
