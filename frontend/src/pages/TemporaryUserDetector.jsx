import { useState } from "react";
import InputSection from "../components/sections/InputSection";
import ConsoleSection from "../components/sections/ConsoleSection";
import ChartSection from "../components/sections/ChartSection";
import WindowTabs from "../components/tabs/WindowTabs";
import NormalTabs from "../components/tabs/NormalTabs";
import Accordian from "../components/accordian/Accordian";
import AnomalyDistribution from "../components/charts/temp-detector/AnomalyDistribution";
import SimilarityScatter from "../components/charts/temp-detector/SimilarityScatter";
import HeuristicRadar from "../components/charts/temp-detector/HeuristicRadar";
import { getJson, postJson } from "../api/MLPEClient";
import { formatJson, tryParseJson } from "../utils/json";

import { TemporaryUserDetectorDefaultPayload } from "../constants";

function TemporaryUserDetector() {
  const [inputText, setInputText] = useState(
    formatJson(TemporaryUserDetectorDefaultPayload)
  );
  const [keptItems, setKeptItems] = useState([]);
  const [quarantinedItems, setQuarantinedItems] = useState([]);
  const [rejectedItems, setRejectedItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [scoreSummary, setScoreSummary] = useState(null);
  const [consoleText, setConsoleText] = useState("Ready.");
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = async (userId) => {
    const response = await getJson(
      userId ? `/temp-detector/history?user_id=${userId}` : "/temp-detector/history"
    );
    setHistoryItems(response?.items || []);
  };

  const handleSubmit = async () => {
    const parsed = tryParseJson(inputText);
    if (!parsed.ok) {
      setConsoleText(`Invalid JSON: ${parsed.error.message}`);
      return;
    }

    setIsLoading(true);
    setConsoleText("Scoring batches via /temp-detector/score-batches...");

    try {
      let payload = parsed.value;
      if (Array.isArray(payload)) {
        payload = { batches: payload };
      } else if (payload && payload.user_id && payload.batch_id) {
        payload = { batches: [payload] };
      }

      const response = await postJson("/temp-detector/score-batches", payload);
      setKeptItems(response?.kept || []);
      setQuarantinedItems(response?.quarantined || []);
      setRejectedItems(response?.rejected || []);
      setScoreSummary(response?.summary || null);
      const userId =
        payload?.batches?.[0]?.user_id ||
        payload?.user_id ||
        response?.kept?.[0]?.user_id ||
        response?.quarantined?.[0]?.user_id ||
        response?.rejected?.[0]?.user_id;
      await fetchHistory(userId);
      const summary = response?.summary;
      setConsoleText(
        summary
          ? `Batches scored. Kept ${summary.kept}, Quarantined ${summary.quarantined}, Rejected ${summary.rejected}.`
          : "Batches scored."
      );
    } catch (error) {
      setKeptItems([]);
      setQuarantinedItems([]);
      setRejectedItems([]);
      setHistoryItems([]);
      setScoreSummary(null);
      setConsoleText(
        `Request failed: ${error.message}${
          error.data ? ` | ${formatJson(error.data)}` : ""
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatScore = (value) =>
    typeof value === "number" ? value.toFixed(3) : "n/a";

  const toAccordianItems = (items) =>
    items.map((item) => ({
      key: item.batch_id,
      title: `${item.batch_id} | ${item.outcome || "unknown"}`,
      subtitle: `Anomaly: ${formatScore(item.anomaly_score)} | Similarity: ${formatScore(
        item.similarity_score
      )}`,
      content: (
        <pre className="whitespace-pre-wrap text-xs font-mono">
          {formatJson(item.batch || {})}
        </pre>
      ),
    }));

  const allItems =
    historyItems.length > 0
      ? historyItems
      : [...keptItems, ...quarantinedItems, ...rejectedItems];

  const tabs = [
    {
      key: "legit",
      label: "Legit Batches",
      content: (
        <Accordian name="legit-batches" items={toAccordianItems(keptItems)} />
      ),
    },
    {
      key: "quarantined",
      label: "Quarantined Batches",
      content: (
        <Accordian
          name="quarantined-batches"
          items={toAccordianItems(quarantinedItems)}
        />
      ),
    },
    {
      key: "rejected",
      label: "Rejected Batches",
      content: (
        <Accordian
          name="rejected-batches"
          items={toAccordianItems(rejectedItems)}
        />
      ),
    },
  ];

  const charts = [
    {
      key: "anomaly-distribution",
      label: "Anomaly Distribution",
      content: (
        <div className="w-full h-72 overflow-hidden">
          <ChartSection
            subtitle="Histogram with quarantine/reject thresholds"
            contentClassName="h-full"
          >
            <AnomalyDistribution items={allItems} thresholds={scoreSummary} />
          </ChartSection>
        </div>
      ),
    },
    {
      key: "similarity-scatter",
      label: "Similarity vs Anomaly",
      description: "Scatter by outcome",
      content: (
        <div className="w-full h-72 overflow-hidden">
          <ChartSection
            subtitle="Similarity Score vs Anomaly Score"
            contentClassName="h-full"
          >
            <SimilarityScatter items={allItems} />
          </ChartSection>
        </div>
      ),
    },
    {
      key: "heuristic-radar",
      label: "Heuristic Radar",
      description: "Average component scores per outcome",
      content: (
        <div className="w-full h-72 overflow-hidden">
          <ChartSection
            subtitle="Heuristic Component Scores"
            contentClassName="h-full"
          >
            <HeuristicRadar items={allItems} />
          </ChartSection>
        </div>
      ),
    },
  ];

  const normalTabsContent = [
    {
      key: "summary",
      label: "Output Summary",
      content: (
        <div className="min-h-50">
          <WindowTabs tabs={tabs} contentClassName="max-h-95 overflow-auto"/>
        </div>
      ),
    },
    {
      key: "charts",
      label: "Charts",
      content: (
        <div className="min-h-50 h-full">
          <WindowTabs tabs={charts} contentClassName="h-full overflow-hidden" />
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-8xl mx-auto">
          <div className="grid h-full min-h-0 grid-cols-12 gap-3">
            <div className="col-span-12 xl:col-span-4 flex min-h-0 flex-col gap-3">
              <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
                <div className="col-span-12 bg-base-200 rounded-lg shadow border-2 border-primary/70 flex min-h-90 flex-col">
                  <InputSection
                    title="Interaction Batches"
                    value={inputText}
                    onChange={setInputText}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                  />
                </div>
                <div className="col-span-12 bg-base-200 rounded-lg shadow border-2 border-primary/70 min-h-40 flex flex-col">
                  <ConsoleSection value={consoleText} />
                </div>
              </div>
            </div>

            <div className="col-span-12 xl:col-span-8 bg-base-200 p-4 rounded-lg shadow border-2 border-primary/70 flex flex-col min-h-0">
              <NormalTabs
                tabs={normalTabsContent}
                className="h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemporaryUserDetector;
