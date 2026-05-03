import { useEffect, useMemo, useState } from "react";
import ConsoleSection from "../components/sections/ConsoleSection";
import CategoryModelVectorSpace from "../components/charts/category-engine/CategoryModelVectorSpace";
import {
  getCategoryVectorSpace3d,
  getDashboardStatus,
  getTempDetectorForest,
  getTempDetectorStatus,
  getUserClusterMap,
  trainCategoryWithCsv,
  trainCategoryWithSynth,
  trainTempDetectorSynth,
  trainUserSeqModel,
} from "../services/api-services";
import IsolationForestTrees from "../components/charts/temp-detector/IsolationForestTrees";
import UserSequenceClusterMap from "../components/charts/user-engine/UserSequenceClusterMap";
import Modal from "../components/modals/Modal";

function TrainModels() {
  const [modelType, setModelType] = useState("category");
  const [nSynth, setNSynth] = useState(400);
  const [categoryTrainMode, setCategoryTrainMode] = useState("csv");
  const [categoryCsvFile, setCategoryCsvFile] = useState(null);
  const [categoryAugment, setCategoryAugment] = useState(false);
  const [categoryAugmentCopies, setCategoryAugmentCopies] = useState(3);
  const [categoryAugmentNoise, setCategoryAugmentNoise] = useState(0.03);
  const [categoryAugmentSeed, setCategoryAugmentSeed] = useState(42);
  const [tempSynthSamples, setTempSynthSamples] = useState(400);
  const [tempSynthSeed, setTempSynthSeed] = useState(42);
  const [tempForest, setTempForest] = useState({ status: "idle", trees: [] });
  const [userOutcomes, setUserOutcomes] = useState("keep");
  const [userMinUsers, setUserMinUsers] = useState(5);
  const [userMinSequences, setUserMinSequences] = useState(20);
  const [userMinSeqLen, setUserMinSeqLen] = useState(2);
  const [userMaxSeqLen, setUserMaxSeqLen] = useState(20);
  const [userEmbeddingDim, setUserEmbeddingDim] = useState(16);
  const [userEpochs, setUserEpochs] = useState(30);
  const [userBatchSize, setUserBatchSize] = useState(16);
  const [userLearningRate, setUserLearningRate] = useState(0.001);
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
  const [userMetrics, setUserMetrics] = useState({
    status: "Idle",
    version: "--",
    users: 0,
    sequences: 0,
    lastRun: "--",
  });
  const [userClusterMap, setUserClusterMap] = useState({
    status: "idle",
    model_version: "v0",
    n_points: 0,
    n_clusters: 0,
    outcome_filter: [],
    points: [],
    clusters: [],
  });

  const categoryTrainingSample = {
    features: {
      vision_loss: 0.2,
      color_blindness: 0.1,
      delayed_reaction: 0.3,
      inaccurate_click: 0.2,
      motor_impairment: 0.34,
      literacy: 0.4,
    },
    profile: {
      font_size: 14,
      line_height: 1.73,
      contrast_mode: "normal",
      primary_color: "#1a73e8",
      primary_color_content: "#ffffff",
      secondary_color: "#1a73e8",
      secondary_color_content: "#ffffff",
      accent_color: "#e37400",
      accent_color_content: "#ffffff",
      theme: "light",
      element_spacing_x: 6,
      element_spacing_y: 3,
      element_padding_x: 8,
      element_padding_y: 8,
      reduced_motion: true,
      target_size: 29,
      tooltip_assist: true,
      layout_simplification: true,
    },
  };

  const canTrain =
    modelType === "category" ||
    modelType === "temp-detector" ||
    modelType === "user";

  const userOutcomesToList = (value) =>
    value === "all"
      ? []
      : value === "keep_quarantine"
      ? ["keep", "quarantine"]
      : ["keep"];

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
        const vectorSpace = await getCategoryVectorSpace3d();
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
      setTempForest({ status: "idle", trees: [] });
      return () => {
        cancelled = true;
      };
    }

    const loadStatus = async () => {
      setConsoleText("Loading temporary detector status...");
      try {
        const status = await getTempDetectorStatus();
        if (cancelled) return;
        setTempMetrics({
          status: status?.model_trained ? "Ready" : "Untrained",
          version: status?.model_version || "--",
          total: status?.baselines?.total_samples ?? 0,
          kept: 0,
          quarantined: 0,
          rejected: 0,
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

  useEffect(() => {
    let cancelled = false;
    if (modelType !== "user") {
      setUserMetrics((prev) => ({ ...prev, status: "Idle" }));
      setUserClusterMap({
        status: "idle",
        model_version: "v0",
        n_points: 0,
        n_clusters: 0,
        outcome_filter: [],
        points: [],
        clusters: [],
      });
      return () => {
        cancelled = true;
      };
    }

    const loadUserStatus = async () => {
      setConsoleText("Loading user engine status...");
      try {
        const status = await getDashboardStatus();
        const tempStatus = await getTempDetectorStatus();
        const outcomes = userOutcomesToList(userOutcomes);
        const clusterMap = await getUserClusterMap({
          minSequenceLen: userMinSeqLen,
          maxSequenceLen: userMaxSeqLen,
          outcomes,
        });
        if (cancelled) return;
        const version = status?.models?.user_seq_model_version || "v0";
        setUserMetrics({
          status: version !== "v0" ? "Ready" : "Untrained",
          version,
          users: tempStatus?.baselines?.users ?? 0,
          sequences: tempStatus?.baselines?.total_samples ?? 0,
          lastRun: new Date().toLocaleTimeString(),
        });
        setUserClusterMap(
          clusterMap || {
            status: "idle",
            model_version: "v0",
            n_points: 0,
            n_clusters: 0,
            outcome_filter: [],
            points: [],
            clusters: [],
          }
        );
        setConsoleText("User engine status loaded.");
      } catch (error) {
        if (cancelled) return;
        setUserMetrics((prev) => ({ ...prev, status: "Failed" }));
        setUserClusterMap((prev) => ({ ...prev, status: "failed" }));
        setConsoleText(
          `Load failed: ${error.message}${
            error.data ? ` | ${JSON.stringify(error.data)}` : ""
          }`
        );
      }
    };

    loadUserStatus();
    return () => {
      cancelled = true;
    };
  }, [modelType, userOutcomes, userMinSeqLen, userMaxSeqLen]);

  useEffect(() => {
    let cancelled = false;
    if (modelType !== "temp-detector") {
      return () => {
        cancelled = true;
      };
    }

    const loadForest = async () => {
      try {
        const forest = await getTempDetectorForest(12);
        if (cancelled) return;
        setTempForest(forest || { status: "idle", trees: [] });
      } catch (error) {
        if (cancelled) return;
        setTempForest({ status: "failed", trees: [] });
      }
    };

    loadForest();
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
      setConsoleText(
        categoryTrainMode === "csv"
          ? "Training Category Engine (CSV upload)..."
          : "Training Category Engine (synthetic data)..."
      );
      setMetrics((prev) => ({ ...prev, status: "Training..." }));
    } else if (modelType === "user") {
      setConsoleText("Training User Engine (sequence autoencoder)...");
      setUserMetrics((prev) => ({ ...prev, status: "Training..." }));
    } else {
      setConsoleText("Training Temporary User Detector from synthetic data...");
      setTempMetrics((prev) => ({ ...prev, status: "Training..." }));
    }

    try {
      if (modelType === "category") {
        let response = null;
        if (categoryTrainMode === "csv") {
          if (!categoryCsvFile) {
            setConsoleText("Select a CSV file before training.");
            setMetrics((prev) => ({ ...prev, status: "Failed" }));
            return;
          }
          const formData = new FormData();
          formData.append("file", categoryCsvFile);
          formData.append("augment", String(categoryAugment));
          formData.append("copies_per_row", String(categoryAugmentCopies));
          formData.append("noise_std", String(categoryAugmentNoise));
          formData.append("seed", String(categoryAugmentSeed));
          response = await trainCategoryWithCsv(formData);
        } else {
          response = await trainCategoryWithSynth(nSynth);
        }
        const vectorSpace = await getCategoryVectorSpace3d();
        setPoints(vectorSpace?.points || []);
        setMetrics({
          samples: response?.n_samples ?? vectorSpace?.points?.length ?? 0,
          features: vectorSpace?.feature_order?.length ?? 0,
          status: "Trained",
          lastRun: new Date().toLocaleTimeString(),
        });
        const sampleSummary =
          response?.source === "csv" && response?.augmentation?.enabled
            ? `Original: ${response?.original_samples ?? 0}, augmented: ${
                response?.augmented_samples ?? 0
              }, total: ${response?.n_samples ?? 0}.`
            : `Samples: ${response?.n_samples ?? nSynth}.`;
        setConsoleText(
          `Training complete. ${sampleSummary}`
        );
      } else if (modelType === "temp-detector") {
        const response = await trainTempDetectorSynth({
          n_samples: tempSynthSamples,
          seed: tempSynthSeed,
        });
        const status = await getTempDetectorStatus();
        const forest = await getTempDetectorForest(12);
        setTempMetrics({
          status:
            response?.status === "trained" ? "Trained" : "Not enough data",
          version: status?.model_version || "--",
          total: status?.baselines?.total_samples ?? 0,
          kept: 0,
          quarantined: 0,
          rejected: 0,
          baselines: status?.baselines?.users ?? 0,
          lastRun: new Date().toLocaleTimeString(),
        });
        setTempForest(forest || { status: "idle", trees: [] });
        setConsoleText(
          response?.status === "trained"
            ? `Training complete. Samples: ${response?.n_samples ?? 0}.`
            : `Not enough samples to train (${response?.n_samples ?? 0}).`
        );
      } else if (modelType === "user") {
        const outcomes = userOutcomesToList(userOutcomes);
        const response = await trainUserSeqModel({
          outcomes,
          min_users: userMinUsers,
          min_sequences: userMinSequences,
          min_sequence_len: userMinSeqLen,
          max_sequence_len: userMaxSeqLen,
          embedding_dim: userEmbeddingDim,
          epochs: userEpochs,
          learning_rate: userLearningRate,
          batch_size: userBatchSize,
        });
        const status = await getDashboardStatus();
        const tempStatus = await getTempDetectorStatus();
        const clusterMap = await getUserClusterMap({
          minSequenceLen: userMinSeqLen,
          maxSequenceLen: userMaxSeqLen,
          outcomes,
        });
        const version = status?.models?.user_seq_model_version || "v0";
        setUserMetrics({
          status:
            response?.status === "trained" ? "Trained" : "Not enough data",
          version,
          users: tempStatus?.baselines?.users ?? 0,
          sequences: tempStatus?.baselines?.total_samples ?? 0,
          lastRun: new Date().toLocaleTimeString(),
        });
        setUserClusterMap(
          clusterMap || {
            status: "idle",
            model_version: "v0",
            n_points: 0,
            n_clusters: 0,
            outcome_filter: [],
            points: [],
            clusters: [],
          }
        );
        setConsoleText(
          response?.status === "trained"
            ? `Training complete. Sequences: ${response?.n_sequences ?? 0}.`
            : `Not enough sequences to train (${response?.n_sequences ?? 0}).`
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
      } else if (modelType === "user") {
        setUserMetrics((prev) => ({ ...prev, status: "Failed" }));
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

  const userStatusTone = useMemo(() => {
    if (userMetrics.status === "Training...") return "text-warning";
    if (userMetrics.status === "Trained") return "text-success";
    if (userMetrics.status === "Failed") return "text-error";
    if (userMetrics.status === "Untrained") return "text-warning";
    return "text-base-content/70";
  }, [userMetrics.status]);

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
                        <div className="text-xs text-base-content/60">
                          Model Type
                        </div>
                        <select
                          className="select select-bordered w-full mt-2"
                          value={modelType}
                          onChange={(event) => setModelType(event.target.value)}
                        >
                          <option value="category">Category Engine</option>
                          <option value="user">User Engine</option>
                          <option value="temp-detector">
                            Temporary User Detector
                          </option>
                        </select>
                      </div>

                      {modelType === "category" ? (
                        <div className="rounded-lg border border-primary/30 bg-base-300/60 p-3">
                          <div className="text-xs text-base-content/60">
                            Training Source
                          </div>
                          <select
                            className="select select-bordered w-full mt-2"
                            value={categoryTrainMode}
                            onChange={(event) =>
                              setCategoryTrainMode(event.target.value)
                            }
                          >
                            <option value="synth">Synthetic data</option>
                            <option value="csv">CSV upload</option>
                          </select>
                          {categoryTrainMode === "synth" ? (
                            <>
                              <div className="text-xs text-base-content/60 mt-3">
                                Synthetic Samples
                              </div>
                              <input
                                type="number"
                                min={50}
                                max={2000}
                                step={50}
                                value={nSynth}
                                onChange={(event) =>
                                  setNSynth(Number(event.target.value))
                                }
                                className="input input-bordered w-full mt-2"
                              />
                              <div className="mt-2 text-[11px] text-base-content/50">
                                Uses synthetic data for now. CSV upload is also
                                supported.
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-xs text-base-content/60 mt-3">
                                CSV File
                              </div>
                              <input
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(event) =>
                                  setCategoryCsvFile(
                                    event.target.files?.[0] || null
                                  )
                                }
                                className="file-input file-input-bordered w-full mt-2"
                              />
                              <div className="mt-2 text-[11px] text-base-content/50">
                                Required columns: vision_loss, color_blindness,
                                delayed_reaction, inaccurate_click, motor_impairment, literacy,
                                font_size, line_height, contrast_mode,
                                primary_color, primary_color_content,
                                secondary_color, secondary_color_content,
                                accent_color, accent_color_content, theme,
                                element_spacing_x, element_spacing_y,
                                element_padding_x, element_padding_y,
                                reduced_motion, target_size, tooltip_assist,
                                layout_simplification.
                              </div>
                              <label className="mt-3 flex items-start gap-2 text-xs text-base-content/70">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  checked={categoryAugment}
                                  onChange={(event) =>
                                    setCategoryAugment(event.target.checked)
                                  }
                                />
                                <span>
                                  Add controlled augmentation for real CSV rows
                                  by perturbing only the six probability
                                  features.
                                </span>
                              </label>
                              {categoryAugment ? (
                                <div className="mt-3 grid grid-cols-3 gap-3">
                                  <div>
                                    <div className="text-xs text-base-content/60">
                                      Copies / Row
                                    </div>
                                    <input
                                      type="number"
                                      min={1}
                                      max={20}
                                      step={1}
                                      value={categoryAugmentCopies}
                                      onChange={(event) =>
                                        setCategoryAugmentCopies(
                                          Number(event.target.value)
                                        )
                                      }
                                      className="input input-bordered w-full mt-2"
                                    />
                                  </div>
                                  <div>
                                    <div className="text-xs text-base-content/60">
                                      Noise Std
                                    </div>
                                    <input
                                      type="number"
                                      min={0.005}
                                      max={0.2}
                                      step={0.005}
                                      value={categoryAugmentNoise}
                                      onChange={(event) =>
                                        setCategoryAugmentNoise(
                                          Number(event.target.value)
                                        )
                                      }
                                      className="input input-bordered w-full mt-2"
                                    />
                                  </div>
                                  <div>
                                    <div className="text-xs text-base-content/60">
                                      Seed
                                    </div>
                                    <input
                                      type="number"
                                      min={0}
                                      max={9999}
                                      step={1}
                                      value={categoryAugmentSeed}
                                      onChange={(event) =>
                                        setCategoryAugmentSeed(
                                          Number(event.target.value)
                                        )
                                      }
                                      className="input input-bordered w-full mt-2"
                                    />
                                  </div>
                                </div>
                              ) : null}
                              <div className="mt-2 text-[11px] text-base-content/50">
                                Recommended starting point: 3 copies per row
                                with 0.03 noise. Avoid high noise unless labels
                                still remain valid for nearby users.
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}

                      {modelType === "temp-detector" ? (
                        <div className="rounded-lg border border-primary/30 bg-base-300/60 p-3 flex flex-col gap-3">
                          <div className="text-xs text-base-content/60">
                            Template-only mode: training uses synthetic samples.
                          </div>
                          <div>
                            <div className="text-xs text-base-content/60">
                              Synthetic Samples
                            </div>
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
                            <div className="text-xs text-base-content/60">
                              Seed
                            </div>
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
                        </div>
                      ) : null}
                      {modelType === "user" ? (
                        <div className="rounded-lg border border-primary/30 bg-base-300/60 p-3 flex flex-col gap-3">
                          <div>
                            <div className="text-xs text-base-content/60">
                              Training Mode
                            </div>
                            <select
                              className="select select-bordered w-full mt-2"
                              value={userOutcomes}
                              onChange={(event) =>
                                setUserOutcomes(event.target.value)
                              }
                            >
                              <option value="keep">Kept batches</option>
                              <option value="keep_quarantine">
                                Keep + Quarantine
                              </option>
                              <option value="all">All outcomes</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs text-base-content/60">
                                Min Users
                              </div>
                              <input
                                type="number"
                                min={1}
                                max={500}
                                step={1}
                                value={userMinUsers}
                                onChange={(event) =>
                                  setUserMinUsers(Number(event.target.value))
                                }
                                className="input input-bordered w-full mt-2"
                              />
                            </div>
                            <div>
                              <div className="text-xs text-base-content/60">
                                Min Sequences
                              </div>
                              <input
                                type="number"
                                min={5}
                                max={1000}
                                step={1}
                                value={userMinSequences}
                                onChange={(event) =>
                                  setUserMinSequences(Number(event.target.value))
                                }
                                className="input input-bordered w-full mt-2"
                              />
                            </div>
                            <div>
                              <div className="text-xs text-base-content/60">
                                Min Seq Length
                              </div>
                              <input
                                type="number"
                                min={2}
                                max={50}
                                step={1}
                                value={userMinSeqLen}
                                onChange={(event) =>
                                  setUserMinSeqLen(Number(event.target.value))
                                }
                                className="input input-bordered w-full mt-2"
                              />
                            </div>
                            <div>
                              <div className="text-xs text-base-content/60">
                                Max Seq Length
                              </div>
                              <input
                                type="number"
                                min={5}
                                max={200}
                                step={1}
                                value={userMaxSeqLen}
                                onChange={(event) =>
                                  setUserMaxSeqLen(Number(event.target.value))
                                }
                                className="input input-bordered w-full mt-2"
                              />
                            </div>
                            <div>
                              <div className="text-xs text-base-content/60">
                                Embedding Dim
                              </div>
                              <input
                                type="number"
                                min={4}
                                max={128}
                                step={1}
                                value={userEmbeddingDim}
                                onChange={(event) =>
                                  setUserEmbeddingDim(
                                    Number(event.target.value)
                                  )
                                }
                                className="input input-bordered w-full mt-2"
                              />
                            </div>
                            <div>
                              <div className="text-xs text-base-content/60">
                                Epochs
                              </div>
                              <input
                                type="number"
                                min={5}
                                max={200}
                                step={5}
                                value={userEpochs}
                                onChange={(event) =>
                                  setUserEpochs(Number(event.target.value))
                                }
                                className="input input-bordered w-full mt-2"
                              />
                            </div>
                            <div>
                              <div className="text-xs text-base-content/60">
                                Batch Size
                              </div>
                              <input
                                type="number"
                                min={4}
                                max={256}
                                step={1}
                                value={userBatchSize}
                                onChange={(event) =>
                                  setUserBatchSize(Number(event.target.value))
                                }
                                className="input input-bordered w-full mt-2"
                              />
                            </div>
                            <div>
                              <div className="text-xs text-base-content/60">
                                Learning Rate
                              </div>
                              <input
                                type="number"
                                min={0.0001}
                                max={0.01}
                                step={0.0001}
                                value={userLearningRate}
                                onChange={(event) =>
                                  setUserLearningRate(
                                    Number(event.target.value)
                                  )
                                }
                                className="input input-bordered w-full mt-2"
                              />
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-auto">
                      <div className="flex items-center gap-2 text-xs text-base-content/60">
                        <span className="w-2 h-2 rounded-full bg-success/70"></span>
                        {canTrain
                          ? "Ready for training"
                          : "Training not available"}
                      </div>
                      <div className="flex items-center gap-2">
                        {modelType === "category" ? (
                          <Modal
                            title="Category Training Data Structure"
                            triggerLabel="Show Training Data Structure"
                            triggerClassName="btn btn-ghost btn-sm"
                          >
                            <div className="text-xs text-base-content/60">
                              One training row combines the impairment features with
                              the expected profile output.
                            </div>
                            <pre className="mt-3 p-3 rounded-lg bg-base-200 text-xs font-mono whitespace-pre-wrap">
                              {JSON.stringify(categoryTrainingSample, null, 2)}
                            </pre>
                          </Modal>
                        ) : null}
                        <button
                          className="btn btn-primary shadow"
                          onClick={handleTrain}
                          disabled={isTraining}
                        >
                          {isTraining ? (
                            <span className="loading loading-spinner loading-sm"></span>
                          ) : (
                            "Train Model"
                          )}
                        </button>
                      </div>
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
                          Tracks live template stats and model readiness.
                        </div>
                      </div>
                      <div className="text-xs text-base-content/60">
                        Last run: {tempMetrics.lastRun}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Template Samples</div>
                        <div className="text-sm font-semibold">
                          {tempMetrics.total}
                        </div>
                      </div>
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Template Users</div>
                        <div className="text-sm font-semibold">
                          {tempMetrics.baselines}
                        </div>
                      </div>
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Status</div>
                        <div
                          className={`text-sm font-semibold ${tempStatusTone}`}
                        >
                          {tempMetrics.status}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-base-content/60">
                      Model version: {tempMetrics.version}
                    </div>
                  </div>
                ) : modelType === "user" ? (
                  <div className="rounded-lg border border-primary/20 bg-base-300/60 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">
                          User Engine Status
                        </div>
                        <div className="text-xs text-base-content/60">
                          Sequence model readiness and data coverage.
                        </div>
                      </div>
                      <div className="text-xs text-base-content/60">
                        Last run: {userMetrics.lastRun}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Users</div>
                        <div className="text-sm font-semibold">
                          {userMetrics.users}
                        </div>
                      </div>
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Sequences</div>
                        <div className="text-sm font-semibold">
                          {userMetrics.sequences}
                        </div>
                      </div>
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Status</div>
                        <div
                          className={`text-sm font-semibold ${userStatusTone}`}
                        >
                          {userMetrics.status}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-base-content/60">
                      Model version: {userMetrics.version}
                    </div>
                    <div className="mt-1 text-xs text-base-content/60">
                      Visualization: {userClusterMap.n_points} sequences across{" "}
                      {userClusterMap.n_clusters} clusters
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
                        <div className="text-sm font-semibold">
                          {metrics.samples}
                        </div>
                      </div>
                      <div className="rounded-md bg-base-200 p-2 border border-primary/10">
                        <div className="text-base-content/60">Features</div>
                        <div className="text-sm font-semibold">
                          {metrics.features}
                        </div>
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
                    <div className="h-full min-h-[50vh]">
                      <CategoryModelVectorSpace points={points} />
                    </div>
                  ) : modelType === "temp-detector" ? (
                    <div className="max-h-[40vh] overflow-auto h-full">
                      <IsolationForestTrees
                        trees={tempForest?.trees || []}
                        maxDepth={12}
                      />
                    </div>
                  ) : modelType === "user" ? (
                    <div className="h-full min-h-[50vh]">
                      {userClusterMap.status === "ready" &&
                      (userClusterMap.points?.length ?? 0) > 0 ? (
                        <UserSequenceClusterMap mapData={userClusterMap} />
                      ) : (
                        <div className="h-full flex items-center justify-center text-base-content/50">
                          {userClusterMap.status === "failed"
                            ? "Failed to load user sequence visualization."
                            : userClusterMap.status === "untrained"
                            ? "Train User Engine first to unlock sequence cluster map."
                            : "No user sequences available for current filter."}
                        </div>
                      )}
                    </div>
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
