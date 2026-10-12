/* Generated from existing Giftborne profile readers. Rebuild with scripts/build-profile-contracts.cjs; no auth or combat owner here.
[["apps/miniapp/src/characterFetch.ts","a791ec8672bc82c7a5a1ed895f9b1e32c93b41c97d04b5722badf4893e15e64f"],["apps/miniapp/src/clientContract.ts","aac9a8f4d1684ba595741ae121c9fb2628b516ba025f05e45439752ccce0dca2"],["apps/miniapp/src/collectibleEquipmentFetch.ts","1f6ed9abd3c44d58bb5e1e8923384f251d4c9b5911b66d979d4d1614730f21f0"],["packages/gift-engine/dist/collectibleEquipment.js","18f97255ac5ff799fae0acbcf2be3a7e244e5139d97e86da18e56de44b36cdc4"],["packages/shared/dist/characterIdentity.js","813192dd94e93f347d1d59a018da7db189129d4a4dc40f590ae754c12d09f68b"],["packages/shared/dist/clientContract.js","e23e70bbc12d936b501837d7d164c578460a60f1eaa12d21cb5457fec654c775"],["packages/shared/dist/collectibleGifts.js","420e7aa535d58bdef1a6d723ee99e4bb1cb3e6afe78fa7340974ed80d0b1f2a2"],["../../../../../DevData/Projects/giftborne-2d-ref2game/scripts/profile-contracts-entry.mjs","9df9812eeae3eed4b091854137baa222d74c8562d9a31f39a01faf2f87403feb"]]
*/
var GIFTBORNE_SERVER_CONTRACTS = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#region ../../../CodexData/.codex/worktrees/721e/giftborne/packages/shared/dist/characterIdentity.js
	/** Creation identity, not a replacement for combat-sim's ability/role authority.
	* Catalog membership alone does not mean a class or race has runtime coverage.
	*/
	var CHARACTER_RACE_IDS = Object.freeze([
		"dawnfolk",
		"aeral",
		"stonekin",
		"emberkin",
		"thornborn",
		"tideborn",
		"glassborn",
		"duskborn"
	]);
	var CHARACTER_CLASS_IDS = Object.freeze([
		"warrior",
		"runesmith",
		"veilblade",
		"stormcaller",
		"dawnwarden",
		"thornbinder",
		"wayfarer",
		"duskweaver",
		"chronomancer",
		"oathkeeper"
	]);
	Object.freeze({
		version: 1,
		raceId: "dawnfolk",
		classId: "warrior",
		appearance: Object.freeze({
			build: "slender",
			complexion: 0,
			hairStyle: 0,
			hairColor: 0
		})
	});
	var record$1 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
	var exact$2 = (value, keys) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
	var preset = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5;
	var parseCharacterIdentity = (value) => {
		if (!record$1(value) || !exact$2(value, [
			"version",
			"raceId",
			"classId",
			"appearance"
		]) || value["version"] !== 1 || !CHARACTER_RACE_IDS.includes(value["raceId"]) || !CHARACTER_CLASS_IDS.includes(value["classId"]) || !record$1(value["appearance"])) throw new Error("character-identity-invalid");
		const appearance = value["appearance"];
		if (!exact$2(appearance, [
			"build",
			"complexion",
			"hairStyle",
			"hairColor"
		]) || !["slender", "sturdy"].includes(appearance["build"]) || !preset(appearance["complexion"]) || !preset(appearance["hairStyle"]) || !preset(appearance["hairColor"])) throw new Error("character-identity-invalid");
		return Object.freeze({
			version: 1,
			raceId: value["raceId"],
			classId: value["classId"],
			appearance: Object.freeze({
				build: appearance["build"],
				complexion: appearance["complexion"],
				hairStyle: appearance["hairStyle"],
				hairColor: appearance["hairColor"]
			})
		});
	};
	//#endregion
	//#region ../../../CodexData/.codex/worktrees/721e/giftborne/packages/shared/dist/collectibleGifts.js
	/** Strict game DTO reader for persistence/wire data, not Telegram authentication. */
	function parseTelegramCollectibleGift(value) {
		const invalid = () => {
			throw new Error("invalid-collectible-gift");
		};
		const record = (input, keys) => {
			if (typeof input !== "object" || input === null || Array.isArray(input) || Object.keys(input).length !== keys.length || keys.some((key) => !Object.hasOwn(input, key))) return invalid();
			return input;
		};
		const text = (input) => {
			if (typeof input !== "string" || input.length === 0 || input.length > 128 || [...input].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return invalid();
			return input;
		};
		const integer = (input, max, min = 0) => {
			if (typeof input !== "number" || !Number.isSafeInteger(input) || input < min || input > max) return invalid();
			return input;
		};
		const trait = (input) => {
			const data = record(input, ["name", "rarityPermille"]);
			return {
				name: text(data["name"]),
				rarityPermille: integer(data["rarityPermille"], 1e3)
			};
		};
		const gift = record(value, [
			"slug",
			"collectionId",
			"collectionName",
			"number",
			"model",
			"symbol",
			"backdrop"
		]);
		const slug = text(gift["slug"]), collectionId = text(gift["collectionId"]);
		if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(slug) || !/^\d{1,32}$/.test(collectionId)) return invalid();
		const backdrop = record(gift["backdrop"], [
			"name",
			"rarityPermille",
			"colors"
		]);
		const colors = record(backdrop["colors"], [
			"center",
			"edge",
			"symbol",
			"text"
		]);
		return {
			slug,
			collectionId,
			collectionName: text(gift["collectionName"]),
			number: integer(gift["number"], Number.MAX_SAFE_INTEGER, 1),
			model: trait(gift["model"]),
			symbol: trait(gift["symbol"]),
			backdrop: {
				name: text(backdrop["name"]),
				rarityPermille: integer(backdrop["rarityPermille"], 1e3),
				colors: {
					center: integer(colors["center"], 16777215),
					edge: integer(colors["edge"], 16777215),
					symbol: integer(colors["symbol"], 16777215),
					text: integer(colors["text"], 16777215)
				}
			}
		};
	}
	//#endregion
	//#region ../../../CodexData/.codex/worktrees/721e/giftborne/packages/shared/dist/clientContract.js
	/** Reader capability, not identity/auth or a mutable publication/source SHA.
	* v5 reads dungeon/duel entry barriers and main-hand collectible equipment.
	* Older strict readers must reopen the paired client before any profile access. */
	var GAME_CLIENT_CONTRACT = "giftborne.world-client.v5";
	var GAME_CLIENT_CONTRACT_QUERY = "clientContract";
	/** Reads optional persisted caravan poses; never a command or authentication. */
	var CINDER_CARAVAN_READER_QUERY = "cinderCaravan";
	var CINDER_CARAVAN_READER = "world-v1";
	/** Optional spatial-preset reader, independent of the v3/v4 replay contract. */
	var CHOIR_PLACEMENT_READER_QUERY = "choirPlacement";
	var CHOIR_PLACEMENT_READER = "world-v1";
	var BRIDGE_PLACEMENT_READER_QUERY = "bridgePlacement";
	var BRIDGE_PLACEMENT_READER = "world-v1";
	/** Opt-in frozen world-motion prefix, acknowledged by /encounters/pending. */
	var ADMISSION_MOVEMENT_READER_QUERY = "admissionMovement";
	var ADMISSION_MOVEMENT_READER = "world-v1";
	/** Reads optional immutable ordinary-combat analog movement rules. */
	var ANALOG_MOVEMENT_READER_QUERY = "playerMovement";
	var ANALOG_MOVEMENT_READER = "world-analog-v1";
	/** Reads head, off-hand and main-hand replacements, not ownership/authentication.
	* Earlier readers cannot parse main-hand selections/frozen gear; paired release only. */
	var COLLECTIBLE_EQUIPMENT_READER_QUERY = "collectibleEquipment";
	var COLLECTIBLE_EQUIPMENT_READER = "slots-v4";
	/** Opt-in local dungeon skill deadlines, in the public frame's simulation ticks. */
	var DUNGEON_SKILLS_READER_QUERY = "dungeonSkills";
	var DUNGEON_SKILLS_READER = "cooldown-v1";
	/** Reads durable-backed local dungeon stock and the shared potion cooldown. */
	var DUNGEON_POTIONS_READER_QUERY = "dungeonPotions";
	var DUNGEON_POTIONS_READER = "stock-v1";
	/** Reads the position of the accepted skill target, not client aim/authority. */
	var DUNGEON_ACTION_READER_QUERY = "dungeonAction";
	var DUNGEON_ACTION_READER = "target-v1";
	//#endregion
	//#region ../../../CodexData/.codex/worktrees/721e/giftborne/apps/miniapp/src/clientContract.ts
	var gameClientUrl = (path, origin) => {
		const url = new URL(path, origin);
		url.searchParams.set(GAME_CLIENT_CONTRACT_QUERY, GAME_CLIENT_CONTRACT);
		url.searchParams.set(CINDER_CARAVAN_READER_QUERY, CINDER_CARAVAN_READER);
		if (url.pathname === "/v1/ws") {
			url.searchParams.set(DUNGEON_SKILLS_READER_QUERY, DUNGEON_SKILLS_READER);
			url.searchParams.set(DUNGEON_POTIONS_READER_QUERY, DUNGEON_POTIONS_READER);
			url.searchParams.set(DUNGEON_ACTION_READER_QUERY, DUNGEON_ACTION_READER);
		}
		if (url.pathname.startsWith("/v1/encounters/") || url.pathname === "/v1/profile/exploration-vitals" || url.pathname === "/v1/profile/gift-equipment" || url.pathname === "/v1/profile/commands" || url.pathname === "/v1/gifts/inventory" || url.pathname === "/v1/ws") url.searchParams.set(COLLECTIBLE_EQUIPMENT_READER_QUERY, COLLECTIBLE_EQUIPMENT_READER);
		if (url.pathname.startsWith("/v1/encounters/")) {
			url.searchParams.set(ANALOG_MOVEMENT_READER_QUERY, ANALOG_MOVEMENT_READER);
			url.searchParams.set(CHOIR_PLACEMENT_READER_QUERY, CHOIR_PLACEMENT_READER);
			url.searchParams.set(BRIDGE_PLACEMENT_READER_QUERY, BRIDGE_PLACEMENT_READER);
			url.searchParams.set(ADMISSION_MOVEMENT_READER_QUERY, ADMISSION_MOVEMENT_READER);
		}
		return url;
	};
	//#endregion
	//#region ../../../CodexData/.codex/worktrees/721e/giftborne/apps/miniapp/src/characterFetch.ts
	var CharacterFetchError = class extends Error {
		code;
		constructor(code) {
			super(code);
			this.code = code;
		}
	};
	var record = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
	var exact$1 = (value, keys) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
	var id = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
	var parseCharacterRoster = (value) => {
		if (!record(value) || !exact$1(value, [
			"revision",
			"selectedCharacterId",
			"maxCharacters",
			"characters"
		]) || !Number.isSafeInteger(value["revision"]) || value["revision"] < 0 || value["maxCharacters"] !== 5 || !Array.isArray(value["characters"]) || value["characters"].length > 5) throw new CharacterFetchError("response-invalid");
		const ids = /* @__PURE__ */ new Set(), slots = /* @__PURE__ */ new Set();
		const characters = value["characters"].map((entry) => {
			if (!record(entry) || !(exact$1(entry, ["characterId", "slot"]) || exact$1(entry, [
				"characterId",
				"slot",
				"identity"
			])) || !id(entry["characterId"]) || !Number.isInteger(entry["slot"]) || entry["slot"] < 1 || entry["slot"] > 5 || ids.has(entry["characterId"]) || slots.has(entry["slot"])) throw new CharacterFetchError("response-invalid");
			ids.add(entry["characterId"]);
			slots.add(entry["slot"]);
			let identity;
			if (Object.hasOwn(entry, "identity")) try {
				identity = parseCharacterIdentity(entry["identity"]);
			} catch {
				throw new CharacterFetchError("response-invalid");
			}
			return {
				characterId: entry["characterId"],
				slot: entry["slot"],
				...identity ? { identity } : {}
			};
		});
		if (value["selectedCharacterId"] !== null && (!id(value["selectedCharacterId"]) || !ids.has(value["selectedCharacterId"]))) throw new CharacterFetchError("response-invalid");
		return {
			revision: value["revision"],
			selectedCharacterId: value["selectedCharacterId"],
			maxCharacters: 5,
			characters
		};
	};
	//#endregion
	//#region ../../../CodexData/.codex/worktrees/721e/giftborne/packages/gift-engine/dist/collectibleEquipment.js
	var COLLECTIBLE_EQUIPMENT_RULES = "giftborne.collectible-equipment.v1";
	var COLLECTIBLE_MULTI_SLOT_RULES = "giftborne.collectible-equipment.v2";
	var COLLECTIBLE_WEAPON_RULES = "giftborne.collectible-equipment.v3";
	/**
	* Pure game mapping after source validation; never proves ownership or equips.
	* Head families use the existing level-one defensive helm budget (12 HP/4 armor).
	* Crystal Ball uses the existing Veilbound Focus budget (5 magic/10 bps cooldown).
	* Light Sword uses the existing Sunbreaker Blade budget (7 attack power).
	* Serial/market price/rarity cannot buy higher combat power. Traits determine
	* presentation; renderer support and physical appearance still need acceptance.
	* Unknown families remain visible inventory, but cannot be equipped yet.
	*/
	function projectCollectibleEquipment(gift) {
		const family = gift.collectionName === "Heroic Helmet" ? {
			slug: "HeroicHelmet",
			kind: "helm"
		} : gift.collectionName === "Top Hat" ? {
			slug: "TopHat",
			kind: "top-hat"
		} : gift.collectionName === "Crystal Ball" ? {
			slug: "CrystalBall",
			kind: "orb"
		} : gift.collectionName === "Light Sword" ? {
			slug: "LightSword",
			kind: "light-sword"
		} : null;
		if (!family || !Number.isSafeInteger(gift.number) || gift.number < 1 || gift.slug !== `${family.slug}-${gift.number}` || !/^\d{1,32}$/.test(gift.collectionId)) return null;
		const slot = family.kind === "orb" ? "off-hand" : family.kind === "light-sword" ? "main-hand" : "head";
		return {
			rulesVersion: family.kind === "light-sword" ? COLLECTIBLE_WEAPON_RULES : family.kind === "orb" ? COLLECTIBLE_MULTI_SLOT_RULES : COLLECTIBLE_EQUIPMENT_RULES,
			giftSlug: gift.slug,
			collectionId: gift.collectionId,
			number: gift.number,
			slot,
			stats: {
				maxHealth: slot === "head" ? 12 : 0,
				armor: slot === "head" ? 4 : 0,
				attackPower: slot === "main-hand" ? 7 : 0,
				spellPower: family.kind === "orb" ? 5 : 0,
				critChanceBps: 0,
				cooldownReductionBps: family.kind === "orb" ? 10 : 0
			},
			appearance: {
				kind: family.kind,
				model: gift.model.name,
				symbol: gift.symbol.name,
				backdrop: gift.backdrop.name,
				colors: { ...gift.backdrop.colors }
			}
		};
	}
	//#endregion
	//#region ../../../CodexData/.codex/worktrees/721e/giftborne/apps/miniapp/src/collectibleEquipmentFetch.ts
	var GiftEquipmentError = class extends Error {
		code;
		constructor(code) {
			super(code);
			this.code = code;
		}
	};
	var invalid = () => {
		throw new GiftEquipmentError("gift-response-invalid");
	};
	var exact = (value, keys) => typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
	var integer = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
	var canonical = (value) => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? "[" + value.map(canonical).join(",") + "]" : "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
	var freeze = (value) => {
		if (value && typeof value === "object") {
			for (const child of Object.values(value)) freeze(child);
			Object.freeze(value);
		}
		return value;
	};
	function parseClientCollectibleEquipment(value) {
		try {
			const hasOffHand = typeof value === "object" && value !== null && Object.hasOwn(value, "offHand");
			const hasMainHand = typeof value === "object" && value !== null && Object.hasOwn(value, "mainHand");
			if (!exact(value, [
				"profileRevision",
				"selection",
				"ownership",
				"projection",
				...hasOffHand ? ["offHand"] : [],
				...hasMainHand ? ["mainHand"] : []
			]) || !integer(value["profileRevision"])) return invalid();
			const parseSlot = (record, slot) => {
				const selection = record["selection"] === null ? null : parseTelegramCollectibleGift(record["selection"]);
				const ownership = record["ownership"];
				if (![
					"unselected",
					"unknown",
					"verified",
					"not-owned"
				].includes(ownership) || selection === null !== (ownership === "unselected")) return invalid();
				const mapped = selection === null ? null : projectCollectibleEquipment(selection);
				if (selection !== null && mapped?.slot !== slot) return invalid();
				const projection = ownership === "verified" ? mapped : null;
				if (canonical(record["projection"]) !== canonical(projection)) return invalid();
				return {
					selection,
					ownership,
					projection
				};
			};
			if (hasOffHand && !exact(value["offHand"], [
				"selection",
				"ownership",
				"projection"
			])) return invalid();
			if (hasMainHand && !exact(value["mainHand"], [
				"selection",
				"ownership",
				"projection"
			])) return invalid();
			return freeze({
				profileRevision: value["profileRevision"],
				...parseSlot(value, "head"),
				...hasMainHand ? { mainHand: parseSlot(value["mainHand"], "main-hand") } : {},
				...hasOffHand ? { offHand: parseSlot(value["offHand"], "off-hand") } : {}
			});
		} catch {
			return invalid();
		}
	}
	//#endregion
	exports.gameClientUrl = gameClientUrl;
	exports.parseCharacterRoster = parseCharacterRoster;
	exports.parseClientCollectibleEquipment = parseClientCollectibleEquipment;
	return exports;
})({});

if(typeof module!=="undefined")module.exports=GIFTBORNE_SERVER_CONTRACTS;
