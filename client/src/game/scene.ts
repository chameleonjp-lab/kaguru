// 年輪の実験室: 温かな工房の光と、中央の板材を検査する見下ろし視点をつくるシーン入口。
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { GameWorld } from "./GameWorld";

export interface GameHandle {
  scene: Scene;
  dispose: () => void;
}

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.34, 0.29, 0.23, 1);
  scene.ambientColor = new Color3(0.3, 0.27, 0.23);

  const camera = new ArcRotateCamera(
    "studio-camera",
    -Math.PI / 2.2,
    1.12,
    14.7,
    new Vector3(0, 0.25, 0.05),
    scene,
  );
  camera.lowerBetaLimit = 0.78;
  camera.upperBetaLimit = 1.3;
  camera.lowerRadiusLimit = 12.8;
  camera.upperRadiusLimit = 16.9;
  camera.wheelDeltaPercentage = 0.015;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, true);

  const studioLight = new HemisphericLight("studio-fill", new Vector3(0, 1, 0), scene);
  studioLight.intensity = 0.76;
  studioLight.diffuse = new Color3(1, 0.82, 0.62);
  studioLight.groundColor = new Color3(0.1, 0.09, 0.075);

  const lamp = new PointLight("amber-lamp", new Vector3(0, 4.3, 0.2), scene);
  lamp.intensity = 4.2;
  lamp.diffuse = new Color3(1, 0.44, 0.14);
  lamp.range = 13;

  const world = new GameWorld(scene);
  scene.onBeforeRenderObservable.add(() => {
    world.update(scene.getEngine().getDeltaTime() / 1000);
  });

  return {
    scene,
    dispose: () => {
      world.dispose();
      scene.dispose();
    },
  };
}
