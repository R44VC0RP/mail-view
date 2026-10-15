import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import "./support-fidelity.css";

// Exact window.open argument observed in bench/reference/training-url.json.
export const GMAIL_TRAINING_URL = "//support.google.com/a/users/?p=gmail_training";

const resources = [
  "Change or reset your password",
  "Create a Gmail signature",
  "Create a Google Account for Gmail",
  "Sign out of or remove your account from Gmail",
  "Sign in to Gmail",
];
const issueOptions = [
  "Send or receive chat message",
  "Change notifications settings",
  "Find messages or attachments",
  "Send or receive email",
  "Get help with your Gmail account",
  "Report spam or block someone",
  "Other",
];

// Public SVG paths copied from the header-help/header-feedback reference JSON.
const glyphs = {
  close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z",
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  article: "M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
  community: "M16 13c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10zm-1-9v7H4V4h11zm6 2h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1z",
  feedback: "M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17l-.59.59-.58.58V4h16v12zm-9-4h2v2h-2zm0-6h2v4h-2z",
  search: "M20.49 19l-5.73-5.73C15.53 12.2 16 10.91 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.41 0 2.7-.47 3.77-1.24L19 20.49 20.49 19zM5 9.5C5 7.01 7.01 5 9.5 5S14 7.01 14 9.5 11.99 14 9.5 14 5 11.99 5 9.5z",
  flag: "M12.36 6l.4 2H18v6h-3.36l-.4-2H7V6h5.36M14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6L14 4z",
  idea: "M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z",
  dropdown: "M7 10l5 5 5-5H7z",
  screenshot: "M5 10H6.5V7.5H9V6H5ZM15 16H19V12H17.5V14.5H15ZM8 21V19H4Q3.175 19 2.588 18.413Q2 17.825 2 17V5Q2 4.175 2.588 3.587Q3.175 3 4 3H20Q20.825 3 21.413 3.587Q22 4.175 22 5V17Q22 17.825 21.413 18.413Q20.825 19 20 19H16V21ZM4 17H20Q20 17 20 17Q20 17 20 17V5Q20 5 20 5Q20 5 20 5H4Q4 5 4 5Q4 5 4 5V17Q4 17 4 17Q4 17 4 17ZM4 17Q4 17 4 17Q4 17 4 17V5Q4 5 4 5Q4 5 4 5Q4 5 4 5Q4 5 4 5V17Q4 17 4 17Q4 17 4 17Z",
};

function SupportGlyph({ name }: { name: keyof typeof glyphs }) {
  return <svg className="gopen-support-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d={glyphs[name]} /><path d="M0 0h24v24H0V0z" fill="none" /></svg>;
}

export function SupportView({ topic, onClose }: { topic: "help" | "feedback"; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(topic === "feedback");
  const [intent, setIntent] = useState<"issue" | "idea" | null>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [screenshot, setScreenshot] = useState(false);
  const [review, setReview] = useState(false);
  const [notice, setNotice] = useState("");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [article, setArticle] = useState("");
  const localRecord = useRef<object | null>(null);

  useEffect(() => {
    setFeedbackOpen(topic === "feedback");
    setIntent(null);
    setReview(false);
    setNotice("");
  }, [topic]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  const title = intent === "issue" ? "Report an issue" : intent === "idea" ? "Suggest an idea" : "Send feedback to Google";
  const canSubmit = description.trim().length > 0 && (intent !== "issue" || category !== "");
  const submitLocal = () => {
    if (!canSubmit) return;
    localRecord.current = { intent, category, description, emailUpdates, screenshot: screenshot ? "blank-local-preview" : null, createdAt: new Date().toISOString() };
    try { sessionStorage.setItem("gopen.mockFeedback", JSON.stringify(localRecord.current)); } catch { /* The in-memory record remains available if storage is disabled. */ }
    setNotice("Feedback saved in this local demo. Nothing was sent to Google.");
  };

  return <div ref={root} tabIndex={-1} className={`gopen-support ${feedbackOpen ? "gopen-support-feedback-backdrop" : "gopen-support-help-root"}`} onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); onClose(); }
    if (event.key === "Tab" && feedbackOpen) {
      const controls = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select,a[href]') ?? [])].filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first?.focus(); }
    }
  }}>
    {!feedbackOpen ? <section className="gopen-support-help" role="dialog" aria-label="Help">
      <header className="gopen-support-help-header">
        {(article || searching) && <button className="gopen-support-help-back gopen-support-icon-button" aria-label="Back" onClick={() => { setArticle(""); setSearching(false); setQuery(""); }}><SupportGlyph name="back" /></button>}
        <h1>Help</h1>
        <button className="gopen-support-help-close gopen-support-icon-button" aria-label="Close Help Panel" onClick={onClose}><svg className="gopen-support-glyph" viewBox="0 0 48 48" aria-hidden="true"><path d="M38 12.83L35.17 10 24 21.17 12.83 10 10 12.83 21.17 24 10 35.17 12.83 38 24 26.83 35.17 38 38 35.17 26.83 24z" /></svg></button>
      </header>
      <div className="gopen-support-help-scroll">
        {article ? <div className="gopen-support-demo-article"><h2>{article}</h2><p>Article content is not available in this local demo.</p></div> : <>
          {searching && <input className="gopen-support-help-query" autoFocus aria-label="Search Help" placeholder="Search Help" value={query} onChange={event => setQuery(event.target.value)} />}
          <h2 className="gopen-support-help-heading">Popular help resources</h2>
          {resources.filter(resource => resource.toLowerCase().includes(query.toLowerCase())).map(resource => <button key={resource} className="gopen-support-resource" aria-label={`${resource} (Help article)`} onClick={() => setArticle(resource)}><span className="gopen-support-help-circle"><SupportGlyph name="article" /></span><span>{resource}</span></button>)}
          <button className="gopen-support-forum" onClick={() => setArticle("Visit help forum")}>Visit help forum <Icon name="openInNew" size={14} /></button>
          <div className="gopen-support-help-search-wrap"><button className="gopen-support-help-search" onClick={() => setSearching(true)}><SupportGlyph name="search" /><span>Search Help</span></button></div>
          <div className="gopen-support-help-divider" />
          <h2 className="gopen-support-help-heading">Need more help?</h2>
          <button className="gopen-support-community" onClick={() => setArticle("Ask the Help Community")}><span className="gopen-support-help-circle"><SupportGlyph name="community" /></span><span>Ask the Help Community<small>Get answers from community experts</small></span></button>
          <div className="gopen-support-help-divider" />
          <button className="gopen-support-help-feedback" onClick={() => setFeedbackOpen(true)}><span className="gopen-support-help-circle"><SupportGlyph name="feedback" /></span><span>Send feedback</span></button>
        </>}
      </div>
    </section> : <section className={`gopen-support-feedback ${intent ? "gopen-support-feedback-form" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="gopen-support-feedback-header">
        {intent && <button className="gopen-support-icon-button" aria-label="Back" onClick={() => { if (review) setReview(false); else { setIntent(null); setDescription(""); setCategory(""); setScreenshot(false); } setNotice(""); }}><SupportGlyph name="back" /></button>}
        <h1>{title}</h1><button className="gopen-support-icon-button gopen-support-feedback-close" aria-label="Close" onClick={onClose}><SupportGlyph name="close" /></button>
      </header>
      {notice ? <div className="gopen-support-local-notice" role="status"><p>{notice}</p><button className="gopen-support-primary" onClick={onClose}>Close</button></div> : !intent ? <div className="gopen-support-feedback-choices">
        <img className="gopen-support-feedback-illustration" src={new URL("../assets/header-feedback-illustration.png", import.meta.url).href} alt="" />
        <button onClick={() => setIntent("issue")}><span className="gopen-support-intent-circle"><SupportGlyph name="flag" /></span>Report an issue</button>
        <button onClick={() => setIntent("idea")}><span className="gopen-support-intent-circle"><SupportGlyph name="idea" /></span>Suggest an idea</button>
      </div> : <>
        <div className="gopen-support-feedback-content">
          <div className="gopen-support-feedback-fields">
            {review ? <div className="gopen-support-local-notice"><h2>Review local feedback</h2><p>{description}</p><p>This review screen is a local mock. No account or system information is collected.</p></div> : <>
              {intent === "issue" && <div className="gopen-support-category"><label htmlFor="gopen-support-category">When you noticed this issue, what were you trying to do? (required)</label><div className="gopen-support-select"><select id="gopen-support-category" value={category} onChange={event => setCategory(event.target.value)} required><option value="">Choose an option</option>{issueOptions.map(option => <option key={option}>{option}</option>)}</select><SupportGlyph name="dropdown" /></div></div>}
              <label className="gopen-support-description-label" htmlFor="gopen-support-description">Describe your {intent === "idea" ? "suggestion" : "issue"} (required)</label>
              <textarea id="gopen-support-description" value={description} onChange={event => setDescription(event.target.value)} placeholder={intent === "idea" ? "Tell us how we can improve our product" : "Tell us what happened and what's not working"} required />
              <div className="gopen-support-sensitive">Please don&apos;t include any sensitive information <Icon name="help" size={14} /></div>
            </>}
            {(intent === "idea" || review) && <div className="gopen-support-screenshot"><p>A screenshot will help us better understand your {intent === "idea" ? "idea" : "issue"}.</p><button className="gopen-support-outline" onClick={() => setScreenshot(!screenshot)}><SupportGlyph name="screenshot" />{screenshot ? "Remove screenshot" : "Capture screenshot"}</button>{screenshot && <div className="gopen-support-blank-preview" role="img" aria-label="Blank local screenshot preview; no mail captured"><span>Blank local preview</span></div>}</div>}
          </div>
          <div className="gopen-support-feedback-bottom">
            <label className="gopen-support-checkbox"><input type="checkbox" checked={emailUpdates} onChange={event => setEmailUpdates(event.target.checked)} /><span className="gopen-support-checkbox-box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.73,12.91 8.1,19.28 22.79,4.59" /></svg></span><span>We may email you for more information or updates</span></label>
            <p className="gopen-support-legal">Some <button onClick={() => setNotice("Local demo: no account or system information is collected.")}>account and system information</button> may be sent to Google. We will use it to fix problems and improve our services, subject to our <button onClick={() => setNotice("Local demo: nothing is transmitted to Google.")}>Privacy Policy</button> and <button onClick={() => setNotice("Local demo: nothing is transmitted to Google.")}>Terms of Service</button>. We may email you for more information or updates. Go to <button onClick={() => setNotice("Legal Help is not connected in this local demo.")}>Legal Help</button> to ask for content changes for legal reasons.</p>
          </div>
        </div>
        <footer className="gopen-support-feedback-footer"><button className="gopen-support-primary" disabled={!canSubmit} onClick={() => intent === "issue" && !review ? setReview(true) : submitLocal()}>{intent === "issue" && !review ? "Next" : "Send"}</button></footer>
      </>}
    </section>}
  </div>;
}
