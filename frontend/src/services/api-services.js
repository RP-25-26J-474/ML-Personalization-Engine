const defaultBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const externalBaseUrl =
  import.meta.env.EXT_BACKEND_BASE_URL ||
  import.meta.env.VITE_EXT_BACKEND_BASE_URL ||
  "http://localhost:3000";
const externalUsersPath =
  import.meta.env.EXT_BACKEND_USERS_PATH ||
  import.meta.env.VITE_EXT_BACKEND_USERS_PATH ||
  "/api/users";
const externalInteractionBatchesPath =
  import.meta.env.EXT_BACKEND_INTERACTION_BATCHES_PATH ||
  import.meta.env.VITE_EXT_BACKEND_INTERACTION_BATCHES_PATH ||
  "/api/interactions/aggregated-batches";

async function request(path, options = {}) {
  const defaultHeaders =
    options.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  const response = await fetch(`${defaultBaseUrl}${path}`, {
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      (data && (data.detail || data.message)) ||
      `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function postJson(path, body) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getJson(path) {
  return request(path, { method: "GET" });
}

async function externalRequest(path, options = {}) {
  const defaultHeaders =
    options.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  const response = await fetch(`${externalBaseUrl}${path}`, {
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      (data && (data.detail || data.message)) ||
      `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function postForm(path, formData) {
  return request(path, {
    method: "POST",
    headers: {},
    body: formData,
  });
}

export function getDashboardStatus() {
  return getJson("/dashboard/status");
}

export function getCategoryVectorSpace() {
  return getJson("/category/vector-space");
}

export function getCategoryVectorSpace3d() {
  return getJson("/category/vector-space-3d");
}

export function generateCategoryProfile(payload) {
  return postJson("/category/generate-profile", payload);
}

export function scoreTempDetectorBatches(payload) {
  return postJson("/temp-detector/score-batches", payload);
}

export function getTempDetectorStatus() {
  return getJson("/temp-detector/status");
}

export function getTempDetectorForest(maxTrees = 12) {
  return getJson(`/temp-detector/forest?max_trees=${maxTrees}`);
}

export function trainTempDetectorSynth(payload) {
  return postJson("/temp-detector/train-synth", payload);
}

export function trainTempDetectorFromBatches(payload) {
  return postJson("/temp-detector/train-from-batches", payload);
}

export function getTempTemplate(userId) {
  return getJson(`/temp-detector/template?user_id=${encodeURIComponent(userId)}`);
}

export function updateUserProfile(payload) {
  return postJson("/user/update-profile", payload);
}

export function updateUserProfileBatch(payload) {
  return postJson("/user/update-profile-batch", payload);
}

export function getUserProfileDiffs(userId) {
  return getJson(`/data/profile-diffs?user_id=${encodeURIComponent(userId)}`);
}

export const getProfileDiffs = getUserProfileDiffs;

export function trainUserSeqModel(payload) {
  return postJson("/user/train-seq-model", payload);
}

export function getUserClusterMap({
  minSequenceLen,
  maxSequenceLen,
  outcomes = [],
}) {
  const params = new URLSearchParams();
  params.set("min_sequence_len", String(minSequenceLen));
  params.set("max_sequence_len", String(maxSequenceLen));
  outcomes.forEach((outcome) => params.append("outcomes", outcome));
  return getJson(`/user/cluster-map?${params.toString()}`);
}

export function trainCategoryWithCsv(formData) {
  return postForm("/category/train-csv", formData);
}

export function trainCategoryWithSynth(nSynth) {
  return postJson("/category/train", { n_synth: nSynth });
}

export function getExternalUsers() {
  return externalRequest(externalUsersPath, {
    method: "GET",
  });
}

export function getExternalInteractionBatches(userId) {
  const params = new URLSearchParams({
    user_id: String(userId || "").trim(),
  });
  return externalRequest(`${externalInteractionBatchesPath}?${params.toString()}`, {
    method: "GET",
  });
}

export function getProfiles(userId) {
  return getJson(`/data/profiles?user_id=${encodeURIComponent(userId)}`);
}

export function getTraces(userId) {
  return getJson(`/data/traces?user_id=${encodeURIComponent(userId)}`);
}

export function getQuarantine(userId) {
  return getJson(`/data/quarantine?user_id=${encodeURIComponent(userId)}`);
}

export function getCurrentProfile(userId) {
  return getJson(`/data/current-profile?user_id=${encodeURIComponent(userId)}`);
}
