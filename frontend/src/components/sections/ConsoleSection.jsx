export default function ConsoleSection() {
  return (
    <div className="flex flex-col h-full gap-2 p-2">
      <h2 className="font-semibold text-center">Console</h2>

      <textarea
        className="textarea w-full h-full p-3 border border-primary/30 rounded bg-base-100 resize-none text-sm font-mono text-primary"
        placeholder="Console logs will appear here..."
        readOnly
      />
    </div>
  );
}
