import { useEffect, useState } from "react";
import InputSection from "../components/sections/InputSection";
import OutputSection from "../components/sections/OutputSection";
import ConsoleSection from "../components/sections/ConsoleSection";
import ChartSection from "../components/sections/ChartSection";
import CategoryNearestNeighbor from "../components/charts/category-engine/CategoryNearestNeighbor";
import {
  generateCategoryProfile,
  getCategoryVectorSpace,
} from "../services/api-services";
import { formatJson, tryParseJson } from "../utils/json";
import { appendConsole, demoDelay } from "../utils/demo";
import { appendStateMachineTraces } from "../utils/traces";

import { CategoryEngineDefaultPayload } from "../constants";

const formatMetric = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(4)
    : "n/a";

export default function CategoryEngine() {
  const [inputText, setInputText] = useState(formatJson(CategoryEngineDefaultPayload));
  const [outputText, setOutputText] = useState("");
  const [consoleText, setConsoleText] = useState("Ready.");
  const [isLoading, setIsLoading] = useState(false);
  const [vectorPoints, setVectorPoints] = useState([]);
  const [neighborIndices, setNeighborIndices] = useState([]);
  const [neighborDistances, setNeighborDistances] = useState([]);
  const [vectorStatus, setVectorStatus] = useState("Idle");

  useEffect(() => {
    let active = true;

    const loadVectorSpace = async () => {
      setVectorStatus("Loading");
      try {
        const response = await getCategoryVectorSpace();
        if (!active) return;
        setVectorPoints(response?.points_2d ?? []);
        setVectorStatus(response?.points_2d?.length ? "Ready" : "Empty");
      } catch (error) {
        if (!active) return;
        setVectorStatus("Failed");
      }
    };

    loadVectorSpace();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async () => {
    const parsed = tryParseJson(inputText);
    if (!parsed.ok) {
      setConsoleText(`Invalid JSON: ${parsed.error.message}`);
      return;
    }

    setIsLoading(true);
    setConsoleText("");
    appendConsole(setConsoleText, "Validating onboarding payload...");
    await demoDelay();
    appendConsole(
      setConsoleText,
      "Sending onboarding payload to /category/generate-profile..."
    );
    await demoDelay();

    try {
      const response = await generateCategoryProfile(parsed.value);
      setOutputText(formatJson(response));
      const nnDistance = response?.quality?.nearest_neighbor_distance;
      const nnSimilarity = response?.quality?.nearest_neighbor_similarity;
      setNeighborIndices(response?.quality?.neighbor_indices ?? []);
      setNeighborDistances(response?.quality?.neighbor_distances ?? []);
      appendConsole(
        setConsoleText,
        `Profile generated. Traces: ${response?.traces?.length ?? 0}. ` +
          `NN distance: ${formatMetric(nnDistance)}. ` +
          `NN similarity: ${formatMetric(nnSimilarity)}.`
      );
      appendStateMachineTraces(setConsoleText, response?.traces);
    } catch (error) {
      setOutputText("");
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

  const handleCopy = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      appendConsole(setConsoleText, "Output copied to clipboard.");
    } catch (error) {
      appendConsole(setConsoleText, `Copy failed: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1">
        <div className="max-w-8xl mx-auto">
          <div className="grid h-[calc(100vh-13rem)] grid-cols-12 gap-3">
            <div className="col-span-12 xl:col-span-8 flex min-h-0 flex-col gap-3">
              <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
                <div className="col-span-12 xl:col-span-6 bg-base-200 rounded-lg shadow border-2 border-primary/70 flex min-h-90 flex-col">
                  <InputSection
                    title="Onboarding Input"
                    value={inputText}
                    onChange={setInputText}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                  />
                </div>

                <div className="col-span-12 xl:col-span-6 bg-base-200 rounded-lg shadow border-2 border-primary/70 flex min-h-90 flex-col">
                  <OutputSection value={outputText} onCopy={handleCopy} />
                </div>
              </div>

              <div className="bg-base-200 rounded-lg shadow border-2 border-primary/70 min-h-40 flex flex-col shrink-0">
                <ConsoleSection value={consoleText} />
              </div>
            </div>

            <div className="col-span-12 xl:col-span-4 bg-base-200 p-4 rounded-lg shadow border-2 border-primary/70 flex flex-col">
              <ChartSection
                title="Category Vector Space"
                subtitle={`UMAP projection with neighbor highlights (${vectorStatus}).`}
              >
                <CategoryNearestNeighbor
                  points={vectorPoints}
                  neighborIndices={neighborIndices}
                  neighborDistances={neighborDistances}
                />
              </ChartSection>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
