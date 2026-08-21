// 年輪の実験室: DOMの作業指示とBabylonの作業台を重ね、材料が主役になる静かな工房UIをつくる。
// Mobile UX: keep a single next action, live quality, and optional stock details within thumb reach on phones.
import "@babylonjs/core/Shaders/default.vertex.js";
import "@babylonjs/core/Shaders/standard.fragment.js";
import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";
import type { GameSnapshot, GrainLabAction, ToolAction, WoodKind, WorkPhase } from "@/game/GameWorld";
import { assets } from "@/game/assets";
import { toolLabels, woodCatalog, woodProfiles } from "@/game/WoodCatalog";
import { rewardList, rewards, type RewardId } from "@/game/Rewards";
import { orderList, orders } from "@/game/Orders";
import { useIsMobile } from "@/hooks/useMobile";

const getDemo = () => new URLSearchParams(window.location.search).has("demo");
const getMobileStockOpen = () => new URLSearchParams(window.location.search).has("stock");

const freshState = (): GameSnapshot => ({
  wood: "walnut",
  sanding: getDemo() ? 100 : 0,
  staining: getDemo() ? 100 : 0,
  joining: getDemo() ? 100 : 0,
  quality: getDemo() ? 100 : 12,
  status: getDemo() ? "デモ：合格済みの木目データを検査台に表示しています。" : "最初の木目を選び、仕上げ工程を始めてください。",
  collection: getDemo() ? 1 : 0,
  demo: getDemo(),
  targetQuality: 90,
  recipeName: "深層オイル・レシピ",
  nextTool: getDemo() ? null : "sand",
  unlockedRewards: getDemo() ? ["tung-oil"] : [],
  activeRewardId: getDemo() ? "tung-oil" : null,
  latestRewardId: null,
  phase: getDemo() ? "delivery" : "request",
  activeOrderId: getDemo() ? "table-dining" : "chair-cafe",
  totalScore: getDemo() ? 1710 : 0,
  lastDeliveryScore: getDemo() ? 1710 : 0,
  scoreBreakdown: getDemo() ? { material: 270, grain: 450, finish: 180, affinity: 0 } : { material: 0, grain: 0, finish: 0, affinity: 0 },
  bestScore: getDemo() ? 900 : 0,
  isNewBest: false,
  customerReaction: getDemo() ? "見事です。天板の流れが部屋の光を受け止めています。" : "仕様を確認して、最高の一作をつくってください。",
  timeline: [],
  canUndo: false,
  canRedo: false,
  undoCount: 0,
  redoCount: 0,
  historyNotice: null,
  deliveryReadyNotice: null,
});

const toolMeta: Array<{ id: Extract<ToolAction, "sand" | "stain" | "join">; number: string; label: string; detail: string }> = [
  { id: "sand", number: "01", label: "研磨", detail: "繊維の粗さをそろえる" },
  { id: "stain", number: "02", label: "着色", detail: "色調の深さを合わせる" },
  { id: "join", number: "03", label: "連続化", detail: "端部の木目を結ぶ" },
];

type WarningHover = { visible: boolean; title?: string; message?: string; remaining?: number; target?: number };

const getWarningTip = (): WarningHover => new URLSearchParams(window.location.search).has("tip")
  ? { visible: true, title: "研磨が不足しています", message: "研磨を追加して、繊維の粗さと反射むらを整えてください。", remaining: 66, target: 100 }
  : { visible: false };

const getDeliveryReady = (): GameSnapshot["deliveryReadyNotice"] => new URLSearchParams(window.location.search).has("ready")
  ? { id: 1, message: "全工程を達成しました。品質 90 の基準を満たし、納品可能です。", breakdown: { material: 30, grain: 50, finish: 20, affinity: 8 }, total: 108 }
  : null;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const [state, setState] = useState<GameSnapshot>(freshState);
  const previousPhaseRef = useRef<WorkPhase>(state.phase);
  const seenHistoryNoticeRef = useRef<number | null>(null);
  const seenDeliveryReadyRef = useRef<number | null>(null);
  const [workStartOpen, setWorkStartOpen] = useState(false);
  const [historyToast, setHistoryToast] = useState<GameSnapshot["historyNotice"]>(null);
  const [deliveryReady, setDeliveryReady] = useState<GameSnapshot["deliveryReadyNotice"]>(getDeliveryReady);
  const [warningHover, setWarningHover] = useState<WarningHover>(getWarningTip);
  const [mobileStockOpen, setMobileStockOpen] = useState(getMobileStockOpen);
  const isMobile = useIsMobile();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
    let disposed = false;
    let handle: GameHandle | null = null;

    createGameScene(engine, canvas)
      .then((gameHandle) => {
        if (disposed) {
          gameHandle.dispose();
          return;
        }
        handle = gameHandle;
        engine.runRenderLoop(() => gameHandle.scene.render());
      })
      .catch((error: unknown) => console.error("Game scene initialization failed", error));

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      handle?.dispose();
      engine.dispose();
      startedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const onState = (event: Event) => {
      const detail = (event as CustomEvent<GameSnapshot>).detail;
      if (detail) setState(detail);
    };
    window.addEventListener("grain-lab-state", onState);
    window.dispatchEvent(new CustomEvent<GrainLabAction>("grain-lab-action", { detail: { type: "request-state" } }));
    return () => window.removeEventListener("grain-lab-state", onState);
  }, []);

  useEffect(() => {
    const movedFromRequest = previousPhaseRef.current === "request" && state.phase === "create";
    previousPhaseRef.current = state.phase;
    if (!movedFromRequest) return;
    setWorkStartOpen(true);
    const timeout = window.setTimeout(() => setWorkStartOpen(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [state.phase]);

  useEffect(() => {
    if (!state.historyNotice || seenHistoryNoticeRef.current === state.historyNotice.id) return;
    seenHistoryNoticeRef.current = state.historyNotice.id;
    setHistoryToast(state.historyNotice);
    const timeout = window.setTimeout(() => setHistoryToast(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [state.historyNotice]);

  useEffect(() => {
    if (!state.deliveryReadyNotice || seenDeliveryReadyRef.current === state.deliveryReadyNotice.id) return;
    seenDeliveryReadyRef.current = state.deliveryReadyNotice.id;
    setDeliveryReady(state.deliveryReadyNotice);
    const timeout = window.setTimeout(() => setDeliveryReady(null), 3400);
    return () => window.clearTimeout(timeout);
  }, [state.deliveryReadyNotice]);

  useEffect(() => {
    const onWarningHover = (event: Event) => setWarningHover((event as CustomEvent<WarningHover>).detail ?? { visible: false });
    window.addEventListener("grain-lab-warning-hover", onWarningHover);
    return () => window.removeEventListener("grain-lab-warning-hover", onWarningHover);
  }, []);

  useEffect(() => {
    if (state.phase === "create" && getMobileStockOpen()) {
      setMobileStockOpen(true);
      return;
    }
    if (state.phase !== "create") setMobileStockOpen(false);
  }, [state.phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
        event.preventDefault();
        dispatch({ type: key === "y" || event.shiftKey ? "redo" : "undo" });
        return;
      }
      const mapping: Record<string, ToolAction | undefined> = { "1": "sand", "2": "stain", "3": "join", z: "undo", y: "redo", r: "reset" };
      const action = mapping[key];
      if (action && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        dispatch({ type: action });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const dispatch = (detail: GrainLabAction) => {
    window.dispatchEvent(new CustomEvent<GrainLabAction>("grain-lab-action", { detail }));
  };

  const selectedProgress = (id: "sand" | "stain" | "join") => (id === "sand" ? state.sanding : id === "stain" ? state.staining : state.joining);
  const profile = woodCatalog[state.wood];
  const steps = profile.order.map((tool) => selectedProgress(tool));
  const isComplete = state.quality >= profile.targetQuality && state.nextTool === null;
  const activeReward = state.activeRewardId ? rewards[state.activeRewardId] : null;
  const latestReward = state.latestRewardId ? rewards[state.latestRewardId] : null;
  const activeOrder = orders[state.activeOrderId];
  const isDeliverable = state.wood === activeOrder.desiredWood && state.quality >= activeOrder.minimumQuality && isComplete;
  const previewWarnings = [
    { id: "sand", current: state.sanding, target: profile.targets.sand, title: "研磨が不足しています", message: "研磨を追加して、繊維の粗さと反射むらを整えてください。" },
    { id: "stain", current: state.staining, target: profile.targets.stain, title: "着色が不足しています", message: "着色を重ねて、色調と木目の深みを依頼仕様へ合わせてください。" },
    { id: "join", current: state.joining, target: profile.targets.join, title: "連続化が不足しています", message: "連続化を行い、端部で木目が途切れないよう調整してください。" },
  ].map((warning) => ({ ...warning, remaining: Math.max(0, warning.target - warning.current), active: warning.current < warning.target }))
    .filter((warning) => warning.active);
  const phaseLabels = ["依頼", "作成", "最終確認", "納品"] as const;

  return (
    <main className={`game-shell ${isMobile ? "is-mobile" : ""} ${state.phase === "create" ? "phase-creating" : ""}`} aria-label="GRAIN LAB 木目テクスチャ制作ゲーム">
      <canvas ref={canvasRef} className="game-canvas" aria-label="木材加工の3D作業台" />
      <div className="vignette" aria-hidden="true" />
      {workStartOpen && <section className="work-start-transition" role="status"><span>SPECIFICATION LOCKED</span><strong>{woodCatalog[activeOrder.desiredWood].japaneseName} を作業台へ</strong><p>依頼の仕上げ条件を固定しました。平面テクスチャの加工を開始します。</p><i /></section>}
      {historyToast && <div className={`history-toast ${historyToast.type}`} role="status"><span>{historyToast.type === "undo" ? "↶" : "↷"}</span><p><b>{historyToast.type === "undo" ? "取り消しました" : "やり直しました"}</b>{historyToast.message}</p><kbd>{historyToast.type === "undo" ? "Ctrl Z" : "Ctrl Y"}</kbd></div>}
      {deliveryReady && <section className="delivery-ready-effect" role="status"><div className="ready-rays" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--ray": index } as React.CSSProperties} />)}</div><span>QUALITY GATE CLEARED</span><strong>納品可能</strong><p>{deliveryReady.message}</p><div className="ready-score"><b>FINAL QUALITY <em>{deliveryReady.total}</em></b><div><span>木材 <i>{deliveryReady.breakdown.material}</i></span><span>木目 <i>{deliveryReady.breakdown.grain}</i></span><span>仕上げ <i>{deliveryReady.breakdown.finish}</i></span><span>相性 <i>+{deliveryReady.breakdown.affinity}</i></span></div></div><button onClick={() => dispatch({ type: "open-preview" })}>完成家具を最終確認する</button></section>}
      {latestReward && state.phase !== "delivery" && <section className="reward-reveal" aria-live="polite"><div className="reward-burst" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div><div className="unlock-banner"><span>RECIPE REWARD UNLOCKED</span><b>{latestReward.japaneseName}</b><p>{latestReward.effect}</p></div></section>}
      {state.phase === "request" ? <section className="furniture-callout">
        <span className="preview-label">3D WHITE OBJECT / {activeOrder.furniture.toUpperCase()}</span>
        <span className="preview-part-label">TEXTURE ZONE · {activeOrder.joinery}</span>
        <p>ドラッグして、立体の部位と仕上げ範囲を確認</p>
      </section> : state.phase === "preview" || state.phase === "delivery" ? <section className="finished-callout">
        <span>FINISHED OBJECT / {activeOrder.furniture.toUpperCase()}</span>
        <b>{profile.japaneseName}・{profile.recipeName}</b>
        <p>完成テクスチャを3D家具へ適用済み</p>
      </section> : <div
        className={isComplete ? "material-inspection verified" : "material-inspection"}
        style={{ backgroundImage: `url(${profile.texture})` }}
        aria-hidden="true"
      >
        <div className="analysis-grid" />
        <span className="inspection-label left">GRAIN / {profile.name}</span>
        <span className="inspection-label right">TILE {String(state.quality).padStart(2, "0")} / {profile.targetQuality}</span>
        <span className="seam-axis" />
        {isComplete && <span className="inspection-stamp">SEAMLESS<br />VERIFIED</span>}
      </div>}

      <header className="topbar">
        <div className="brand-lockup">
          <img src={assets.grainMark} alt="年輪のロゴマーク" className="brand-mark" />
          <div>
            <p className="eyebrow">WOOD TEXTURE STUDIO</p>
            <h1>GRAIN LAB</h1>
          </div>
        </div>
        <div className="header-meters">
          <div className="score-badge"><span>BEST SCORE</span><strong>{String(state.bestScore).padStart(4, "0")}</strong></div>
          <div className="quality-badge" aria-label={`現在の品質 ${state.quality} 点`}>
          <span>QUALITY</span>
          <strong>{String(state.quality).padStart(2, "0")}</strong><em> / {profile.targetQuality}</em>
          <i aria-hidden="true" />
          </div>
        </div>
      </header>

      {isMobile && state.phase === "create" && <section className="mobile-work-dock" aria-label="モバイル用加工操作">
        <div className="mobile-work-status"><span>LIVE QUALITY</span><strong>{String(state.quality).padStart(2, "0")}<small> / {profile.targetQuality}</small></strong><p>{state.nextTool ? `次の工程：${toolLabels[state.nextTool]}` : "最終確認の準備が整いました"}</p></div>
        <div className="mobile-process-meter" aria-label="工程進捗">{steps.map((step, index) => <span key={toolMeta[index].id} className={step >= profile.targets[toolMeta[index].id] ? "complete" : step > 0 ? "active" : ""}><i style={{ width: `${Math.min(100, step)}%` }} /></span>)}</div>
        <div className="mobile-tool-actions">{toolMeta.map((tool) => {
          const progress = selectedProgress(tool.id);
          const isNext = state.nextTool === tool.id;
          return <button key={tool.id} className={isNext ? "mobile-tool next" : "mobile-tool"} onClick={() => dispatch({ type: tool.id })} aria-label={`${tool.label}を実行。現在 ${progress}%`}><small>{tool.number}</small><b>{tool.label}</b><i>{progress}%</i></button>;
        })}</div>
        {isDeliverable && <button className="mobile-preview-action" onClick={() => dispatch({ type: "open-preview" })}>完成家具を最終確認する <span>→</span></button>}
        <div className="mobile-utility-actions"><button className="mobile-history" onClick={() => dispatch({ type: "undo" })} disabled={!state.canUndo}><span>↶</span>戻す <i>{state.undoCount}</i></button><button className="mobile-history" onClick={() => dispatch({ type: "redo" })} disabled={!state.canRedo}><span>↷</span>やり直す <i>{state.redoCount}</i></button><button className="mobile-stock-button" onClick={() => setMobileStockOpen(true)}>素材・仕上げ <span>⌃</span></button></div>
      </section>}

      {isMobile && mobileStockOpen && state.phase === "create" && <section className="mobile-stock-sheet" aria-label="素材と仕上げの選択">
        <button className="mobile-sheet-close" onClick={() => setMobileStockOpen(false)} aria-label="素材と仕上げの選択を閉じる"><span>STOCK & FINISH</span>閉じる ×</button>
        <div className="mobile-sheet-scroll"><section><p>WOOD STOCK</p><div className="mobile-wood-list">{woodProfiles.map((wood) => <button key={wood.id} className={state.wood === wood.id ? "selected" : ""} onClick={() => dispatch({ type: "material", wood: wood.id as WoodKind })}><i style={{ backgroundColor: wood.swatchTint, backgroundImage: `url(${wood.texture})`, backgroundBlendMode: "multiply" }} /><span><b>{wood.japaneseName}</b><small>{wood.name} · GOAL {wood.targetQuality}</small></span></button>)}</div></section><section className="mobile-reward-list"><p>FINISH / TOOL</p>{rewardList.map((reward) => {
          const isUnlocked = state.unlockedRewards.includes(reward.id);
          const isActive = state.activeRewardId === reward.id;
          return <button key={reward.id} disabled={!isUnlocked} className={isActive ? "active" : ""} onClick={() => dispatch({ type: "reward", rewardId: reward.id as RewardId })}><i>{reward.type === "仕上げ油" ? "OIL" : "TOOL"}</i><span><b>{reward.japaneseName}</b><small>{isUnlocked ? reward.effect : `LOCK · ${woodCatalog[reward.unlockWood].name}`}</small></span>{isActive && <em>ACTIVE</em>}</button>;
        })}</section></div>
      </section>}

      {state.phase === "request" ? <aside className="inspection-panel" aria-label="3D家具の検品ガイド">
        <p className="panel-kicker">3D INSPECTION</p>
        <h2>{activeOrder.furniture === "chair" ? "CHAIR" : activeOrder.furniture === "table" ? "TABLE" : "SHELF"}</h2>
        <p className="inspection-caption">白い現物を回して、テクスチャの必要な部位と木目方向を照合します。</p>
        <div className="inspection-steps"><span><b>01</b> ドラッグで回転</span><span><b>02</b> ホイールで拡大</span><span><b>03</b> 仕様書と部位を照合</span></div>
        <div className="zone-readout"><span>TEXTURE ZONE</span><b>{activeOrder.joinery}</b></div>
        <div className="inspection-client"><span>CLIENT</span><b>{activeOrder.client}</b></div>
      </aside> : <aside className="tool-rack" aria-label="加工ツール">
        <p className="panel-kicker">PROCESS</p>
        {toolMeta.map((tool, index) => {
          const progress = selectedProgress(tool.id);
          const required = profile.targets[tool.id];
          const isNext = state.nextTool === tool.id;
          return (
            <button key={tool.id} className={isNext ? "tool-button next-tool" : "tool-button"} onClick={() => dispatch({ type: tool.id })} aria-label={`${tool.label}を実行`}> 
              <span className="tool-number">{tool.number}</span>
              <span className="tool-copy"><b>{tool.label}</b><small>{isNext ? `次工程 · ${required}%` : `目標 ${required}%`}</small></span>
              <span className="tool-progress" aria-hidden="true"><i style={{ transform: `scaleY(${Math.max(0.08, Math.min(1, progress / required))})` }} /></span>
              <kbd>{index + 1}</kbd>
            </button>
          );
        })}
        <div className="history-actions" aria-label="加工履歴">
          <button className={state.canUndo ? "undo-button" : "undo-button disabled"} onClick={() => dispatch({ type: "undo" })} disabled={!state.canUndo} aria-label="加工を戻す">
            <span>↶</span><b>戻す</b><small>{state.undoCount} 手</small><kbd>Ctrl Z</kbd>
          </button>
          <button className={state.canRedo ? "redo-button" : "redo-button disabled"} onClick={() => dispatch({ type: "redo" })} disabled={!state.canRedo} aria-label="加工をやり直す">
            <span>↷</span><b>やり直す</b><small>{state.redoCount} 手</small><kbd>Ctrl Y</kbd>
          </button>
        </div>
        <div className="timeline-strip" aria-label="加工タイムライン"><span>TRACE</span><p>{state.timeline.length ? state.timeline.join(" · ") : "最初の工程を選択"}</p></div>
        <div className={activeReward ? "active-reward" : "active-reward empty"}>
          <span>ACTIVE FINISH</span>
          <b>{activeReward ? activeReward.japaneseName : "未装備"}</b>
          <small>{activeReward ? `${activeReward.effect}${activeReward.unlockWood === state.wood ? " · 材種相性 +8%" : ""}` : "レシピ達成で解放"}</small>
        </div>
        <section className="recipe-card" aria-label={`${profile.japaneseName}の専用レシピ`}>
          <span>RECIPE / {profile.name}</span>
          <b>{profile.recipeName}</b>
          <p>{profile.recipeHint}</p>
          <div><small>TARGET QUALITY</small><strong>{profile.targetQuality}</strong></div>
        </section>
        <button className="reset-button" onClick={() => dispatch({ type: "reset" })}><span>R</span> 新しいテストピース</button>
      </aside>}

      <section className="objective-card" aria-live="polite">
        <p className="panel-kicker">CURRENT BRIEF</p>
        <div className="phase-track">{phaseLabels.map((phase, index) => <span key={phase} className={(state.phase === "request" && index === 0) || (state.phase === "create" && index <= 1) || (state.phase === "preview" && index <= 2) || (state.phase === "delivery") ? "active" : ""}>{String(index + 1).padStart(2, "0")} {phase}</span>)}</div>
        <h2>{state.phase === "request" ? activeOrder.title : state.phase === "create" ? state.recipeName : state.phase === "preview" ? "完成家具の最終確認" : "納品を完了しました"}</h2>
        <p>{state.phase === "request" ? activeOrder.request : state.status}</p>
        {state.phase === "request" && <div className="spec-sheet">
          <div><span>SIZE</span><b>{activeOrder.dimensions}</b></div><div><span>WOOD</span><b>{woodCatalog[activeOrder.desiredWood].japaneseName}</b></div><div><span>GRAIN</span><b>{activeOrder.grainDirection}</b></div><div><span>FINISH</span><b>{activeOrder.finish}</b></div>
          <div className="spec-inspection"><span>INSPECTION</span><b>{activeOrder.inspection.join(" · ")}</b></div>
        </div>}
        <div className="objective-meta"><span>{state.phase === "request" ? `${activeOrder.client} / ${woodCatalog[activeOrder.desiredWood].name}` : state.phase === "preview" ? "3D FINAL CHECK" : state.phase === "delivery" ? `DELIVERY +${state.lastDeliveryScore}` : `GOAL ${activeOrder.minimumQuality}`}</span><span>{state.phase === "create" ? (state.nextTool ? `NEXT · ${toolLabels[state.nextTool]}` : "PREVIEW READY") : state.phase === "preview" ? "DRAG + WHEEL" : state.phase === "delivery" ? "CLIENT SATISFIED" : "SELECT REQUEST"}</span></div>
        {state.phase === "request" && <div className="order-picker">{orderList.map((order) => <button key={order.id} onClick={() => dispatch({ type: "select-order", orderId: order.id })} className={order.id === activeOrder.id ? "selected" : ""}>{order.furniture === "chair" ? "椅子" : order.furniture === "table" ? "テーブル" : "棚"}</button>)}</div>}
        {state.phase === "create" && <div className="process-track" aria-label="工程進捗">{steps.map((step, index) => <span key={index} className={step >= 66 ? "done" : step > 0 ? "active" : ""}><i style={{ width: `${step}%` }} /></span>)}</div>}
        {state.phase !== "preview" && <button className={isDeliverable || state.phase === "request" || state.phase === "delivery" ? "primary-action ready" : "primary-action"} onClick={() => dispatch({ type: state.phase === "request" ? "accept-order" : state.phase === "create" ? "open-preview" : "next-request" })}>{state.phase === "request" ? "依頼を受諾する" : state.phase === "create" ? (isDeliverable ? "完成家具を最終確認する" : `納品基準：品質 ${activeOrder.minimumQuality}`) : "次の依頼を見る"}</button>}
      </section>

      {state.phase === "preview" && <aside className="final-preview-panel" aria-label="納品前の最終確認">
        <span>FINAL CHECK / 3D</span><h2>{activeOrder.title}</h2><p>{isMobile ? "一本指で回転、二本指で拡大縮小。赤い警告マーカーをタップすると、改善方法を確認できます。" : "ドラッグで回転、ホイールで拡大縮小。赤い警告マーカーにホバーすると、改善方法を確認できます。"}</p>
        <ul className="quality-highlights"><li className="grain"><i /> <span><b>木目の連続性</b><small>緑：端部の流れと継ぎ目を確認</small></span></li><li className="finish"><i /> <span><b>仕上げの均一性</b><small>琥珀：光を変えて艶むらを確認</small></span></li><li className="affinity"><i /> <span><b>材種と仕上げの相性</b><small>{activeReward?.unlockWood === state.wood ? "青緑：相性ボーナス +8% 適用" : "青緑：現在の仕上げとの相性を確認"}</small></span></li></ul>
        <div><button className="back-to-work" onClick={() => dispatch({ type: "back-to-work" })}>作業に戻る</button><button className="confirm-delivery" onClick={() => dispatch({ type: "deliver" })}>納品を確定する</button></div>
      </aside>}
      {state.phase === "preview" && previewWarnings.map((warning) => <button key={warning.id} className={`warning-marker ${warning.id}`} aria-label={warning.title} onMouseEnter={() => setWarningHover({ visible: true, title: warning.title, message: warning.message, remaining: warning.remaining, target: warning.target })} onMouseLeave={() => setWarningHover({ visible: false })} onFocus={() => setWarningHover({ visible: true, title: warning.title, message: warning.message, remaining: warning.remaining, target: warning.target })} onBlur={() => setWarningHover({ visible: false })} onClick={() => setWarningHover((current) => current.visible && current.title === warning.title ? { visible: false } : { visible: true, title: warning.title, message: warning.message, remaining: warning.remaining, target: warning.target })}>!</button>)}
      {warningHover.visible && <aside className="warning-tooltip" role="status"><span>QUALITY WARNING</span><b>{warningHover.title}</b><strong>あと {warningHover.remaining}% 必要</strong><p>{warningHover.message}</p><small>目標 {warningHover.target}% ・赤いマーカーからカーソルを外すと閉じます</small></aside>}

      {state.phase === "delivery" && state.lastDeliveryScore > 0 && <section className="delivery-celebration" aria-live="polite"><div className="celebration-confetti" aria-hidden="true">{Array.from({ length: 20 }, (_, index) => <i key={index} />)}</div><span>{state.isNewBest ? "NEW BEST SCORE" : "DELIVERY SCORE"}</span><strong>+{state.lastDeliveryScore}</strong><p>{activeOrder.title} を納品しました</p><div className="score-breakdown"><span>WOOD {state.scoreBreakdown.material}</span><span>GRAIN {state.scoreBreakdown.grain}</span><span>FINISH {state.scoreBreakdown.finish}</span><span className={state.scoreBreakdown.affinity ? "affinity-score" : ""}>SYNC {state.scoreBreakdown.affinity}</span></div><div className="customer-reaction"><b>{activeOrder.client}</b><p>「{state.customerReaction}」</p></div><div className="best-rank"><span>PERSONAL BEST</span><b>{state.bestScore}</b><small>全ての木材・仕上げ・報酬を最初から選択できます</small></div></section>}

      {state.phase === "request" ? <aside className="request-spec-panel" aria-label="依頼の仕上げ仕様">
        <p className="panel-kicker">MATERIAL BRIEF</p>
        <div className="brief-wood"><span className="brief-swatch" style={{ backgroundColor: profile.swatchTint, backgroundImage: `url(${profile.texture})` }} /><div><b>{profile.name}</b><small>{profile.japaneseName}</small></div></div>
        <dl><div><dt>GRAIN</dt><dd>{activeOrder.grainDirection}</dd></div><div><dt>FINISH</dt><dd>{activeOrder.finish}</dd></div><div><dt>QUALITY</dt><dd>{activeOrder.minimumQuality} / 100 以上</dd></div></dl>
        <div className="score-basis"><span>SCORE BASIS</span><b>WOOD 30% · GRAIN 50% · FINISH 20%</b></div>
      </aside> : <aside className="material-panel" aria-label="木材の選択">
        <p className="panel-kicker">STOCK</p>
        {woodProfiles.map((wood) => <button key={wood.id} className={state.wood === wood.id ? "material-card selected" : "material-card"} onClick={() => dispatch({ type: "material", wood: wood.id as WoodKind })}>
          <span className="wood-swatch" style={{ backgroundColor: wood.swatchTint, backgroundImage: `url(${wood.texture})`, backgroundBlendMode: "multiply" }} />
          <span><b>{wood.name}</b><small>{wood.trait} · GOAL {wood.targetQuality}</small></span>
        </button>)}
        <div className="collection-card"><span>DATA SHELF</span><strong>{String(state.collection).padStart(2, "0")}</strong><small>保存済みサンプル</small></div>
        <section className="reward-shelf" aria-label="解放済みの仕上げ油と道具">
          <div className="reward-shelf-title"><span>REWARD SHELF</span><strong>{state.unlockedRewards.length}/{rewardList.length}</strong></div>
          {rewardList.map((reward) => {
            const isUnlocked = state.unlockedRewards.includes(reward.id);
            const isActive = state.activeRewardId === reward.id;
            return <button key={reward.id} disabled={!isUnlocked} className={isActive ? "reward-card active" : isUnlocked ? "reward-card" : "reward-card locked"} onClick={() => dispatch({ type: "reward", rewardId: reward.id as RewardId })}>
              <span className="reward-type">{reward.type === "仕上げ油" ? "OIL" : "TOOL"}</span>
              <span><b>{reward.japaneseName}</b><small>{isUnlocked ? `${reward.effect}${isActive ? " · ACTIVE" : ""}` : `LOCK · ${woodCatalog[reward.unlockWood].name}`}</small></span>
            </button>;
          })}
        </section>
      </aside>}

      <footer className="lab-footer">
        <span><i className={isComplete ? "status-dot complete" : "status-dot"} /> {isComplete ? "SEAMLESS VERIFIED" : "LIVE GRAIN ANALYSIS"}</span>
        <span className="footer-tip">ドラッグで観察 · ホイールで拡大</span>
      </footer>
    </main>
  );
}
