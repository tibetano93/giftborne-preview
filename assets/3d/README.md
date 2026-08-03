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

Balanced and high quality use the production v17 Aetherion and v14 Sovereign
while low quality keeps the v8 pair above. `aetherion-authored-v17.glb` retains the complete
Blender human anatomy and adds seven fitted armor meshes from crownjoshua's
CC0 Rigged Knight foundation, retargeted to the compact Giftborne skeleton.
Only the source armor geometry is used; its character, controls, scripts,
materials and animation are excluded. The fitted source helmet is reshaped beneath
an original closed winged celestial crown and cyan eye slit; shoulder and
breastplate vertices are tapered around an adult heroic silhouette without changing
the bind skeleton. Source armor islands retain separate textured ivory plate,
antique gold and dark articulated joints.
Paired armor uses the matching anatomical side, Gauntlets use their measured
40-degree drop instead of the shoulder angle, and symmetric pieces preserve X
symmetry through decimation. The fitted under-suit uses neutral charcoal and
leather extremities instead of cyan mannequin surfaces.
The integrated aether-heart chest hierarchy, two four-bone gold-edged mantle
panels and narrower Light Sword complete the original presentation. The production
hero contains 31,000 visible triangles in one skinned shell across seven draw groups.
`relic-sovereign-authored-v14.glb` instead derives from
CDmir's CC0 Forest Monster: one connected 5,546-triangle skinned colossus with
large grounded limbs, claws and embedded 512 px stone-and-bark base/normal
maps plus a 120-triangle skinned detail shell for its compact fractured crown,
luminous eyes and chest singularity. The oversized source tree and all legacy scene helpers are excluded. The
actor pair is selected once before combat begins: low uses v8 while
balanced/high use the v17/v14 production pair. If the high-tier renderer misses its preflight frame
budget, adaptation reduces shadows, DPR and effect density while preserving
the production principals; actor geometry is never swapped mid-encounter.
Every principal primitive carries validated normalized `TEXCOORD_0` data.
Aetherion samples the external 512 px armor maps; the production Sovereign
retains its audited embedded source UV detail and textures. Energy materials
stay untextured for controlled emission.
`vault-sentinel-authored-v4.glb` and
`aether-wisp-authored-v4.glb` are fully original profiled Giftborne meshes.
Each carries five compact transform clips for locomotion, attack/cast, hit and
death. Their versioned geometry source is `scripts/build-authored-actors.py`.

Rebuild these committed outputs with Blender 4.5.12 LTS and the workspace
optimizer:

```powershell
pnpm exec node scripts/build-authored-actors.mjs `
  --blender <path-to-blender.exe> `
  --source-rig scripts/source-assets/giftborne-humanoid-rig.glb `
  --hero-foundation <path-to-extracted-human_base_meshes_bundle.blend> `
  --hero-armor-foundation <path-to-Knight_0.blend> `
  --boss-foundation <path-to-extracted-forest-monster-final.blend> `
  --output-dir apps/miniapp/public/assets/3d

pnpm exec node scripts/build-authored-motion.mjs `
  --source scripts/source-assets/giftborne-combat-clips-v1.glb `
  --output apps/miniapp/public/assets/3d/giftborne-authored-motion-v3.glb
```

Blender 4.5.12 LTS creates bounded normalized smart-UV islands across each batched
core and detail shell. The optimizer keeps those UVs
through glTF pruning and Meshopt compression. Asset validation decodes the final
GLBs and rejects incomplete, out-of-bounds or collapsed UV coverage. The build
prints the result sizes and SHA-256 digests; the manifest pins the exact
committed variants. Blender may reorder equivalent joined UV vertices between
authoring runs, so a regenerated GLB requires a manifest update and the full
asset validator rather than an assumed byte-identical hash. The intermediate shared rig remains in
`scripts/source-assets` as an authoring input and is no longer shipped in the
Mini App public bundle.

At runtime each licensed foundation is transformed into a named Giftborne
actor; no hidden duplicate body or source helper scene is loaded.
Independent actor skeletons drive the production anatomy while combat timing
and world movement remain owned by the deterministic simulation. Aetherion has distinct
idle, run, two-hit combo, three casts, step, stagger and death motion. The
Sovereign has distinct hover, glide, charge, fan, cast, Starfall, channel,
stagger, ascension and death motion. Aetherion samples the versioned
`aetherion-star-metal` color/normal/roughness set. The production Sovereign uses
its embedded graded celestial-stone base and normal textures with a grounded rough
material response. Missing external hero maps fail back to colored PBR without
hiding either actor. Each principal declares exact core, detail and total
visible-triangle counts. The low actor payload is 1,204,746 / 1,500,000 bytes;
the production payload is 1,792,646 / 1,875,000 bytes. A conservative
validator ceiling for a deployment cache containing both the production and
low principals is 2,408,526 / 2,500,000 bytes; the current high-tier
adaptation does not fetch or swap to the low pair. This M0
slice is still subject to Founder acceptance on physical iPhone and Android
hardware; it is not a claim of final campaign character art.

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
- https://opengameart.org/content/knight-rigged-mid-poly
- https://download.blender.org/durian/models/dragon_adult.blend.zip
- https://opengameart.org/content/forest-monster
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

Credit: Aetherion v17 additionally uses modified fitted armor geometry from
`Knight (Rigged - Mid Poly)` by crownjoshua, released under CC0. Giftborne does
not ship its source character, Rigify controls, scripts, materials or
animations. The exact source-file size and SHA-256 are pinned in
`scripts/source-assets/aetherion-armor-foundation-v1.json`.

Attribution: Relic Sovereign v8 uses a modified mobile derivative of the adult
Scales dragon from Sintel by Blender Foundation, licensed CC BY 3.0. The
Giftborne materials, reduced rig, animation, combat role and presentation are
original modifications and are not endorsed by Blender Foundation. The credit
and links remain reachable from Settings in EN, RU and ZH for the low-tier
fallback.

Credit: Relic Sovereign v14 uses a modified derivative of `Forest Monster` by
CDmir with TinyWorlds, released under CC0. Giftborne removes the tree canopy and
legacy scene, retains the connected monster anatomy and UV detail, and authors
the encounter role and semantic clip set. Exact archive/file sizes and SHA-256
digests are pinned in
`scripts/source-assets/sovereign-production-foundation-v1.json`.

The material atlases and arena floors were generated specifically for
Giftborne with the built-in OpenAI ImageGen workflow. The sunlit v2 floor is
paired with the original `celestial-vault-sunlit-v2.png` combat backdrop. They
do not imitate or contain art from an existing game franchise.

The v3 principal-material recipe is pinned at
`scripts/source-assets/principal-materials-v3.json`. Its two original color
materials were generated with the built-in ImageGen workflow and compressed to
512 px WebP. `scripts/build-principal-materials.mjs` deterministically derives
the 248 px wrapped-Sobel normal and bounded roughness maps from those shipped
color files. Both data-map types use lossless WebP so RGB directions and scalar
response survive transport. The Aetherion maps remain actor payload; the older
Sovereign atlas is retained as provenance/fallback material but Sovereign v14 uses the
Forest Monster's embedded textures. Low-tier combat remains under its 1.5 MB
actor gate and balanced/high remain under the measured 1.875 MB gate.

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
