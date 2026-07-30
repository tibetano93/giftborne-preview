# Giftborne mobile 3D assets

The combat slice uses a deliberately small, real-time 3D actor pipeline. The
shipped humanoid outfit/rig is derived from the free Quaternius Modular
Character Outfits - Fantasy Standard pack. The eleven combat clips are trimmed
from the Quaternius Universal Animation Library. Both sources are CC0.

Giftborne gives the shared foundation two distinct presentations at runtime:
separate material grading, generated armor-detail atlases, weapons, lighting,
shadows, and original celestial ornaments. This is a customized vertical-slice
foundation, not a claim that the underlying mesh was authored by Giftborne and
not yet Founder acceptance of final production character art.

`scripts/build-actor-assets.mjs` takes the external source GLTF and animation
GLB, reduces embedded textures to 512 px WebP, keeps eleven named combat clips,
removes unused animation channels, and applies Meshopt compression. The source
archives are intentionally not committed.

Reproduction inputs used on 2026-07-28:

- `Modular Character Outfits - Fantasy[Standard].zip` (page version 2.1,
  SHA-256 `c3468b18871cc8c8f05ab14df7712baf22cb9f389cbd870babf130e595187f70`),
  input `Exports/glTF (Godot-Unreal)/Outfits/Male_Ranger.gltf`;
- `Universal Animation Library[Standard].zip` (downloaded 2026-07-28,
  SHA-256 `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724`),
  input `Unreal-Godot/UAL1_Standard.glb`.

Run `node scripts/build-actor-assets.mjs --model <Male_Ranger.gltf>
--animations <UAL1_Standard.glb> --output-dir
apps/miniapp/public/assets/3d` from the repository root. The committed manifest
pins the derived outputs by byte count and SHA-256.

Sources:

- https://quaternius.com/packs/modularcharacteroutfitsfantasy.html
- https://quaternius.com/packs/universalanimationlibrary.html
- https://creativecommons.org/publicdomain/zero/1.0/

The material atlases and arena floors were generated specifically for
Giftborne with the built-in OpenAI ImageGen workflow. The sunlit v2 floor is
paired with the original `celestial-vault-sunlit-v2.png` combat backdrop. They
do not imitate or contain art from an existing game franchise.

`materials/celestial-seal-v4.webp` is an original shared effect texture
generated for this pass. Its black field is intentional: the renderer uses it
only with additive blending for player casts, boss signatures, and the phase
pulse. It is loaded with the combat bundle and is not counted as actor payload.

The Skyreach Frontier v3 panorama and floor were generated on 2026-07-29 for
the Founder-requested bright-fantasy pass. The production prompt specified an
original hopeful realm of floating garden islands, ivory-and-gold structures,
waterfalls, portals, spring foliage, and a high three-quarter action-RPG
camera. It explicitly excluded franchise imitation, characters, UI, text,
grimdark lighting, and toy-like materials. Both outputs were resized and
compressed to mobile WebP before being pinned in `manifest.json`; the original
ImageGen PNGs are not runtime payloads.
