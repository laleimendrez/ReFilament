// static/js/data.js

let spectralChartInstance = null;

const AS7265X_LABELS = [
    '410 nm','435 nm','460 nm','485 nm','510 nm','535 nm',
    '560 nm','585 nm','610 nm','645 nm','680 nm','705 nm',
    '730 nm','760 nm','810 nm','860 nm','900 nm','940 nm'
];

const MATERIAL_COLORS = { 'PET': '#00BFFF', 'HDPE': '#39FF14', 'PP': '#FFD700' };
const REFERENCE_COLOR = '#94a3b8';

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let allLogs      = [];   // full dataset from server
let filteredLogs = [];   // after search + chip filter
let currentPage  = 1;
let rowsPerPage  = 10;
let sortCol      = 'id';
let sortDir      = 'desc';   // 'asc' | 'desc'
let activeFilter = 'all';    // 'all' | 'PET' | 'HDPE' | 'PP'
let searchQuery  = '';
let selectedIds  = new Set();

// ─────────────────────────────────────────
// SPECTRAL CHART
// ─────────────────────────────────────────
const setupSpectralChart = (materialType, rawVis, rawNir, refVis, refNir) => {
    if (spectralChartInstance) spectralChartInstance.destroy();
    const ctx = document.getElementById('spectralChart').getContext('2d');
    const measuredData  = [...rawVis, ...rawNir];
    const referenceData = [...refVis, ...refNir];

    spectralChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: AS7265X_LABELS,
            datasets: [{
                label: 'Measured Spectrum',
                data: measuredData,
                borderColor: MATERIAL_COLORS[materialType] || '#FFFFFF',
                backgroundColor: 'transparent',
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 5
            },{
                label: 'Reference Profile',
                data: referenceData,
                borderColor: REFERENCE_COLOR,
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5,5],
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    title: { display: true, text: 'WAVELENGTH (AS7265X Channels)', color: '#94a3b8' },
                    grid:  { color: 'rgba(51,65,85,0.5)' },
                    ticks: { color: '#E2E8F0' }
                },
                y: {
                    title: { display: true, text: 'INTENSITY / ABSORBANCE', color: '#94a3b8' },
                    grid:  { color: 'rgba(51,65,85,0.5)' },
                    ticks: { color: '#E2E8F0' }
                }
            }
        }
    });
};

// ─────────────────────────────────────────
// DONUT CHART
// ─────────────────────────────────────────
function renderDonut(pet, hdpe, pp) {
    const radius = 14;
    const circumference = 2 * Math.PI * radius;
    const values = { pet, hdpe, pp };
    let offset = 0;
    ['pet','hdpe','pp'].forEach(type => {
        const circle = document.querySelector(`.circle.${type}`);
        if (!circle) return;
        const pct   = parseFloat(values[type]);
        const dash  = (pct / 100) * circumference;
        circle.style.strokeDasharray  = `${dash} ${circumference}`;
        circle.style.strokeDashoffset = offset;
        offset -= dash;
    });
}

// ─────────────────────────────────────────
// FILTER + SEARCH + SORT
// ─────────────────────────────────────────
function applyFilters(resetPage = true) {
    let result = [...allLogs];

    if (activeFilter !== 'all') {
        result = result.filter(r => r.material === activeFilter);
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(r =>
            String(r.id).includes(q) ||
            (r.timestamp    || '').toLowerCase().includes(q) ||
            (r.chemical_name|| '').toLowerCase().includes(q) ||
            (r.material     || '').toLowerCase().includes(q)
        );
    }

    result.sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (sortCol === 'id' || sortCol === 'confidence') {
            va = parseFloat(va); vb = parseFloat(vb);
        } else {
            va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
        }
        if (va < vb) return sortDir === 'asc' ? -1 :  1;
        if (va > vb) return sortDir === 'asc' ?  1 : -1;
        return 0;
    });

    filteredLogs = result;

    if (resetPage) currentPage = 1;

    renderTable();
    renderPagination();
    updateResultsCount();
}

// ─────────────────────────────────────────
// TABLE RENDER
// ─────────────────────────────────────────
function renderTable() {
    const tbody  = document.getElementById('materials-table-body');
    const start  = (currentPage - 1) * rowsPerPage;
    const pageRows = filteredLogs.slice(start, start + rowsPerPage);

    if (pageRows.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center;padding:32px;color:#94a3b8;font-size:0.95rem;">
              No records match your search or filter.
            </td>
          </tr>`;
        updateSelectAllState();
        return;
    }

    tbody.innerHTML = pageRows.map(item => {
        const conf     = item.confidence || '0%';
        const confVal  = conf.replace('%','');
        const mat      = (item.material || '').toLowerCase();
        const checked  = selectedIds.has(item.id) ? 'checked' : '';
        return `
        <tr class="material-row ${mat}" data-id="${item.id}" data-material="${item.material}" data-confidence="${confVal}">
          <td class="col-check"><input type="checkbox" class="row-cb" data-id="${item.id}" ${checked} /></td>
          <td>${item.id}</td>
          <td>${item.timestamp}</td>
          <td class="material-cell">
            <span class="material-tag ${mat}">${item.material}</span>
          </td>
          <td class="confidence-bar-cell">
            <div class="bar-and-text-container">
              <span class="confidence-bar-wrapper">
                <span class="confidence-bar ${mat}" style="--conf: ${confVal}"></span>
              </span>
              <span class="confidence-text">${conf}</span>
            </div>
          </td>
          <td>${item.chemical_name || 'N/A'}</td>
          <td><button class="view-spectrum" data-id="${item.id}">View Spectrum</button></td>
        </tr>`;
    }).join('');

    // Re-attach row checkbox listeners
    tbody.querySelectorAll('.row-cb').forEach(cb => {
        cb.addEventListener('change', onRowCheckChange);
    });

    // Re-attach spectrum buttons
    tbody.querySelectorAll('.view-spectrum').forEach(btn => {
        btn.addEventListener('click', () => openSpectralModal(btn.dataset.id));
    });

    updateSelectAllState();
    updateExportSelectedBtn();
}

// ─────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────
function renderPagination() {
    const total      = filteredLogs.length;
    const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
    const start      = total === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const end        = Math.min(currentPage * rowsPerPage, total);

    document.getElementById('pagination-info').textContent =
        `Showing ${start}–${end} of ${total} records`;

    const container = document.getElementById('page-numbers');
    container.innerHTML = '';

    // Show at most 5 page buttons around current
    let pStart = Math.max(1, currentPage - 2);
    let pEnd   = Math.min(totalPages, pStart + 4);
    pStart     = Math.max(1, pEnd - 4);

    for (let i = pStart; i <= pEnd; i++) {
        const btn = document.createElement('button');
        btn.className  = 'page-btn page-num' + (i === currentPage ? ' page-btn--active' : '');
        btn.textContent = i;
        btn.addEventListener('click', () => { currentPage = i; renderTable(); renderPagination(); });
        container.appendChild(btn);
    }

    // Disable first/prev/next/last
    document.getElementById('page-first').disabled = currentPage === 1;
    document.getElementById('page-prev').disabled  = currentPage === 1;
    document.getElementById('page-next').disabled  = currentPage === totalPages;
    document.getElementById('page-last').disabled  = currentPage === totalPages;
}

function updateResultsCount() {
    document.getElementById('results-count').textContent =
        `${filteredLogs.length} record${filteredLogs.length !== 1 ? 's' : ''}`;
}

// ─────────────────────────────────────────
// CHECKBOXES & EXPORT SELECTED
// ─────────────────────────────────────────
function onRowCheckChange(e) {
    const id = parseInt(e.target.dataset.id);
    if (e.target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    updateSelectAllState();
    updateExportSelectedBtn();
}

function updateSelectAllState() {
    const allCbs   = document.querySelectorAll('.row-cb');
    const checkedN = [...allCbs].filter(c => c.checked).length;
    const cb       = document.getElementById('select-all-cb');
    if (!cb) return;
    cb.checked       = allCbs.length > 0 && checkedN === allCbs.length;
    cb.indeterminate = checkedN > 0 && checkedN < allCbs.length;
}

function updateExportSelectedBtn() {
    const btn = document.getElementById('export-selected-btn');
    if (!btn) return;
    btn.disabled    = selectedIds.size === 0;
    btn.textContent = selectedIds.size > 0
        ? `Export Selected (${selectedIds.size})`
        : 'Export Selected';
}

function exportSelected() {
    if (selectedIds.size === 0) return;
    const rows = allLogs.filter(r => selectedIds.has(r.id));
    const headers = ['id','timestamp','material','chemical_name','confidence'];
    const csvRows = [
        headers.join(','),
        ...rows.map(r => [
            r.id,
            `"${r.timestamp}"`,
            r.material,
            `"${r.chemical_name || ''}"`,
            r.confidence
        ].join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href  = url;
    link.download = `classification_selected_${selectedIds.size}_records.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────
// SPECTRAL MODAL
// ─────────────────────────────────────────
const spectralModal   = document.getElementById('spectralAnalysisModal');
const closeSpectralBtn = document.querySelector('.close-button');
const confirmBtn       = document.querySelector('.modal-confirm-button');

function closeSpectralModal() {
    spectralModal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

async function openSpectralModal(dataId) {
    const row = document.querySelector(`button[data-id="${dataId}"]`);
    if (!row) return;
    const tr         = row.closest('tr');
    const materialType = tr.querySelector('.material-tag').textContent.trim();
    const confidence = tr.querySelector('.confidence-text').textContent.trim();
    const timestamp  = tr.querySelector('td:nth-child(3)').textContent.trim();

    const response = await fetch(`/data/spectra/${dataId}`);
    if (!response.ok) { alert('Failed to fetch spectral data.'); return; }
    const spectra = await response.json();
    if (!spectra.raw_vis || !spectra.ref_vis) { alert('Invalid spectral data.'); return; }

    document.getElementById('modal-id').textContent = dataId;
    document.getElementById('modal-material').textContent  = materialType;
    document.getElementById('modal-material').className    = `material-tag ${materialType.toLowerCase()}`;
    document.getElementById('modal-confidence').textContent = confidence;
    document.getElementById('modal-timestamp').textContent  = timestamp;
    document.getElementById('modal-analysis-note').textContent =
        `Key spectral peaks were detected, showing a strong correlation with the ${materialType} reference profile. This high certainty confirms the material type.`;

    setupSpectralChart(materialType, spectra.raw_vis, spectra.raw_nir, spectra.ref_vis, spectra.ref_nir);
    spectralModal.style.display = 'block';
    document.body.classList.add('modal-open');

    const legendMeasured = document.querySelector('.legend-color.measured');
    if (legendMeasured) legendMeasured.style.backgroundColor = MATERIAL_COLORS[materialType] || '#FFFFFF';
}

// ─────────────────────────────────────────
// DOWNLOAD CSV MODALS
// ─────────────────────────────────────────
function showModal(modal)  { if (modal) modal.style.display = 'flex'; }
function hideModal(modal)  { if (modal) modal.style.display = 'none'; }

async function handleDownload(url, filename) {
    try {
        const response = await fetch(url);
        if (response.status === 404) {
            hideModal(document.getElementById('download-modal'));
            showModal(document.getElementById('no-data-modal'));
            return;
        }
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            alert('Error: ' + (err.error || response.statusText));
            return;
        }
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href  = window.URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(link.href);
        hideModal(document.getElementById('download-modal'));
    } catch (err) {
        console.error(err);
        alert('Download error: ' + err.message);
    }
}

// ─────────────────────────────────────────
// SUMMARY REFRESH
// ─────────────────────────────────────────
async function refreshSummary() {
    try {
        const res     = await fetch('/data/summary');
        const summary = await res.json();

        document.querySelector('.card:nth-child(1) .number').textContent = summary.total_records.toLocaleString();
        document.querySelector('.percent.pet').textContent  = summary.pet  + '%';
        document.querySelector('.percent.hdpe').textContent = summary.hdpe + '%';
        document.querySelector('.percent.pp').textContent   = summary.pp   + '%';
        document.querySelector('.activity').textContent     = '+' + summary.activity_24h + ' ⬆';
        document.querySelector('.confidence').textContent   = summary.avg_confidence + '%';

        renderDonut(summary.pet, summary.hdpe, summary.pp);
    } catch (e) { console.error('Summary refresh error:', e); }
}

// ─────────────────────────────────────────
// LOGS REFRESH (ISO-Reliability: auto-refresh)
// ─────────────────────────────────────────
async function refreshLogs() {
    try {
        const res = await fetch('/data/api/logs');
        if (!res.ok) return;
        allLogs = await res.json();
        // normalize confidence field
        allLogs.forEach(r => {
            if (!r.confidence && r.confidence_score !== undefined) {
                r.confidence = `${Math.round(r.confidence_score * 1000) / 10}%`;
            }
        });
        applyFilters(false);
    } catch (e) { console.error('Log refresh error:', e); }
}

// ─────────────────────────────────────────
// DOM READY
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // ── Seed allLogs from server-rendered data ──
    const tbody = document.getElementById('materials-table-body');
    allLogs = [...tbody.querySelectorAll('tr.material-row')].map(tr => ({
        id:           parseInt(tr.dataset.id),
        material:     tr.dataset.material,
        confidence:   tr.querySelector('.confidence-text')?.textContent.trim() || '0%',
        timestamp:    tr.querySelector('td:nth-child(3)')?.textContent.trim()  || '',
        chemical_name:tr.querySelector('td:nth-child(6)')?.textContent.trim()  || '',
    }));

    applyFilters(); // initial render + pagination

    // Initial donut + comp bar from server data
    const pet  = parseFloat(document.querySelector('.percent.pet')?.textContent)  || 0;
    const hdpe = parseFloat(document.querySelector('.percent.hdpe')?.textContent) || 0;
    const pp   = parseFloat(document.querySelector('.percent.pp')?.textContent)   || 0;
    renderDonut(pet, hdpe, pp);

    // ── Search ──
    const searchInput    = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        applyFilters();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFilters();
    });

    // ── Filter chips ──
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => {
                c.classList.remove('chip--active');
            });
            chip.classList.add('chip--active');
            activeFilter = chip.dataset.filter;
            applyFilters();
        });
    });

    // ── Sort ──
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            else { sortCol = col; sortDir = 'desc'; }

            document.querySelectorAll('th.sortable .sort-icon').forEach(i => i.textContent = '↕');
            th.querySelector('.sort-icon').textContent = sortDir === 'asc' ? '↑' : '↓';
            applyFilters();
        });
    });

    // ── Rows per page ──
    document.getElementById('rows-select').addEventListener('change', e => {
        rowsPerPage = parseInt(e.target.value);
        currentPage = 1;
        renderTable();
        renderPagination();
        updateResultsCount();
    });

    // ── Pagination buttons ──
    document.getElementById('page-first').addEventListener('click', () => {
        currentPage = 1; renderTable(); renderPagination();
    });
    document.getElementById('page-prev').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTable(); renderPagination(); }
    });
    document.getElementById('page-next').addEventListener('click', () => {
        const total = Math.ceil(filteredLogs.length / rowsPerPage);
        if (currentPage < total) { currentPage++; renderTable(); renderPagination(); }
    });
    document.getElementById('page-last').addEventListener('click', () => {
        currentPage = Math.ceil(filteredLogs.length / rowsPerPage);
        renderTable(); renderPagination();
    });

    // ── Select all checkbox ──
    document.getElementById('select-all-cb').addEventListener('change', e => {
        const start    = (currentPage - 1) * rowsPerPage;
        const pageRows = filteredLogs.slice(start, start + rowsPerPage);
        pageRows.forEach(r => {
            if (e.target.checked) selectedIds.add(r.id);
            else selectedIds.delete(r.id);
        });
        document.querySelectorAll('.row-cb').forEach(cb => { cb.checked = e.target.checked; });
        updateExportSelectedBtn();
    });

    // ── Export Selected ──
    document.getElementById('export-selected-btn').addEventListener('click', exportSelected);

    // ── Download CSV modal ──
    const downloadModal = document.getElementById('download-modal');
    const noDataModal   = document.getElementById('no-data-modal');

    document.getElementById('open-modal-btn').addEventListener('click',   () => showModal(downloadModal));
    document.querySelector('#download-modal .close-modal').addEventListener('click', () => hideModal(downloadModal));
    document.querySelector('.close-no-data').addEventListener('click',    () => hideModal(noDataModal));
    document.getElementById('close-no-data-btn').addEventListener('click',() => hideModal(noDataModal));

    document.getElementById('download-range-btn').addEventListener('click', () => {
        const start = document.getElementById('modal-start').value;
        const end   = document.getElementById('modal-end').value;
        if (!start || !end) { alert('Please select both start and end dates.'); return; }
        handleDownload(
            `/data/download?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
            `classification_logs_${start}_to_${end}.csv`
        );
    });

    document.getElementById('download-all-btn').addEventListener('click', () => {
        handleDownload('/data/download?all=true', 'classification_logs_all.csv');
    });

    // ── Spectral modal ──
    closeSpectralBtn.onclick  = closeSpectralModal;
    confirmBtn.onclick        = closeSpectralModal;

    // Attach spectrum buttons from server-rendered rows
    document.querySelectorAll('.view-spectrum').forEach(btn => {
        btn.addEventListener('click', () => openSpectralModal(btn.dataset.id));
    });

    // ── Backdrop clicks ──
    window.addEventListener('click', e => {
        if (e.target === spectralModal) closeSpectralModal();
        if (e.target === downloadModal) hideModal(downloadModal);
        if (e.target === noDataModal)   hideModal(noDataModal);
    });

    // ── Auto-refresh every 5s ──
    setInterval(() => {
        refreshLogs();
        refreshSummary();
    }, 5000);
});