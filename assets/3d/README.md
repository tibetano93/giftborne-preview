# Giftborne mobile 3D assets

The combat slice uses a deliberately small, real-time 3D actor pipeline.
Aetherion's motion skeleton and source clips are derived from the free CC0
Quaternius libraries, while his visible anatomy comes from Blender's official
CC0 Human Base Meshes bundle. The Relic Sovereign has a separate
nonhuman mobile skeleton and eleven embedded encounter clips.

`aetherion-authored-v8.glb` replaces the shared low-poly Ranger surface with a
mobile derivative of Blender's CC0 realistic male Human Base Mesh. The source
modifiers and materials are excluded; Giftborne keeps the complete face,
paired source sclera, hands and connected anatomy, adds explicit iris and pupil
geometry, and retargets them to the deterministic motion skeleton alongside an
original fitted celestial cuirass, crown, cape, fauld, tabard and relic blade.
The complete actor remains at 11,408 visible triangles and eleven draw groups. The
source archive and exact
SHA-256 are pinned in
`scripts/source-assets/aetherion-production-foundation-v1.json`, and the
required credit is preserved below. `relic-sovereign-authored-v8.glb` replaces
the humanoid stand-in with a modified mobile derivative of the Blender
Foundation's adult Scales dragon from Sintel. Source scripts, simulations,
high-resolution sculpt data and materials are excluded. Giftborne rebuilds an
82-bone mobile skeleton, limits skinning to four influences, reduces the actor
to 11,938 visible triangles and authors its celestial materials plus eleven
semantic motions. Each boss clip now drives 19-22 varying channels across the
spine, neck, jaw, all large, medium and small wing chains, hindquarters and tail
instead of isolated root poses.
Every hero/boss primitive carries deterministic normalized
`TEXCOORD_0` islands so the external 512 px armor atlases are coherently sampled
at runtime; energy materials stay untextured for controlled emission.
`vault-sentinel-authored-v4.glb` and
`aether-wisp-authored-v4.glb` are fully original profiled Giftborne meshes.
Each carries five compact transform clips for locomotion, attack/cast, hit and
death. Their reproducible geometry source is `scripts/build-authored-actors.py`.

Rebuild these committed outputs with Blender 4.5.5 LTS and the workspace
optimizer:

```powershell
pnpm exec node scripts/build-authored-actors.mjs `
  --blender <path-to-blender.exe> `
  --source-rig scripts/source-assets/giftborne-humanoid-rig.glb `
  --hero-foundation <path-to-extracted-human_base_meshes_bundle.blend> `
  --boss-foundation <path-to-extracted-dragon_adult.blend> `
  --output-dir apps/miniapp/public/assets/3d

pnpm exec node scripts/build-authored-motion.mjs `
  --source scripts/source-assets/giftborne-combat-clips-v1.glb `
  --output apps/miniapp/public/assets/3d/giftborne-authored-motion-v3.glb
```

Blender 4.5.5 LTS creates deterministic smart-UV islands across each batched
core and detail shell. The optimizer keeps those UVs
through glTF pruning and Meshopt compression. Asset validation decodes the final
GLBs and rejects incomplete, out-of-bounds or collapsed UV coverage. The build
prints immutable sizes and SHA-256 digests. The intermediate shared rig remains in
`scripts/source-assets` as an authoring input and is no longer shipped in the
Mini App public bundle.

At runtime each licensed foundation is stripped, decimated, recolored and
batched into the Giftborne core shell; no hidden duplicate body is loaded.
Independent actor skeletons drive the production anatomy while combat timing
and world movement remain owned by the deterministic simulation. Aetherion has distinct
idle, run, two-hit combo, three casts, step, stagger and death motion. The
Sovereign has distinct hover, glide, charge, fan, cast, Starfall, channel,
stagger, ascension and death motion. Aetherion samples the versioned
`aetherion-star-metal` color/normal/roughness set; the Sovereign samples the
matching `sovereign-moon-regalia` set. Only the primary ivory/pearl armor groups
sample these maps so secondary colors remain readable at mobile scale. Missing
color or surface maps fail back independently to the existing colored PBR
materials without hiding either actor. Each principal declares exact core,
detail and total visible-triangle counts under a 12,000-triangle ceiling. The
complete actor payload is 1,493,746 / 1,500,000 bytes. This M0 slice is still subject to Founder
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

- https://download.blender.org/demo/bundles/bundles-3.6/human-base-meshes-bundle-v1.0.0.zip
- https://download.blender.org/durian/models/dragon_adult.blend.zip
- https://creativecommons.org/licenses/by/3.0/
- https://quaternius.com/packs/modularcharacteroutfitsfantasy.html
- https://quaternius.com/packs/universalanimationlibrary.html
- https://creativecommons.org/publicdomain/zero/1.0/

Credit: Aetherion v8 uses a modified mobile derivative of the realistic male
Human Base Mesh by Blender Studio and the Blender community, released under
CC0. The Giftborne name, material zoning, retarget, armor, relic geometry and
game presentation are original modifications and are not endorsed by Blender
Foundation. The source and license links are reachable from the in-app Settings
panel in every supported language.

Attribution: Relic Sovereign v8 uses a modified mobile derivative of the adult
Scales dragon from Sintel by Blender Foundation, licensed CC BY 3.0. The
Giftborne materials, reduced rig, animation, combat role and presentation are
original modifications and are not endorsed by Blender Foundation. The exact
source archive/file sizes and SHA-256 digests are pinned in
`scripts/source-assets/sovereign-production-foundation-v1.json`; the same credit
and links are reachable from Settings in EN, RU and ZH.

The material atlases and arena floors were generated specifically for
Giftborne with the built-in OpenAI ImageGen workflow. The sunlit v2 floor is
paired with the original `celestial-vault-sunlit-v2.png` combat backdrop. They
do not imitate or contain art from an existing game franchise.

The v2 principal-material recipe is pinned at
`scripts/source-assets/principal-materials-v2.json`. Its two original color
materials were generated with the built-in ImageGen workflow and compressed to
512 px WebP. `scripts/build-principal-materials.mjs` deterministically derives
the 248 px wrapped-Sobel normal and bounded roughness maps from those shipped
color files. Both data-map types use lossless WebP so RGB directions and scalar
response survive transport; the six-map principal surface payload is 477,410
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
