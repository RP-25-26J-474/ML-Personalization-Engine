import { useState } from "react";
import InputSection from "../components/sections/InputSection";
import OutputSection from "../components/sections/OutputSection";
import ConsoleSection from "../components/sections/ConsoleSection";
import ChartSection from "../components/sections/ChartSection";
import ProfileDiffHistory from "../components/sections/ProfileDiffHistory";
import {
  getExternalInteractionBatches,
  getUserProfileDiffs,
  updateUserProfile,
  updateUserProfileBatch,
} from "../services/api-services";
import { formatJson, tryParseJson } from "../utils/json";
import { appendConsole } from "../utils/demo";
import { appendStateMachineTraces } from "../utils/traces";

import {
  UserEngineDefaultPayload,
  UserEngineBatchDefaultPayload,
} from "../constants";

export default function UserEngine() {
  const [mode, setMode] = useState("single");
  const [inputText, setInputText] = useState(
    formatJson(UserEngineDefaultPayload)
  );
  const [outputText, setOutputText] = useState("");
  const [consoleText, setConsoleText] = useState("Ready.");
  const [isLoading, setIsLoading] = useState(false);
  const [diffHistory, setDiffHistory] = useState([]);
  const [historyUserId, setHistoryUserId] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [fetchUserId, setFetchUserId] = useState("u_001");

  const normalizeBatchPayload = (response) => {
    if (Array.isArray(response)) {
      return { batches: response };
    }

    if (Array.isArray(response?.batches)) {
      return { batches: response.batches };
    }

    if (Array.isArray(response?.data)) {
      return { batches: response.data };
    }

    if (Array.isArray(response?.items)) {
      return { batches: response.items };
    }

    if (
      response &&
      typeof response === "object" &&
      response.user_id &&
      response.batch_id
    ) {
      return { batches: [response] };
    }

    return { batches: [] };
  };

  const extractUserId = (payload) => {
    if (!payload) return "";
    if (payload.user_id) return payload.user_id;
    if (Array.isArray(payload.batches) && payload.batches.length > 0) {
      return payload.batches[0]?.user_id || "";
    }
    return "";
  };

  const fetchHistory = async (userId) => {
    if (!userId) return;
    setIsHistoryLoading(true);
    try {
      const response = await getUserProfileDiffs(userId);
      setDiffHistory(Array.isArray(response) ? response : []);
      setHistoryUserId(userId);
    } catch (error) {
      setDiffHistory([]);
      appendConsole(
        setConsoleText,
        `History load failed: ${error.message}${
          error.data ? ` | ${formatJson(error.data)}` : ""
        }`
      );
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleFetchBatches = async () => {
    const userId = String(fetchUserId || "").trim();
    if (!userId) {
      appendConsole(setConsoleText, "Interaction fetch failed: user_id is required.");
      return;
    }

    setIsLoading(true);
    appendConsole(setConsoleText, `Fetching interaction batches for user_id=${userId}...`);

    try {
      const response = await getExternalInteractionBatches(userId);
      const payload = normalizeBatchPayload(response);
      if (!Array.isArray(payload.batches) || payload.batches.length === 0) {
        throw new Error("No interaction batches returned.");
      }
      setMode("batch");
      setInputText(formatJson(payload));
      appendConsole(
        setConsoleText,
        `Loaded ${payload.batches.length} interaction batch${
          payload.batches.length === 1 ? "" : "es"
        } into the editor.`
      );
    } catch (error) {
      appendConsole(
        setConsoleText,
        `Interaction fetch failed: ${error.message}${
          error.data ? ` | ${formatJson(error.data)}` : ""
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    const parsed = tryParseJson(inputText);
    if (!parsed.ok) {
      setConsoleText(`Invalid JSON: ${parsed.error.message}`);
      return;
    }

    setIsLoading(true);
    const apiCall =
      mode === "batch" ? updateUserProfileBatch : updateUserProfile;
    setConsoleText("");
    appendConsole(setConsoleText, "Validating interaction payload...");
    appendConsole(
      setConsoleText,
      `Updating user profile via ${
        mode === "batch" ? "/user/update-profile-batch" : "/user/update-profile"
      }...`
    );

    try {
      const response = await apiCall(parsed.value);
      setOutputText(formatJson(response));
      if (response?.quarantined || !response?.profile) {
        appendConsole(
          setConsoleText,
          "No profile update persisted. Interaction was filtered by Temporary User Detector."
        );
      } else {
        const version = response?.profile?.metadata?.version;
        const origin = response?.profile?.metadata?.origin;
        appendConsole(
          setConsoleText,
          `Profile updated successfully${
            version ? ` (v${version})` : ""
          }${origin ? ` origin=${origin}` : ""}.`
        );
      }
      appendStateMachineTraces(setConsoleText, response?.traces);
      const userId = extractUserId(parsed.value);
      if (userId) {
        appendConsole(setConsoleText, "Loading profile diff history...");
        void fetchHistory(userId);
      }
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
                  <div className="flex items-center justify-between px-4 pt-4">
                    <div className="text-sm font-semibold">Mode</div>
                    <div className="join">
                      <button
                        className={`btn btn-xs join-item ${
                          mode === "single" ? "btn-primary" : "btn-ghost"
                        }`}
                        onClick={() => {
                          setMode("single");
                          setInputText(formatJson(UserEngineDefaultPayload));
                        }}
                        type="button"
                      >
                        Single
                      </button>
                      <button
                        className={`btn btn-xs join-item ${
                          mode === "batch" ? "btn-primary" : "btn-ghost"
                        }`}
                        onClick={() => {
                          setMode("batch");
                          setInputText(
                            formatJson(UserEngineBatchDefaultPayload)
                          );
                        }}
                        type="button"
                      >
                        Batch
                      </button>
                    </div>
                  </div>
                  <div className="px-4 pt-3">
                    <div className="rounded-lg border border-primary/20 bg-base-100/70 p-3">
                      <div className="mb-2 text-sm font-semibold">
                        Load Interaction Batches
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                          className="input input-bordered w-full"
                          placeholder="user_id"
                          value={fetchUserId}
                          onChange={(event) => setFetchUserId(event.target.value)}
                        />
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={isLoading}
                          onClick={handleFetchBatches}
                          type="button"
                        >
                          Fetch batches
                        </button>
                      </div>
                    </div>
                  </div>
                  <InputSection
                    title={
                      mode === "batch" ? "Interaction Batches" : "Interaction Batch"
                    }
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
                title="Profile Diff History"
                subtitle={
                  isHistoryLoading
                    ? "Loading changes..."
                    : "Version-by-version knob changes"
                }
              >
                <ProfileDiffHistory
                  items={diffHistory}
                  userId={historyUserId}
                />
              </ChartSection>
              <div className="mt-3 shrink-0">
                <button
                  className="btn btn-xs btn-outline"
                  disabled={isHistoryLoading || !historyUserId}
                  onClick={() => fetchHistory(historyUserId)}
                  type="button"
                >
                  Refresh history
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
