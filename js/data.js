// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const RAW_BASE = "https://raw.githubusercontent.com/wmo-im/GRIB2/master/xml/";
const CODEFLAG_URL  = RAW_BASE + "CodeFlag.xml";
const TEMPLATE_URL  = RAW_BASE + "Template.xml";

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
// XML helpers
// ─────────────────────────────────────────────
function getText(el, tag) {
  return el.querySelector(tag)?.textContent?.trim() ?? "";
}

function parseXML(text) {
  return new DOMParser().parseFromString(text, "application/xml");
}

// ─────────────────────────────────────────────
// Pre-processing: CodeFlag.xml  →  structured tables
//
// Title_en format:  "Code table 0.0 - Discipline of processed data…"
//                   "Flag table 3.3 - Resolution and component flags"
// SubTitle_en:      may indicate discipline/category sub-grouping
// ─────────────────────────────────────────────
function processCodeFlags(doc) {
  const tables = new Map();  // key: "0.0" → table object

  const entries = doc.querySelectorAll("GRIB2_CodeFlag_en");
  entries.forEach(el => {
    const rawTitle = getText(el, "Title_en");
    const m = rawTitle.match(/^(Code table|Flag table)\s+(\d+\.\d+)\s+-\s+(.+)$/i);
    if (!m) return;

    const type      = m[1].toLowerCase().includes("flag") ? "Flag table" : "Code table";
    const id        = m[2];   // e.g. "0.0"
    const tableTitle = m[3];  // e.g. "Discipline of processed data…"

    if (!tables.has(id)) {
      tables.set(id, {
        id,
        type,
        title: tableTitle,
        entries: [],
      });
    }

    tables.get(id).entries.push({
      subTitle:   getText(el, "SubTitle_en"),
      code:       getText(el, "CodeFlag"),
      meaning:    getText(el, "MeaningParameterDescription_en"),
      status:     getText(el, "Status"),
    });
  });

  // Sort tables by numeric id
  const sorted = Array.from(tables.values()).sort((a, b) => {
    const [aMaj, aMin] = a.id.split(".").map(Number);
    const [bMaj, bMin] = b.id.split(".").map(Number);
    return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
  });

  // Build cross-reference index
  const index = new Map();
  sorted.forEach(t => index.set(t.id, t));

  return { tables: sorted, index };
}

// ─────────────────────────────────────────────
// Pre-processing: Template.xml  →  structured tables
//
// Title_en format:  "Grid definition template 3.0 - latitude/longitude"
//                   "Product definition template 4.5 - …"
// ─────────────────────────────────────────────
function processTemplates(doc) {
  const tables = new Map();

  const entries = doc.querySelectorAll("GRIB2_Template_en");
  entries.forEach(el => {
    const rawTitle = getText(el, "Title_en");

    // Match: "<Type> template <N.N> - <description>"
    const m = rawTitle.match(/^(.+?template)\s+(\d+\.\d+)\s+-\s+(.+)$/i);
    if (!m) return;

    const type       = m[1];   // e.g. "Grid definition template"
    const id         = m[2];   // e.g. "3.0"
    const tableTitle = m[3];   // e.g. "latitude/longitude"

    if (!tables.has(id)) {
      tables.set(id, {
        id,
        type,
        title: tableTitle,
        entries: [],
      });
    }

    tables.get(id).entries.push({
      octetNo:   getText(el, "OctetNo"),
      contents:  getText(el, "Contents_en"),
      note:      getText(el, "Note_en"),
      noteIDs:   getText(el, "noteIDs"),
      codeTable: getText(el, "codeTable"),
      flagTable: getText(el, "flagTable"),
      status:    getText(el, "Status"),
    });
  });

  // Sort by numeric id
  const sorted = Array.from(tables.values()).sort((a, b) => {
    const [aMaj, aMin] = a.id.split(".").map(Number);
    const [bMaj, bMin] = b.id.split(".").map(Number);
    return aMaj !== bMaj ? aMaj - bMaj : aMin - bMin;
  });

  return sorted;
}

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
      `${codeTables.length} code/flag tables · ${templateTables.length} templates`;

    loadingEl.style.display = "none";
    renderSidebar();

  } catch (err) {
    loadingEl.style.display = "none";
    errorEl.style.display = "block";
    errorEl.textContent = "Error: " + err.message +
      "\n\nNote: This file must be opened via a web server (or GitHub Pages) " +
      "due to CORS restrictions on GitHub's raw content.";
    console.error(err);
  }
}
