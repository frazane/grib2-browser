// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const WMO_TABLES_VERSION = "v36";
const CODEFLAG_URL = "data/CodeFlag.xml";
const TEMPLATE_URL = "data/Template.xml";

// ─────────────────────────────────────────────
// Global state
// ─────────────────────────────────────────────
let state = {
  tab: "codes",          // "codes" | "templates"
  codeTables: [],        // [{id, type, title, subTables, entries}]
  templateTables: [],    // [{id, type, title, entries}]
  codeIndex: new Map(),  // tableId -> table (for cross-ref links)
  selectedTableId: null,
  searchQuery: "",
};

// ─────────────────────────────────────────────
// getText, parseXML, processCodeFlags, processTemplates are in js/utils.js
// ─────────────────────────────────────────────
// Fetch + bootstrap
// ─────────────────────────────────────────────
async function init() {
  const loadingEl  = document.getElementById("loading");
  const barEl      = document.getElementById("loading-bar");
  const labelEl    = document.getElementById("loading-label");
  const errorEl    = document.getElementById("error-msg");

  function setProgress(pct, label) {
    barEl.style.width = pct + "%";
    labelEl.textContent = label;
  }

  try {
    setProgress(10, "Fetching CodeFlag.xml…");
    const cfText = await fetch(CODEFLAG_URL).then(r => {
      if (!r.ok) throw new Error("Failed to fetch CodeFlag.xml: " + r.status);
      return r.text();
    });

    setProgress(45, "Parsing codes & flags…");
    const cfDoc = parseXML(cfText);
    const { tables: codeTables, index: codeIndex } = processCodeFlags(cfDoc);

    setProgress(55, "Fetching Template.xml…");
    const tpText = await fetch(TEMPLATE_URL).then(r => {
      if (!r.ok) throw new Error("Failed to fetch Template.xml: " + r.status);
      return r.text();
    });

    setProgress(88, "Parsing templates…");
    const tpDoc = parseXML(tpText);
    const templateTables = processTemplates(tpDoc);

    setProgress(100, "Done.");

    state.codeTables     = codeTables;
    state.templateTables = templateTables;
    state.codeIndex      = codeIndex;

    document.getElementById("status").textContent =
      `${codeTables.length} code/flag tables · ${templateTables.length} templates · WMO ${WMO_TABLES_VERSION}`;

    loadingEl.style.display = "none";
    renderSidebar();

  } catch (err) {
    loadingEl.style.display = "none";
    errorEl.style.display = "block";
    errorEl.textContent = "Error: " + err.message +
      "\n\nNote: This file must be opened via a web server (or GitHub Pages), not directly from the filesystem.";
    console.error(err);
  }
}
