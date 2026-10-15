import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Label } from "../types";
import { Icon } from "../ui/Icon";
import { SearchCheckbox, SearchSelect } from "./Search";
import "./search-fidelity.css";

export type FilterRule = {
  id: string;
  query: string;
  archive: boolean;
  read: boolean;
  star: boolean;
  labelId: string;
  trash: boolean;
  important: boolean;
  notImportant?: boolean;
  neverSpam: boolean;
  category: string;
};

export function FilterDialog({ query, labels, count, onClose, onCreate, onBack }: {
  query: string;
  labels: Label[];
  count: number;
  onClose: () => void;
  onCreate: (rule: FilterRule, apply: boolean) => void;
  onBack?: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 256, top: 54 });
  const [rule, setRule] = useState<FilterRule>(() => ({
    id: crypto.randomUUID(), query, archive: false, read: false, star: false,
    labelId: "", trash: false, important: false, notImportant: false, neverSpam: false, category: "",
  }));
  const [apply, setApply] = useState(false);
  const [useLabel, setUseLabel] = useState(false);
  const [useCategory, setUseCategory] = useState(false);
  const [notice, setNotice] = useState("");
  useLayoutEffect(() => {
    const locate = () => {
      const rect = document.querySelector(".gmail-search")?.getBoundingClientRect();
      if (rect) setPosition({ left: rect.left, top: rect.bottom - 2 });
    };
    locate();
    window.addEventListener("resize", locate);
    return () => window.removeEventListener("resize", locate);
  }, []);
  useEffect(() => {
    back.current?.focus();
    const outside = (event: PointerEvent) => { if (!dialog.current?.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);
  function change(key: "archive" | "read" | "star" | "trash" | "neverSpam" | "important" | "notImportant", checked: boolean) {
    setRule((current) => ({ ...current, [key]: checked,
      ...(key === "important" && checked ? { notImportant: false } : {}),
      ...(key === "notImportant" && checked ? { important: false } : {}),
    }));
  }
  return createPortal(<div ref={dialog} className="gmail-filter-step" role="dialog" aria-label="Create filter" style={position}>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (useLabel && !rule.labelId) { setNotice("Choose a label."); return; }
      if (useCategory && !rule.category) { setNotice("Choose a category."); return; }
      if (!(rule.archive || rule.read || rule.star || rule.trash || rule.important || rule.notImportant || rule.neverSpam || (useLabel && rule.labelId) || (useCategory && rule.category))) {
        setNotice("Please select at least one action for your filter."); return;
      }
      onCreate({ ...rule, query, labelId: useLabel ? rule.labelId : "", category: useCategory ? rule.category : "" }, apply);
    }}>
      <div className="gmail-filter-criteria">
        <button ref={back} className="gmail-filter-back icon-button" type="button" aria-label="Back to search options" title="Back to search options" onClick={() => {
          if (onBack) onBack();
          else { onClose(); document.querySelector<HTMLButtonElement>(".gmail-search-options")?.click(); }
        }}><span className="gmail-filter-back-text">&laquo; back to search options</span><Icon name="arrowBack" size={20} /></button>
        <span>When a message is an exact match for your search criteria:</span>
      </div>
      <div className="gmail-filter-options">
        {([{ key: "archive", label: "Skip the Inbox (Archive it)" }, { key: "read", label: "Mark as read" }, { key: "star", label: "Star it" }] as const).map((item) =>
          <div className="gmail-filter-option" key={item.key}><SearchCheckbox checked={rule[item.key]} onChange={(checked) => change(item.key, checked)}>{item.label}</SearchCheckbox></div>)}
        <div className="gmail-filter-option"><SearchCheckbox checked={useLabel} onChange={setUseLabel}>Apply the label:</SearchCheckbox><SearchSelect label="Filter label" className="gmail-filter-label-select" value={rule.labelId} options={[{ value: "", label: "Choose label..." }, ...labels.map((label) => ({ value: label.id, label: label.name }))]} onChange={(value) => { setRule((current) => ({ ...current, labelId: value })); setUseLabel(!!value); }} /></div>
        <div className="gmail-filter-option"><SearchCheckbox checked={false} onChange={() => {}} disabled>Forward it</SearchCheckbox><button type="button" className="gmail-filter-forward-link" onClick={() => setNotice("Forwarding is not configured in this local mock. No messages will be forwarded.")}>Add forwarding address</button></div>
        {([{ key: "trash", label: "Delete it" }, { key: "neverSpam", label: "Never send it to Spam" }, { key: "important", label: "Always mark it as important" }, { key: "notImportant", label: "Never mark it as important" }] as const).map((item) =>
          <div className="gmail-filter-option" key={item.key}><SearchCheckbox checked={!!rule[item.key]} onChange={(checked) => change(item.key, checked)}>{item.label}</SearchCheckbox></div>)}
        <div className="gmail-filter-option"><SearchCheckbox checked={useCategory} onChange={setUseCategory}>Categorize as:</SearchCheckbox><SearchSelect label="Filter category" className="gmail-filter-category-select" value={rule.category} options={[{ value: "", label: "Choose category..." }, ...["primary", "social", "promotions", "updates", "forums"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))]} onChange={(value) => { setRule((current) => ({ ...current, category: value })); setUseCategory(!!value); }} /></div>
      </div>
      <div className="gmail-filter-apply"><SearchCheckbox checked={apply} onChange={setApply}>Also apply filter to <strong>{count}</strong> matching conversation{count === 1 ? "" : "s"}.</SearchCheckbox></div>
      <div className="gmail-filter-actions"><button type="button" className="gmail-filter-learn" onClick={() => setNotice("Filters automatically apply the selected actions to matching messages in this local mailbox.")}><Icon name="help" size={20} /><span>Learn more</span></button><button type="submit" className="gmail-advanced-submit">Create filter</button></div>
      {notice && <div className="gmail-filter-notice" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss" onClick={() => setNotice("")}><Icon name="close" size={20} /></button></div>}
    </form>
  </div>, document.body);
}
