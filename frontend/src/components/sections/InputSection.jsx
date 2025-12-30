import { FaAngleRight } from "react-icons/fa";

export default function InputSection({
  title = "Input",
  value,
  onChange,
  onSubmit,
  submitLabel = "Run",
  isLoading = false,
  placeholder = "Enter input data here...",
}) {
  return (
    <div className="flex flex-col h-full gap-2 p-2">
      <h2 className="font-semibold text-center">{title}</h2>

      <form className="flex-1">
        <div className="relative h-full">
          <textarea
            className="textarea w-full h-full p-3 border border-primary/30 rounded bg-base-100 text-slate-100 resize-none font-mono"
            placeholder={placeholder}
            value={value || ""}
            onChange={(event) => onChange?.(event.target.value)}
          />

          <button
            type="button"
            className="absolute bottom-3 right-3 p-2 bg-primary text-white rounded-full hover:bg-primary/90 disabled:opacity-60"
            onClick={onSubmit}
            disabled={isLoading}
            aria-label={submitLabel}
          >
            <FaAngleRight className="w-6 h-6" />
          </button>
        </div>
      </form>
    </div>
  );
}
