import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { RefObject } from "react";
import "./editor.css";

export type RichTextEditorHandle = {
  command: (name: string, value?: string) => void;
  focus: (position?: "start" | "end") => void;
  getContent: () => { body: string; html: string };
  setContent: (body: string, html?: string) => void;
  setSignature: (text: string) => void;
  getSelectedText: () => string;
  insertLink: (text: string, url: string) => void;
  rememberSelection: () => void;
};

type RichTextEditorProps = {
  body: string;
  html?: string;
  onChange: (body: string, html: string) => void;
  label: string;
  editorRef?: RefObject<RichTextEditorHandle | null>;
  autoFocus?: boolean;
  className?: string;
  plainText?: boolean;
  onFiles?: (files: FileList) => void;
  trimQuote?: boolean;
};

function editorHtml(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed
    .querySelectorAll(
      "script, style, iframe, frame, frameset, object, embed, form, input, button, textarea, select, link, meta, base, svg, math, video, audio, template",
    )
    .forEach((node) => node.remove());
  const allowed = new Set([
    "DIV",
    "P",
    "SPAN",
    "BR",
    "B",
    "STRONG",
    "I",
    "EM",
    "U",
    "S",
    "STRIKE",
    "UL",
    "OL",
    "LI",
    "A",
    "BLOCKQUOTE",
    "PRE",
    "FONT",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "TABLE",
    "TBODY",
    "THEAD",
    "TFOOT",
    "TR",
    "TD",
    "TH",
    "CAPTION",
    "COLGROUP",
    "COL",
    "IMG",
    "HR",
    "SUP",
    "SUB",
  ]);
  parsed.body.querySelectorAll("*").forEach((node) => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    const style = (node as HTMLElement).style;
    const safeStyle = [
      "color",
      "background-color",
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "line-height",
      "text-decoration",
      "text-decoration-line",
      "text-align",
      "vertical-align",
      "white-space",
      "word-break",
      "overflow-wrap",
      "letter-spacing",
      "width",
      "height",
      "min-width",
      "max-width",
      "min-height",
      "max-height",
      "display",
      "table-layout",
      "border-collapse",
      "border-spacing",
      "border",
      "border-top",
      "border-right",
      "border-bottom",
      "border-left",
      "border-radius",
      "margin",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "padding",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
    ]
      .map((property) => {
        const value = style.getPropertyValue(property);
        return value && !/url\s*\(|expression\s*\(/i.test(value)
          ? `${property}:${value}`
          : "";
      })
      .filter(Boolean)
      .join(";");
    const href = node.tagName === "A" ? node.getAttribute("href") : null;
    const face = node.tagName === "FONT" ? node.getAttribute("face") : null;
    const size = node.tagName === "FONT" ? node.getAttribute("size") : null;
    const color = node.tagName === "FONT" ? node.getAttribute("color") : null;
    const classes = Array.from(node.classList).filter((name) =>
      [
        "gmail_quote",
        "gmail_quote_container",
        "gmail_attr",
        "gmail_sendername",
        "gmail_signature",
      ].includes(name),
    );
    const attributes = Array.from(node.attributes).filter((attribute) => {
      if (["dir", "align", "valign"].includes(attribute.name))
        return /^(ltr|rtl|auto|left|right|center|justify|top|middle|bottom|baseline)$/i.test(
          attribute.value,
        );
      if (
        [
          "width",
          "height",
          "colspan",
          "rowspan",
          "cellpadding",
          "cellspacing",
          "border",
          "span",
        ].includes(attribute.name)
      )
        return /^\d{1,5}%?$/.test(attribute.value);
      if (attribute.name === "bgcolor")
        return /^(#[0-9a-f]{3,8}|[a-z]+)$/i.test(attribute.value);
      return (
        node.tagName === "IMG" && ["alt", "title"].includes(attribute.name)
      );
    });
    const src = node.tagName === "IMG" ? node.getAttribute("src") : null;
    Array.from(node.attributes).forEach((attribute) =>
      node.removeAttribute(attribute.name),
    );
    if (safeStyle) node.setAttribute("style", safeStyle);
    if (classes.length) node.setAttribute("class", classes.join(" "));
    attributes.forEach(({ name, value }) => node.setAttribute(name, value));
    // Never load remote images from pasted or quoted mail, including tracking pixels.
    if (
      src &&
      (/^data:image\/(png|jpeg|gif|webp);base64,/i.test(src) ||
        src.startsWith(`blob:${window.location.origin}/`))
    ) {
      node.setAttribute("src", src);
      node.setAttribute("referrerpolicy", "no-referrer");
    }
    if (href && /^(https?:\/\/|mailto:)/i.test(href)) {
      node.setAttribute("href", href);
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
    if (face) node.setAttribute("face", face);
    if (size && /^[1-7]$/.test(size)) node.setAttribute("size", size);
    if (color && /^(#[0-9a-f]{3,8}|[a-z]+)$/i.test(color))
      node.setAttribute("color", color);
  });
  return parsed.body.innerHTML;
}

function plainHtml(text: string) {
  const element = document.createElement("div");
  element.textContent = text;
  return element.innerHTML.replace(/\r?\n/g, "<br>");
}

function htmlText(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  clone
    .querySelectorAll("div, p, blockquote, tr, li, h1, h2, h3, h4, h5, h6")
    .forEach((node) => node.append("\n"));
  clone.querySelectorAll("td, th").forEach((node) => node.append("\t"));
  return (clone.textContent || "").replace(/\n$/, "");
}

export function RichTextEditor({
  body,
  html,
  onChange,
  label,
  editorRef,
  autoFocus,
  className = "",
  plainText = false,
  onFiles,
  trimQuote = false,
}: RichTextEditorProps) {
  const editor = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const initialized = useRef(false);
  const lastPlainText = useRef(plainText);
  const change = useRef(onChange);
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const [hasQuote, setHasQuote] = useState(false);
  change.current = onChange;

  function rememberSelection() {
    const current = window.getSelection();
    if (!editor.current || !current?.rangeCount) return;
    const range = current.getRangeAt(0);
    if (
      editor.current.contains(range.startContainer) &&
      editor.current.contains(range.endContainer)
    )
      selection.current = range.cloneRange();
  }

  function restoreSelection(position?: "start" | "end") {
    const element = editor.current;
    const current = window.getSelection();
    if (!element || !current) return false;
    element.focus();
    let range = selection.current;
    if (
      position ||
      !range ||
      !element.contains(range.startContainer) ||
      !element.contains(range.endContainer)
    ) {
      range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(position === "start");
    }
    current.removeAllRanges();
    current.addRange(range);
    return true;
  }

  function getContent() {
    const element = editor.current;
    if (!element) return { body: "", html: "" };
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-editor-trimmed]").forEach((node) => {
      node.removeAttribute("hidden");
      node.removeAttribute("data-editor-trimmed");
    });
    const body = element.querySelector("[data-editor-trimmed][hidden]")
      ? htmlText(clone)
      : element.innerText;
    return { body, html: plainText ? plainHtml(body) : clone.innerHTML };
  }

  function updateQuote() {
    const quote = editor.current?.querySelector<HTMLElement>(
      ":scope > .gmail_quote",
    );
    setHasQuote(Boolean(quote));
    if (!quote) return;
    quote.toggleAttribute("data-editor-trimmed", trimQuote);
    quote.hidden = trimQuote && !quoteExpanded && !plainText;
  }

  function setContent(body: string, html?: string) {
    if (!editor.current) return;
    editor.current.innerHTML =
      html && !plainText ? editorHtml(html) : plainHtml(body);
    selection.current = null;
    updateQuote();
  }

  function save() {
    if (!editor.current) return;
    const content = getContent();
    change.current(content.body, content.html);
    updateQuote();
    rememberSelection();
  }

  function command(name: string, value?: string) {
    if (
      plainText &&
      !["insertText", "undo", "redo", "selectAll"].includes(name)
    )
      return;
    if (!restoreSelection()) return;
    // Chromium editing commands keep the browser's undo stack and active selection intact.
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(
      name,
      false,
      name === "insertHTML" && value ? editorHtml(value) : value,
    );
    save();
  }

  useImperativeHandle(editorRef, () => ({
    command,
    focus: (position) => {
      restoreSelection(position);
    },
    getContent,
    setContent,
    setSignature: (text) => {
      if (!editor.current || !restoreSelection()) return;
      const signature = editor.current.querySelector<HTMLElement>(
        ":scope > .gmail_signature",
      );
      if (!signature && !text) return;
      const range = document.createRange();
      if (signature) range.selectNode(signature);
      else {
        const quote = editor.current.querySelector(":scope > .gmail_quote");
        if (quote) range.setStartBefore(quote);
        else range.selectNodeContents(editor.current);
        range.collapse(Boolean(quote));
      }
      selection.current = range;
      command(
        plainText ? "insertText" : "insertHTML",
        text
          ? plainText
            ? text
            : `<div class="gmail_signature">${plainHtml(text)}</div>`
          : "",
      );
    },
    getSelectedText: () => selection.current?.toString() || "",
    rememberSelection,
    insertLink: (text, url) => {
      if (!/^(https?:\/\/|mailto:)/i.test(url)) return;
      if (plainText) {
        command("insertText", text ? `${text} (${url})` : url);
        return;
      }
      if (!restoreSelection()) return;
      if (selection.current && !selection.current.collapsed && selection.current.toString() === text) {
        document.execCommand("createLink", false, url);
        editor.current?.querySelectorAll("a").forEach(link => {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        });
        save();
        return;
      }
      const link = document.createElement("a");
      link.textContent = text || url;
      if (document.queryCommandState("bold")) link.style.fontWeight = "700";
      if (document.queryCommandState("italic")) link.style.fontStyle = "italic";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      command("insertHTML", link.outerHTML);
    },
  }));

  useLayoutEffect(() => {
    if (!editor.current || initialized.current) return;
    setContent(body, html);
    initialized.current = true;
    if (autoFocus) restoreSelection();
  }, []);

  useLayoutEffect(updateQuote, [trimQuote, quoteExpanded, plainText]);

  useEffect(() => {
    document.addEventListener("selectionchange", rememberSelection);
    return () =>
      document.removeEventListener("selectionchange", rememberSelection);
  }, []);

  useEffect(() => {
    if (lastPlainText.current === plainText || !editor.current) return;
    lastPlainText.current = plainText;
    if (plainText) {
      restoreSelection();
      document.execCommand("selectAll", false);
      document.execCommand("insertHTML", false, plainHtml(getContent().body));
      save();
    }
  }, [plainText]);

  return (
    <>
      <div
        ref={editor}
        className={`gmail-editor ${className}`}
        contentEditable={plainText ? "plaintext-only" : true}
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        tabIndex={0}
        spellCheck
        onInput={save}
        onBlur={rememberSelection}
        onKeyUp={rememberSelection}
        onKeyDown={(event) => {
          if (
            plainText &&
            (event.ctrlKey || event.metaKey) &&
            ["b", "i", "u"].includes(event.key.toLowerCase())
          )
            event.preventDefault();
        }}
        onPaste={(event) => {
          event.preventDefault();
          if (event.clipboardData.files.length) {
            onFiles?.(event.clipboardData.files);
            return;
          }
          rememberSelection();
          const pasted = event.clipboardData.getData("text/html");
          command(
            !plainText && pasted ? "insertHTML" : "insertText",
            !plainText && pasted
              ? pasted
              : event.clipboardData.getData("text/plain"),
          );
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files"))
            event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (event.dataTransfer.files.length) {
            onFiles?.(event.dataTransfer.files);
            return;
          }
          rememberSelection();
          const pasted = event.dataTransfer.getData("text/html");
          command(
            !plainText && pasted ? "insertHTML" : "insertText",
            !plainText && pasted
              ? pasted
              : event.dataTransfer.getData("text/plain"),
          );
        }}
      />
      {trimQuote && hasQuote && !plainText && (
        <div className="gmail-editor-trim-control" contentEditable={false}>
          <button
            type="button"
            className="gmail-trimmed-button"
            aria-label={
              quoteExpanded ? "Hide trimmed content" : "Show trimmed content"
            }
            title={
              quoteExpanded ? "Hide trimmed content" : "Show trimmed content"
            }
            aria-expanded={quoteExpanded}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setQuoteExpanded((value) => !value)}
          >
            <span aria-hidden="true">...</span>
          </button>
        </div>
      )}
    </>
  );
}
