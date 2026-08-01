# Giftborne mobile 3D assets

The combat slice uses a deliberately small, real-time 3D actor pipeline. The
hidden humanoid rig is derived from the free Quaternius Modular Character
Outfits - Fantasy Standard pack. The source motion is trimmed from the
Quaternius Universal Animation Library. Both foundations are CC0. Giftborne's
committed motion builder retimes and layers that source into 21 actor-specific
semantic clips: ten for Aetherion and eleven for the Relic Sovereign.

The authored combat identities replace the visible shared Ranger surface.
`aetherion-authored-v5.glb` and `relic-sovereign-authored-v5.glb` preserve only
the audited skeleton; the source body is removed from both shipped GLBs. Their
complete visible silhouettes, armor, regalia, weapons and emissive geometry
are original Giftborne work. The v5 principals each batch 41 authored pieces
into core and detail shells. Hard armor stays rigid while compact original
elbow and knee bridges use two-bone weights to remove the disconnected puppet
read. Aetherion adds adult proportions, closed gauntlets and boots, a split
cape and refined relic blade; the Sovereign adds a tapered split vessel,
faceted mask, clawed gauntlets, asymmetric orbit rings and crescent staff.
Every visible hero/boss
primitive carries deterministic normalized `TEXCOORD_0` islands so the
external 512 px armor atlases are coherently sampled at runtime; energy
materials stay untextured for controlled emission.
`vault-sentinel-authored-v3.glb` and
`aether-wisp-authored-v3.glb` are fully original profiled Giftborne meshes.
Each carries five compact transform clips for locomotion, attack/cast, hit and
death. Their reproducible geometry source is `scripts/build-authored-actors.py`.

Rebuild these committed outputs with Blender 4.5.5 LTS and the workspace
optimizer:

```powershell
pnpm exec node scripts/build-authored-actors.mjs `
  --blender <path-to-blender.exe> `
  --source-rig scripts/source-assets/giftborne-humanoid-rig.glb `
  --output-dir apps/miniapp/public/assets/3d

pnpm exec node scripts/build-authored-motion.mjs `
  --source scripts/source-assets/giftborne-combat-clips-v1.glb `
  --output apps/miniapp/public/assets/3d/giftborne-authored-motion-v2.glb
```

Blender 4.5.5 LTS creates deterministic smart-UV islands across each batched
core and detail shell. The optimizer keeps those UVs
through glTF pruning and Meshopt compression. Asset validation decodes the final
GLBs and rejects incomplete, out-of-bounds or collapsed UV coverage. The build
prints immutable sizes and SHA-256 digests. The intermediate shared rig remains in
`scripts/source-assets` as an authoring input and is no longer shipped in the
Mini App public bundle.

At runtime, there is no imported Ranger mesh to hide. The skeleton drives the
original rigid armor and blended joint bridges through actor-prefixed in-place clips while combat
timing remains owned by the deterministic simulation. Aetherion has distinct
idle, run, two-hit combo, three casts, step, stagger and death motion. The
Sovereign has distinct hover, glide, charge, fan, cast, Starfall, channel,
stagger, ascension and death motion. Aetherion samples the versioned
`aetherion-star-metal` color/normal/roughness set; the Sovereign samples the
matching `sovereign-moon-regalia` set. Only the primary ivory/pearl armor groups
sample these maps so secondary colors remain readable at mobile scale. Missing
color or surface maps fail back independently to the existing colored PBR
materials without hiding either actor. Each principal declares exact core,
detail and total visible-triangle counts under a 12,000-triangle ceiling. The
complete actor payload is 1,328,026 / 1,500,000 bytes. This M0 slice is still subject to Founder
acceptance on physical iPhone and Android hardware; it is not a claim of final
campaign character art.

`scripts/build-actor-assets.mjs` takes the external source GLTF and animation
GLB, reduces embedded textures to 512 px WebP, trims the foundation clips,
removes unused animation channels, and applies Meshopt compression. The exact
trimmed motion input needed by the authored-motion builder is pinned at
`scripts/source-assets/giftborne-combat-clips-v1.glb`; the larger source
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
scripts/source-assets` from the repository root, then run the two committed
builders above to produce the public actor and motion GLBs. Asset validation
pins both source derivatives and every runtime output by byte count and SHA-256.

Sources:

- https://quaternius.com/packs/modularcharacteroutfitsfantasy.html
- https://quaternius.com/packs/universalanimationlibrary.html
- https://creativecommons.org/publicdomain/zero/1.0/

The material atlases and arena floors were generated specifically for
Giftborne with the built-in OpenAI ImageGen workflow. The sunlit v2 floor is
paired with the original `celestial-vault-sunlit-v2.png` combat backdrop. They
do not imitate or contain art from an existing game franchise.

The v2 principal-material recipe is pinned at
`scripts/source-assets/principal-materials-v2.json`. Its two original color
materials were generated with the built-in ImageGen workflow and compressed to
512 px WebP. `scripts/build-principal-materials.mjs` deterministically derives
the 256 px wrapped-Sobel normal and bounded roughness maps from those shipped
color files. Both data-map types use lossless WebP so RGB directions and scalar
response survive transport; the six-map principal surface payload is 521,206
bytes and the complete actor payload remains under its 1.5 MB gate. Low-tier
combat requests only the two color maps; balanced/high add normal and roughness.

The approved v5 character turnaround references are pinned at
`scripts/source-assets/principal-identity-v5.json` with their complete built-in
ImageGen prompts, source PNG digests and compact 1200x800 WebP derivatives.
They are modeling references only and are never loaded by the Mini App.

`materials/celestial-seal-v4.webp` is an original shared effect texture
generated for this pass. Its black field is intentional: the renderer uses it
only with additive blending for player casts, boss signatures, and the phase
pulse. It is loaded with the combat bundle and is not counted as actor payload.

`materials/combat-vfx-atlas-v1.webp` is the production 3x3 alpha atlas for the
five player skills, ordinary and critical impacts, the boss phase pulse, and
celestial embers. Its original square ImageGen render is pinned at
`scripts/source-assets/giftborne-combat-vfx-source.png`; the build script
resizes it to 1024 px, extracts additive alpha from the pure-black field, and
enforces a 640 KB mobile budget:

```powershell
pnpm exec node scripts/build-combat-vfx-atlas.mjs `
  --source scripts/source-assets/giftborne-combat-vfx-source.png `
  --output apps/miniapp/public/assets/3d/materials/combat-vfx-atlas-v1.webp
```

The atlas prompt requested nine isolated original ivory, gold, sky, jade,
coral, and amethyst effects on pure black: Slash, Burst, Shield, Starfall,
Astral Step, normal impact, critical impact, phase pulse, and embers. It
explicitly excluded characters, UI, text, logos, franchise motifs, grimdark
lighting, and toy-like materials. Geometric warning zones remain separate and
the prior primitive effects remain the load-failure and low-cost fallback.

The Skyreach Frontier v3 panorama and floor were generated on 2026-07-29 for
the Founder-requested bright-fantasy pass. The production prompt specified an
original hopeful realm of floating garden islands, ivory-and-gold structures,
waterfalls, portals, spring foliage, and a high three-quarter action-RPG
camera. It explicitly excluded franchise imitation, characters, UI, text,
grimdark lighting, and toy-like materials. Both outputs were resized and
compressed to mobile WebP before being pinned in `manifest.json`; the original
ImageGen PNGs are not runtime payloads.
