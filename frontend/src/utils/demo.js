export const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const demoDelay = (baseMs = 250, jitterMs = 150) =>
  delay(baseMs + Math.floor(Math.random() * jitterMs));

export const appendConsole = (setConsoleText, message) => {
  const timestamp = new Date().toLocaleTimeString();
  setConsoleText((prev) => {
    const line = `[${timestamp}] ${message}`;
    return prev ? `${prev}\n${line}` : line;
  });
};
