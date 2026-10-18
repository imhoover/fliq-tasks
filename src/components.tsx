import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Ellipsis,
  Star,
  X,
} from "lucide-react";
import {
  flickDirection,
  labels,
  moveStatus,
  type Status,
  type Task,
} from "../shared/tasks";

export const ease = [0.22, 1, 0.36, 1] as const;
export const KeyboardMotion = createContext(false);
function useCalmMotion() {
  const keyboard = useContext(KeyboardMotion);
  const reduced = useReducedMotion();
  return keyboard || reduced;
}
export function Logo() {
  return (
    <span className="wordmark">
      fliq<span>.</span>
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const reduced = useCalmMotion();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog
      ?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
      ?.focus();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet-dialog"
      aria-label={title}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        className="sheet glass"
        initial={{ y: reduced ? 0 : 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: reduced ? 0 : 0.24, ease }}
      >
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="閉じる" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </dialog>
  );
}
export function TaskCard({
  task,
  onChange,
  onEdit,
}: {
  task: Task;
  onChange: (task: Task, status?: Status, starred?: boolean) => void;
  onEdit: () => void;
}) {
  const x = useMotionValue(0);
  const leftOpacity = useTransform(x, [-80, -18], [1, 0]);
  const rightOpacity = useTransform(x, [18, 80], [0, 1]);
  const dragging = useRef(false);
  const reduced = useCalmMotion();
  const next = task.status === "done" ? "inbox" : moveStatus(task.status, 1);
  return (
    <motion.div
      layout={!reduced}
      initial={{ opacity: 0, y: reduced ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: reduced ? 0 : 24 }}
      transition={{ duration: reduced ? 0 : 0.2, ease }}
      className="task-track"
      data-testid="task-card"
    >
      <div className="swipe-reveal">
        <motion.span style={{ opacity: rightOpacity }}>
          <ArrowRight size={17} />
          {labels[moveStatus(task.status, 1)]}
        </motion.span>
        <motion.span style={{ opacity: leftOpacity }}>
          {labels[moveStatus(task.status, -1)]}
          <ArrowLeft size={17} />
        </motion.span>
      </div>
      <motion.article
        className={`task-card glass ${task.status === "done" ? "is-done" : ""}`}
        style={{ x, touchAction: "pan-y" }}
        drag="x"
        dragConstraints={{ left: -150, right: 150 }}
        dragElastic={0.12}
        dragMomentum={false}
        onPointerDownCapture={() => {
          dragging.current = false;
        }}
        onDragStart={() => {
          dragging.current = true;
        }}
        onDragEnd={(_event, info) => {
          const direction = flickDirection(
            info.offset.x,
            info.offset.y,
            info.velocity.x,
          );
          if (direction) {
            const status = moveStatus(task.status, direction);
            if (status !== task.status) onChange(task, status);
          }
          void animate(x, 0, {
            type: "spring",
            bounce: 0.12,
            duration: reduced ? 0 : 0.28,
            velocity: info.velocity.x,
          });
        }}
      >
        <button
          className={`status-button ${task.status}`}
          aria-label={`「${task.title}」を${labels[next]}にする`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onChange(task, next)}
        >
          {task.status === "done" ? (
            <Check size={15} strokeWidth={2.5} />
          ) : task.status === "doing" ? (
            <span />
          ) : (
            <Circle size={21} strokeWidth={1.4} />
          )}
        </button>
        <button
          className="task-copy"
          onClick={() => {
            if (!dragging.current) onEdit();
          }}
          aria-label={`「${task.title}」を編集`}
        >
          <span className="task-title">{task.title}</span>
          {task.notes && <span className="task-notes">{task.notes}</span>}
          <span className={`status-label ${task.status}`}>
            <i />
            {labels[task.status]}
          </span>
        </button>
        <button
          className={`icon-button star-button ${task.starred ? "is-starred" : ""}`}
          aria-label={`「${task.title}」を重要にする`}
          aria-pressed={task.starred}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onChange(task, undefined, !task.starred)}
        >
          <Star size={17} fill={task.starred ? "currentColor" : "none"} />
        </button>
        <button
          className="icon-button task-more"
          aria-label={`「${task.title}」の詳細`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onEdit}
        >
          <Ellipsis size={19} />
        </button>
      </motion.article>
    </motion.div>
  );
}
export function Toast({
  text,
  undo,
  onClose,
}: {
  text: string;
  undo?: () => void;
  onClose: () => void;
}) {
  const reduced = useCalmMotion();
  useEffect(() => {
    const timer = setTimeout(onClose, undo ? 9000 : 6000);
    return () => clearTimeout(timer);
  }, [text, undo, onClose]);
  return (
    <AnimatePresence>
      <motion.div
        className="toast glass"
        role="status"
        initial={{ y: reduced ? 0 : 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: reduced ? 0 : 16, opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.2, ease }}
      >
        <span>{text}</span>
        {undo && <button onClick={undo}>取り消す</button>}
        <button
          className="icon-button"
          aria-label="通知を閉じる"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
