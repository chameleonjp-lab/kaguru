# Runtime Structure

`GameCanvas.tsx` はReactの表示枠として、Babylonエンジンの初期化・破棄、DOM HUDの表示、キーボードショートカットだけを担当する。ゲーム内の加工ルールや3D要素の所有はReactに持ち込まない。

| Module | Ownership | Responsibility |
|---|---|---|
| `client/src/components/GameCanvas.tsx` | React | キャンバスのライフサイクル、HUD、入力の発火、状態表示 |
| `client/src/game/scene.ts` | Babylon scene | カメラ、照明、工房シーン、更新ループ、破棄ハンドル |
| `client/src/game/GameWorld.ts` | Gameplay world | 板材、素材、作業台、工程値、品質計算、デモ進行、DOMイベントの掃除 |
| `client/src/game/assets.ts` | Asset contract | WebDevストレージにある生成画像URL |

状態は `GameWorld` のみが更新する。DOM側は `grain-lab-state` カスタムイベントを購読し、ボタンやキー入力は `grain-lab-action` を発火する。これにより、HUDを差し替えても木目作成のルールや3Dシーンを変更せずに保てる。

## State Contract

`GameSnapshot` は `wood`、各工程の進捗（`sanding`、`staining`、`joining`）、算出済みの `quality`、表示用の `status`、収集済みの `collection`、`demo` を含む。工程値は0〜100に正規化され、品質は研磨30%、着色25%、継ぎ目35%、基本精度10%の合成で算出する。

