import { useEffect, useMemo, useState } from "react";
import ConsoleSection from "../components/sections/ConsoleSection";
import CategoryModelVectorSpace from "../components/charts/category-engine/CategoryModelVectorSpace";
import { getJson, postJson } from "../api/MLPEClient";

function TrainModels() {
  const [modelType, setModelType] = useState("category");
  const [nSynth, setNSynth] = useState(400);
  const [consoleText, setConsoleText] = useState("Ready.");
  const [isTraining, setIsTraining] = useState(false);
  const [points, setPoints] = useState([]);
  const [metrics, setMetrics] = useState({
    samples: 0,
    features: 0,
    status: "Idle",
    lastRun: "--",
  });

  const canTrain = modelType === "category";

  useEffect(() => {
    let cancelled = false;
    if (modelType !== "category") {
      setPoints([]);
      setMetrics((prev) => ({ ...prev, status: "Idle" }));
      return () => {
        cancelled = true;
      };
    }

    const loadVectorSpace = async () => {
      setConsoleText("Loading existing category vector space...");
      setMetrics((prev) => ({ ...prev, status: "Loading..." }));
      try {
        const vectorSpace = await getJson("/category/vector-space-3d");
        if (cancelled) return;
        setPoints(vectorSpace?.points || []);
        setMetrics((prev) => ({
          ...prev,
          samples: vectorSpace?.points?.length ?? 0,
          features: vectorSpace?.feature_order?.length ?? 0,
          status: vectorSpace?.points?.length ? "Ready" : "Idle",
          lastRun: new Date().toLocaleTimeString(),
        }));
        setConsoleText("Vector space loaded.");
      } catch (error) {
        if (cancelled) return;
        setConsoleText(
          `Load failed: ${error.message}${
            error.data ? ` | ${JSON.stringify(error.data)}` : ""
          }`
        );
        setMetrics((prev) => ({ ...prev, status: "Failed" }));
      }
    };

    loadVectorSpace();
    return () => {
      cancelled = true;
    };
  }, [modelType]);

  const handleTrain = async () => {
    if (!canTrain) {
      setConsoleText("User Engine training is not wired yet.");
      return;
    }

    setIsTraining(true);
    setConsoleText("Training Category Engine (synthetic data)...");
    setMetrics((prev) => ({ ...prev, status: "Training..." }));

    try {
      const response = await postJson("/category/train", { n_synth: nSynth });
      const vectorSpace = await getJson("/category/vector-space-3d");
      setPoints(vectorSpace?.points || []);
      setMetrics({
        samples: response?.n_samples ?? vectorSpace?.points?.length ?? 0,
        features: vectorSpace?.feature_order?.length ?? 0,
        status: "Trained",
        lastRun: new Date().toLocaleTimeString(),
      });
      setConsoleText(
        `Training complete. Samples: ${response?.n_samples ?? nSynth}.`
      );
    } catch (error) {
      setConsoleText(
        `Training failed: ${error.message}${
          error.data ? ` | ${JSON.stringify(error.data)}` : ""
        }`
      );
      setMetrics((prev) => ({ ...prev, status: "Failed" }));
    } finally {
      setIsTraining(false);
    }
  };

  const statusTone = useMemo(() => {
    if (metrics.status === "Training...") return "text-warning";
    if (metrics.status === "Trained") return "text-success";
    if (metrics.status === "Failed") return "text-error";
    return "text-base-content/70";
  }, [metrics.status]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-8xl mx-auto">
          <div className="grid h-full min-h-0 grid-cols-12 gap-3">
            <div className="col-span-12 xl:col-span-6 flex min-h-0 flex-col gap-3">
              <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
                <div className="col-span-12 rounded-xl shadow-lg flex flex-col border-2 border-primary/70 bg-base-200/70 backdrop-blur">
                  <div className="flex flex-col gap-4 px-5 py-5">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-lg border border-primary/30 bg-base-300/60 p-3">
                        <div className="text-xs text-base-content/60">Model Type</div>
                        <select
                          className="select select-bordered w-full mt-2"
                          value={modelType}
                          onChange={(event) => setModelType(event.target.value)}
                        >
                          <option value="category">Category Engine</option>
                          <option value="user">User Engine</option>
                        </select>
                      </div>

                      <div className="rounded-lg border border-primary/30 bg-base-300/60 p-3">
                        <div className="text-xs text-base-content/60">Synthetic Samples</div>
                        <input
                          type="number"
                          min={50}
                          max={2000}
                          step={50}
                          value={nSynth}
                          onChange={(event) => setNSynth(Number(event.target.value))}
                          className="input input-bordered w-full mt-2"
                        />
                        <div className="mt-2 text-[11px] text-base-content/50">
                          Uses synthetic data for now. File upload coming next.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-base-content/60">
                        <span className="w-2 h-2 rounded-full bg-success/70"></span>
                        {canTrain ? "Ready for training" : "Category Engine only"}
                      </div>
                      <button
                        className="btn btn-primary shadow"
                        onClick={handleTrain}
                        disabled={isTraining}
                      >
                        {isTraining ? "Training..." : "Train Model"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="col-span-12 bg-base-200 rounded-xl shadow-lg border-2 border-primary/70 min-h-50 flex flex-col">
                  <ConsoleSection value={consoleText} />
                </div>
              </div>
            </div>

            <div className="col-span-12 xl:col-span-6 bg-base-200 p-4 rounded-xl shadow-lg border-2 border-primary/70 flex flex-col">
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <div className="rounded-lg border border-primary/20 bg-base-300/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">
                        Training Insights
                      </div>
                      <div className="text-xs text-base-content/60">
                        Visualize cluster spread and data coverage.
                      </div>
                    </div>
                    <div className="text-xs text-base-content/60">
                      Last run: {metrics.lastRun}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                      <div className="text-base-content/60">Samples</div>
                      <div className="text-sm font-semibold">{metrics.samples}</div>
                    </div>
                    <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                      <div className="text-base-content/60">Features</div>
                      <div className="text-sm font-semibold">{metrics.features}</div>
                    </div>
                    <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                      <div className="text-base-content/60">Status</div>
                      <div className={`text-sm font-semibold ${statusTone}`}>
                        {metrics.status}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-h-0 border border-primary/20 rounded-lg bg-base-300/40">
                  <CategoryModelVectorSpace points={points} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrainModels;
