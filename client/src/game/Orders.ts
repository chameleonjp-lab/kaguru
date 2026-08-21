// 年輪の実験室: 白い家具に木目を与える、顧客ごとの依頼帳と納品スコア基準。
import type { WoodKind } from "./WoodCatalog";

export type FurnitureKind = "chair" | "table" | "shelf";
export type OrderId = "chair-cafe" | "table-dining" | "shelf-library";

export interface FurnitureOrder {
  id: OrderId;
  furniture: FurnitureKind;
  title: string;
  client: string;
  request: string;
  desiredWood: WoodKind;
  minimumQuality: number;
  baseScore: number;
  dimensions: string;
  joinery: string;
  grainDirection: string;
  finish: string;
  inspection: readonly string[];
}

export const orders: Record<OrderId, FurnitureOrder> = {
  "chair-cafe": {
    id: "chair-cafe", furniture: "chair", title: "窓辺のカフェチェア", client: "朝霧カフェ", request: "朝の斜光で繊維が荒れず、背と座の木目が静かにつながる軽い杉の椅子。白い試作体の見付け面だけにテクスチャを入れてください。", desiredWood: "cedar", minimumQuality: 84, baseScore: 720,
    dimensions: "W420 × D470 × H780 mm", joinery: "背板・座枠・前脚の見付け面", grainDirection: "背板は縦目、座枠は前後方向", finish: "薄い蜜蝋仕上げ・低光沢", inspection: ["杉材の直線木目", "座と背の連続感", "角部に濃い染みなし"],
  },
  "table-dining": {
    id: "table-dining", furniture: "table", title: "六人用ダイニングテーブル", client: "白磁邸", request: "食卓の中央から両端へ流れる、深いウォールナットの一枚板の印象。白い試作天板の上面と短辺の木口を、途切れない木目として納品してください。", desiredWood: "walnut", minimumQuality: 90, baseScore: 900,
    dimensions: "W1800 × D850 × H720 mm", joinery: "天板上面・短辺木口・幕板上端", grainDirection: "長手方向へ一本の連続流れ", finish: "桐油 2 回塗り・半艶", inspection: ["ウォールナットの深い縞", "短辺までのシームレス接続", "節の明暗が中央で切れない"],
  },
  "shelf-library": {
    id: "shelf-library", furniture: "shelf", title: "読書室の壁面棚", client: "薄明文庫", request: "読書室の北窓の光をやわらかく返すホワイトオーク。白い棚板の正面木口を横切る木目が、各段で止まらず続くように仕上げてください。", desiredWood: "oak", minimumQuality: 88, baseScore: 820,
    dimensions: "W1200 × D280 × H1800 mm", joinery: "棚板前木口・側板内側・背板見付け", grainDirection: "棚板ごとに左右へ水平に連続", finish: "水性クリア・艶消し", inspection: ["ホワイトオークの導管", "三段の木目方向の統一", "棚板端部の継ぎ目なし"],
  },
};

export const orderList = Object.values(orders);
