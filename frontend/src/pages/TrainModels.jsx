import { useEffect, useMemo, useState } from "react";
import ConsoleSection from "../components/sections/ConsoleSection";
import CategoryModelVectorSpace from "../components/charts/category-engine/CategoryModelVectorSpace";
import { getJson, postJson } from "../api/MLPEClient";

function TrainModels() {
  const [modelType, setModelType] = useState("category");
  const [nSynth, setNSynth] = useState(400);
  const [tempUserId, setTempUserId] = useState("");
  const [tempOutcomes, setTempOutcomes] = useState("keep");
  const [tempMinSamples, setTempMinSamples] = useState(10);
  const [tempSynthSamples, setTempSynthSamples] = useState(400);
  const [tempSynthSeed, setTempSynthSeed] = useState(42);
  const [consoleText, setConsoleText] = useState("Ready.");
  const [isTraining, setIsTraining] = useState(false);
  const [points, setPoints] = useState([]);
  const [metrics, setMetrics] = useState({
    samples: 0,
    features: 0,
    status: "Idle",
    lastRun: "--",
  });
  const [tempMetrics, setTempMetrics] = useState({
    status: "Idle",
    version: "--",
    total: 0,
    kept: 0,
    quarantined: 0,
    rejected: 0,
    baselines: 0,
    lastRun: "--",
  });

  const canTrain = modelType === "category" || modelType === "temp-detector";

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

  useEffect(() => {
    let cancelled = false;
    if (modelType !== "temp-detector") {
      setTempMetrics((prev) => ({ ...prev, status: "Idle" }));
      return () => {
        cancelled = true;
      };
    }

    const loadStatus = async () => {
      setConsoleText("Loading temporary detector status...");
      try {
        const status = await getJson("/temp-detector/status");
        if (cancelled) return;
        setTempMetrics({
          status: status?.model_trained ? "Ready" : "Untrained",
          version: status?.model_version || "--",
          total: status?.history?.total ?? 0,
          kept: status?.history?.kept ?? 0,
          quarantined: status?.history?.quarantined ?? 0,
          rejected: status?.history?.rejected ?? 0,
          baselines: status?.baselines?.users ?? 0,
          lastRun: new Date().toLocaleTimeString(),
        });
        setConsoleText("Temporary detector status loaded.");
      } catch (error) {
        if (cancelled) return;
        setTempMetrics((prev) => ({ ...prev, status: "Failed" }));
        setConsoleText(
          `Load failed: ${error.message}${
            error.data ? ` | ${JSON.stringify(error.data)}` : ""
          }`
        );
      }
    };

    loadStatus();
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
    if (modelType === "category") {
      setConsoleText("Training Category Engine (synthetic data)...");
      setMetrics((prev) => ({ ...prev, status: "Training..." }));
    } else {
      setConsoleText("Training Temporary User Detector from stored batches...");
      setTempMetrics((prev) => ({ ...prev, status: "Training..." }));
    }

    try {
      if (modelType === "category") {
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
      } else {
        const outcomes =
          tempOutcomes === "all"
            ? []
            : tempOutcomes === "keep_quarantine"
            ? ["keep", "quarantine"]
            : ["keep"];
        const response = tempOutcomes === "synth"
          ? await postJson("/temp-detector/train-synth", {
              n_samples: tempSynthSamples,
              seed: tempSynthSeed,
            })
          : await postJson("/temp-detector/train-from-batches", {
              user_id: tempUserId || null,
              outcomes,
              min_samples: tempMinSamples,
            });
        const status = await getJson("/temp-detector/status");
        setTempMetrics({
          status: response?.status === "trained" ? "Trained" : "Not enough data",
          version: status?.model_version || "--",
          total: status?.history?.total ?? 0,
          kept: status?.history?.kept ?? 0,
          quarantined: status?.history?.quarantined ?? 0,
          rejected: status?.history?.rejected ?? 0,
          baselines: status?.baselines?.users ?? 0,
          lastRun: new Date().toLocaleTimeString(),
        });
        setConsoleText(
          response?.status === "trained"
            ? `Training complete. Samples: ${response?.n_samples ?? 0}.`
            : `Not enough samples to train (${response?.n_samples ?? 0}).`
        );
      }
    } catch (error) {
      setConsoleText(
        `Training failed: ${error.message}${
          error.data ? ` | ${JSON.stringify(error.data)}` : ""
        }`
      );
      if (modelType === "category") {
        setMetrics((prev) => ({ ...prev, status: "Failed" }));
      } else {
        setTempMetrics((prev) => ({ ...prev, status: "Failed" }));
      }
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

  const tempStatusTone = useMemo(() => {
    if (tempMetrics.status === "Training...") return "text-warning";
    if (tempMetrics.status === "Trained") return "text-success";
    if (tempMetrics.status === "Failed") return "text-error";
    if (tempMetrics.status === "Untrained") return "text-warning";
    return "text-base-content/70";
  }, [tempMetrics.status]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-8xl mx-auto">
          <div className="grid h-full min-h-0 grid-cols-12 gap-3">
            <div className="col-span-12 xl:col-span-6 flex min-h-0 flex-col gap-3">
              <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
                <div className="col-span-12 rounded-xl shadow-lg flex flex-col border-2 border-primary/70 bg-base-200/70 backdrop-blur">
                  <div className="flex flex-col gap-4 px-5 py-5 flex-1">
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
                          <option value="temp-detector">Temporary User Detector</option>
                        </select>
                      </div>

                      {modelType === "category" ? (
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
                      ) : null}

                      {modelType === "temp-detector" ? (
                        <div className="rounded-lg border border-primary/30 bg-base-300/60 p-3 flex flex-col gap-3">
                          <div>
                            <div className="text-xs text-base-content/60">User ID (optional)</div>
                            <input
                              type="text"
                              value={tempUserId}
                              onChange={(event) => setTempUserId(event.target.value)}
                              className="input input-bordered w-full mt-2"
                              placeholder="u_001"
                            />
                          </div>
                          <div>
                            <div className="text-xs text-base-content/60">Training Mode</div>
                            <select
                              className="select select-bordered w-full mt-2"
                              value={tempOutcomes}
                              onChange={(event) => setTempOutcomes(event.target.value)}
                            >
                              <option value="keep">From kept batches</option>
                              <option value="keep_quarantine">Keep + Quarantine</option>
                              <option value="all">All outcomes</option>
                              <option value="synth">Synthetic data</option>
                            </select>
                          </div>
                          {tempOutcomes !== "synth" ? (
                            <div>
                              <div className="text-xs text-base-content/60">Min Samples</div>
                              <input
                                type="number"
                                min={5}
                                max={1000}
                                step={5}
                                value={tempMinSamples}
                                onChange={(event) => setTempMinSamples(Number(event.target.value))}
                                className="input input-bordered w-full mt-2"
                              />
                            </div>
                          ) : null}
                          {tempOutcomes === "synth" ? (
                            <>
                              <div>
                                <div className="text-xs text-base-content/60">Synthetic Samples</div>
                                <input
                                  type="number"
                                  min={50}
                                  max={2000}
                                  step={50}
                                  value={tempSynthSamples}
                                  onChange={(event) =>
                                    setTempSynthSamples(Number(event.target.value))
                                  }
                                  className="input input-bordered w-full mt-2"
                                />
                              </div>
                              <div>
                                <div className="text-xs text-base-content/60">Seed</div>
                                <input
                                  type="number"
                                  min={0}
                                  max={9999}
                                  step={1}
                                  value={tempSynthSeed}
                                  onChange={(event) =>
                                    setTempSynthSeed(Number(event.target.value))
                                  }
                                  className="input input-bordered w-full mt-2"
                                />
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-auto">
                      <div className="flex items-center gap-2 text-xs text-base-content/60">
                        <span className="w-2 h-2 rounded-full bg-success/70"></span>
                        {canTrain ? "Ready for training" : "Training not available"}
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
                <div className="col-span-12 bg-base-200 rounded-xl shadow-lg border-2 border-primary/70 min-h-20 flex flex-col">
                  <ConsoleSection value={consoleText} />
                </div>
              </div>
            </div>

            <div className="col-span-12 xl:col-span-6 bg-base-200 p-4 rounded-xl shadow-lg border-2 border-primary/70 flex flex-col">
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                {modelType === "temp-detector" ? (
                  <div className="rounded-lg border border-primary/20 bg-base-300/60 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">
                          Temporary Detector Status
                        </div>
                        <div className="text-xs text-base-content/60">
                          Tracks stored batches and model readiness.
                        </div>
                      </div>
                      <div className="text-xs text-base-content/60">
                        Last run: {tempMetrics.lastRun}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Total</div>
                        <div className="text-sm font-semibold">{tempMetrics.total}</div>
                      </div>
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Kept</div>
                        <div className="text-sm font-semibold">{tempMetrics.kept}</div>
                      </div>
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Quarantined</div>
                        <div className="text-sm font-semibold">
                          {tempMetrics.quarantined}
                        </div>
                      </div>
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Rejected</div>
                        <div className="text-sm font-semibold">
                          {tempMetrics.rejected}
                        </div>
                      </div>
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Baselines</div>
                        <div className="text-sm font-semibold">
                          {tempMetrics.baselines}
                        </div>
                      </div>
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Status</div>
                        <div className={`text-sm font-semibold ${tempStatusTone}`}>
                          {tempMetrics.status}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-base-content/60">
                      Model version: {tempMetrics.version}
                    </div>
                  </div>
                ) : (
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
                )}
                <div className="flex-1 min-h-0 border border-primary/20 rounded-lg bg-base-300/40">
                  {modelType === "category" ? (
                    <CategoryModelVectorSpace points={points} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-base-content/50">
                      Visualization not available.
                    </div>
                  )}
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
