import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../ui/Icon";
import type { RichTextEditorHandle } from "./RichTextEditor";
import "./editor.css";

const fonts = [
  ["Sans Serif", "Arial", "arial, sans-serif"],
  ["Serif", "Times New Roman", "'times new roman', serif"],
  ["Fixed Width", "monospace", "monospace"],
  ["Wide", "Arial Black", "'arial black', sans-serif"],
  ["Narrow", "Arial Narrow", "'arial narrow', sans-serif"],
  ["Comic Sans MS", "Comic Sans MS", "'comic sans ms', sans-serif"],
  ["Garamond", "Garamond", "garamond, serif"],
  ["Georgia", "Georgia", "georgia, serif"],
  ["Tahoma", "Tahoma", "tahoma, sans-serif"],
  ["Trebuchet MS", "Trebuchet MS", "'trebuchet ms', sans-serif"],
  ["Verdana", "Verdana", "verdana, sans-serif"],
];
const sizes = [
  ["Small", "1", 10],
  ["Normal", "2", 13],
  ["Large", "4", 18],
  ["Huge", "6", 32],
] as const;
const colors = [
  [
    "#000000",
    "#444444",
    "#666666",
    "#999999",
    "#cccccc",
    "#eeeeee",
    "#f3f3f3",
    "#ffffff",
  ],
  [
    "#ff0000",
    "#ff9900",
    "#ffff00",
    "#00ff00",
    "#00ffff",
    "#0000ff",
    "#9900ff",
    "#ff00ff",
  ],
  [
    "#f4cccc",
    "#fce5cd",
    "#fff2cc",
    "#d9ead3",
    "#d0e0e3",
    "#cfe2f3",
    "#d9d2e9",
    "#ead1dc",
  ],
  [
    "#ea9999",
    "#f9cb9c",
    "#ffe599",
    "#b6d7a8",
    "#a2c4c9",
    "#9fc5e8",
    "#b4a7d6",
    "#d5a6bd",
  ],
  [
    "#e06666",
    "#f6b26b",
    "#ffd966",
    "#93c47d",
    "#76a5af",
    "#6fa8dc",
    "#8e7cc3",
    "#c27ba0",
  ],
  [
    "#cc0000",
    "#e69138",
    "#f1c232",
    "#6aa84f",
    "#45818e",
    "#3d85c6",
    "#674ea7",
    "#a64d79",
  ],
  [
    "#990000",
    "#b45f06",
    "#bf9000",
    "#38761d",
    "#134f5c",
    "#0b5394",
    "#351c75",
    "#741b47",
  ],
  [
    "#660000",
    "#783f04",
    "#7f6000",
    "#274e13",
    "#0c343d",
    "#073763",
    "#20124d",
    "#4c1130",
  ],
];
const tools = [
  {
    icon: "numberedList",
    label: "Numbered list",
    command: "insertOrderedList",
  },
  {
    icon: "bulletedList",
    label: "Bulleted list",
    command: "insertUnorderedList",
  },
  { icon: "indentDecrease", label: "Indent less", command: "outdent" },
  { icon: "indentIncrease", label: "Indent more", command: "indent" },
  {
    icon: "quote",
    label: "Quote",
    command: "formatBlock",
    value: "blockquote",
  },
  { icon: "strikethrough", label: "Strikethrough", command: "strikeThrough" },
  {
    icon: "clearFormatting",
    label: "Remove formatting",
    command: "removeFormat",
  },
];
type MenuName = "font" | "size" | "color" | "align" | "more";

export function FormattingToolbar({
  editorRef,
  disabled = false,
}: {
  editorRef: RefObject<RichTextEditorHandle | null>;
  disabled?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [width, setWidth] = useState(568);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [menu, setMenu] = useState<{
    name: MenuName;
    x: number;
    y: number;
  } | null>(null);
  const [format, setFormat] = useState({
    bold: false,
    italic: false,
    underline: false,
    font: "Arial",
    size: "2",
    alignment: "Left",
  });
  const available = width - (historyVisible ? 80 : 0);
  const visibleTools = Math.max(
    0,
    Math.min(tools.length, Math.floor((available - 388) / 30)),
  );

  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(root.current);
    function selection() {
      const selected = window.getSelection();
      const node = selected?.anchorNode;
      const element =
        node?.nodeType === Node.ELEMENT_NODE
          ? (node as Element)
          : node?.parentElement;
      const editor = element?.closest(".gmail-editor");
      if (!editor || !root.current?.parentElement?.contains(editor)) return;
      setHistoryVisible(true);
      const next = {
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        font:
          document.queryCommandValue("fontName").replace(/["']/g, "") ||
          "Arial",
        size: document.queryCommandValue("fontSize") || "2",
        alignment: document.queryCommandState("justifyCenter")
          ? "Center"
          : document.queryCommandState("justifyRight")
            ? "Right"
            : "Left",
      };
      setFormat((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    }
    selection();
    document.addEventListener("selectionchange", selection);
    return () => {
      observer.disconnect();
      document.removeEventListener("selectionchange", selection);
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    function outside(event: PointerEvent) {
      if (
        !panel.current?.contains(event.target as Node) &&
        !root.current?.contains(event.target as Node)
      )
        setMenu(null);
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setMenu(null);
        trigger.current?.focus();
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        const items = Array.from(
          panel.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || [],
        );
        if (!items.length) return;
        event.preventDefault();
        const index = items.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        items[
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) %
                items.length
        ]?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, [menu]);

  function command(name: string, value?: string) {
    editorRef.current?.command(name, value);
    setMenu(null);
  }

  function open(name: MenuName, button: HTMLButtonElement) {
    editorRef.current?.rememberSelection();
    trigger.current = button;
    if (menu?.name === name) {
      setMenu(null);
      return;
    }
    const dimensions = {
      font: [195.242, 364],
      size: [173.156, 140],
      color: [324, 208],
      align: [36, 92],
      more: [40, (tools.length - visibleTools) * 28 + 8],
    }[name];
    const rect = button.getBoundingClientRect();
    const toolbar = root.current?.getBoundingClientRect();
    setMenu({
      name,
      x: Math.max(
        8,
        Math.min(
          rect.left + rect.width / 2 - dimensions[0] / 2,
          window.innerWidth - dimensions[0] - 8,
        ),
      ),
      y: Math.max(8, (toolbar?.top ?? rect.top) + 2 - dimensions[1]),
    });
  }

  function menuButton(name: MenuName, label: string, icon?: string) {
    return (
      <button
        type="button"
        className={`gmail-format-dropdown gmail-format-${name}`}
        aria-label={label}
        data-tooltip={label}
        aria-haspopup="menu"
        aria-expanded={menu?.name === name}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => open(name, event.currentTarget)}
      >
        {icon ? (
          <Icon name={icon} size={20} />
        ) : (
          <span>
            {fonts.find(
              (font) => font[1].toLowerCase() === format.font.toLowerCase(),
            )?.[0] || "Sans Serif"}
          </span>
        )}
        <span className="gmail-format-arrow">
          <Icon name="formatArrow20" size={20} />
        </span>
      </button>
    );
  }

  function toolButton(tool: (typeof tools)[number], inMenu = false) {
    return (
      <button
        type="button"
        key={tool.icon}
        className={`gmail-format-button ${!inMenu && tool.icon === "strikethrough" ? "gmail-format-strike" : ""}`}
        aria-label={tool.label}
        data-tooltip={tool.label}
        role={inMenu ? "menuitem" : undefined}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => command(tool.command, tool.value)}
      >
        <Icon name={tool.icon} size={20} />
      </button>
    );
  }

  return (
    <div
      ref={root}
      className="gmail-formatting-row"
      onPointerDownCapture={() => editorRef.current?.rememberSelection()}
    >
      <div
        className="gmail-formatting-toolbar"
        role="toolbar"
        aria-label="Formatting options"
        aria-disabled={disabled}
      >
        {menuButton("font", "Font")}
        <span className="gmail-format-divider" />
        {menuButton("size", "Font size", "formatSize")}
        <span className="gmail-format-divider" />
        {(["bold", "italic", "underline"] as const).map((name) => (
          <button
            type="button"
            key={name}
            className="gmail-format-button"
            aria-label={`${name[0].toUpperCase()}${name.slice(1)}`}
            data-tooltip={`${name[0].toUpperCase()}${name.slice(1)}`}
            aria-pressed={format[name]}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command(name)}
          >
            <Icon name={name} size={20} />
          </button>
        ))}
        {menuButton("color", "Text color", "textColor")}
        <span className="gmail-format-divider" />
        {menuButton("align", "Align", `align${format.alignment}`)}
        {tools.slice(0, visibleTools).map((tool) => toolButton(tool))}
        {visibleTools < tools.length && (
          <>
            <span className="gmail-format-divider" />
            <button
              type="button"
              className="gmail-format-button gmail-format-overflow"
              aria-label="More formatting options"
              data-tooltip="More formatting options"
              aria-haspopup="menu"
              aria-expanded={menu?.name === "more"}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => open("more", event.currentTarget)}
            >
              <Icon name="formatArrow20" size={20} />
            </button>
          </>
        )}
      </div>
      {historyVisible && (
        <div
          className="gmail-format-history"
          role="toolbar"
          aria-label="Undo and redo"
        >
          {["undo", "redo"].map((name) => (
            <button
              key={name}
              type="button"
              className="gmail-format-button"
              aria-label={name === "undo" ? "Undo" : "Redo"}
              data-tooltip={name === "undo" ? "Undo" : "Redo"}
              disabled={
                disabled ||
                (name === "redo" && !document.queryCommandEnabled("redo"))
              }
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => command(name)}
            >
              <Icon name={name} size={20} />
            </button>
          ))}
        </div>
      )}
      {menu &&
        createPortal(
          <div
            ref={panel}
            className={`gmail-format-menu gmail-format-menu-${menu.name}`}
            role="menu"
            aria-label={
              menu.name === "more"
                ? "More formatting options"
                : menu.name === "color"
                  ? "Text color"
                  : menu.name === "font"
                    ? "Font"
                    : menu.name === "size"
                      ? "Font size"
                      : "Align"
            }
            style={{ left: menu.x, top: menu.y }}
            onMouseDown={(event) => event.preventDefault()}
          >
            {menu.name === "font" &&
              fonts.map(([label, value, family]) => (
                <button
                  type="button"
                  key={value}
                  role="menuitemradio"
                  aria-checked={
                    format.font.toLowerCase() === value.toLowerCase()
                  }
                  style={{ fontFamily: family }}
                  onClick={() => {
                    setFormat((current) => ({ ...current, font: value }));
                    command("fontName", value);
                  }}
                >
                  {label}
                </button>
              ))}
            {menu.name === "size" &&
              sizes.map(([label, value, size]) => (
                <button
                  type="button"
                  key={value}
                  role="menuitemradio"
                  aria-checked={format.size === value}
                  style={{ fontSize: size }}
                  onClick={() => {
                    setFormat((current) => ({ ...current, size: value }));
                    command("fontSize", value);
                  }}
                >
                  {label}
                </button>
              ))}
            {menu.name === "align" &&
              ["Left", "Center", "Right"].map((alignment) => (
                <button
                  type="button"
                  key={alignment}
                  role="menuitemradio"
                  aria-checked={format.alignment === alignment}
                  aria-label={`Align ${alignment.toLowerCase()}`}
                  onClick={() => {
                    setFormat((current) => ({ ...current, alignment }));
                    command(`justify${alignment}`);
                  }}
                >
                  <Icon name={`align${alignment}`} size={20} />
                </button>
              ))}
            {menu.name === "more" &&
              tools.slice(visibleTools).map((tool) => toolButton(tool, true))}
            {menu.name === "color" &&
              ["Background color", "Text color"].map((label) => (
                <div key={label} className="gmail-color-palette">
                  <div>{label}</div>
                  <div
                    className="gmail-color-grid"
                    role="group"
                    aria-label={label}
                  >
                    {colors.map((row, rowIndex) => (
                      <div key={rowIndex} className="gmail-color-grid-row">
                        {row.map((color) => (
                          <button
                            type="button"
                            key={color}
                            role="menuitem"
                            aria-label={`${label} ${color}`}
                            title={color}
                            style={{ backgroundColor: color }}
                            onClick={() =>
                              command(
                                label === "Text color"
                                  ? "foreColor"
                                  : "hiliteColor",
                                color,
                              )
                            }
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
