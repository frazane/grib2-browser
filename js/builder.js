// ─────────────────────────────────────────────
// Top-level tab switching (Browser ↔ Builder)
// ─────────────────────────────────────────────
let topTab = "browser";

// Navigate from builder to a table in the browser tab.
// builderState is untouched; switching back via the Builder tab restores the view.
function goToTableFromBuilder(id, tab) {
  switchTopTab("browser");
  goToTable(id, tab);
}

function switchTopTab(tab) {
  topTab = tab;
  document.getElementById("top-tab-browser").classList.toggle("active", tab === "browser");
  document.getElementById("top-tab-builder").classList.toggle("active", tab === "builder");

  // Show / hide browser-only / builder-only topbar elements
  document.querySelectorAll(".browser-only").forEach(el => {
    el.style.display = tab === "browser" ? "" : "none";
  });
  document.querySelectorAll(".builder-only").forEach(el => {
    el.style.display = tab === "builder" ? "" : "none";
  });

  // Show / hide content panes
  document.getElementById("browser-content").style.display = tab === "browser" ? "flex" : "none";
  document.getElementById("builder-main").style.display    = tab === "builder" ? "flex" : "none";

  if (tab === "builder") {
    renderBuilderSidebar();
    renderBuilderDetail();
  }
}

// ─────────────────────────────────────────────
// Editor — load GRIB2 file and populate builder state
// ─────────────────────────────────────────────
function loadGrib2File(input) {
  const file = input.files[0];
  input.value = "";
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const bytes = new Uint8Array(e.target.result);
    let decoded;
    try {
      decoded = decodeGrib2(bytes);
    } catch (err) {
      document.getElementById("builder-detail").innerHTML =
        `<div class="load-error"><strong>Failed to load GRIB2 file:</strong><br>${escHtml(err.message)}</div>`;
      return;
    }

    Object.assign(builderState.s0, decoded.s0);
    Object.assign(builderState.s1, decoded.s1);
    Object.assign(builderState.s3, decoded.s3);
    Object.assign(builderState.s4, decoded.s4);
    Object.assign(builderState.s5, decoded.s5);
    Object.assign(builderState.s6, decoded.s6);
    for (let i = 0; i <= 7; i++) builderState.completed.add(i);
    builderState.currentStep = 0;

    renderBuilderSidebar();
    renderBuilderDetail();

    if (decoded.warnings.length) {
      const warnItems = decoded.warnings.map(w => `<li>${escHtml(w)}</li>`).join("");
      const banner = document.createElement("div");
      banner.className = "load-warning";
      banner.innerHTML = `<strong>Loaded with ${decoded.warnings.length} warning(s):</strong><ul>${warnItems}</ul>`;
      const detail = document.getElementById("builder-detail");
      detail.insertBefore(banner, detail.firstChild);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ─────────────────────────────────────────────
// Builder — constants & state
// ─────────────────────────────────────────────
const BUILDER_STEPS = [
  { id: 0, title: "Section 0", desc: "Indicator / Discipline" },
  { id: 1, title: "Section 1", desc: "Identification" },
  { id: 2, title: "Section 2", desc: "Local Use (empty)" },
  { id: 3, title: "Section 3", desc: "Grid Definition" },
  { id: 4, title: "Section 4", desc: "Product Definition" },
  { id: 5, title: "Section 5", desc: "Data Representation" },
  { id: 6, title: "Section 6", desc: "Bitmap" },
  { id: 7, title: "Section 7", desc: "Data (empty)" },
  { id: 8, title: "Build & Download", desc: "Assemble GRIB2 file" },
];

const now = new Date();
let builderState = {
  currentStep: 0,
  s0: { discipline: 0 },
  s1: {
    originatingCentre: 0,
    originatingSubCentre: 0,
    masterTablesVersion: 2,
    localTablesVersion: 0,
    significanceOfRefTime: 1,
    year:   now.getUTCFullYear(),
    month:  now.getUTCMonth() + 1,
    day:    now.getUTCDate(),
    hour:   0,
    minute: 0,
    second: 0,
    productionStatus: 0,
    typeOfData: 0,
  },
  s3: { templateId: null, fields: {}, sourceOfGridDef: 0, numberOfDataPoints: 0, interpretationOfListOfNumbers: 0 },
  s4: { templateId: null, fields: {}, numberOfCoordValues: 0 },
  s5: { templateId: null, fields: {}, numberOfPackedValues: 0 },
  s6: { bitmapIndicator: 255 },
  completed: new Set(),
};

// ─────────────────────────────────────────────
// Builder — sidebar
// ─────────────────────────────────────────────
function renderBuilderSidebar() {
  const sidebar = document.getElementById("builder-sidebar");
  if (!sidebar) return;
  let html = "";
  BUILDER_STEPS.forEach(step => {
    const isActive    = step.id === builderState.currentStep;
    const isCompleted = builderState.completed.has(step.id);
    const check = isCompleted ? `<span class="step-check">✓ </span>` : "";
    html += `<div class="builder-step${isActive ? " active" : ""}" onclick="goToBuilderStep(${step.id})">
      ${check}<span class="step-name">${escHtml(step.title)}</span>
      <span class="step-desc">${escHtml(step.desc)}</span>
    </div>`;
  });
  sidebar.innerHTML = html;
}

function goToBuilderStep(step) {
  builderState.currentStep = step;
  renderBuilderSidebar();
  renderBuilderDetail();
}

// ─────────────────────────────────────────────
// Builder — detail dispatch
// ─────────────────────────────────────────────
function renderBuilderDetail() {
  const detail = document.getElementById("builder-detail");
  if (!detail) return;
  switch (builderState.currentStep) {
    case 0: detail.innerHTML = renderBuilderStep0(); break;
    case 1: detail.innerHTML = renderBuilderStep1(); break;
    case 2: detail.innerHTML = renderBuilderStep2(); break;
    case 3: detail.innerHTML = renderBuilderStep3(); break;
    case 4: detail.innerHTML = renderBuilderStep4(); break;
    case 5: detail.innerHTML = renderBuilderStep5(); break;
    case 6: detail.innerHTML = renderBuilderStep6(); break;
    case 7: detail.innerHTML = renderBuilderStep7(); break;
    case 8: detail.innerHTML = renderBuilderStep8(); break;
  }
}

function builderNavHtml(stepId) {
  const prev = stepId > 0
    ? `<button onclick="goToBuilderStep(${stepId - 1})">← Previous</button>` : "";
  const next = stepId < 8
    ? `<button class="btn-next" onclick="builderNext(${stepId})">Next →</button>` : "";
  return `<div class="builder-nav">${prev}${next}</div>`;
}

function builderNext(stepId) {
  builderState.completed.add(stepId);
  goToBuilderStep(stepId + 1);
}

// ─────────────────────────────────────────────
// Builder — shared helpers
// ─────────────────────────────────────────────

// Build a <select> from a code table + append "Code table X.X" hint
function builderCodeSelect(tableId, curVal, onchangeExpr) {
  const tbl = state.codeIndex.get(tableId);
  if (!tbl) {
    return `<input type="number" min="0" value="${curVal}" onchange="${onchangeExpr}" />
      <span class="field-hint">Code table ${escHtml(tableId)} not loaded</span>`;
  }
  let html = `<select onchange="${onchangeExpr}">`;
  tbl.entries.forEach(e => {
    const c = (e.code || "").trim();
    if (!c || c.includes("-")) return;
    if (e.status === "Deprecated") return;
    if (/^reserved$/i.test(e.meaning.trim()) || /^missing$/i.test(e.meaning.trim())) return;
    const sel = String(e.code) === String(curVal) ? " selected" : "";
    html += `<option value="${escHtml(e.code)}"${sel}>${escHtml(e.code)} — ${escHtml(e.meaning)}</option>`;
  });
  html += `</select> ${bCodeTableHint(tableId)}`;
  return html;
}

// Type badge helper
// inferred=true adds a tooltip indicating the type was detected from the field description
function bTypeTag(ftype, inferred = false) {
  const map = {
    codetable: ["type-codetable", "codetable"],
    ieeefloat: ["type-float",     "IEEE float"],
    signed:    ["type-signed",    "signed"],
    unsigned:  ["type-unsigned",  "unsigned"],
  };
  const [cls, label] = map[ftype] || ["type-unsigned", "unsigned"];
  const title = inferred ? ` title="type inferred from field description"` : "";
  return `<span class="type-tag ${cls}"${title}>${label}</span>`;
}

// Clickable "Code table X.X" hint that navigates to the browser tab
function bCodeTableHint(tableId) {
  return `<span class="field-hint">Code table <a class="ref-link" onclick="goToTableFromBuilder('${escAttr(tableId)}','codes')">${escHtml(tableId)}</a></span>`;
}

// Standard table header for builder sections
function bTableHead() {
  return `<table><thead><tr>
    <th style="width:90px">Octet(s)</th>
    <th>Contents</th>
    <th style="width:320px">Value</th>
  </tr></thead><tbody>`;
}

// ─────────────────────────────────────────────
// Builder — Step 0: Section 0 (Discipline)
// ─────────────────────────────────────────────
function renderBuilderStep0() {
  const bs = builderState.s0;
  return `
    <h2>Section 0 — Indicator</h2>
    <div class="subtitle">The indicator section identifies the start of a GRIB message and the discipline.</div>
    ${bTableHead()}
      <tr><td><code>1–4</code></td><td>GRIB (coded as ASCII)</td><td><code>GRIB</code> (fixed)</td></tr>
      <tr><td><code>5–6</code></td><td>Reserved</td><td><code>0</code> (fixed)</td></tr>
      <tr>
        <td><code>7</code></td>
        <td>Discipline ${bTypeTag("unsigned")}</td>
        <td>${builderCodeSelect("0.0", bs.discipline, "builderState.s0.discipline=+this.value")}</td>
      </tr>
      <tr><td><code>8</code></td><td>GRIB Edition Number</td><td><code>2</code> (fixed)</td></tr>
      <tr><td><code>9–16</code></td><td>Total length of GRIB message in octets</td><td><em>computed at build</em></td></tr>
    </tbody></table>
    ${builderNavHtml(0)}`;
}

// ─────────────────────────────────────────────
// Builder — Step 1: Section 1 (Identification)
// ─────────────────────────────────────────────
function renderBuilderStep1() {
  const bs = builderState.s1;
  return `
    <h2>Section 1 — Identification</h2>
    <div class="subtitle">Identifies the originating centre and reference time.</div>
    ${bTableHead()}
      <tr><td><code>1–4</code></td><td>Length of section</td><td><code>21</code> (fixed)</td></tr>
      <tr><td><code>5</code></td><td>Section number</td><td><code>1</code> (fixed)</td></tr>
      <tr>
        <td><code>6–7</code></td>
        <td>Originating centre ${bTypeTag("unsigned")}</td>
        <td><input type="number" min="0" max="65535" value="${bs.originatingCentre}"
              onchange="builderState.s1.originatingCentre=+this.value" />
            <span class="field-hint">Common table C-11</span></td>
      </tr>
      <tr>
        <td><code>8–9</code></td>
        <td>Originating sub-centre ${bTypeTag("unsigned")}</td>
        <td><input type="number" min="0" max="65535" value="${bs.originatingSubCentre}"
              onchange="builderState.s1.originatingSubCentre=+this.value" /></td>
      </tr>
      <tr>
        <td><code>10</code></td>
        <td>Master tables version number ${bTypeTag("unsigned")}</td>
        <td><input type="number" min="0" max="255" value="${bs.masterTablesVersion}"
              onchange="builderState.s1.masterTablesVersion=+this.value" />
            ${bCodeTableHint("1.0")}</td>
      </tr>
      <tr>
        <td><code>11</code></td>
        <td>Local tables version number ${bTypeTag("unsigned")}</td>
        <td><input type="number" min="0" max="255" value="${bs.localTablesVersion}"
              onchange="builderState.s1.localTablesVersion=+this.value" />
            ${bCodeTableHint("1.1")}</td>
      </tr>
      <tr>
        <td><code>12</code></td>
        <td>Significance of reference time ${bTypeTag("unsigned")}</td>
        <td>${builderCodeSelect("1.2", bs.significanceOfRefTime, "builderState.s1.significanceOfRefTime=+this.value")}</td>
      </tr>
      <tr>
        <td><code>13–14</code></td>
        <td>Year ${bTypeTag("unsigned")}</td>
        <td><input type="number" min="1" max="9999" value="${bs.year}"
              onchange="builderState.s1.year=+this.value" /></td>
      </tr>
      <tr>
        <td><code>15</code></td>
        <td>Month ${bTypeTag("unsigned")}</td>
        <td><input type="number" min="1" max="12" value="${bs.month}"
              onchange="builderState.s1.month=+this.value" /></td>
      </tr>
      <tr>
        <td><code>16</code></td>
        <td>Day ${bTypeTag("unsigned")}</td>
        <td><input type="number" min="1" max="31" value="${bs.day}"
              onchange="builderState.s1.day=+this.value" /></td>
      </tr>
      <tr>
        <td><code>17</code></td>
        <td>Hour ${bTypeTag("unsigned")}</td>
        <td><input type="number" min="0" max="23" value="${bs.hour}"
              onchange="builderState.s1.hour=+this.value" /></td>
      </tr>
      <tr>
        <td><code>18</code></td>
        <td>Minute ${bTypeTag("unsigned")}</td>
        <td><input type="number" min="0" max="59" value="${bs.minute}"
              onchange="builderState.s1.minute=+this.value" /></td>
      </tr>
      <tr>
        <td><code>19</code></td>
        <td>Second ${bTypeTag("unsigned")}</td>
        <td><input type="number" min="0" max="59" value="${bs.second}"
              onchange="builderState.s1.second=+this.value" /></td>
      </tr>
      <tr>
        <td><code>20</code></td>
        <td>Production status of processed data ${bTypeTag("unsigned")}</td>
        <td>${builderCodeSelect("1.3", bs.productionStatus, "builderState.s1.productionStatus=+this.value")}</td>
      </tr>
      <tr>
        <td><code>21</code></td>
        <td>Type of processed data ${bTypeTag("unsigned")}</td>
        <td>${builderCodeSelect("1.4", bs.typeOfData, "builderState.s1.typeOfData=+this.value")}</td>
      </tr>
    </tbody></table>
    ${builderNavHtml(1)}`;
}

// ─────────────────────────────────────────────
// Builder — Step 2: Section 2 (Local Use — empty)
// ─────────────────────────────────────────────
function renderBuilderStep2() {
  return `
    <h2>Section 2 — Local Use</h2>
    <div class="subtitle">This section is reserved for local use by the originating centre. We leave it empty.</div>
    ${bTableHead()}
      <tr><td><code>1–4</code></td><td>Length of section</td><td><code>5</code> (fixed)</td></tr>
      <tr><td><code>5</code></td><td>Section number</td><td><code>2</code> (fixed)</td></tr>
    </tbody></table>
    <div style="margin-top:10px;color:#666;font-size:12px">No local-use data included.</div>
    ${builderNavHtml(2)}`;
}

// ─────────────────────────────────────────────
// Builder — Template steps helper (Sections 3, 4, 5)
// ─────────────────────────────────────────────
function renderTemplateStep(stepId, sectionKey, heading, subtitle, templatePrefix, sectionHeaderRows) {
  const bs = builderState[sectionKey];
  const templates = state.templateTables.filter(t => t.id.startsWith(templatePrefix + "."));

  // Template picker row
  let html = `
    <h2>${heading}</h2>
    <div class="subtitle">${subtitle}</div>
    ${bTableHead()}
      ${sectionHeaderRows}
      <tr>
        <td></td>
        <td>Template ${bTypeTag("codetable")}</td>
        <td><select onchange="onBuilderTemplateChange('${sectionKey}',this.value)">
          <option value="">— Select a template —</option>`;
  templates.forEach(t => {
    const sel = t.id === bs.templateId ? " selected" : "";
    html += `<option value="${t.id}"${sel}>${escHtml(t.id)} — ${escHtml(t.title)}</option>`;
  });
  html += `</select></td></tr>`;

  // Template fields
  if (bs.templateId) {
    const tmpl = state.templateTables.find(t => t.id === bs.templateId);
    if (tmpl) {
      html += `<tr><td colspan="3" style="background:#f0f0f0;font-weight:bold;font-size:12px;padding:5px 8px">
        Template <a class="ref-link" onclick="goToTableFromBuilder('${escAttr(bs.templateId)}','templates')">${escHtml(bs.templateId)}</a> fields</td></tr>`;
      flattenTemplateEntries(bs.templateId).forEach((entry, idx) => {
        const range = parseOctetRange(entry.octetNo);
        if (range.length === 0) return;
        const tableRef  = entry.codeTable || entry.flagTable;
        const ftype     = tableRef ? "codetable" : detectFieldType(entry.contents);
        const inferred  = !tableRef;
        const curVal   = bs.fields[idx] !== undefined ? bs.fields[idx] : 0;
        const byteCount = range.length;

        let valueCell;
        if (ftype === "codetable") {
          valueCell = builderCodeSelect(tableRef, curVal,
            `builderState['${sectionKey}'].fields[${idx}]=+this.value`);
        } else if (ftype === "ieeefloat") {
          valueCell = `<input type="number" step="any" value="${curVal}"
            onchange="builderState['${sectionKey}'].fields[${idx}]=parseFloat(this.value)||0" />
            <span class="field-hint">${byteCount} byte(s)</span>`;
        } else if (ftype === "signed") {
          const maxPos = byteCount > 0 ? Math.pow(2, byteCount * 8 - 1) - 1 : 2147483647;
          const minNeg = -maxPos - 1;
          valueCell = `<input type="number" min="${minNeg}" max="${maxPos}" value="${curVal}"
            onchange="builderState['${sectionKey}'].fields[${idx}]=+this.value" />
            <span class="field-hint">${byteCount} byte(s)</span>`;
        } else {
          const maxVal = byteCount > 0 ? Math.pow(256, byteCount) - 1 : 4294967295;
          valueCell = `<input type="number" min="0" max="${maxVal}" value="${curVal}"
            onchange="builderState['${sectionKey}'].fields[${idx}]=+this.value" />
            <span class="field-hint">${byteCount} byte(s)</span>`;
        }

        html += `<tr>
          <td><code>${escHtml(entry.octetNo)}</code></td>
          <td>${escHtml(entry.contents)} ${bTypeTag(ftype, inferred)}</td>
          <td>${valueCell}</td>
        </tr>`;
      });
    }
  }

  html += `</tbody></table>`;
  html += builderNavHtml(stepId);
  return html;
}

function onBuilderTemplateChange(sectionKey, templateId) {
  builderState[sectionKey].templateId = templateId || null;
  builderState[sectionKey].fields = {};
  renderBuilderDetail();
}

// ─────────────────────────────────────────────
// Builder — Step 3: Section 3 (Grid Definition)
// ─────────────────────────────────────────────
function renderBuilderStep3() {
  const bs = builderState.s3;
  const headerRows = `
    <tr><td><code>1–4</code></td><td>Length of section</td><td><em>computed at build</em></td></tr>
    <tr><td><code>5</code></td><td>Section number</td><td><code>3</code> (fixed)</td></tr>
    <tr>
      <td><code>6</code></td>
      <td>Source of grid definition ${bTypeTag("unsigned")}</td>
      <td><input type="number" min="0" max="255" value="${bs.sourceOfGridDef}"
            onchange="builderState.s3.sourceOfGridDef=+this.value" /></td>
    </tr>
    <tr>
      <td><code>7–10</code></td>
      <td>Number of data points ${bTypeTag("unsigned")}</td>
      <td><input type="number" min="0" value="${bs.numberOfDataPoints}"
            onchange="builderState.s3.numberOfDataPoints=+this.value" /></td>
    </tr>
    <tr>
      <td><code>11</code></td>
      <td>Number of octets for optional list</td>
      <td><code>0</code> (fixed)</td>
    </tr>
    <tr>
      <td><code>12</code></td>
      <td>Interpretation of list of numbers ${bTypeTag("unsigned")}</td>
      <td><input type="number" min="0" max="255" value="${bs.interpretationOfListOfNumbers}"
            onchange="builderState.s3.interpretationOfListOfNumbers=+this.value" /></td>
    </tr>
    <tr>
      <td><code>13–14</code></td>
      <td>Grid definition template number ${bTypeTag("unsigned")}</td>
      <td><em>set by template selection below</em></td>
    </tr>`;
  return renderTemplateStep(3, "s3",
    "Section 3 — Grid Definition",
    "Defines the grid/projection used. Choose a grid definition template, then set each field.",
    "3", headerRows);
}

// ─────────────────────────────────────────────
// Builder — Step 4: Section 4 (Product Definition)
// ─────────────────────────────────────────────
function renderBuilderStep4() {
  const bs = builderState.s4;
  const headerRows = `
    <tr><td><code>1–4</code></td><td>Length of section</td><td><em>computed at build</em></td></tr>
    <tr><td><code>5</code></td><td>Section number</td><td><code>4</code> (fixed)</td></tr>
    <tr>
      <td><code>6–7</code></td>
      <td>Number of coordinate values ${bTypeTag("unsigned")}</td>
      <td><input type="number" min="0" value="${bs.numberOfCoordValues}"
            onchange="builderState.s4.numberOfCoordValues=+this.value" /></td>
    </tr>
    <tr>
      <td><code>8–9</code></td>
      <td>Product definition template number ${bTypeTag("unsigned")}</td>
      <td><em>set by template selection below</em></td>
    </tr>`;
  return renderTemplateStep(4, "s4",
    "Section 4 — Product Definition",
    "Describes the parameter, generating process, and time. Choose a product definition template.",
    "4", headerRows);
}

// ─────────────────────────────────────────────
// Builder — Step 5: Section 5 (Data Representation)
// ─────────────────────────────────────────────
function renderBuilderStep5() {
  const bs = builderState.s5;
  const headerRows = `
    <tr><td><code>1–4</code></td><td>Length of section</td><td><em>computed at build</em></td></tr>
    <tr><td><code>5</code></td><td>Section number</td><td><code>5</code> (fixed)</td></tr>
    <tr>
      <td><code>6–9</code></td>
      <td>Number of packed values ${bTypeTag("unsigned")}</td>
      <td><input type="number" min="0" value="${bs.numberOfPackedValues}"
            onchange="builderState.s5.numberOfPackedValues=+this.value" /></td>
    </tr>
    <tr>
      <td><code>10–11</code></td>
      <td>Data representation template number ${bTypeTag("unsigned")}</td>
      <td><em>set by template selection below</em></td>
    </tr>`;
  return renderTemplateStep(5, "s5",
    "Section 5 — Data Representation",
    "Describes how data values are packed. Choose a data representation template.",
    "5", headerRows);
}

// ─────────────────────────────────────────────
// Builder — Step 6: Section 6 (Bitmap)
// ─────────────────────────────────────────────
function renderBuilderStep6() {
  return `
    <h2>Section 6 — Bitmap</h2>
    <div class="subtitle">Indicates whether a bitmap is included. For an empty data section use 255 (no bitmap).</div>
    ${bTableHead()}
      <tr><td><code>1–4</code></td><td>Length of section</td><td><code>6</code> (fixed)</td></tr>
      <tr><td><code>5</code></td><td>Section number</td><td><code>6</code> (fixed)</td></tr>
      <tr>
        <td><code>6</code></td>
        <td>Bitmap indicator ${bTypeTag("unsigned")}</td>
        <td>${builderCodeSelect("6.0", builderState.s6.bitmapIndicator, "builderState.s6.bitmapIndicator=+this.value")}</td>
      </tr>
    </tbody></table>
    ${builderNavHtml(6)}`;
}

// ─────────────────────────────────────────────
// Builder — Step 7: Section 7 (Data — empty)
// ─────────────────────────────────────────────
function renderBuilderStep7() {
  return `
    <h2>Section 7 — Data</h2>
    <div class="subtitle">Contains the packed data values. We leave this section empty (header only).</div>
    ${bTableHead()}
      <tr><td><code>1–4</code></td><td>Length of section</td><td><code>5</code> (fixed)</td></tr>
      <tr><td><code>5</code></td><td>Section number</td><td><code>7</code> (fixed)</td></tr>
    </tbody></table>
    <div style="margin-top:10px;color:#666;font-size:12px">No data values included — the data section is empty.</div>
    ${builderNavHtml(7)}`;
}

// ─────────────────────────────────────────────
// Builder — field range validation
// Returns array of {section, label, value, min, max} for out-of-range fields
// ─────────────────────────────────────────────
function collectFieldWarnings() {
  const warnings = [];
  const sections = [
    { key: "s3", label: "Section 3 (Grid)" },
    { key: "s4", label: "Section 4 (Product)" },
    { key: "s5", label: "Section 5 (Data Rep.)" },
  ];
  sections.forEach(({ key, label }) => {
    const sec = builderState[key];
    if (!sec.templateId) return;
    flattenTemplateEntries(sec.templateId).forEach((entry, idx) => {
      const range = parseOctetRange(entry.octetNo);
      if (range.length === 0) return;
      const raw   = sec.fields[idx];
      const value = (raw !== undefined && raw !== "") ? parseFloat(raw) : 0;
      if (isNaN(value)) return;
      const tableRef = entry.codeTable || entry.flagTable;
      const ftype    = tableRef ? "unsigned" : detectFieldType(entry.contents);
      if (ftype === "ieeefloat") return;
      const n = range.length;
      let min, max;
      if (ftype === "signed") {
        min = -Math.pow(2, n * 8 - 1);
        max =  Math.pow(2, n * 8 - 1) - 1;
      } else {
        min = 0;
        max = Math.pow(2, n * 8) - 1;
      }
      if (value < min || value > max) {
        warnings.push({ section: label, label: entry.contents, value, min, max });
      }
    });
  });
  return warnings;
}

// ─────────────────────────────────────────────
// Builder — Step 8: Build & Download
// ─────────────────────────────────────────────
function renderBuilderStep8() {
  const bs = builderState;
  const allDone = bs.s3.templateId && bs.s4.templateId && bs.s5.templateId;

  const disc0  = state.codeIndex.get("0.0");
  const discEntry = disc0 ? disc0.entries.find(e => +e.code === bs.s0.discipline) : null;
  const discLabel = discEntry ? `${bs.s0.discipline} — ${escHtml(discEntry.meaning)}` : String(bs.s0.discipline);

  const pad2 = n => String(n).padStart(2, "0");
  const refTime = `${bs.s1.year}-${pad2(bs.s1.month)}-${pad2(bs.s1.day)} ` +
                  `${pad2(bs.s1.hour)}:${pad2(bs.s1.minute)}:${pad2(bs.s1.second)} UTC`;

  const gridTpl = state.templateTables.find(t => t.id === bs.s3.templateId);
  const prodTpl = state.templateTables.find(t => t.id === bs.s4.templateId);
  const drtTpl  = state.templateTables.find(t => t.id === bs.s5.templateId);

  let html = `<h2>Build &amp; Download GRIB2 File</h2>
    <div class="subtitle">Review your selections and download the assembled GRIB2 binary.</div>`;

  if (!allDone) {
    html += `<div style="color:#c00;margin:20px 0;padding:12px;border:1px solid #c00;background:#fff0f0">
      ⚠ You must select templates for Sections 3, 4, and 5 before building.
    </div>`;
    html += `<div class="builder-nav"><button onclick="goToBuilderStep(7)">← Previous</button></div>`;
    return html;
  }

  const warnings = collectFieldWarnings();

  html += `<h3 style="margin:16px 0 8px">Summary</h3>
    <table style="margin-bottom:16px">
      <thead><tr><th>Section</th><th>Choice</th></tr></thead>
      <tbody>
        <tr><td>0 — Discipline</td><td>${discLabel}</td></tr>
        <tr><td>1 — Centre</td><td>${bs.s1.originatingCentre} / Sub: ${bs.s1.originatingSubCentre}</td></tr>
        <tr><td>1 — Ref. Time</td><td>${refTime}</td></tr>
        <tr><td>3 — Grid</td><td>${escHtml(bs.s3.templateId)} — ${escHtml(gridTpl?.title || "")}</td></tr>
        <tr><td>4 — Product</td><td>${escHtml(bs.s4.templateId)} — ${escHtml(prodTpl?.title || "")}</td></tr>
        <tr><td>5 — Data Rep.</td><td>${escHtml(bs.s5.templateId)} — ${escHtml(drtTpl?.title || "")}</td></tr>
        <tr><td>6 — Bitmap</td><td>${bs.s6.bitmapIndicator === 255 ? "255 (no bitmap)" : bs.s6.bitmapIndicator}</td></tr>
        <tr><td>7 — Data</td><td>Empty (no data values)</td></tr>
      </tbody>
    </table>`;

  if (warnings.length) {
    html += `<div style="color:#7a4f00;margin:0 0 16px;padding:12px;border:1px solid #e6a817;background:#fffbe6">
      <strong>⚠ ${warnings.length} field value${warnings.length !== 1 ? "s" : ""} out of range — will be clamped on download:</strong>
      <ul style="margin:8px 0 0;padding-left:20px">`;
    warnings.forEach(w => {
      html += `<li>${escHtml(w.section)}: <em>${escHtml(w.label)}</em> — value ${w.value} is outside [${w.min}, ${w.max}]</li>`;
    });
    html += `</ul></div>`;
  }

  html += `<div class="builder-nav">
      <button onclick="goToBuilderStep(7)">← Previous</button>
      <button class="btn-download" onclick="downloadGrib2()">⬇ Download .grib2</button>
      <button class="btn-hexdump" onclick="toggleHexDump()">⎙ Hex Dump</button>
    </div>
    <div id="hex-dump-container" style="display:none;margin-top:16px">
      <div style="font-size:12px;color:#666;margin-bottom:4px">Hex dump of assembled GRIB2 message</div>
      <div id="hex-dump"></div>
    </div>`;
  return html;
}
