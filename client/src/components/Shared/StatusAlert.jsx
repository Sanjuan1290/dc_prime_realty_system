import { FiAlertCircle, FiCheckCircle, FiInfo, FiLoader, FiX } from "react-icons/fi";

const alertStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  loading: "border-slate-200 bg-slate-50 text-slate-700",
};

const iconStyles = {
  success: "text-emerald-600",
  error: "text-red-600",
  warning: "text-amber-600",
  info: "text-blue-600",
  loading: "text-slate-500",
};

const icons = {
  success: FiCheckCircle,
  error: FiAlertCircle,
  warning: FiAlertCircle,
  info: FiInfo,
  loading: FiLoader,
};

const StatusAlert = ({ type = "info", title, message, onClose, className = "" }) => {
  if (!title && !message) return null;

  const normalizedType = alertStyles[type] ? type : "info";
  const Icon = icons[normalizedType];

  return (
    <div
      role={normalizedType === "error" ? "alert" : "status"}
      aria-live={normalizedType === "error" ? "assertive" : "polite"}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm ${alertStyles[normalizedType]} ${className}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconStyles[normalizedType]} ${normalizedType === "loading" ? "animate-spin" : ""}`} />

      <div className="min-w-0 flex-1">
        {title ? <p className="font-bold">{title}</p> : null}
        {message ? <p className={title ? "mt-0.5 font-medium" : "font-medium"}>{message}</p> : null}
      </div>

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/5 active:scale-[0.98]"
          aria-label="Dismiss alert"
        >
          <FiX className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
};

export default StatusAlert;
