import { useEffect, useRef, useState } from "react";
import type { DragEvent, KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Email, Label, OnAction } from "../types";
import { Icon } from "../ui/Icon";
import { matchesView } from "../search";
import "./shell.css";
import "./chrome-fidelity.css";

export type SidebarProps = {
  emails: Email[];
  labels: Label[];
  view: string;
  collapsed: boolean;
  onNavigate: (view: string) => void;
  onCompose: () => void;
  onAction?: OnAction;
  onCreateLabel: (parentId?: string) => void;
  onLabelAction: (
    action: "edit" | "delete" | "color" | "visibility" | "messageVisibility",
    labelId: string,
    value?: string,
    textColor?: string,
  ) => void;
};

// Gmail's curated foregrounds are part of each color choice, not contrast guesses.
const labelColors = [
  { background: "#e7e7e7", text: "#464646" },
  { background: "#b6cff5", text: "#0d3472" },
  { background: "#98d7e4", text: "#0d3b44" },
  { background: "#e3d7ff", text: "#3d188e" },
  { background: "#fbd3e0", text: "#711a36" },
  { background: "#f2b2a8", text: "#8a1c0a" },
  { background: "#757575", text: "#ffffff" },
  { background: "#1e53b8", text: "#ffffff" },
  { background: "#007286", text: "#ffffff" },
  { background: "#7858c3", text: "#ffffff" },
  { background: "#c2185b", text: "#ffffff" },
  { background: "#d93025", text: "#ffffff" },
  { background: "#ffc8af", text: "#7a2e0b" },
  { background: "#ffdeb5", text: "#7a4706" },
  { background: "#fbe983", text: "#594c05" },
  { background: "#fdedc1", text: "#684e07" },
  { background: "#b3efd3", text: "#0b4f30" },
  { background: "#a2dcc1", text: "#04502e" },
  { background: "#ff7537", text: "#54240e" },
  { background: "#ffad46", text: "#633e04" },
  { background: "#ebdbde", text: "#662e37" },
  { background: "#cca6ac", text: "#521d28" },
  { background: "#42d692", text: "#202124" },
  { background: "#16a765", text: "#083018" },
];

const customLabelColors = [
  ["#000000", "#434343", "#666666", "#999999", "#cccccc", "#efefef", "#f3f3f3", "#ffffff"],
  ["#fb4c2f", "#ffad47", "#fad165", "#16a766", "#43d692", "#4a86e8", "#a479e2", "#f691b3"],
  ["#f6c5be", "#ffe6c7", "#fef1d1", "#b9e4d0", "#c6f3de", "#c9daf8", "#e4d7f5", "#fcdee8"],
  ["#efa093", "#ffd6a2", "#fce8b3", "#89d3b2", "#a0eac9", "#a4c2f4", "#d0bcf1", "#fbc8d9"],
  ["#e66550", "#ffbc6b", "#fcda83", "#44b984", "#68dfa9", "#6d9eeb", "#b694e8", "#f7a7c0"],
  ["#cc3a21", "#eaa041", "#f2c960", "#149e60", "#3dc789", "#3c78d8", "#8e63ce", "#e07798"],
  ["#ac2b16", "#cf8933", "#d5ae49", "#0b804b", "#2a9c68", "#285bac", "#653e9b", "#b65775"],
  ["#822111", "#a46a21", "#aa8831", "#076239", "#1a764d", "#1c4587", "#41236d", "#83334c"],
];

function colorName(color: string) {
  return `RGB (${[1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16)).join(", ")})`;
}

function CustomLabelColor({ label, onApply, onClose }: {
  label: Label;
  onApply: (background: string, text: string) => void;
  onClose: () => void;
}) {
  const [background, setBackground] = useState(label.color && label.color.toLowerCase() !== "#e2e3e3" ? label.color : "#999999");
  const [text, setText] = useState(label.textColor || "#f3f3f3");
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { dialog.current?.focus(); }, []);

  return createPortal(
    <div className="gmail-label-custom-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div ref={dialog} className="gmail-label-custom-dialog" role="dialog" aria-modal="true" aria-labelledby="gmail-label-custom-title" tabIndex={-1} onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        } else if (event.key === "Tab") {
          const controls = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not([tabindex="-1"])') ?? []);
          const index = controls.indexOf(document.activeElement as HTMLButtonElement);
          if (event.shiftKey && index <= 0) {
            event.preventDefault();
            controls.at(-1)?.focus();
          } else if (!event.shiftKey && index === controls.length - 1) {
            event.preventDefault();
            controls[0]?.focus();
          }
        }
      }}>
        <h2 id="gmail-label-custom-title">Add custom color</h2>
        <div className="gmail-label-custom-preview">
          <span style={{ backgroundColor: background, color: text }}>{label.name}</span>
          <div><strong>Preview label color</strong> - pick colors below.</div>
        </div>
        <div className="gmail-label-custom-columns">
          {[{ name: "Background color", value: background, set: setBackground }, { name: "Text color", value: text, set: setText }].map((field) => (
            <div key={field.name}>
              <h3>{field.name}</h3>
              <div className="gmail-label-custom-grid" role="grid" aria-label={field.name}>
                {[customLabelColors.slice(0, 1), customLabelColors.slice(1, 2), customLabelColors.slice(2)].map((group, groupIndex) => (
                  <div className="gmail-label-custom-color-group" role="rowgroup" key={groupIndex}>
                    {group.map((row, rowIndex) => (
                      <div role="row" key={rowIndex}>
                        {row.map((color, column) => {
                          const index = (groupIndex < 2 ? groupIndex : rowIndex + 2) * 8 + column;
                          const selected = field.value.toLowerCase() === color;
                          return <button
                            key={color}
                            type="button"
                            role="gridcell"
                            aria-label={colorName(color)}
                            aria-selected={selected}
                            tabIndex={selected || index === 0 && !customLabelColors.flat().includes(field.value.toLowerCase()) ? 0 : -1}
                            style={{ backgroundColor: color, color: groupIndex === 0 && column >= 4 || groupIndex === 2 && rowIndex < 3 ? "#000" : "#fff" }}
                            onClick={() => field.set(color)}
                            onKeyDown={(event) => {
                            const offset = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8, Home: -column, End: 7 - column } as Record<string, number>)[event.key];
                            if (offset === undefined) return;
                            event.preventDefault();
                            const next = Math.max(0, Math.min(63, index + offset));
                            field.set(customLabelColors.flat()[next]);
                            event.currentTarget.closest('[role="grid"]')?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
                          }}>
                            {selected && <Icon name="check" size={12} />}
                          </button>;
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <footer>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="gmail-label-custom-apply" onClick={() => onApply(background, text)}>Apply</button>
        </footer>
      </div>
    </div>, document.body,
  );
}

export function Sidebar({
  emails,
  labels,
  view,
  collapsed,
  onNavigate,
  onCompose,
  onAction,
  onCreateLabel,
  onLabelAction,
}: SidebarProps) {
  const [more, setMore] = useState(false);
  const [categories, setCategories] = useState(false);
  const [moreLabels, setMoreLabels] = useState(false);
  const [closedLabels, setClosedLabels] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{
    id: string;
    top: number;
    left: number;
  } | null>(null);
  const [palette, setPalette] = useState<{ left: number; top: number; focus: boolean } | null>(null);
  const [customColor, setCustomColor] = useState<Label | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const [focusedNav, setFocusedNav] = useState("inbox");
  const inboxCount = emails.filter(
    (email) => matchesView(email, "inbox") && email.unread,
  ).length;
  const draftCount = emails.filter((email) =>
    matchesView(email, "drafts"),
  ).length;
  const scheduledCount = emails.filter((email) =>
    matchesView(email, "scheduled"),
  ).length;
  const roots = labels.filter(
    (label) =>
      !label.parentId || !labels.some((parent) => parent.id === label.parentId),
  );
  const extraRoots = roots.filter(labelHidden);
  const hasHiddenLabels = labels.some(labelHidden);
  const currentLabel = labels.find((label) => label.id === menu?.id);

  useEffect(() => {
    if (!menu) return;
    menuRef.current?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !(event.target as Element).closest(".gmail-label-more")
      )
        setMenu(null);
    };
    const scroll = () => setMenu(null);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", scroll);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", scroll);
      window.clearTimeout(hoverTimer.current);
      if (document.activeElement === document.body || menuRef.current?.contains(document.activeElement)) {
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
  }, [menu]);

  useEffect(() => {
    if (palette?.focus) paletteRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [palette]);

  function labelHidden(label: Label) {
    const visibility = label.visibility ?? (label.visible === false ? "hide" : "show");
    return visibility === "hide" || visibility === "unread" && !emails.some((email) =>
      email.unread && email.labels.includes(label.id) && email.folder !== "trash" && email.folder !== "spam",
    );
  }

  function openPalette(focus: boolean) {
    window.clearTimeout(hoverTimer.current);
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = rect.right + 236 > window.innerWidth - 8 ? rect.left - 236 : rect.right;
    setPalette({ left: Math.max(8, Math.min(Math.round(left), window.innerWidth - 244)), top: Math.max(8, Math.min(rect.top + 6, window.innerHeight - 216)), focus });
  }

  function closePalette() {
    window.clearTimeout(hoverTimer.current);
    setPalette(null);
  }

  function menuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (event.key === "Escape" || event.key === "ArrowLeft" && target.closest(".gmail-label-palette") && !target.closest('[role="grid"]')) {
      event.preventDefault();
      event.stopPropagation();
      if (palette) {
        closePalette();
        menuRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();
      } else setMenu(null);
      return;
    }
    if (event.key === "Tab") { setMenu(null); return; }
    if (event.key === "ArrowRight" && target.getAttribute("aria-haspopup") === "menu") {
      event.preventDefault();
      openPalette(true);
      return;
    }
    const grid = target.closest('[role="grid"]');
    if (grid && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      const items = Array.from(grid.querySelectorAll<HTMLButtonElement>("button"));
      const offset = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -6, ArrowDown: 6 } as Record<string, number>)[event.key];
      items[Math.max(0, Math.min(items.length - 1, items.indexOf(target as HTMLButtonElement) + offset))]?.focus();
      return;
    }
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const panel = target.closest('[role="menu"]');
    const items = Array.from(panel?.querySelectorAll<HTMLButtonElement>("button") ?? []).filter((item) => item.closest('[role="menu"]') === panel);
    if (!items.length) return;
    event.preventDefault();
    const index = items.indexOf(target as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  function closeCustomColor() {
    setCustomColor(null);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function drop(event: DragEvent<HTMLElement>, destination: string) {
    const data = event.dataTransfer.getData("application/x-gopen-messages");
    if (!data || !onAction) return;
    event.preventDefault();
    try {
      const ids: unknown = JSON.parse(data);
      if (Array.isArray(ids) && ids.every((id) => typeof id === "string"))
        onAction("move", ids, destination);
    } catch {
      // Ignore drags that do not contain local message IDs.
    }
  }

  function nav(id: string, title: string, icon: string, count?: number) {
    const activeIcon: Record<string, string> = {
      inboxOutline: "inbox",
      star: "starFilled",
      clock: "clockFilled",
      send: "sendFilled",
      draft: "draftFilled",
      important: "importantFilled",
      scheduleSend: "scheduleSendFilled",
      allMail: "allMailFilled",
      spam: "spamFilled",
      trash: "trashFilled",
      social: "socialFilled",
      updates: "updatesFilled",
      forums: "forumsFilled",
      promotions: "promotionsFilled",
    };
    return (
      <button
        key={id}
        className={`gmail-nav-item${view === id ? " gmail-nav-item-active" : ""}${count ? " gmail-nav-item-unread" : ""}`}
        title={collapsed ? title : undefined}
        aria-current={view === id ? "page" : undefined}
        data-nav-id={id}
        tabIndex={focusedNav === id ? 0 : -1}
        onFocus={() => setFocusedNav(id)}
        onDragOver={(event) => {
          if (
            onAction &&
            ["inbox", "sent", "spam", "trash", "all"].includes(id) &&
            event.dataTransfer.types.includes("application/x-gopen-messages")
          ) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(event) => {
          if (["inbox", "sent", "spam", "trash", "all"].includes(id))
            drop(event, id === "all" ? "archive" : id);
        }}
        onClick={() => onNavigate(id)}
      >
        {/* Only selected Inbox paints both .qj and ::before in the source. */}
        <Icon name={view === id ? activeIcon[icon] ?? icon : icon} size={20} layers={id === "inbox" && view === id ? 2 : 1} />
        <span className="gmail-nav-text">{title}</span>
        {!!count && (
          <span className="gmail-nav-count">{count.toLocaleString()}</span>
        )}
      </button>
    );
  }

  function labelRows(
    label: Label,
    depth = 0,
    ancestors: string[] = [],
  ): ReactNode {
    if (ancestors.includes(label.id)) return null;
    const children = labels.filter((child) => child.parentId === label.id);
    const isClosed = closedLabels.has(label.id);
    const count = emails.filter(
      (email) =>
        email.unread &&
        email.labels.includes(label.id) &&
        email.folder !== "trash" &&
        email.folder !== "spam",
    ).length;
    return (
      <div className="gmail-label-branch" key={label.id}>
        <div
          className={`gmail-label-row${view === `label:${label.id}` ? " gmail-nav-item-active" : ""}${menu?.id === label.id ? " gmail-label-row-menu-open" : ""}`}
          style={{ paddingLeft: collapsed ? 0 : depth * 8 }}
          onDragOver={(event) => {
            if (
              onAction &&
              event.dataTransfer.types.includes("application/x-gopen-messages")
            ) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }
          }}
          onDrop={(event) => drop(event, label.id)}
        >
          {children.length > 0 && !collapsed && (
            <button
              className="gmail-label-caret"
              style={{ left: depth * 8 }}
              aria-label={`${isClosed ? "Expand" : "Collapse"} ${label.name}`}
              aria-expanded={!isClosed}
              tabIndex={-1}
              onClick={() =>
                setClosedLabels((current) => {
                  const next = new Set(current);
                  if (next.has(label.id)) next.delete(label.id);
                  else next.add(label.id);
                  return next;
                })
              }
            >
              <Icon
                name={isClosed ? "arrowRight" : "arrowDropDown"}
                size={20}
              />
            </button>
          )}
          <button
            className="gmail-label-link"
            title={label.name}
            aria-current={view === `label:${label.id}` ? "page" : undefined}
            data-nav-id={`label:${label.id}`}
            tabIndex={focusedNav === `label:${label.id}` ? 0 : -1}
            onFocus={() => setFocusedNav(`label:${label.id}`)}
            onClick={() => onNavigate(`label:${label.id}`)}
          >
            <span
              className="gmail-label-icon"
              style={{
                color: label.color && label.color.toLowerCase() !== "#e2e3e3"
                  ? label.color
                  : undefined,
              }}
            >
              <Icon name="labelFilled" size={20} rasterize />
            </span>
            <span className="gmail-nav-text">{label.name}</span>
            {!!count && <span className="gmail-nav-count">{count}</span>}
          </button>
          {!collapsed && (
            <button
              className="gmail-label-more"
              title={`Options for ${label.name}`}
              aria-label={`Options for ${label.name}`}
              aria-expanded={menu?.id === label.id}
              tabIndex={-1}
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                const rect = event.currentTarget.querySelector("svg")!.getBoundingClientRect();
                setMenu((current) =>
                  current?.id === label.id
                    ? null
                    : {
                        id: label.id,
                        left: Math.max(
                          8,
                          Math.min(rect.left, window.innerWidth - 206.09375),
                        ),
                        top: Math.max(
                          8,
                          Math.min(rect.bottom, window.innerHeight - 411),
                        ),
                      },
                );
                setPalette(null);
              }}
            >
              <Icon name="more" size={20} />
            </button>
          )}
        </div>
        {!isClosed &&
          !collapsed &&
          children.filter((child) => moreLabels || !labelHidden(child)).map((child) =>
            labelRows(child, depth + 1, [...ancestors, label.id]),
          )}
      </div>
    );
  }

  return (
    <aside
      className={`gmail-sidebar${collapsed ? " gmail-sidebar-collapsed" : ""}`}
      aria-label="Mail navigation"
    >
      <div className="gmail-compose-wrap">
        <button
          className="gmail-compose-button"
          onClick={onCompose}
          title={collapsed ? "Compose" : undefined}
        >
          <span className="gmail-compose-icon">
            <Icon name="compose" size={24} />
          </span>
          <span className="gmail-compose-text">Compose</span>
        </button>
      </div>
      <div
        className="gmail-sidebar-scroll"
        onKeyDown={(event) => {
          const target = event.target as HTMLElement;
          if (!target.hasAttribute("data-nav-id")) return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            const row = target.closest(".gmail-label-row");
            const caret = row?.querySelector<HTMLButtonElement>(
              ".gmail-label-caret",
            );
            if (
              caret &&
              caret.getAttribute("aria-expanded") === String(event.key === "ArrowLeft")
            ) {
              event.preventDefault();
              caret.click();
            }
            return;
          }
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>("[data-nav-id]"),
          );
          const index = items.indexOf(target);
          const next = event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          event.preventDefault();
          items[next]?.focus();
        }}
        onScroll={() => {
          if (menu) setMenu(null);
        }}
      >
        <nav className="gmail-navigation" aria-label="Mail folders">
          {nav("inbox", "Inbox", "inboxOutline", inboxCount)}
          {nav("starred", "Starred", "star")}
          {nav("snoozed", "Snoozed", "clock")}
          {nav("sent", "Sent", "send")}
          {nav("drafts", "Drafts", "draft", draftCount)}
          <button
            className="gmail-nav-item gmail-category-toggle"
            aria-expanded={categories}
            data-nav-id="categories"
            tabIndex={focusedNav === "categories" ? 0 : -1}
            onFocus={() => setFocusedNav("categories")}
            onClick={() => setCategories((current) => !current)}
            title={collapsed ? "Categories" : undefined}
          >
            <span className="gmail-category-caret">
              <Icon
                name={categories ? "arrowDropDown" : "arrowRight"}
                size={20}
              />
            </span>
            <Icon name="label" size={20} />
            <span className="gmail-nav-text">Categories</span>
          </button>
          {categories && (
            <div className="gmail-category-items">
              {nav("category:social", "Social", "social")}
              {nav("category:updates", "Updates", "updates")}
              {nav("category:forums", "Forums", "forums")}
              {nav("category:promotions", "Promotions", "promotions")}
            </div>
          )}
          {more && (
            <>
              {nav("important", "Important", "important")}
              {nav("scheduled", "Scheduled", "scheduleSend", scheduledCount)}
              {nav("all", "All Mail", "allMail")}
              {nav("spam", "Spam", "spam")}
              {nav("trash", "Trash", "trash")}
            </>
          )}
          <button
            className="gmail-nav-item"
            aria-expanded={more}
            data-nav-id="more"
            tabIndex={focusedNav === "more" ? 0 : -1}
            onFocus={() => setFocusedNav("more")}
            onClick={() => setMore((current) => !current)}
            title={collapsed ? (more ? "Less" : "More") : undefined}
          >
            <Icon
              name="chevronDown"
              size={20}
              className={more ? "gmail-chevron-up" : undefined}
            />
            <span className="gmail-nav-text">{more ? "Less" : "More"}</span>
          </button>
        </nav>
        <section className="gmail-labels" aria-label="Labels">
          <div className="gmail-labels-heading">
            <h2>Labels</h2>
            <button
              className="icon-button gmail-create-label"
              aria-label="Create new label"
              title="Create new label"
              onClick={() => onCreateLabel()}
            >
              <Icon name="plus" size={20} />
            </button>
          </div>
          {roots
            .filter((label) => !labelHidden(label))
            .map((label) => labelRows(label))}
          {moreLabels && extraRoots.map((label) => labelRows(label))}
          {hasHiddenLabels && (
            <button
              className="gmail-nav-item gmail-labels-more"
              aria-expanded={moreLabels}
              data-nav-id="more-labels"
              tabIndex={focusedNav === "more-labels" ? 0 : -1}
              onFocus={() => setFocusedNav("more-labels")}
              onClick={() => setMoreLabels((current) => !current)}
              title={collapsed ? "More labels" : undefined}
            >
              <Icon
                name="chevronDown"
                size={20}
                className={moreLabels ? "gmail-chevron-up" : undefined}
              />
              <span className="gmail-nav-text">
                {moreLabels ? "Less" : "More"}
              </span>
            </button>
          )}
        </section>
      </div>

      {menu && currentLabel && (
        <div
          ref={menuRef}
          className="gmail-label-menu"
          style={{ top: menu.top, left: menu.left }}
          role="menu"
          aria-label={`Options for ${currentLabel.name}`}
          tabIndex={-1}
          onKeyDown={menuKeyDown}
        >
          <button
            className="gmail-label-menu-item"
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={Boolean(palette)}
            tabIndex={-1}
            onPointerEnter={() => {
              window.clearTimeout(hoverTimer.current);
              hoverTimer.current = window.setTimeout(() => openPalette(false), 300);
            }}
            onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
            onClick={() => openPalette(true)}
          >
            <span className="gmail-label-color-preview" aria-hidden="true" style={{ backgroundColor: currentLabel.color && currentLabel.color.toLowerCase() !== "#e2e3e3" ? currentLabel.color : "#fff", color: currentLabel.textColor || "#202124" }}>a</span>
            <span>Label color</span>
            <Icon name="contextArrow20" size={20} className="gmail-label-menu-arrow" />
          </button>
          {palette && (
            <div ref={paletteRef} className="gmail-label-palette" role="menu" aria-label="Label color" style={{ left: palette.left, top: palette.top }}>
              <div className="gmail-label-menu-heading">Label color</div>
              <div className="gmail-label-color-grid" role="grid" aria-label="Standard label colors">
                {[0, 1, 2, 3].map((row) => <div role="row" key={row}>
                {labelColors.slice(row * 6, row * 6 + 6).map((color) => (
                  <button
                    key={color.background}
                    type="button"
                    role="gridcell"
                    className="gmail-label-swatch"
                    aria-selected={Boolean(currentLabel.color?.toLowerCase() === color.background && currentLabel.textColor?.toLowerCase() === color.text)}
                    aria-label={`a ${colorName(color.background)}`}
                    title={colorName(color.background)}
                    tabIndex={-1}
                    onClick={() => {
                      onLabelAction("color", currentLabel.id, color.background, color.text);
                      setMenu(null);
                    }}
                  ><span style={{ backgroundColor: color.background, color: color.text }}>a</span></button>
                ))}
                </div>)}
              </div>
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="gmail-label-menu-item"
                onClick={() => { setCustomColor(currentLabel); setMenu(null); }}
              >Add custom color</button>
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="gmail-label-menu-item"
                onClick={() => {
                  onLabelAction("color", currentLabel.id, undefined, undefined);
                  setMenu(null);
                }}
              >
                Remove color
              </button>
            </div>
          )}
          <div className="gmail-label-menu-divider" />
          <div role="group" aria-label="In label list">
          <div className="gmail-label-menu-heading">In label list</div>
          {([{ text: "Show", value: "show" }, { text: "Show if unread", value: "unread" }, { text: "Hide", value: "hide" }] as const).map((choice) => {
            const checked = (currentLabel.visibility ?? (currentLabel.visible === false ? "hide" : "show")) === choice.value;
            return <button key={choice.value} type="button" role="menuitemradio" aria-checked={checked} tabIndex={-1} className="gmail-label-menu-item" onPointerEnter={closePalette} onClick={() => { onLabelAction("visibility", currentLabel.id, choice.value); setMenu(null); }}>
              {checked && <Icon name="check" size={20} className="gmail-label-menu-check" />}{choice.text}
            </button>;
          })}
          </div>
          <div className="gmail-label-menu-divider" />
          <div role="group" aria-label="In message list">
          <div className="gmail-label-menu-heading">In message list</div>
          {[{ text: "Show", value: "show" }, { text: "Hide", value: "hide" }].map((choice) => {
            const checked = (currentLabel.messageVisible !== false) === (choice.value === "show");
            return <button key={choice.value} type="button" role="menuitemradio" aria-checked={checked} tabIndex={-1} className="gmail-label-menu-item" onPointerEnter={closePalette} onClick={() => { onLabelAction("messageVisibility", currentLabel.id, choice.value); setMenu(null); }}>
              {checked && <Icon name="check" size={20} className="gmail-label-menu-check" />}{choice.text}
            </button>;
          })}
          </div>
          <div className="gmail-label-menu-divider" />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="gmail-label-menu-item"
            onPointerEnter={closePalette}
            onClick={() => {
              onLabelAction("edit", currentLabel.id);
              setMenu(null);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="gmail-label-menu-item"
            onPointerEnter={closePalette}
            onClick={() => {
              onLabelAction("delete", currentLabel.id);
              setMenu(null);
            }}
          >
            Remove label
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="gmail-label-menu-item"
            onPointerEnter={closePalette}
            onClick={() => {
              onCreateLabel(currentLabel.id);
              setMenu(null);
            }}
          >
            Add sublabel
          </button>
        </div>
      )}
      {customColor && <CustomLabelColor label={customColor} onClose={closeCustomColor} onApply={(background, text) => {
        onLabelAction("color", customColor.id, background, text);
        closeCustomColor();
      }} />}
    </aside>
  );
}
