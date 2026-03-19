// ─────────────────────────────────────────────
// Tab switching
// ─────────────────────────────────────────────
function switchTab(tab) {
  state.tab = tab;
  state.selectedTableId = null;
  state.searchQuery = "";
  document.getElementById("search").value = "";
  document.getElementById("tab-codes").classList.toggle("active", tab === "codes");
  document.getElementById("tab-templates").classList.toggle("active", tab === "templates");
  renderSidebar();
  renderDetail(null);
}

// ─────────────────────────────────────────────
// Sidebar rendering
// ─────────────────────────────────────────────
function currentTables() {
  return state.tab === "codes" ? state.codeTables : state.templateTables;
}

function renderSidebar() {
  const sidebar = document.getElementById("sidebar");
  const tables = currentTables();
  const q = state.searchQuery.toLowerCase();

  let html = "";
  tables.forEach(table => {
    // If searching, only show tables that have matching entries
    if (q) {
      const match = matchesQuery(table, q);
      if (!match) return;
    }
    const sel = table.id === state.selectedTableId ? " selected" : "";
    html += `<div class="sidebar-item${sel}" onclick="selectTable('${table.id}')">
      <span class="table-num">${escHtml(table.type)} ${escHtml(table.id)}</span>
      <span class="entry-count">${table.entries.length}</span>
      <span class="table-name">${escHtml(table.title)}</span>
    </div>`;
  });

  sidebar.innerHTML = html || `<div style="padding:12px;color:#aaa">No results</div>`;
}

// ─────────────────────────────────────────────
// Select a table from sidebar
// ─────────────────────────────────────────────
function selectTable(id) {
  state.selectedTableId = id;
  state.searchQuery = "";
  document.getElementById("search").value = "";
  renderSidebar();
  const table = currentTables().find(t => t.id === id);
  renderDetail(table);
}

// ─────────────────────────────────────────────
// Detail panel rendering
// ─────────────────────────────────────────────
function renderDetail(table) {
  const detail = document.getElementById("detail");
  if (!table) {
    detail.innerHTML = `<div id="placeholder">← Select a table from the sidebar</div>`;
    return;
  }

  if (state.tab === "codes") {
    detail.innerHTML = renderCodeTable(table);
  } else {
    detail.innerHTML = renderTemplateTable(table);
  }
}

function renderCodeTable(table) {
  let html = `<h2>${escHtml(table.type)} ${escHtml(table.id)} — ${escHtml(table.title)}</h2>
    <div class="subtitle">${table.entries.length} entries</div>
    <table>
      <thead><tr>
        <th style="width:100px">Code</th>
        <th>Meaning</th>
        <th style="width:90px">Status</th>
      </tr></thead>
      <tbody>`;

  let lastSubTitle = null;
  table.entries.forEach(e => {
    if (e.subTitle && e.subTitle !== lastSubTitle) {
      lastSubTitle = e.subTitle;
      html += `<tr class="group-header"><td colspan="3">${escHtml(e.subTitle)}</td></tr>`;
    }
    const statusCls = e.status === "Deprecated" ? "status-deprecated" : "status-operational";
    html += `<tr>
      <td><code>${escHtml(e.code)}</code></td>
      <td>${escHtml(e.meaning)}</td>
      <td class="${statusCls}">${escHtml(e.status)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

function renderTemplateTable(table) {
  let html = `<h2>${escHtml(table.type)} ${escHtml(table.id)} — ${escHtml(table.title)}</h2>
    <div class="subtitle">${table.entries.length} octets/fields</div>
    <table>
      <thead><tr>
        <th style="width:90px">Octet(s)</th>
        <th>Contents</th>
        <th style="width:180px">Note / Reference</th>
        <th style="width:80px">Status</th>
      </tr></thead>
      <tbody>`;

  table.entries.forEach(e => {
    // Build reference cell: code table link, flag table link, note
    let ref = "";
    if (e.codeTable) {
      ref += `Code table: <a class="ref-link" onclick="goToTable('${escAttr(e.codeTable)}','codes')">${escHtml(e.codeTable)}</a>`;
    }
    if (e.flagTable) {
      if (ref) ref += "<br>";
      ref += `Flag table: <a class="ref-link" onclick="goToTable('${escAttr(e.flagTable)}','codes')">${escHtml(e.flagTable)}</a>`;
    }
    if (e.note && !e.codeTable && !e.flagTable) {
      ref = escHtml(e.note);
    } else if (e.note) {
      ref += `<br><small>${escHtml(e.note)}</small>`;
    }

    const statusCls = e.status === "Deprecated" ? "status-deprecated" : "status-operational";
    html += `<tr>
      <td><code>${escHtml(e.octetNo)}</code></td>
      <td>${escHtml(e.contents)}</td>
      <td>${ref}</td>
      <td class="${statusCls}">${escHtml(e.status)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

// ─────────────────────────────────────────────
// Cross-reference navigation
// ─────────────────────────────────────────────
function goToTable(id, tab) {
  if (state.tab !== tab) {
    state.tab = tab;
    document.getElementById("tab-codes").classList.toggle("active", tab === "codes");
    document.getElementById("tab-templates").classList.toggle("active", tab === "templates");
  }
  state.selectedTableId = id;
  state.searchQuery = "";
  document.getElementById("search").value = "";
  renderSidebar();
  const table = currentTables().find(t => t.id === id);
  if (table) {
    renderDetail(table);
    // Scroll sidebar item into view
    setTimeout(() => {
      const items = document.querySelectorAll(".sidebar-item.selected");
      if (items[0]) items[0].scrollIntoView({ block: "nearest" });
    }, 50);
  } else {
    renderDetail(null);
    document.getElementById("detail").innerHTML =
      `<div style="padding:20px;color:#c00">Table ${escHtml(id)} not found.</div>`;
  }
}

// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────
function onSearch(query) {
  state.searchQuery = query.trim();

  if (!state.searchQuery) {
    state.selectedTableId = null;
    renderSidebar();
    renderDetail(null);
    return;
  }

  state.selectedTableId = null;
  renderSidebar();
  renderSearchResults(state.searchQuery);
}

function renderSearchResults(query) {
  const q = query.toLowerCase();
  const tables = currentTables();
  const detail = document.getElementById("detail");

  // Gather all matching entries across all tables
  let hits = [];
  tables.forEach(table => {
    table.entries.forEach(e => {
      const haystack = [
        table.type, table.id, table.title,
        e.code || "", e.meaning || "", e.contents || "", e.note || "",
      ].join(" ").toLowerCase();

      if (haystack.includes(q)) {
        hits.push({ table, entry: e });
      }
    });
  });

  if (!hits.length) {
    detail.innerHTML = `<div style="padding:20px;color:#aaa">No results for "${escHtml(query)}"</div>`;
    return;
  }

  const label = state.tab === "codes" ? "code/flag tables" : "templates";
  let html = `<h3 style="margin-bottom:12px">${hits.length} result${hits.length!==1?"s":""} for "${escHtml(query)}" across ${label}</h3>
    <table>
    <thead><tr>
      <th style="width:140px">Table</th>`;

  if (state.tab === "codes") {
    html += `<th style="width:90px">Code</th><th>Meaning</th><th style="width:90px">Status</th>`;
  } else {
    html += `<th style="width:80px">Octet(s)</th><th>Contents</th><th style="width:90px">Status</th>`;
  }
  html += `</tr></thead><tbody>`;

  hits.forEach(({ table, entry: e }) => {
    const statusCls = e.status === "Deprecated" ? "status-deprecated" : "status-operational";
    const tableRef = `<a class="ref-link" onclick="selectTable('${escAttr(table.id)}')">${escHtml(table.type)} ${escHtml(table.id)}</a>`;
    if (state.tab === "codes") {
      html += `<tr>
        <td>${tableRef}<br><small>${escHtml(table.title)}</small></td>
        <td><code>${escHtml(e.code)}</code></td>
        <td>${highlight(escHtml(e.meaning), query)}</td>
        <td class="${statusCls}">${escHtml(e.status)}</td>
      </tr>`;
    } else {
      html += `<tr>
        <td>${tableRef}<br><small>${escHtml(table.title)}</small></td>
        <td><code>${escHtml(e.octetNo)}</code></td>
        <td>${highlight(escHtml(e.contents), query)}</td>
        <td class="${statusCls}">${escHtml(e.status)}</td>
      </tr>`;
    }
  });

  html += `</tbody></table>`;
  detail.innerHTML = html;
}

// escHtml, escAttr, highlight, matchesQuery are in js/utils.js
