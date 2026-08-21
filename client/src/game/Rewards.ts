// 年輪の実験室: レシピを完成した職人に、次の木材加工で使える油と道具を返す報酬棚。
import type { RecipeTool, WoodKind } from "./WoodCatalog";

export type RewardId = "tung-oil" | "ray-plane" | "amber-oil" | "seam-gauge" | "obsidian-strop";

export interface Reward {
  id: RewardId;
  name: string;
  japaneseName: string;
  type: "仕上げ油" | "道具";
  unlockWood: WoodKind;
  description: string;
  effect: string;
  bonus: Partial<Record<RecipeTool, number>>;
}

export const rewards: Record<RewardId, Reward> = {
  "tung-oil": { id: "tung-oil", name: "TUNG OIL", japaneseName: "桐油", type: "仕上げ油", unlockWood: "walnut", description: "深い縞を均質に見せる浸透油。", effect: "着色 +17%", bonus: { stain: 17 } },
  "ray-plane": { id: "ray-plane", name: "RAY PLANE", japaneseName: "導管鉋", type: "道具", unlockWood: "oak", description: "硬い導管を乱さずに薄く削る小鉋。", effect: "研磨 +17%", bonus: { sand: 17 } },
  "amber-oil": { id: "amber-oil", name: "AMBER OIL", japaneseName: "琥珀油", type: "仕上げ油", unlockWood: "cherry", description: "赤味を穏やかに寝かせる薄い仕上げ油。", effect: "着色 +17%", bonus: { stain: 17 } },
  "seam-gauge": { id: "seam-gauge", name: "SEAM GAUGE", japaneseName: "木口定規", type: "道具", unlockWood: "cedar", description: "軽い繊維の端部をまっすぐ検査する定規。", effect: "連続化 +17%", bonus: { join: 17 } },
  "obsidian-strop": { id: "obsidian-strop", name: "OBSIDIAN STROP", japaneseName: "黒曜革砥", type: "道具", unlockWood: "ebony", description: "緻密な黒檀を鏡面へ追い込む革砥。", effect: "研磨・連続化 +17%", bonus: { sand: 17, join: 17 } },
};

export const rewardList = Object.values(rewards);

export const rewardForWood: Record<WoodKind, RewardId> = {
  walnut: "tung-oil",
  oak: "ray-plane",
  cherry: "amber-oil",
  cedar: "seam-gauge",
  ebony: "obsidian-strop",
};

