import { useState } from "react";
import Modal from "../components/modals/Modal";
import InputSection from "../components/sections/InputSection";
import ConsoleSection from "../components/sections/ConsoleSection";
import ChartSection from "../components/sections/ChartSection";
import WindowTabs from "../components/tabs/WindowTabs";
import NormalTabs from "../components/tabs/NormalTabs";
import Accordian from "../components/accordian/Accordian";
import AnomalyDistribution from "../components/charts/temp-detector/AnomalyDistribution";
import SimilarityScatter from "../components/charts/temp-detector/SimilarityScatter";
import HeuristicRadar from "../components/charts/temp-detector/HeuristicRadar";
import {
  getTempTemplate,
  scoreTempDetectorBatches,
} from "../services/api-services";
import { formatJson, tryParseJson } from "../utils/json";
import { appendConsole, demoDelay } from "../utils/demo";

import { TemporaryUserDetectorDefaultPayload } from "../constants";

function TemporaryUserDetector() {
  const [inputText, setInputText] = useState(
    formatJson(TemporaryUserDetectorDefaultPayload)
  );
  const [keptItems, setKeptItems] = useState([]);
  const [quarantinedItems, setQuarantinedItems] = useState([]);
  const [rejectedItems, setRejectedItems] = useState([]);
  const [scoreSummary, setScoreSummary] = useState(null);
  const [consoleText, setConsoleText] = useState("Ready.");
  const [isLoading, setIsLoading] = useState(false);
  const [templateUserId, setTemplateUserId] = useState("u_001");
  const [templateResult, setTemplateResult] = useState(null);

  const handleSubmit = async () => {
    const parsed = tryParseJson(inputText);
    if (!parsed.ok) {
      setConsoleText(`Invalid JSON: ${parsed.error.message}`);
      return;
    }

    setIsLoading(true);
    setConsoleText("");
    appendConsole(setConsoleText, "Normalizing interaction batches...");
    await demoDelay();
    appendConsole(setConsoleText, "Scoring batches via /temp-detector/score-batches...");
    await demoDelay();

    try {
      let payload = parsed.value;
      if (Array.isArray(payload)) {
        payload = { batches: payload };
      } else if (payload && payload.user_id && payload.batch_id) {
        payload = { batches: [payload] };
      }

      const response = await scoreTempDetectorBatches(payload);
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
      appendConsole(setConsoleText, "Fetching live user template...");
      await demoDelay();
      if (userId) {
        const template = await getTempTemplate(userId);
        setTemplateResult(template);
      }
      const summary = response?.summary;
      appendConsole(
        setConsoleText,
        summary
          ? `Batches scored. Kept ${summary.kept}, Quarantined ${summary.quarantined}, Rejected ${summary.rejected}.`
          : "Batches scored."
      );
    } catch (error) {
      setKeptItems([]);
      setQuarantinedItems([]);
      setRejectedItems([]);
      setScoreSummary(null);
      appendConsole(
        setConsoleText,
        `Request failed: ${error.message}${
          error.data ? ` | ${formatJson(error.data)}` : ""
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchTemplate = async () => {
    const userId = String(templateUserId || "").trim();
    if (!userId) {
      appendConsole(setConsoleText, "Template fetch failed: user_id is required.");
      return;
    }
    setIsLoading(true);
    try {
      appendConsole(setConsoleText, `Fetching template for user_id=${userId}...`);
      const response = await getTempTemplate(userId);
      setTemplateResult(response);
      appendConsole(
        setConsoleText,
        response?.template_found
          ? `Template found for ${userId} (count=${response.count}).`
          : `No template found for ${userId}.`
      );
      if (response) {
        setTimeout(() => {
          document.getElementById("user-template-modal")?.showModal();
        }, 50);
      }
    } catch (error) {
      setTemplateResult(null);
      appendConsole(
        setConsoleText,
        `Template fetch request failed: ${error.message}${
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
      subtitle: `Anomaly: ${formatScore(
        item.anomaly_score
      )} | Similarity: ${formatScore(item.similarity_score)}`,
      content: (
        <pre className="whitespace-pre-wrap text-xs font-mono">
          {formatJson(item.batch || {})}
        </pre>
      ),
    }));

  const allItems = [...keptItems, ...quarantinedItems, ...rejectedItems];

  const tabs = [
    {
      key: "legit",
      label: "Legit Batches (Primary User)",
      content: (
        <Accordian name="legit-batches" items={toAccordianItems(keptItems)} />
      ),
    },
    {
      key: "quarantined",
      label: "Quarantined Batches (Ambiguous)",
      content: (
        <Accordian
          name="quarantined-batches"
          items={toAccordianItems(quarantinedItems)}
        />
      ),
    },
    {
      key: "rejected",
      label: "Rejected Batches (Temporary User)",
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
        <div className="w-full h-full overflow-hidden">
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
        <div className="w-full h-full overflow-hidden">
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
        <div className="w-full h-full overflow-hidden">
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
        <WindowTabs tabs={tabs} contentClassName="overflow-auto" />
      ),
    },
    {
      key: "charts",
      label: "Charts",
      content: (
        <WindowTabs tabs={charts} contentClassName="overflow-auto" />
      ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-8xl mx-auto">
          <div className="grid h-full min-h-0 grid-cols-12 gap-3">
            {/* Left Column: Actions & Sandboxes (2 cards now!) */}
            <div className="col-span-12 xl:col-span-4 flex xl:h-full flex-col gap-3 min-w-0">
              <div className="flex-1 bg-base-200/50 rounded-lg shadow border border-primary flex flex-col transition-all duration-300 min-w-0 overflow-hidden">
                <InputSection
                  title="Interaction Batches"
                  value={inputText}
                  onChange={setInputText}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                />
              </div>
              <div className="bg-base-200 rounded-lg shadow border-2 border-primary/70 p-4 flex-none">
                <h3 className="font-semibold text-sm mb-3">Live User Template</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3.5 items-center justify-center">
                  <input
                    className="input input-bordered w-full"
                    placeholder="user_id"
                    value={templateUserId}
                    onChange={(event) => setTemplateUserId(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm flex-1"
                      disabled={isLoading}
                      onClick={handleFetchTemplate}
                    >
                      Fetch
                    </button>
                    <Modal
                      id="user-template-modal"
                      title={`Live User Template: ${templateUserId}`}
                      triggerLabel="View"
                      triggerClassName={
                        templateResult
                          ? "btn btn-outline btn-sm btn-primary px-3"
                          : "hidden"
                      }
                      boxClassName="modal-box max-w-2xl bg-base-200 border border-primary rounded-xl p-5 shadow-2xl"
                    >
                      <pre className="block w-full max-w-full overflow-auto whitespace-pre text-xs font-mono bg-base-100 p-3 rounded-lg border border-base-content/30 max-h-[60vh] text-base-content/95 shadow-inner mt-2">
                        {templateResult ? formatJson(templateResult) : "No template fetched."}
                      </pre>
                    </Modal>
                  </div>
                </div>
                  <div className="text-xs text-base-content/60 leading-relaxed text-center italic">
                    Template updates automatically after kept batches. Fetch to view.
                  </div>
                </div>
              </div>

            {/* Right Column: Visual Outputs, Lists & Console logs (Tab + Console!) */}
            <div className="col-span-12 xl:col-span-8 max-h-[90vh] overflow-auto bg-base-200/50 p-4 rounded-lg shadow border border-primary flex flex-col min-h-0 transition-all duration-300 min-w-0 overflow-hidden gap-3">
              <div className="flex-1 flex flex-col min-h-0">
                <NormalTabs tabs={normalTabsContent} className="h-full" contentClassName="max-h-[48vh] overflow-auto mt-2" />
              </div>
              <div className="bg-base-200/50 rounded-lg shadow border border-primary min-h-[160px] max-h-[220px] flex flex-col min-w-0 overflow-hidden">
                <ConsoleSection value={consoleText} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemporaryUserDetector;
