import { useId } from "react";

export default function Modal({
  id,
  title,
  children,
  triggerLabel = "Open",
  triggerClassName = "btn",
  modalClassName = "modal modal-bottom sm:modal-middle",
  boxClassName = "modal-box",
  showCloseCorner = true,
}) {
  const autoId = useId();
  const modalId = id || autoId;

  const openModal = () => {
    const el = document.getElementById(modalId);
    if (el?.showModal) el.showModal();
  };

  return (
    <>
      <button type="button" className={triggerClassName} onClick={openModal}>
        {triggerLabel}
      </button>
      <dialog id={modalId} className={modalClassName}>
        <div className={boxClassName}>
          {showCloseCorner ? (
            <form method="dialog">
              <button
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                aria-label="Close"
                type="submit"
              >
                ✕
              </button>
            </form>
          ) : null}
          {title ? <h3 className="font-bold text-lg">{title}</h3> : null}
          <div className="mt-3">{children}</div>
        </div>
      </dialog>
    </>
  );
}
