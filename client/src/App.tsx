// 年輪の実験室: 余白のある工房HUDを載せるGameCanvasだけを、アプリの表示面として使う。
import ErrorBoundary from "./components/ErrorBoundary";
import GameCanvas from "./components/GameCanvas";

export default function App() {
  return (
    <ErrorBoundary>
      <GameCanvas />
    </ErrorBoundary>
  );
}

