// static/js/data.js

let spectralChartInstance = null;

// Define the 12 spectral channels (6 VIS, 6 NIR) from the AS7265X sensor
// AS7265x spectral channels (410 nm UV to 940 nm IR, ~20 nm FWHM)
const AS7265X_LABELS = [
    // UV–VIS (AS72651)
    '410 nm', '435 nm', '460 nm', '485 nm', '510 nm', '535 nm',
    // VIS (AS72652)
    '560 nm', '585 nm', '610 nm', '645 nm', '680 nm', '705 nm',
    // NIR (AS72653)
    '730 nm', '760 nm', '810 nm', '860 nm', '900 nm', '940 nm'
];

const MATERIAL_COLORS = { 'PET': '#00BFFF', 'HDPE': '#39FF14', 'PP': '#FFD700' };
const REFERENCE_COLOR = '#94a3b8';

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let allLogs = []; 
let filteredLogs = []; 
let currentPage = 1;
let rowsPerPage = 10;
let sortCol = 'id';
let sortDir = 'desc'; 
let activeFilter = 'all'; 
let searchQuery = '';
let selectedIds = new Set();

// ─────────────────────────────────────────
// SPECTRAL CHART
// ─────────────────────────────────────────
const setupSpectralChart = (materialType, rawVis, rawNir, refVis, refNir) => {
    // Destroy previous chart instance if it exists
    if (spectralChartInstance) {
        spectralChartInstance.destroy();
    }
    
    const ctx = document.getElementById('spectralChart').getContext('2d');
    const measuredData = [...rawVis, ...rawNir];
    const referenceData = [...refVis, ...refNir];
    const isMobile = window.innerWidth <= 768;

    spectralChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: AS7265X_LABELS,
            datasets: [{
                label: 'Measured Spectrum',
                data: measuredData,
                // Use MATERIAL_COLORS dictionary to set the color
                borderColor: MATERIAL_COLORS[materialType] || '#FFFFFF', 
                backgroundColor: 'transparent',
                borderWidth: isMobile ? 2 : 3,
                tension: 0.4,
                pointRadius: isMobile ? 2.5 : 5,
                pointHoverRadius: isMobile ? 4 : 7,
            },{
                label: 'Reference Profile',
                data: referenceData,
                borderColor: REFERENCE_COLOR,
                backgroundColor: 'transparent',
                borderWidth: isMobile ? 1.5 : 2,
                borderDash: [5,5],
                tension: 0.4,
                pointRadius: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'WAVELENGTH (AS7265X Channels)',
                        color: '#94a3b8',
                        font: { size: isMobile ? 9 : 12 }
                    },
                    grid: { color: 'rgba(51,65,85,0.5)' },
                    ticks: {
                        color: '#E2E8F0',
                        font: { size: isMobile ? 8 : 11 },
                        maxRotation: isMobile ? 55 : 45,
                        autoSkip: true,
                        maxTicksLimit: isMobile ? 10 : 18,
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'INTENSITY / ABSORBANCE',
                        color: '#94a3b8',
                        font: { size: isMobile ? 9 : 12 }
                    },
                    grid: { color: 'rgba(51,65,85,0.5)' },
                    ticks: {
                        color: '#E2E8F0',
                        font: { size: isMobile ? 9 : 11 },
                        maxTicksLimit: 8,
                        callback: function(value) {
                            if (isMobile && value >= 1000) return (value / 1000).toFixed(0) + 'k';
                            return value.toLocaleString();
                        }
                    }
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

    if (Array.isArray(activeFilter)) {
        result = result.filter(r => activeFilter.includes(r.material));
    } else if (activeFilter !== 'all') {
        result = result.filter(r => r.material === activeFilter);
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(r =>
            String(r.id).includes(q) ||
            (r.timestamp || '').toLowerCase().includes(q) ||
            (r.chemical_name || '').toLowerCase().includes(q) ||
            (r.material || '').toLowerCase().includes(q)
        );
    }

    result.sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (sortCol === 'id' || sortCol === 'confidence') {
            va = parseFloat(va); vb = parseFloat(vb);
        } else {
            va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
        }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
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
    const tbody = document.getElementById('materials-table-body');
    const start = (currentPage - 1) * rowsPerPage;
    const pageRows = filteredLogs.slice(start, start + rowsPerPage);

    if (pageRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#94a3b8;">No records found.</td></tr>`;
        updateSelectAllState();
        return;
    }

    tbody.innerHTML = pageRows.map(item => {
        const conf = item.confidence || '0%';
        const confVal = conf.replace('%','');
        const mat = (item.material || '').toLowerCase();
        const checked = selectedIds.has(item.id) ? 'checked' : '';
        return `
        <tr class="material-row ${mat}" data-id="${item.id}" data-material="${item.material}" data-confidence="${confVal}">
          <td class="col-check"><input type="checkbox" class="row-cb" data-id="${item.id}" ${checked} /></td>
          <td>${item.id}</td>
          <td>${item.timestamp}</td>
          <td class="material-cell"><span class="material-tag ${mat}">${item.material}</span></td>
          <td class="confidence-bar-cell">
            <div class="bar-and-text-container">
              <span class="confidence-bar-wrapper"><span class="confidence-bar ${mat}" style="--conf: ${confVal}"></span></span>
              <span class="confidence-text">${conf}</span>
            </div>
          </td>
          <td>${item.chemical_name || 'N/A'}</td>
          <td><button class="view-spectrum" data-id="${item.id}">View Spectrum</button></td>
        </tr>`;
    }).join('');

    // Clickable Row Logic
    tbody.querySelectorAll('.material-row').forEach(row => {
        row.addEventListener('click', (e) => {
            // Prevent if clicking checkbox or button
            if (e.target.tagName === 'INPUT' || e.target.classList.contains('view-spectrum')) return;
            openSpectralModal(row.dataset.id);
        });
    });

    // Re-attach listeners for interactive elements
    tbody.querySelectorAll('.row-cb').forEach(cb => {
        cb.addEventListener('click', (e) => e.stopPropagation()); // Stop row click
        cb.addEventListener('change', onRowCheckChange);
    });

    tbody.querySelectorAll('.view-spectrum').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop row click
            openSpectralModal(btn.dataset.id);
        });
    });

    updateSelectAllState();
    updateExportSelectedBtn();
}

// ─────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────
function renderPagination() {
    const total = filteredLogs.length;
    const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
    const start = total === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const end = Math.min(currentPage * rowsPerPage, total);

    document.getElementById('pagination-info').textContent = `Showing ${start}–${end} of ${total} records`;
    const container = document.getElementById('page-numbers');
    container.innerHTML = '';

    let pStart = Math.max(1, currentPage - 2);
    let pEnd = Math.min(totalPages, pStart + 4);
    pStart = Math.max(1, pEnd - 4);

    for (let i = pStart; i <= pEnd; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn page-num' + (i === currentPage ? ' page-btn--active' : '');
        btn.textContent = i;
        btn.addEventListener('click', () => { currentPage = i; renderTable(); renderPagination(); });
        container.appendChild(btn);
    }

    document.getElementById('page-first').disabled = currentPage === 1;
    document.getElementById('page-prev').disabled = currentPage === 1;
    document.getElementById('page-next').disabled = currentPage === totalPages;
    document.getElementById('page-last').disabled = currentPage === totalPages;
}

function updateResultsCount() {
    document.getElementById('results-count').textContent = `${filteredLogs.length} record${filteredLogs.length !== 1 ? 's' : ''}`;
}

// ─────────────────────────────────────────
// CHECKBOXES & EXPORT
// ─────────────────────────────────────────
function onRowCheckChange(e) {
    const id = parseInt(e.target.dataset.id);
    if (e.target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    updateSelectAllState();
    updateExportSelectedBtn();
}

function updateSelectAllState() {
    const allCbs = document.querySelectorAll('.row-cb');
    const checkedN = [...allCbs].filter(c => c.checked).length;
    const cb = document.getElementById('select-all-cb');
    if (!cb) return;
    cb.checked = allCbs.length > 0 && checkedN === allCbs.length;
    cb.indeterminate = checkedN > 0 && checkedN < allCbs.length;
}

function updateExportSelectedBtn() {
    const label = selectedIds.size > 0 ? `Export Selected (${selectedIds.size})` : 'Export Selected';
    const disabled = selectedIds.size === 0;
    [
        document.getElementById('export-selected-btn'),
        document.getElementById('export-selected-btn-desktop')
    ].forEach(btn => {
        if (!btn) return;
        btn.disabled = disabled;
        btn.textContent = label;
    });
}

function exportSelected() {
    if (selectedIds.size === 0) return;
    const rows = allLogs.filter(r => selectedIds.has(r.id));
    const csvRows = [
        ['id','timestamp','material','chemical_name','confidence'].join(','),
        ...rows.map(r => [r.id, `"${r.timestamp}"`, r.material, `"${r.chemical_name || ''}"`, r.confidence].join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `selection_${selectedIds.size}.csv`;
    link.click();
}

// ─────────────────────────────────────────
// SPECTRAL MODAL
// ─────────────────────────────────────────
const spectralModal = document.getElementById('spectralAnalysisModal');
function closeSpectralModal() { spectralModal.style.display = 'none'; document.body.classList.remove('modal-open'); }

async function openSpectralModal(dataId) {
    const response = await fetch(`/data/spectra/${dataId}`);
    if (!response.ok) { alert('Failed to fetch spectral data.'); return; }
    const spectra = await response.json();
    
    const row = document.querySelector(`tr[data-id="${dataId}"]`);
    document.getElementById('modal-id').textContent = dataId;

    // Mobile title styling: split into two lines via JS only
    const titleEl = document.getElementById('modal-title');
    if (window.innerWidth <= 768) {
        titleEl.innerHTML = 'SPECTRAL ANALYSIS';
        // Insert classification ID line if not already there
        let idLine = document.getElementById('modal-id-line');
        if (!idLine) {
            idLine = document.createElement('span');
            idLine.id = 'modal-id-line';
            titleEl.insertAdjacentElement('afterend', idLine);
        }
        idLine.textContent = `Classification ID: ${dataId}`;
    } else {
        titleEl.innerHTML = `SPECTRAL ANALYSIS - CLASSIFICATION ID: <span id="modal-id">${dataId}</span>`;
        const idLine = document.getElementById('modal-id-line');
        if (idLine) idLine.remove();
    }
    document.getElementById('modal-material').textContent = row.dataset.material;
    document.getElementById('modal-material').className = `material-tag ${row.dataset.material.toLowerCase()}`;
    document.getElementById('modal-confidence').textContent = row.querySelector('.confidence-text').textContent;
    document.getElementById('modal-timestamp').textContent = row.querySelector('td:nth-child(3)').textContent;

    setupSpectralChart(row.dataset.material, spectra.raw_vis, spectra.raw_nir, spectra.ref_vis, spectra.ref_nir);
    spectralModal.style.display = 'flex';  // <-- changed from 'block' to 'flex'
    document.body.classList.add('modal-open');
}

// ─────────────────────────────────────────
// DOWNLOAD CSV MODALS
// ─────────────────────────────────────────
function showModal(modal) { if (modal) modal.style.display = 'flex'; }
function hideModal(modal) { if (modal) modal.style.display = 'none'; }

async function handleDownload(url, filename) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            hideModal(document.getElementById('download-modal'));
            showModal(document.getElementById('no-data-modal'));
            return;
        }
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        hideModal(document.getElementById('download-modal'));
    } catch (err) {
        alert('Download error: ' + err.message);
    }
}

// ─────────────────────────────────────────
// REFRESH & INIT
// ─────────────────────────────────────────
async function refreshSummary() {
    try {
        const res = await fetch('/data/summary');
        const summary = await res.json();
        document.querySelector('.card:nth-child(1) .number').textContent = summary.total_records.toLocaleString();
        document.querySelector('.percent.pet').textContent = summary.pet + '%';
        document.querySelector('.percent.hdpe').textContent = summary.hdpe + '%';
        document.querySelector('.percent.pp').textContent = summary.pp + '%';
        document.querySelector('.activity').textContent = '+' + summary.activity_24h + ' ⬆';
        document.querySelector('.confidence').textContent = summary.avg_confidence + '%';
        renderDonut(summary.pet, summary.hdpe, summary.pp);
    } catch (e) {}
}

async function refreshLogs() {
    try {
        const res = await fetch('/data/api/logs');
        if (!res.ok) return;
        allLogs = await res.json();
        applyFilters(false);
    } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('materials-table-body');
    allLogs = [...tbody.querySelectorAll('tr.material-row')].map(tr => ({
        id: parseInt(tr.dataset.id),
        material: tr.dataset.material,
        confidence: tr.querySelector('.confidence-text')?.textContent.trim() || '0%',
        timestamp: tr.querySelector('td:nth-child(3)')?.textContent.trim() || '',
        chemical_name: tr.querySelector('td:nth-child(6)')?.textContent.trim() || '',
    }));

    applyFilters();
    renderDonut(
        parseFloat(document.querySelector('.percent.pet')?.textContent) || 0,
        parseFloat(document.querySelector('.percent.hdpe')?.textContent) || 0,
        parseFloat(document.querySelector('.percent.pp')?.textContent) || 0
    );

    // ── Search (desktop bar) ──────────────────────────────────────────
    const desktopSearch = document.getElementById('search-input-desktop');
    const desktopClear  = document.getElementById('clear-search-btn-desktop');
    if (desktopSearch) {
        desktopSearch.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            if (desktopClear) desktopClear.style.display = searchQuery ? 'block' : 'none';
            applyFilters();
        });
    }
    if (desktopClear) desktopClear.addEventListener('click', () => {
        if (desktopSearch) desktopSearch.value = '';
        searchQuery = '';
        desktopClear.style.display = 'none';
        applyFilters();
    });

    // ── Filter chips (desktop) ────────────────────────────────────────
    document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip--active'));
        chip.classList.add('chip--active');
        activeFilter = chip.dataset.filter;
        applyFilters();
    }));

    // ── Desktop export + download buttons ────────────────────────────
    const exportDesktop = document.getElementById('export-selected-btn-desktop');
    const downloadDesktop = document.getElementById('open-modal-btn-desktop');
    if (exportDesktop) exportDesktop.addEventListener('click', exportSelected);
    if (downloadDesktop) downloadDesktop.addEventListener('click', () => showModal(document.getElementById('download-modal')));

    // ── Search (mobile) ───────────────────────────────────────────────
    document.getElementById('search-input').addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        const clearBtn = document.getElementById('clear-search-btn');
        if (clearBtn) clearBtn.style.display = searchQuery ? 'block' : 'none';
        applyFilters();
    });
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        searchQuery = '';
        clearBtn.style.display = 'none';
        applyFilters();
    });

    // ── Sorting ───────────────────────────────────────────────────────
    document.querySelectorAll('th.sortable').forEach(th => th.addEventListener('click', () => {
        sortCol = th.dataset.col;
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        applyFilters();
    }));

    // ── Select-all checkbox ───────────────────────────────────────────
    document.getElementById('select-all-cb').addEventListener('change', (e) => {
        document.querySelectorAll('.row-cb').forEach(cb => {
            cb.checked = e.target.checked;
            const id = parseInt(cb.dataset.id);
            if (e.target.checked) selectedIds.add(id);
            else selectedIds.delete(id);
        });
        updateExportSelectedBtn();
    });

    // ── ⋮ Actions dropdown ────────────────────────────────────────────
    const actionsBtn      = document.getElementById('actions-menu-btn');
    const actionsDropdown = document.getElementById('actions-dropdown');
    const filterMenuBtn   = document.getElementById('filter-menu-btn');
    const filterDropdown  = document.getElementById('filter-dropdown');

    actionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const opening = actionsDropdown.hidden;
        actionsDropdown.hidden = !opening;
        // close the other dropdown
        filterDropdown.hidden = true;
        filterMenuBtn.classList.remove('open', 'active');
    });

    // ── Filter dropdown ───────────────────────────────────────────────
    filterMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const opening = filterDropdown.hidden;
        filterDropdown.hidden = !opening;
        filterMenuBtn.classList.toggle('open', opening);
        filterMenuBtn.classList.toggle('active', opening);
        // close the other dropdown
        actionsDropdown.hidden = true;
    });

    // ── Filter Apply ──────────────────────────────────────────────────
    document.getElementById('filter-apply-btn').addEventListener('click', () => {
        const checked = [...document.querySelectorAll('.filter-cb:checked')].map(cb => cb.value);
        const hasAll = checked.includes('all');

        // sync the "All" checkbox with the others
        const allCb = document.querySelector('.filter-cb[value="all"]');
        const typeCbs = [...document.querySelectorAll('.filter-cb:not([value="all"])')];

        if (hasAll) {
            // "All" checked → treat as no type filter
            activeFilter = 'all';
        } else if (checked.length === 0) {
            activeFilter = 'all'; // nothing checked → show all
        } else if (checked.length === 1) {
            activeFilter = checked[0]; // single type
        } else {
            // multiple types selected — filter to any of them
            activeFilter = checked; // applyFilters handles array below
        }

        applyFilters();
        filterDropdown.hidden = true;
        filterMenuBtn.classList.remove('open', 'active');
    });

    // Sync "All" checkbox: checking it checks everything, unchecking clears types
    document.querySelector('.filter-cb[value="all"]').addEventListener('change', (e) => {
        document.querySelectorAll('.filter-cb:not([value="all"])').forEach(cb => {
            cb.checked = e.target.checked;
        });
    });
    // If all type boxes are manually checked, also check "All"
    document.querySelectorAll('.filter-cb:not([value="all"])').forEach(cb => {
        cb.addEventListener('change', () => {
            const typeCbs = [...document.querySelectorAll('.filter-cb:not([value="all"])')];
            document.querySelector('.filter-cb[value="all"]').checked = typeCbs.every(c => c.checked);
        });
    });

    // ── Close dropdowns on outside click ─────────────────────────────
    document.addEventListener('click', () => {
        actionsDropdown.hidden = true;
        filterDropdown.hidden  = true;
        filterMenuBtn.classList.remove('open', 'active');
    });
    // Prevent clicks inside panels from closing them
    actionsDropdown.addEventListener('click', (e) => e.stopPropagation());
    filterDropdown.addEventListener('click',  (e) => e.stopPropagation());

    // ── Export selected ───────────────────────────────────────────────
    document.getElementById('export-selected-btn').addEventListener('click', () => {
        exportSelected();
        actionsDropdown.hidden = true;
    });

    // ── Download CSV modal ────────────────────────────────────────────
    document.getElementById('open-modal-btn').addEventListener('click', () => {
        actionsDropdown.hidden = true;
        showModal(document.getElementById('download-modal'));
    });

    // ── Spectral modal close ──────────────────────────────────────────
    document.querySelector('.close-button').onclick = closeSpectralModal;
    document.querySelector('.modal-confirm-button').onclick = closeSpectralModal;

    // ── Download modal close buttons ──────────────────────────────────────────
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            hideModal(document.getElementById('download-modal'));
            hideModal(document.getElementById('no-data-modal'));
        });
    });

    const closeNoDataBtn = document.getElementById('close-no-data-btn');
    if (closeNoDataBtn) {
        closeNoDataBtn.addEventListener('click', () => hideModal(document.getElementById('no-data-modal')));
    }

    // Close on overlay background click
    document.getElementById('download-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) hideModal(e.currentTarget);
    });
    document.getElementById('no-data-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) hideModal(e.currentTarget);
    });

    // ── Download buttons ──────────────────────────────────────────────────────
    document.getElementById('download-range-btn').addEventListener('click', () => {
        const start = document.getElementById('modal-start').value;
        const end   = document.getElementById('modal-end').value;
        if (!start || !end) { alert('Please select both a start and end date.'); return; }
        handleDownload(`/data/download?start=${start}&end=${end}`, `logs_${start}_to_${end}.csv`);
    });

    document.getElementById('download-all-btn').addEventListener('click', () => {
        handleDownload('/data/download?all=true', 'logs_all.csv');  // <-- added ?all=true
    });

    setInterval(() => { refreshLogs(); refreshSummary(); }, 5000);
});
