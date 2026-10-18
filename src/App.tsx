import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudOff,
  Command,
  Inbox,
  Layers2,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { labels, statuses, type Status, type Task } from "../shared/tasks";
import { TaskStore } from "./store";
import { api, useSync } from "./sync";
import {
  ease,
  KeyboardMotion,
  Logo,
  Modal,
  TaskCard,
  Toast,
} from "./components";

type Account = {
  user: { id: string; name: string } | null;
  googleConfigured: boolean;
  aiConfigured: boolean;
};
type Filter = "all" | Status | "starred" | "trash";
type ToastData = { text: string; undo?: () => void };
const filterLabels: Record<Filter, string> = {
  all: "すべてのタスク",
  inbox: "未着手",
  doing: "進行中",
  done: "完了",
  starred: "重要",
  trash: "ゴミ箱",
};
const navItems = [
  { id: "all", icon: Layers2, label: "すべてのタスク" },
  { id: "inbox", icon: Inbox, label: "未着手" },
  { id: "doing", icon: LoaderCircle, label: "進行中" },
  { id: "done", icon: CheckCheck, label: "完了" },
  { id: "starred", icon: Star, label: "重要" },
] as const;

export function App({
  bootDraft,
  wasFocused,
}: {
  bootDraft: string;
  wasFocused: boolean;
}) {
  const [account, setAccount] = useState<Account>({
    user: null,
    googleConfigured: false,
    aiConfigured: false,
  });
  const [draft, setDraft] = useState(bootDraft);
  const [connection, setConnection] = useState("確認中");
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    let active = true;
    void api<Account>("/api/me")
      .then((result) => {
        if (active) {
          setAccount(result);
          setConnection("接続済み");
        }
      })
      .catch(() => {
        if (active) setConnection("クラウドに接続できません");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <KeyboardMotion.Provider value={keyboard}>
      <MotionConfig reducedMotion="user">
        <div
          style={{ display: "contents" }}
          onKeyDownCapture={() => setKeyboard(true)}
          onPointerDownCapture={() => setKeyboard(false)}
        >
          <Workspace
            key={account.user?.id ?? "guest"}
            account={account}
            setAccount={setAccount}
            draft={draft}
            setDraft={setDraft}
            wasFocused={wasFocused}
            connection={connection}
            keyboard={keyboard}
          />
        </div>
      </MotionConfig>
    </KeyboardMotion.Provider>
  );
}
function Workspace({
  account,
  setAccount,
  draft,
  setDraft,
  wasFocused,
  connection,
  keyboard,
}: {
  account: Account;
  setAccount: (value: Account) => void;
  draft: string;
  setDraft: (value: string) => void;
  wasFocused: boolean;
  connection: string;
  keyboard: boolean;
}) {
  const [store] = useState(() => {
    try {
      return new TaskStore(localStorage, account.user?.id ?? "guest");
    } catch {
      return new TaskStore(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error(
              "保存領域を読み込めません。入力内容をコピーして保管してください。",
            );
          },
        },
        "unavailable",
      );
    }
  });
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [limit, setLimit] = useState(50);
  const [modal, setModal] = useState<"account" | "ai" | "help" | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [draftError, setDraftError] = useState(
    store.key.endsWith("unavailable"),
  );
  const transferred = useRef(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const systemReduced = useReducedMotion();
  const reduced = keyboard || systemReduced;
  const notify = useCallback((text: string) => setToast({ text }), []);
  const closeToast = useCallback(() => setToast(null), []);
  const syncState = useSync(store, Boolean(account.user), notify);
  useEffect(() => {
    if (!draft && snapshot.draft) setDraft(snapshot.draft);
  }, [draft, snapshot.draft, setDraft]);
  useEffect(() => {
    if (transferred.current) return;
    transferred.current = true;
    if (draft) {
      try {
        store.draft(draft);
        localStorage.removeItem("fliq.quick-capture");
      } catch {
        setDraftError(true);
      }
    }
  }, [draft, store]);
  useEffect(() => {
    if (wasFocused || matchMedia("(pointer: fine)").matches)
      composer.current?.focus({ preventScroll: true });
    if (new URLSearchParams(location.search).get("auth") === "failed")
      notify("Googleログインに失敗しました。もう一度お試しください。");
  }, [wasFocused, notify]);
  const focusComposer = useCallback(() => {
    setFilter("all");
    window.scrollTo({ top: 0, behavior: "instant" });
    composer.current?.focus();
  }, []);
  useEffect(() => {
    setLimit(50);
  }, [filter, query, sort]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key.toLowerCase() === "n" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !target.matches("input,textarea,select,[contenteditable]") &&
        !modal &&
        !editing
      ) {
        event.preventDefault();
        focusComposer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, editing, focusComposer]);
  function run(action: () => void) {
    try {
      action();
      return true;
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "保存できませんでした。入力内容をコピーして保管してください。",
      );
      return false;
    }
  }
  function capture() {
    if (!draft.trim()) return;
    if (run(() => store.add(draft))) {
      setDraft("");
      setDraftError(false);
      notify("追加しました");
      composer.current?.focus();
    }
  }
  function changeTask(task: Task, status?: Status, starred?: boolean) {
    if (
      run(() =>
        store.update(task.id, {
          ...(status ? { status } : {}),
          ...(starred !== undefined ? { starred } : {}),
        }),
      )
    ) {
      setToast({
        text: status
          ? `${labels[status]}に変更しました`
          : starred
            ? "重要に追加しました"
            : "重要から外しました",
        undo: () => {
          run(() =>
            store.update(task.id, {
              status: task.status,
              starred: task.starred,
            }),
          );
          setToast(null);
        },
      });
    }
  }
  const active = useMemo(
    () => snapshot.tasks.filter((task) => !task.deleted),
    [snapshot.tasks],
  );
  const counts = useMemo(
    () => ({
      all: active.length,
      inbox: active.filter((task) => task.status === "inbox").length,
      doing: active.filter((task) => task.status === "doing").length,
      done: active.filter((task) => task.status === "done").length,
      starred: active.filter((task) => task.starred).length,
      trash: snapshot.tasks.filter((task) => task.deleted).length,
    }),
    [active, snapshot.tasks],
  );
  const visible = useMemo(
    () =>
      snapshot.tasks
        .filter(
          (task) =>
            (filter === "trash" ? task.deleted : !task.deleted) &&
            (filter === "starred"
              ? task.starred
              : statuses.includes(filter as Status)
                ? task.status === filter
                : true) &&
            `${task.title} ${task.notes}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase()),
        )
        .sort((a, b) =>
          sort === "newest"
            ? b.createdAt.localeCompare(a.createdAt)
            : a.createdAt.localeCompare(b.createdAt),
        ),
    [snapshot.tasks, filter, query, sort],
  );
  const percent = counts.all ? Math.round((counts.done / counts.all) * 100) : 0;
  const date = new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
  function exportTasks() {
    const link = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              version: 1,
              exportedAt: new Date().toISOString(),
              tasks: snapshot.tasks,
              draft,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    link.href = url;
    const today = new Date();
    const localDay = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    link.download = `fliq-${localDay}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      <aside className="sidebar glass">
        <div className="sidebar-brand">
          <Logo />
          <span className="beta-label">WORKSPACE</span>
        </div>
        <button className="new-task-button" onClick={focusComposer}>
          <Plus size={18} />
          新規メモ<kbd>N</kbd>
        </button>
        <div className="nav-caption">ライブラリ</div>
        <nav aria-label="タスクの表示">
          <div className="nav-list">
            {navItems.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`nav-item ${filter === id ? "selected" : ""}`}
                aria-current={filter === id ? "page" : undefined}
              >
                {filter === id && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="nav-highlight"
                    transition={{ duration: reduced ? 0 : 0.2, ease }}
                  />
                )}
                <Icon size={18} />
                <span>{label}</span>
                <span className="nav-count">{counts[id]}</span>
              </button>
            ))}
          </div>
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${filter === "trash" ? "selected" : ""}`}
            onClick={() => setFilter("trash")}
          >
            <Trash2 size={17} />
            <span>ゴミ箱</span>
            <span className="nav-count">{counts.trash}</span>
          </button>
          <button className="nav-item" onClick={() => setModal("help")}>
            <CircleHelp size={17} />
            <span>操作ガイド</span>
          </button>
          <button
            className="sidebar-account"
            onClick={() => setModal("account")}
          >
            <span className="avatar">
              <UserRound size={17} />
            </span>
            <span>
              <strong>{account.user?.name ?? "ゲスト"}</strong>
              <small>{account.user ? syncState : "この端末に保存"}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-logo">
            <Logo />
          </div>
          <div className="breadcrumb">
            <Layers2 size={15} />
            <span>ワークスペース</span>
            <ChevronRight size={12} />
            <strong>タスク</strong>
          </div>
          <div className="topbar-actions">
            <span
              className={`connection-chip ${syncState.includes("待ち") ? "pending" : ""}`}
            >
              <i />
              {account.user ? syncState : "端末に保存"}
            </span>
            <button
              className="icon-button"
              aria-label="タスクをエクスポート"
              onClick={exportTasks}
            >
              <ArrowDownToLine size={18} />
            </button>
            <button
              className="avatar top-avatar"
              aria-label="アカウント"
              onClick={() => setModal("account")}
            >
              {account.user?.name.slice(0, 1) ?? <UserRound size={17} />}
            </button>
          </div>
        </header>
        <main className="main-grid">
          <div className="task-workspace">
            <div className="page-heading">
              <div>
                <p className="eyebrow">{date}</p>
                <h1>
                  タスク<span className="heading-dot">.</span>
                </h1>
              </div>
              <span className="task-total">
                {counts.all}
                <small>タスク</small>
              </span>
            </div>
            <section className="composer glass" aria-label="新規メモ">
              <div className="composer-heading">
                <span>
                  <span className="capture-dot" />
                  クイックメモ
                </span>
                <span className="composer-shortcut">
                  <Command size={11} /> + Enter
                </span>
              </div>
              <textarea
                ref={composer}
                aria-label="メモ、タスクを入力"
                placeholder="メモ、タスクを入力…"
                value={draft}
                maxLength={5300}
                onChange={(event) => {
                  const value = event.target.value;
                  setDraft(value);
                  try {
                    store.draft(value);
                    setDraftError(false);
                  } catch {
                    setDraftError(true);
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    (event.metaKey || event.ctrlKey) &&
                    event.key === "Enter" &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    capture();
                  }
                }}
              />
              <div className="composer-footer">
                <button className="ai-button" onClick={() => setModal("ai")}>
                  <Sparkles size={16} />
                  AIで整理
                </button>
                <span className={`draft-state ${draftError ? "error" : ""}`}>
                  {draftError
                    ? "未保存・内容をコピーしてください"
                    : draft
                      ? "下書き保存済み"
                      : "1行目がタスク名"}
                </span>
                <button
                  className="add-button"
                  aria-label="タスクを追加"
                  disabled={!draft.trim()}
                  onClick={capture}
                >
                  <ArrowUp size={20} />
                </button>
              </div>
            </section>
            <section className="task-section" aria-label={filterLabels[filter]}>
              <div className="section-heading">
                <h2>
                  {filterLabels[filter]}
                  <span>{counts[filter]}</span>
                </h2>
                {filter !== "trash" && (
                  <span className="flick-hint">
                    ← 戻す
                    <span />
                    進める →
                  </span>
                )}
              </div>
              <div className="list-tools">
                <div
                  className="status-tabs"
                  role="group"
                  aria-label="ステータス"
                >
                  {(["all", ...statuses] as const).map((status) => (
                    <button
                      aria-pressed={filter === status}
                      key={status}
                      onClick={() => setFilter(status)}
                    >
                      {filter === status && (
                        <motion.span
                          layoutId="tab-active"
                          className="tab-highlight"
                          transition={{ duration: reduced ? 0 : 0.18, ease }}
                        />
                      )}
                      <span>
                        {status === "all" ? "すべて" : labels[status]}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="sort-button" title="並び順">
                  <SlidersHorizontal size={15} />
                  <select
                    aria-label="並び順"
                    value={sort}
                    onChange={(event) =>
                      setSort(event.target.value as "newest" | "oldest")
                    }
                  >
                    <option value="newest">新しい順</option>
                    <option value="oldest">古い順</option>
                  </select>
                </label>
              </div>
              <div className="search-field">
                <Search size={16} />
                <input
                  aria-label="タスクを検索"
                  placeholder="タスクを検索"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button
                    className="icon-button"
                    aria-label="検索をクリア"
                    onClick={() => setQuery("")}
                  >
                    <X size={15} />
                  </button>
                )}
                <kbd>検索</kbd>
              </div>
              <div className="task-list">
                <AnimatePresence initial={false}>
                  {visible.slice(0, limit).map((task) =>
                    task.deleted ? (
                      <motion.article
                        layout
                        key={task.id}
                        className="trash-card glass"
                      >
                        <span>{task.title}</span>
                        <button
                          className="text-button"
                          onClick={() => {
                            if (
                              run(() =>
                                store.update(task.id, { deleted: false }),
                              )
                            )
                              notify("復元しました");
                          }}
                        >
                          復元
                        </button>
                      </motion.article>
                    ) : (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onChange={changeTask}
                        onEdit={() => setEditing(task)}
                      />
                    ),
                  )}
                </AnimatePresence>
                {!visible.length && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="empty-state"
                  >
                    <span className="empty-icon">
                      {query ? (
                        <Search size={28} strokeWidth={1.2} />
                      ) : (
                        <Inbox size={30} strokeWidth={1.2} />
                      )}
                    </span>
                    <h3>
                      {query
                        ? "該当するタスクはありません"
                        : filter === "trash"
                          ? "ゴミ箱は空です"
                          : "タスクはまだありません"}
                    </h3>
                    {filter === "all" && !query && (
                      <>
                        <button className="text-button" onClick={focusComposer}>
                          メモを追加
                          <ArrowRight size={14} />
                        </button>
                        <button
                          className="sample-button"
                          onClick={() =>
                            run(() =>
                              store.addMany([
                                "週末の予定をまとめる\nサンプルのタスク",
                                "デザインの参考を集める\nサンプルのタスク",
                                "読みたい本をメモする\nサンプルのタスク",
                              ]),
                            )
                          }
                        >
                          サンプルを追加
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </div>
              {visible.length > limit && (
                <button
                  className="secondary-button"
                  onClick={() => setLimit((value) => value + 50)}
                >
                  さらに50件を表示
                </button>
              )}
              <div className="list-footer">
                <span>
                  {Math.min(visible.length, limit)}件を表示
                  {visible.length > limit ? ` / ${visible.length}件` : ""}
                </span>
                <span>
                  <span className="tiny-dot" />
                  {draftError ? "下書き未保存" : "端末に保存"}
                </span>
              </div>
            </section>
          </div>
          <aside className="insights">
            <section className="progress-panel glass">
              <div className="panel-title">
                <h2>進捗</h2>
                <span className="subtle-badge">すべて</span>
              </div>
              <div className="progress-ring">
                <svg
                  viewBox="0 0 140 140"
                  aria-label={`完了率 ${percent}%`}
                  role="img"
                >
                  <circle cx="70" cy="70" r="59" className="ring-track" />
                  <motion.circle
                    cx="70"
                    cy="70"
                    r="59"
                    className="ring-value"
                    strokeDasharray={370.7}
                    animate={{ strokeDashoffset: 370.7 * (1 - percent / 100) }}
                    transition={{ duration: reduced ? 0 : 0.28, ease }}
                  />
                </svg>
                <div>
                  <strong>
                    {percent}
                    <small>%</small>
                  </strong>
                  <span>完了</span>
                </div>
              </div>
              <div className="progress-summary">
                <Check size={13} />
                {counts.done}
                <span>/ {counts.all} タスク完了</span>
              </div>
              <div className="progress-breakdown">
                {statuses.map((status) => (
                  <div key={status}>
                    <span className={`status-label ${status}`}>
                      <i />
                      {labels[status]}
                    </span>
                    <strong>{counts[status]}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="gesture-panel glass">
              <span className="panel-kicker">フリック操作</span>
              <div className="gesture-visual">
                <span className="gesture-arrow">←</span>
                <span className="mini-task">
                  <i />
                  <span />
                  <span />
                </span>
                <span className="gesture-arrow">→</span>
              </div>
              <div className="gesture-labels">
                <span>前の状態へ</span>
                <span>次の状態へ</span>
              </div>
              <div className="status-sequence">
                <span>未着手</span>
                <ChevronRight size={11} />
                <span>進行中</span>
                <ChevronRight size={11} />
                <span>完了</span>
              </div>
            </section>
            <section className="keyboard-panel">
              <div className="panel-title">
                <h2>ショートカット</h2>
                <Command size={13} />
              </div>
              <div>
                <span>新規メモ</span>
                <kbd>N</kbd>
              </div>
              <div>
                <span>メモを保存</span>
                <span>
                  <kbd>⌘ / Ctrl</kbd>
                  <kbd>↵</kbd>
                </span>
              </div>
              <div>
                <span>シートを閉じる</span>
                <kbd>Esc</kbd>
              </div>
            </section>
            <button className="cloud-panel" onClick={() => setModal("account")}>
              {account.user ? <Cloud size={18} /> : <CloudOff size={18} />}
              <span>
                {account.user ? "クラウド同期" : "Googleで同期"}
                <small>
                  {account.user ? syncState : "ログインして端末間で共有"}
                </small>
              </span>
              <ChevronRight size={16} />
            </button>
          </aside>
        </main>
      </div>
      <nav className="mobile-nav glass" aria-label="モバイルナビゲーション">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          <Layers2 size={20} />
          <span>すべて</span>
        </button>
        <button
          className={filter === "doing" ? "active" : ""}
          onClick={() => setFilter("doing")}
        >
          <LoaderCircle size={20} />
          <span>進行中</span>
        </button>
        <button
          className={filter === "starred" ? "active" : ""}
          onClick={() => setFilter("starred")}
        >
          <Star size={20} />
          <span>重要</span>
        </button>
        <button
          aria-label="新規メモ"
          className="mobile-add"
          onClick={focusComposer}
        >
          <Plus size={23} />
        </button>
      </nav>
      {toast && (
        <Toast text={toast.text} undo={toast.undo} onClose={closeToast} />
      )}
      {editing && (
        <Editor
          key={editing.id}
          task={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            if (run(() => store.update(editing.id, patch))) {
              setEditing(null);
              notify("保存しました");
            }
          }}
          onDelete={() => {
            const task = editing;
            if (run(() => store.update(task.id, { deleted: true }))) {
              setEditing(null);
              setToast({
                text: "ゴミ箱に移動しました",
                undo: () => {
                  run(() => store.update(task.id, { deleted: false }));
                  setToast(null);
                },
              });
            }
          }}
        />
      )}
      {modal === "ai" && (
        <AiSheet
          account={account}
          text={draft}
          onClose={() => setModal(null)}
          onLogin={() => setModal("account")}
          onApply={(texts) => {
            if (run(() => store.addMany(texts))) {
              setModal(null);
              notify(`${texts.length}件追加しました`);
            }
          }}
        />
      )}
      {modal === "help" && (
        <Modal title="操作ガイド" onClose={() => setModal(null)}>
          <div className="help-content">
            <p>
              入力欄の1行目がタスク名、2行目以降が詳細です。追加ボタン、または⌘
              / Ctrl + Enterで保存します。
            </p>
            <p>
              右にフリックすると未着手 → 進行中 →
              完了、左にフリックすると前の状態に戻ります。丸い状態ボタンでも変更できます。
            </p>
            <p>
              削除したタスクはゴミ箱から復元できます。iPhoneではSafariの共有メニューから「ホーム画面に追加」で開けます。
            </p>
            <button
              className="text-button"
              onClick={() => {
                setModal(null);
                setFilter("trash");
              }}
            >
              ゴミ箱を開く
              <ArrowRight size={14} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "account" && (
        <Modal title="アカウント" onClose={() => setModal(null)}>
          <div className="account-content">
            <div className="account-card">
              <span className="large-avatar">
                <UserRound size={25} />
              </span>
              <h3>{account.user?.name ?? "ゲスト"}</h3>
              <p>
                {account.user
                  ? syncState
                  : "メモはこの端末に保存されています。"}
              </p>
            </div>
            {account.user ? (
              <>
                <button
                  className="secondary-button"
                  onClick={() => {
                    try {
                      const guest = new TaskStore(
                        localStorage,
                        "guest",
                      ).getSnapshot();
                      if (run(() => store.importGuest(guest)))
                        notify("端末のメモを取り込みました");
                    } catch {
                      notify("端末のメモを読み込めませんでした。");
                    }
                  }}
                >
                  ログイン前の端末メモを取り込む
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    void api("/auth/logout", "POST")
                      .then(() => {
                        setDraft("");
                        setAccount({ ...account, user: null });
                      })
                      .catch((error) => notify(error.message));
                  }}
                >
                  <LogOut size={16} />
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <button
                  className="google-button"
                  disabled={!account.googleConfigured}
                  onClick={() => {
                    location.href = "/auth/google";
                  }}
                >
                  <span className="google-mark">G</span>Googleでログイン
                </button>
                {!account.googleConfigured && (
                  <p className="configuration-note">
                    {connection === "接続済み"
                      ? "Googleログインは未設定です。"
                      : connection === "確認中"
                        ? "接続を確認しています。"
                        : connection}{" "}
                    端末への保存は利用できます。
                  </p>
                )}
              </>
            )}
            <button className="secondary-button" onClick={exportTasks}>
              <ArrowDownToLine size={16} />
              データをエクスポート
            </button>
            <button
              className="text-button mobile-help"
              onClick={() => setModal("help")}
            >
              操作ガイド
              <ChevronRight size={14} />
            </button>
            <button
              className="text-button mobile-help"
              onClick={() => {
                setModal(null);
                setFilter("trash");
              }}
            >
              ゴミ箱
              <Trash2 size={14} />
            </button>
            <p className="account-footnote">
              端末保存はブラウザのデータ消去で失われます。同期前のメモはエクスポートできます。
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Editor({
  task,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onSave: (patch: Pick<Task, "title" | "notes" | "status">) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title),
    [notes, setNotes] = useState(task.notes),
    [status, setStatus] = useState(task.status);
  return (
    <Modal title="タスクを編集" onClose={onClose}>
      <form
        className="editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim()) onSave({ title: title.trim(), notes, status });
        }}
      >
        <label>
          タスク名
          <input
            autoFocus
            required
            maxLength={300}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          詳細
          <textarea
            rows={5}
            maxLength={5000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <label>
          ステータス
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as Status)}
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>
        <div className="editor-footer">
          <button type="button" className="delete-button" onClick={onDelete}>
            <Trash2 size={16} />
            ゴミ箱へ
          </button>
          <button
            className="primary-button"
            type="submit"
            disabled={!title.trim()}
          >
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}
function AiSheet({
  account,
  text,
  onClose,
  onLogin,
  onApply,
}: {
  account: Account;
  text: string;
  onClose: () => void;
  onLogin: () => void;
  onApply: (texts: string[]) => void;
}) {
  const [source, setSource] = useState(text),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<
      { title: string; notes: string }[]
    >([]),
    [selected, setSelected] = useState<number[]>([]);
  async function generate() {
    setBusy(true);
    setError("");
    setSuggestions([]);
    try {
      const result = await api<{
        suggestions: { title: string; notes: string }[];
      }>("/api/ai/breakdown", "POST", { text: source });
      setSuggestions(result.suggestions);
      setSelected(result.suggestions.map((_, index) => index));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "AIに接続できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="AIで整理" onClose={onClose}>
      <div className="ai-content">
        {!account.user ? (
          <div className="ai-login">
            <span className="ai-orb">
              <Sparkles size={27} />
            </span>
            <p>AIでの整理にはGoogleログインが必要です。</p>
            <button className="primary-button" onClick={onLogin}>
              アカウントを開く
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <>
            <label className="ai-source">
              メモ
              <textarea
                autoFocus
                rows={5}
                maxLength={5300}
                value={source}
                onChange={(event) => setSource(event.target.value)}
              />
            </label>
            <p className="configuration-note">
              このメモをCloudflare Workers
              AIに送信します。候補を確認してから追加できます。
            </p>
            {!account.aiConfigured && (
              <p className="inline-error">Workers AIは未設定です。</p>
            )}
            <button
              className="primary-button wide"
              disabled={busy || !source.trim() || !account.aiConfigured}
              onClick={() => void generate()}
            >
              {busy ? (
                <LoaderCircle size={16} className="spinning" />
              ) : (
                <Sparkles size={16} />
              )}
              {busy ? "整理中" : "タスクの候補を作る"}
            </button>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            {suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((item, index) => (
                  <label className="suggestion" key={index}>
                    <input
                      type="checkbox"
                      checked={selected.includes(index)}
                      onChange={(event) =>
                        setSelected((values) =>
                          event.target.checked
                            ? [...values, index]
                            : values.filter((value) => value !== index),
                        )
                      }
                    />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.notes}</small>
                    </span>
                  </label>
                ))}
                <button
                  className="primary-button wide"
                  disabled={!selected.length}
                  onClick={() =>
                    onApply(
                      suggestions
                        .filter((_, index) => selected.includes(index))
                        .map((item) => `${item.title}\n${item.notes}`),
                    )
                  }
                >
                  {selected.length}件を追加
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
