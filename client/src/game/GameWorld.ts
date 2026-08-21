// 年輪の実験室: 中央の板材を主役に、材種固有のレシピで加工結果を可視化するゲーム世界。
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { assets } from "./assets";
import { toolLabels, woodCatalog, type RecipeTool, type WoodKind } from "./WoodCatalog";
import { rewardForWood, rewardList, rewards, type RewardId } from "./Rewards";
import { orderList, orders, type FurnitureKind, type OrderId } from "./Orders";

export type { WoodKind } from "./WoodCatalog";
export type WorkPhase = "request" | "create" | "preview" | "delivery";
export type ToolAction = RecipeTool | "material" | "reward" | "undo" | "redo" | "select-order" | "accept-order" | "open-preview" | "back-to-work" | "deliver" | "next-request" | "reset" | "request-state";

export interface GrainLabAction {
  type: ToolAction;
  wood?: WoodKind;
  rewardId?: RewardId;
  orderId?: OrderId;
}

export interface GameSnapshot {
  wood: WoodKind;
  sanding: number;
  staining: number;
  joining: number;
  quality: number;
  status: string;
  collection: number;
  demo: boolean;
  targetQuality: number;
  recipeName: string;
  nextTool: RecipeTool | null;
  unlockedRewards: RewardId[];
  activeRewardId: RewardId | null;
  latestRewardId: RewardId | null;
  phase: WorkPhase;
  activeOrderId: OrderId;
  totalScore: number;
  lastDeliveryScore: number;
  scoreBreakdown: { material: number; grain: number; finish: number; affinity: number };
  bestScore: number;
  isNewBest: boolean;
  customerReaction: string;
  timeline: string[];
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  historyNotice: { id: number; type: "undo" | "redo"; message: string } | null;
  deliveryReadyNotice: { id: number; message: string; breakdown: { material: number; grain: number; finish: number; affinity: number }; total: number } | null;
}

interface ProcessCheckpoint {
  sanding: number;
  staining: number;
  joining: number;
  quality: number;
  nextTool: RecipeTool | null;
  tool: RecipeTool | null;
}

const amber = new Color3(0.77, 0.38, 0.18);
const graphite = new Color3(0.1, 0.11, 0.11);

export class GameWorld {
  private readonly board: Mesh;
  private readonly boardMaterial: StandardMaterial;
  private readonly textures: Record<WoodKind, Texture>;
  private readonly seamMaterial: StandardMaterial;
  private readonly seamStrip: Mesh;
  private readonly gridMaterial: StandardMaterial;
  private readonly toolLamps: Record<RecipeTool, StandardMaterial>;
  private readonly furnitureModels: Record<FurnitureKind, Mesh[]>;
  private readonly inspectionMarkers: Record<FurnitureKind, Mesh[]>;
  private furnitureMaterial!: StandardMaterial;
  private state: GameSnapshot;
  private unlockedRewards: RewardId[];
  private activeRewardId: RewardId | null;
  private totalScore: number;
  private bestScores: Record<string, number>;
  private undoStack: ProcessCheckpoint[] = [];
  private redoStack: ProcessCheckpoint[] = [];
  private historyNoticeId = 0;
  private deliveryReadyId = 0;
  private pulse = 0;

  constructor(private readonly scene: Scene) {
    const query = new URLSearchParams(window.location.search);
    const demo = query.has("demo");
    const create = query.has("create");
    const warning = query.has("warning");
    const preview = query.has("preview") || warning;
    const sampleComplete = demo || preview;
    this.totalScore = this.loadScore();
    this.bestScores = this.loadBestScores();
    this.unlockedRewards = rewardList.map((reward) => reward.id);
    this.activeRewardId = this.unlockedRewards[0] ?? null;
    this.state = this.createState(sampleComplete ? "walnut" : "cedar", sampleComplete, sampleComplete ? 1 : 0, sampleComplete ? "table-dining" : "chair-cafe", demo ? "delivery" : preview ? "preview" : create ? "create" : "request");
    if (warning) this.state = { ...this.state, sanding: 34, staining: 0, joining: 34, quality: 0, nextTool: "sand" };
    this.createStudio();

    const woodMaterial = new StandardMaterial("board-material", scene);
    woodMaterial.diffuseColor = new Color3(0.9, 0.76, 0.58);
    woodMaterial.specularColor = new Color3(0.16, 0.12, 0.08);
    woodMaterial.specularPower = 38;
    const walnutTexture = this.createWoodTexture(assets.walnutTexture, "walnut-grain");
    const oakTexture = this.createWoodTexture(assets.oakTexture, "oak-grain");
    this.textures = { walnut: walnutTexture, oak: oakTexture, cherry: walnutTexture, cedar: oakTexture, ebony: walnutTexture };
    woodMaterial.diffuseTexture = walnutTexture;
    this.boardMaterial = woodMaterial;
    this.board = MeshBuilder.CreateBox("specimen-board", { width: 8.2, height: 0.3, depth: 4.1 }, scene);
    this.board.position = new Vector3(0, 0.72, 0.05);
    this.board.material = woodMaterial;

    this.seamMaterial = new StandardMaterial("seam-material", scene);
    this.seamMaterial.diffuseColor = new Color3(0.14, 0.055, 0.025);
    this.seamMaterial.emissiveColor = new Color3(0.11, 0.025, 0.01);
    this.seamMaterial.alpha = 0.82;
    this.seamStrip = MeshBuilder.CreateBox("seam-preview", { width: 0.1, height: 0.025, depth: 4.08 }, scene);
    this.seamStrip.position = new Vector3(0, 0.89, 0.05);
    this.seamStrip.material = this.seamMaterial;

    this.gridMaterial = new StandardMaterial("grid-material", scene);
    this.gridMaterial.diffuseColor = amber;
    this.gridMaterial.emissiveColor = amber.scale(0.34);
    this.gridMaterial.alpha = 0.17;
    this.createGrainGrid();
    this.toolLamps = this.createToolRack();
    this.furnitureModels = this.createFurnitureModels();
    this.inspectionMarkers = this.createInspectionMarkers();
    window.addEventListener("grain-lab-action", this.onAction as EventListener);
    this.recalculate(demo ? "デモ：納品済みのテーブルと獲得報酬を表示しています。" : warning ? "デモ：品質不足の警告マーカーと改善アドバイスを表示しています。" : preview ? "デモ：完成家具の最終確認を表示しています。" : "新しい依頼が届きました。真っ白な家具と要望を確認してください。");
    if (preview) this.setCameraMode("preview");
  }

  update(delta: number) {
    this.pulse += delta;
    const completed = this.isComplete();
    const livingGlow = completed ? 0.5 + Math.sin(this.pulse * 2.2) * 0.18 : 0.14 + Math.sin(this.pulse * 1.25) * 0.04;
    this.gridMaterial.alpha = Math.max(0.07, livingGlow - this.state.joining * 0.003);
    this.board.position.y = 0.72 + (completed ? Math.sin(this.pulse * 2) * 0.018 : 0);
    const visibleFurniture = this.state.phase === "request" ? this.furnitureModels[orders[this.state.activeOrderId].furniture] : [];
    visibleFurniture.forEach((mesh, index) => { mesh.rotation.y = Math.sin(this.pulse * 0.7) * 0.035 * (index === 0 ? 1 : 0); });
  }

  dispose() {
    window.removeEventListener("grain-lab-action", this.onAction as EventListener);
    Array.from(new Set(Object.values(this.textures))).forEach((texture) => texture.dispose());
  }

  private onAction = (event: Event) => {
    const detail = (event as CustomEvent<GrainLabAction>).detail;
    if (!detail) return;
    if (detail.type === "request-state") {
      this.emitState();
      return;
    }
    this.applyAction(detail);
  };

  private applyAction(action: GrainLabAction) {
    if (["sand", "stain", "join", "material", "reset"].includes(action.type) && this.state.phase !== "create") {
      this.state = { ...this.state, status: "まず依頼を受諾し、指定の白い家具に合わせてテクスチャを作成してください。" };
      this.emitState();
      return;
    }
    switch (action.type) {
      case "sand":
      case "stain":
      case "join": {
        const expected = this.getNextTool();
        if (expected !== action.type) {
          const nextLabel = expected ? toolLabels[expected] : "検品";
          this.state = { ...this.state, status: `この材の次工程は「${nextLabel}」です。レシピ順に加工してください。` };
          this.emitState();
          return;
        }
        const field = action.type === "sand" ? "sanding" : action.type === "stain" ? "staining" : "joining";
        this.undoStack.push(this.captureCheckpoint(action.type));
        if (this.undoStack.length > 8) this.undoStack.shift();
        this.redoStack = [];
        const bonus = this.getActiveReward()?.bonus[action.type] ?? 0;
        this.state = { ...this.state, [field]: Math.min(100, this.state[field] + 34 + bonus), timeline: [...this.state.timeline, `${String(this.state.timeline.length + 1).padStart(2, "0")} ${toolLabels[action.type]}`].slice(-6) };
        this.recalculate(this.getToolMessage(action.type));
        return;
      }
      case "undo":
        this.undoProcess();
        return;
      case "redo":
        this.redoProcess();
        return;
      case "material":
        if (!action.wood) return;
        this.state = this.createState(action.wood, false, this.state.collection, this.state.activeOrderId, "create");
        this.recalculate(`${woodCatalog[action.wood].japaneseName}を作業台に載せました。専用レシピを確認してください。`);
        return;
      case "reward":
        if (!action.rewardId || !this.unlockedRewards.includes(action.rewardId)) {
          this.state = { ...this.state, status: "この報酬は、対応する木材レシピを合格すると解放されます。" };
          this.emitState();
          return;
        }
        this.activeRewardId = action.rewardId;
        this.state = { ...this.state, activeRewardId: action.rewardId, latestRewardId: null, status: `${rewards[action.rewardId].japaneseName}を装備しました。${rewards[action.rewardId].effect} の補助が有効です。` };
        this.emitState();
        return;
      case "select-order":
        if (!action.orderId) return;
        this.state = this.createState(orders[action.orderId].desiredWood, false, this.state.collection, action.orderId, "request");
        this.recalculate(`${orders[action.orderId].client}からの依頼内容を確認しています。`);
        return;
      case "accept-order": {
        const order = orders[this.state.activeOrderId];
        this.state = this.createState(order.desiredWood, false, this.state.collection, order.id, "create");
        this.recalculate(`依頼を受諾しました。${woodCatalog[order.desiredWood].japaneseName}で、必要品質 ${order.minimumQuality} を目指してください。`);
        return;
      }
      case "open-preview":
        this.openPreview();
        return;
      case "back-to-work":
        this.state = { ...this.state, phase: "create", status: "作業台へ戻りました。加工内容を調整してから、もう一度最終確認できます。" };
        this.setCameraMode("studio");
        this.updateMaterials();
        this.syncPresentation();
        this.emitState();
        return;
      case "deliver":
        this.deliverOrder();
        return;
      case "next-request": {
        const activeIndex = orderList.findIndex((order) => order.id === this.state.activeOrderId);
        const nextOrder = orderList[(activeIndex + 1) % orderList.length];
        this.state = this.createState(nextOrder.desiredWood, false, this.state.collection, nextOrder.id, "request");
        this.recalculate(`次の依頼「${nextOrder.title}」が届きました。`);
        return;
      }
      case "reset":
        this.state = this.createState(this.state.wood, false, this.state.collection, this.state.activeOrderId, "create");
        this.recalculate("新しいテストピースに交換しました。レシピの最初の工程から始めてください。");
        return;
    }
  }

  private recalculate(status: string) {
    const profile = woodCatalog[this.state.wood];
    const wasComplete = this.isComplete();
    const progress = (["sand", "stain", "join"] as const).reduce((total, tool) => total + Math.min(1, this.getProgress(tool) / profile.targets[tool]), 0) / 3;
    const quality = Math.round(profile.baseQuality + (profile.targetQuality - profile.baseQuality) * progress);
    this.state = { ...this.state, quality, status, targetQuality: profile.targetQuality, recipeName: profile.recipeName, nextTool: this.getNextTool(), canUndo: this.undoStack.length > 0 && this.state.phase === "create", canRedo: this.redoStack.length > 0 && this.state.phase === "create", undoCount: this.undoStack.length, redoCount: this.redoStack.length };
    if (this.isComplete() && !wasComplete) {
      const rewardId = rewardForWood[this.state.wood];
      const isNewReward = !this.unlockedRewards.includes(rewardId);
      const order = orders[this.state.activeOrderId];
      const activeReward = this.getActiveReward();
      const material = this.state.wood === order.desiredWood ? 30 : 0;
      const grain = Math.round(50 * Math.min(1, (this.state.sanding / profile.targets.sand + this.state.joining / profile.targets.join) / 2));
      const finish = Math.round(20 * Math.min(1, this.state.staining / profile.targets.stain));
      const affinity = activeReward?.unlockWood === this.state.wood ? 8 : 0;
      const breakdown = { material, grain, finish, affinity };
      const total = material + grain + finish + affinity;
      if (isNewReward) {
        this.unlockedRewards = [...this.unlockedRewards, rewardId];
        this.activeRewardId = rewardId;
        this.saveRewards();
      }
      this.state = {
        ...this.state,
        collection: this.state.collection + 1,
        unlockedRewards: this.unlockedRewards,
        activeRewardId: this.activeRewardId,
        latestRewardId: isNewReward ? rewardId : null,
        status: isNewReward
          ? `SEAMLESS 合格。報酬「${rewards[rewardId].japaneseName}」を解放し、装備しました。${rewards[rewardId].effect} が次の加工で有効です。`
          : "SEAMLESS 合格。専用レシピの木目データをサンプル棚へ保存しました。",
        canUndo: false,
        canRedo: false,
        undoCount: 0,
        redoCount: 0,
        scoreBreakdown: breakdown,
        deliveryReadyNotice: { id: ++this.deliveryReadyId, message: `全工程を達成しました。品質 ${profile.targetQuality} の基準を満たし、納品可能です。`, breakdown, total },
      };
      this.clearHistory();
    }
    this.updateMaterials();
    this.syncPresentation();
    this.emitState();
  }

  private isComplete() {
    const profile = woodCatalog[this.state.wood];
    return this.state.quality >= profile.targetQuality && (["sand", "stain", "join"] as const).every((tool) => this.getProgress(tool) >= profile.targets[tool]);
  }

  private createState(wood: WoodKind, demo: boolean, collection: number, activeOrderId: OrderId, phase: WorkPhase): GameSnapshot {
    this.clearHistory();
    const profile = woodCatalog[wood];
    return {
      wood,
      sanding: demo ? 100 : 0,
      staining: demo ? 100 : 0,
      joining: demo ? 100 : 0,
      quality: demo ? profile.targetQuality : profile.baseQuality,
      status: "",
      collection,
      demo,
      targetQuality: profile.targetQuality,
      recipeName: profile.recipeName,
      nextTool: demo ? null : profile.order[0],
      unlockedRewards: this.unlockedRewards,
      activeRewardId: this.activeRewardId,
      latestRewardId: null,
      phase,
      activeOrderId,
      totalScore: demo ? this.totalScore + orders[activeOrderId].baseScore : this.totalScore,
      lastDeliveryScore: demo ? orders[activeOrderId].baseScore : 0,
      scoreBreakdown: demo ? { material: Math.round(orders[activeOrderId].baseScore * 0.3), grain: Math.round(orders[activeOrderId].baseScore * 0.5), finish: Math.round(orders[activeOrderId].baseScore * 0.2), affinity: 0 } : { material: 0, grain: 0, finish: 0, affinity: 0 },
      bestScore: demo ? orders[activeOrderId].baseScore : 0,
      isNewBest: false,
      customerReaction: demo ? "見事です。天板の流れが部屋の光を受け止めています。" : "仕様を確認して、最高の一作をつくってください。",
      timeline: [],
      canUndo: false,
      canRedo: false,
      undoCount: 0,
      redoCount: 0,
      historyNotice: null,
      deliveryReadyNotice: null,
    };
  }

  private getProgress(tool: RecipeTool) {
    return tool === "sand" ? this.state.sanding : tool === "stain" ? this.state.staining : this.state.joining;
  }

  private getNextTool(): RecipeTool | null {
    const profile = woodCatalog[this.state.wood];
    return profile.order.find((tool) => this.getProgress(tool) < profile.targets[tool]) ?? null;
  }

  private getToolMessage(tool: RecipeTool) {
    const profile = woodCatalog[this.state.wood];
    const descriptions: Record<RecipeTool, string> = {
      sand: "繊維を整え、表面の精度を高めています。",
      stain: "色調を馴染ませ、素材の表情を引き出しています。",
      join: "端部の木目を追い込み、連続性を検査しています。",
    };
    const next = this.getNextTool();
    const active = this.getActiveReward();
    const equipped = active?.bonus[tool] ? ` ${active.japaneseName}の補助 +${active.bonus[tool]}%。` : "";
    return next ? `${profile.japaneseName}：${descriptions[tool]}${equipped} 次は「${toolLabels[next]}」です。` : `${profile.japaneseName}：全工程が揃いました。最終検品を行います。`;
  }

  private captureCheckpoint(tool: RecipeTool | null): ProcessCheckpoint {
    return { sanding: this.state.sanding, staining: this.state.staining, joining: this.state.joining, quality: this.state.quality, nextTool: this.state.nextTool, tool };
  }

  private restoreCheckpoint(checkpoint: ProcessCheckpoint, status: string, historyNotice: GameSnapshot["historyNotice"]) {
    this.state = { ...this.state, sanding: checkpoint.sanding, staining: checkpoint.staining, joining: checkpoint.joining, quality: checkpoint.quality, nextTool: checkpoint.nextTool, historyNotice };
    this.recalculate(status);
  }

  private undoProcess() {
    if (this.state.phase !== "create" || this.undoStack.length === 0) {
      this.state = { ...this.state, status: "取り消せる加工操作はありません。", canUndo: false, canRedo: this.redoStack.length > 0, undoCount: 0, redoCount: this.redoStack.length };
      this.emitState();
      return;
    }
    const checkpoint = this.undoStack.pop()!;
    this.redoStack.push(this.captureCheckpoint(checkpoint.tool));
    const label = checkpoint.tool ? toolLabels[checkpoint.tool] : "直前の加工";
    const message = `「${label}」の加工を戻しました。さらに ${this.undoStack.length} 手戻せます。`;
    this.restoreCheckpoint(checkpoint, message, { id: ++this.historyNoticeId, type: "undo", message });
  }

  private redoProcess() {
    if (this.state.phase !== "create" || this.redoStack.length === 0) {
      this.state = { ...this.state, status: "やり直せる加工操作はありません。", canUndo: this.undoStack.length > 0, canRedo: false, undoCount: this.undoStack.length, redoCount: 0 };
      this.emitState();
      return;
    }
    const checkpoint = this.redoStack.pop()!;
    this.undoStack.push(this.captureCheckpoint(checkpoint.tool));
    const label = checkpoint.tool ? toolLabels[checkpoint.tool] : "直前の加工";
    const message = `「${label}」の加工をやり直しました。`;
    this.restoreCheckpoint(checkpoint, message, { id: ++this.historyNoticeId, type: "redo", message });
  }

  private clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
  }

  private openPreview() {
    const order = orders[this.state.activeOrderId];
    if (this.state.phase !== "create" || this.state.wood !== order.desiredWood) {
      this.state = { ...this.state, status: `最終確認には、依頼指定の ${woodCatalog[order.desiredWood].japaneseName} を選択してください。` };
      this.emitState();
      return;
    }
    const hasWarnings = this.state.quality < order.minimumQuality || !this.isComplete();
    this.state = { ...this.state, phase: "preview", status: hasWarnings ? "最終確認：未達の品質項目を赤いマーカーで確認し、作業台へ戻って改善してください。" : "最終確認：完成テクスチャを3D家具へ適用しました。ドラッグで回転、ホイールで拡大縮小してください。" };
    this.setCameraMode("preview");
    this.updateMaterials();
    this.syncPresentation();
    this.emitState();
  }

  private deliverOrder() {
    const order = orders[this.state.activeOrderId];
    if (this.state.phase !== "preview") {
      this.state = { ...this.state, status: "最終確認で完成家具を確認してから、納品を確定してください。" };
      this.emitState();
      return;
    }
    if (this.state.wood !== order.desiredWood) {
      this.state = { ...this.state, status: `この依頼は ${woodCatalog[order.desiredWood].japaneseName} の仕上げを希望しています。素材を確認してください。` };
      this.emitState();
      return;
    }
    if (this.state.quality < order.minimumQuality || !this.isComplete()) {
      this.state = { ...this.state, status: `納品基準は品質 ${order.minimumQuality} です。木目の連続性をもう一度検査してください。` };
      this.emitState();
      return;
    }
    const materialScore = Math.round(order.baseScore * 0.3);
    const grainScore = Math.round(order.baseScore * 0.5 * Math.min(1.08, this.state.quality / order.minimumQuality));
    const finishScore = Math.round(order.baseScore * (this.getActiveReward() ? 0.2 : 0.12));
    const affinityScore = this.getActiveReward()?.unlockWood === this.state.wood ? Math.round(order.baseScore * 0.08) : 0;
    const score = materialScore + grainScore + finishScore + affinityScore;
    this.totalScore += score;
    this.saveScore();
    const previousBest = this.getBestScore(order.id);
    const bestScore = Math.max(previousBest, score);
    const isNewBest = score > previousBest;
    if (isNewBest) this.saveBestScore(order.id, bestScore);
    this.clearHistory();
    this.setCameraMode("studio");
    this.state = { ...this.state, phase: "delivery", totalScore: this.totalScore, lastDeliveryScore: score, scoreBreakdown: { material: materialScore, grain: grainScore, finish: finishScore, affinity: affinityScore }, bestScore, isNewBest, customerReaction: this.getCustomerReaction(score, order.baseScore, isNewBest), status: `納品完了。${order.client}に「${order.title}」をお渡ししました。`, canUndo: false, canRedo: false, undoCount: 0, redoCount: 0 };
    this.syncPresentation();
    this.emitState();
  }

  private getActiveReward() {
    return this.activeRewardId ? rewards[this.activeRewardId] : null;
  }

  private setCameraMode(mode: "studio" | "preview") {
    const camera = this.scene.activeCamera;
    if (!(camera instanceof ArcRotateCamera)) return;
    if (mode === "preview") {
      camera.target = new Vector3(0, 1.65, 0);
      camera.lowerBetaLimit = 0.35;
      camera.upperBetaLimit = 1.55;
      camera.lowerRadiusLimit = 4.2;
      camera.upperRadiusLimit = 12.5;
      camera.radius = Math.min(camera.radius, 9.2);
      camera.wheelDeltaPercentage = 0.045;
      return;
    }
    camera.target = new Vector3(0, 0.25, 0.05);
    camera.lowerBetaLimit = 0.78;
    camera.upperBetaLimit = 1.3;
    camera.lowerRadiusLimit = 12.8;
    camera.upperRadiusLimit = 16.9;
    camera.radius = 14.7;
    camera.wheelDeltaPercentage = 0.015;
  }

  private loadRewards(): RewardId[] {
    try {
      const saved = window.localStorage.getItem("grain-lab-unlocked-rewards");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((id): id is RewardId => typeof id === "string" && id in rewards) : [];
    } catch {
      return [];
    }
  }

  private saveRewards() {
    window.localStorage.setItem("grain-lab-unlocked-rewards", JSON.stringify(this.unlockedRewards));
  }

  private loadScore() {
    try {
      return Number(window.localStorage.getItem("grain-lab-total-score")) || 0;
    } catch {
      return 0;
    }
  }

  private saveScore() {
    window.localStorage.setItem("grain-lab-total-score", String(this.totalScore));
  }

  private loadBestScores() {
    try {
      const saved = window.localStorage.getItem("grain-lab-best-scores");
      const parsed = saved ? JSON.parse(saved) : {};
      return parsed && typeof parsed === "object" ? parsed as Record<string, number> : {};
    } catch {
      return {};
    }
  }

  private getBestScore(orderId: OrderId) {
    return this.bestScores[orderId] ?? 0;
  }

  private saveBestScore(orderId: OrderId, score: number) {
    this.bestScores[orderId] = score;
    window.localStorage.setItem("grain-lab-best-scores", JSON.stringify(this.bestScores));
  }

  private getCustomerReaction(score: number, baseScore: number, isNewBest: boolean) {
    if (isNewBest) return "最高記録です。依頼仕様を超える精度で、家具に静かな存在感が生まれました。";
    if (score >= baseScore) return "要望どおりです。木目の流れと仕上げが、家具の輪郭を引き立てています。";
    return "仕上がりは堅実です。次は木目の連続性をさらに追い込んでみましょう。";
  }

  private emitState() {
    window.dispatchEvent(new CustomEvent<GameSnapshot>("grain-lab-state", { detail: { ...this.state } }));
  }

  private createWoodTexture(url: string, name: string) {
    const texture = new Texture(url, this.scene, true, false);
    texture.name = name;
    texture.uScale = 1.35;
    texture.vScale = 1.05;
    return texture;
  }

  private updateMaterials() {
    const profile = woodCatalog[this.state.wood];
    this.boardMaterial.diffuseTexture = this.textures[this.state.wood];
    const finish = 0.52 + this.state.staining * 0.004;
    this.boardMaterial.diffuseColor = new Color3(...profile.tint);
    this.boardMaterial.specularPower = 18 + this.state.sanding * 0.62;
    this.boardMaterial.specularColor = new Color3(finish * 0.26, finish * 0.17, finish * 0.09);
    const isFinishedPreview = this.state.phase === "preview" || this.state.phase === "delivery";
    this.furnitureMaterial.diffuseTexture = isFinishedPreview ? this.textures[this.state.wood] : null;
    this.furnitureMaterial.diffuseColor = isFinishedPreview ? new Color3(...profile.tint) : new Color3(1, 0.99, 0.96);
    this.furnitureMaterial.emissiveColor = isFinishedPreview ? new Color3(0.04, 0.025, 0.012) : new Color3(0.18, 0.18, 0.16);
    this.furnitureMaterial.specularPower = isFinishedPreview ? 22 + this.state.sanding * 0.5 : 40;
    this.seamMaterial.alpha = Math.max(0.03, 0.84 - this.state.joining * 0.008);
    this.seamMaterial.emissiveColor = this.isComplete() ? new Color3(0.13, 0.34, 0.18) : new Color3(0.11, 0.025, 0.01);
    this.toolLamps.sand.emissiveColor = this.state.sanding > 0 ? amber.scale(0.75) : graphite;
    this.toolLamps.stain.emissiveColor = this.state.staining > 0 ? amber.scale(0.75) : graphite;
    this.toolLamps.join.emissiveColor = this.state.joining > 0 ? amber.scale(0.75) : graphite;
  }

  private syncPresentation() {
    const isRequest = this.state.phase === "request";
    const isFinishedPreview = this.state.phase === "preview" || this.state.phase === "delivery";
    this.board.isVisible = this.state.phase === "create";
    this.seamStrip.isVisible = this.state.phase === "create";
    this.gridMaterial.alpha = isRequest || isFinishedPreview ? 0 : this.gridMaterial.alpha;
    const activeFurniture = orders[this.state.activeOrderId].furniture;
    (Object.keys(this.furnitureModels) as FurnitureKind[]).forEach((kind) => {
      this.furnitureModels[kind].forEach((mesh) => { mesh.isVisible = (isRequest || isFinishedPreview) && kind === activeFurniture; });
      this.inspectionMarkers[kind].forEach((marker) => { marker.isVisible = this.state.phase === "preview" && kind === activeFurniture; });
    });
  }

  private createFurnitureModels(): Record<FurnitureKind, Mesh[]> {
    const material = new StandardMaterial("white-furniture-material", this.scene);
    this.furnitureMaterial = material;
    material.diffuseColor = new Color3(1, 0.99, 0.96);
    material.emissiveColor = new Color3(0.18, 0.18, 0.16);
    material.specularColor = new Color3(0.26, 0.26, 0.24);
    material.specularPower = 40;
    const makeBox = (name: string, width: number, height: number, depth: number, x: number, y: number, z: number) => {
      const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, this.scene);
      mesh.position = new Vector3(x, y, z);
      mesh.material = material;
      return mesh;
    };
    const chair = [
      makeBox("chair-seat", 2.4, 0.22, 2.1, 0, 1.45, 0), makeBox("chair-back", 2.4, 1.9, 0.18, 0, 2.4, 0.88),
      makeBox("chair-leg-fl", 0.18, 1.05, 0.18, -0.95, 0.9, -0.78), makeBox("chair-leg-fr", 0.18, 1.05, 0.18, 0.95, 0.9, -0.78),
      makeBox("chair-leg-bl", 0.18, 1.05, 0.18, -0.95, 0.9, 0.78), makeBox("chair-leg-br", 0.18, 1.05, 0.18, 0.95, 0.9, 0.78),
    ];
    const table = [
      makeBox("table-top", 5.6, 0.25, 3.1, 0, 1.8, 0), makeBox("table-apron-front", 5.3, 0.32, 0.18, 0, 1.48, -1.28), makeBox("table-apron-back", 5.3, 0.32, 0.18, 0, 1.48, 1.28),
      makeBox("table-leg-fl", 0.22, 1.45, 0.22, -2.35, 0.9, -1.15), makeBox("table-leg-fr", 0.22, 1.45, 0.22, 2.35, 0.9, -1.15), makeBox("table-leg-bl", 0.22, 1.45, 0.22, -2.35, 0.9, 1.15), makeBox("table-leg-br", 0.22, 1.45, 0.22, 2.35, 0.9, 1.15),
    ];
    const shelf = [
      makeBox("shelf-side-left", 0.22, 3.4, 0.9, -2.5, 2.1, 0), makeBox("shelf-side-right", 0.22, 3.4, 0.9, 2.5, 2.1, 0),
      makeBox("shelf-top", 5.2, 0.18, 0.9, 0, 3.72, 0), makeBox("shelf-bottom", 5.2, 0.18, 0.9, 0, 0.5, 0), makeBox("shelf-board-one", 4.8, 0.16, 0.82, 0, 1.55, 0), makeBox("shelf-board-two", 4.8, 0.16, 0.82, 0, 2.62, 0),
    ];
    return { chair, table, shelf };
  }

  private createInspectionMarkers(): Record<FurnitureKind, Mesh[]> {
    const colors = [new Color3(0.30, 0.82, 0.52), new Color3(0.98, 0.62, 0.18), new Color3(0.22, 0.72, 0.78)];
    const makeMarker = (name: string, position: Vector3, color: Color3) => {
      const sphere = MeshBuilder.CreateSphere(`${name}-point`, { diameter: 0.2, segments: 16 }, this.scene);
      sphere.position = position;
      const material = new StandardMaterial(`${name}-material`, this.scene);
      material.diffuseColor = color;
      material.emissiveColor = color.scale(0.85);
      sphere.material = material;
      sphere.isVisible = false;
      return sphere;
    };
    const markerSet = (kind: FurnitureKind, points: Vector3[]) => points.map((point, index) => makeMarker(`${kind}-inspection-${index}`, point, colors[index]));
    return {
      chair: markerSet("chair", [new Vector3(-0.72, 1.67, -0.72), new Vector3(0.78, 1.67, 0.46), new Vector3(0, 3.08, 0.82)]),
      table: markerSet("table", [new Vector3(-1.95, 2.03, -0.75), new Vector3(1.65, 2.03, 0.32), new Vector3(0.2, 2.03, 1.18)]),
      shelf: markerSet("shelf", [new Vector3(-1.78, 2.7, -0.58), new Vector3(1.55, 1.62, -0.58), new Vector3(0.1, 3.68, -0.58)]),
    };
  }

  private createStudio() {
    const floor = MeshBuilder.CreateGround("workshop-floor", { width: 45, height: 34 }, this.scene);
    const floorMaterial = new StandardMaterial("floor-material", this.scene);
    floorMaterial.diffuseColor = new Color3(0.095, 0.09, 0.078);
    floorMaterial.specularColor = Color3.Black();
    floor.material = floorMaterial;

    const bench = MeshBuilder.CreateBox("workbench", { width: 12.6, height: 0.82, depth: 7.2 }, this.scene);
    bench.position = new Vector3(0, 0, 0.05);
    const benchMaterial = new StandardMaterial("bench-material", this.scene);
    benchMaterial.diffuseColor = new Color3(0.14, 0.065, 0.028);
    benchMaterial.specularColor = new Color3(0.055, 0.024, 0.012);
    bench.material = benchMaterial;
    for (const x of [-5.3, 5.3]) for (const z of [-2.75, 2.75]) {
      const leg = MeshBuilder.CreateBox(`bench-leg-${x}-${z}`, { width: 0.55, height: 3.1, depth: 0.55 }, this.scene);
      leg.position = new Vector3(x, -1.85, z);
      leg.material = benchMaterial;
    }

    const backWall = MeshBuilder.CreateBox("plaster-wall", { width: 20, height: 10, depth: 0.4 }, this.scene);
    backWall.position = new Vector3(0, 4.2, 6.1);
    const wallMaterial = new StandardMaterial("wall-material", this.scene);
    wallMaterial.diffuseColor = new Color3(0.56, 0.52, 0.44);
    wallMaterial.specularColor = Color3.Black();
    backWall.material = wallMaterial;

    const lamp = MeshBuilder.CreateCylinder("workshop-lamp", { height: 0.35, diameterTop: 0.6, diameterBottom: 1.45, tessellation: 32 }, this.scene);
    lamp.position = new Vector3(0, 4.9, 0.3);
    const lampMaterial = new StandardMaterial("lamp-shade", this.scene);
    lampMaterial.diffuseColor = new Color3(0.12, 0.11, 0.1);
    lampMaterial.emissiveColor = new Color3(0.11, 0.055, 0.02);
    lamp.material = lampMaterial;
  }

  private createGrainGrid() {
    for (let x = -3.6; x <= 3.61; x += 1.2) {
      const line = MeshBuilder.CreateBox(`grain-grid-x-${x}`, { width: 0.012, height: 0.018, depth: 3.8 }, this.scene);
      line.position = new Vector3(x, 0.885, 0.05);
      line.material = this.gridMaterial;
    }
    for (let z = -1.5; z <= 1.51; z += 1.0) {
      const line = MeshBuilder.CreateBox(`grain-grid-z-${z}`, { width: 7.6, height: 0.018, depth: 0.012 }, this.scene);
      line.position = new Vector3(0, 0.885, z + 0.05);
      line.material = this.gridMaterial;
    }
  }

  private createToolRack(): Record<RecipeTool, StandardMaterial> {
    const tools: Array<{ id: RecipeTool; z: number; color: Color3 }> = [
      { id: "sand", z: -2.15, color: new Color3(0.56, 0.34, 0.17) },
      { id: "stain", z: 0, color: new Color3(0.29, 0.17, 0.1) },
      { id: "join", z: 2.15, color: new Color3(0.13, 0.14, 0.13) },
    ];
    const lamps = {} as Record<RecipeTool, StandardMaterial>;
    const rack = MeshBuilder.CreateBox("tool-rack", { width: 1.4, height: 2.9, depth: 6.2 }, this.scene);
    rack.position = new Vector3(-5.1, 1.55, 0.05);
    const rackMaterial = new StandardMaterial("rack-material", this.scene);
    rackMaterial.diffuseColor = new Color3(0.08, 0.08, 0.075);
    rack.material = rackMaterial;
    tools.forEach(({ id, z, color }) => {
      const body = MeshBuilder.CreateBox(`tool-${id}`, { width: 0.72, height: 0.22, depth: 1.1 }, this.scene);
      body.position = new Vector3(-4.25, 1.75, z + 0.05);
      const bodyMaterial = new StandardMaterial(`tool-material-${id}`, this.scene);
      bodyMaterial.diffuseColor = color;
      bodyMaterial.specularColor = new Color3(0.12, 0.1, 0.08);
      body.material = bodyMaterial;
      const lamp = MeshBuilder.CreateSphere(`tool-lamp-${id}`, { diameter: 0.16, segments: 16 }, this.scene);
      lamp.position = new Vector3(-4.25, 2.05, z + 0.05);
      const lampMaterial = new StandardMaterial(`tool-lamp-material-${id}`, this.scene);
      lampMaterial.diffuseColor = amber;
      lampMaterial.emissiveColor = graphite;
      lamp.material = lampMaterial;
      lamps[id] = lampMaterial;
    });
    return lamps;
  }
}
