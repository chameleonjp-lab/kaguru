// 年輪の実験室: 木材の性質を、工程順・加工しきい値・品質目標として表現するレシピ帳。
import { assets } from "./assets";

export type WoodKind = "walnut" | "oak" | "cherry" | "cedar" | "ebony";
export type RecipeTool = "sand" | "stain" | "join";

export interface WoodProfile {
  id: WoodKind;
  name: string;
  japaneseName: string;
  trait: string;
  recipeName: string;
  recipeHint: string;
  targetQuality: number;
  baseQuality: number;
  order: readonly RecipeTool[];
  targets: Record<RecipeTool, number>;
  texture: string;
  tint: readonly [number, number, number];
  swatchTint: string;
}

export const toolLabels: Record<RecipeTool, string> = {
  sand: "研磨",
  stain: "着色",
  join: "連続化",
};

export const woodCatalog: Record<WoodKind, WoodProfile> = {
  walnut: {
    id: "walnut", name: "WALNUT", japaneseName: "ウォールナット", trait: "深い縞と節", recipeName: "深層オイル・レシピ", recipeHint: "研磨で導管を整え、オイルの深みを揃えてから木目を結びます。", targetQuality: 90, baseQuality: 12,
    order: ["sand", "stain", "join"], targets: { sand: 66, stain: 66, join: 66 }, texture: assets.walnutTexture, tint: [0.95, 0.76, 0.55], swatchTint: "#5a2d15",
  },
  oak: {
    id: "oak", name: "WHITE OAK", japaneseName: "ホワイトオーク", trait: "淡い導管と光", recipeName: "導管を締めるレシピ", recipeHint: "細かく研磨して導管を締め、端部を結んでから薄く色調を合わせます。", targetQuality: 88, baseQuality: 14,
    order: ["sand", "join", "stain"], targets: { sand: 100, stain: 66, join: 66 }, texture: assets.oakTexture, tint: [1, 0.93, 0.74], swatchTint: "#d9b67a",
  },
  cherry: {
    id: "cherry", name: "CHERRY", japaneseName: "チェリー", trait: "飴色へ育つ赤味", recipeName: "飴色を寝かせるレシピ", recipeHint: "先に薄い着色で赤味を寝かせ、研磨で艶を整えてから木目を連続させます。", targetQuality: 92, baseQuality: 10,
    order: ["stain", "sand", "join"], targets: { sand: 66, stain: 100, join: 66 }, texture: assets.walnutTexture, tint: [0.94, 0.47, 0.27], swatchTint: "#9f4324",
  },
  cedar: {
    id: "cedar", name: "CEDAR", japaneseName: "杉", trait: "軽く香る直線木目", recipeName: "繊維を守るレシピ", recipeHint: "軽い研磨で繊維を残し、木目の連続性を先に確保して仕上げを薄く重ねます。", targetQuality: 84, baseQuality: 18,
    order: ["sand", "join", "stain"], targets: { sand: 66, stain: 34, join: 100 }, texture: assets.oakTexture, tint: [0.92, 0.54, 0.27], swatchTint: "#b96f35",
  },
  ebony: {
    id: "ebony", name: "EBONY", japaneseName: "黒檀", trait: "緻密で硬い黒艶", recipeName: "鏡面の黒艶レシピ", recipeHint: "三工程を妥協なく積み上げ、硬い繊維の継ぎ目を見えないところまで追い込みます。", targetQuality: 96, baseQuality: 8,
    order: ["sand", "stain", "join"], targets: { sand: 100, stain: 100, join: 100 }, texture: assets.walnutTexture, tint: [0.19, 0.16, 0.15], swatchTint: "#1c1716",
  },
};

export const woodProfiles = Object.values(woodCatalog);

