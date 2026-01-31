let spectralChartInstance = null; // To hold the Chart.js instance

// Define the 12 spectral channels (6 VIS, 6 NIR) from the AS7265X sensor
const AS7265X_LABELS = [
    '410 nm', '435 nm', '460 nm', '485 nm', '510 nm', '535 nm',
    '560 nm', '585 nm', '610 nm', '645 nm', '680 nm', '705 nm',
    '730 nm', '760 nm', '810 nm', '860 nm', '900 nm', '940 nm'
];

const MATERIAL_COLORS = {
    'PET': '#00BFFF',
    'HDPE': '#39FF14',
    'PP': '#FFD700'
};

const REFERENCE_COLOR = '#94a3b8';

// Setup Chart Function
const setupSpectralChart = (materialType, rawVis, rawNir, refVis, refNir) => {
    if (spectralChartInstance) {
        spectralChartInstance.destroy();
    }
    
    const ctx = document.getElementById('spectralChart').getContext('2d');
    
    const measuredData = [...rawVis, ...rawNir];
    const referenceData = [...refVis, ...refNir];
    const labels = AS7265X_LABELS;

    spectralChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Measured Spectrum',
                data: measuredData,
                borderColor: MATERIAL_COLORS[materialType] || '#FFFFFF', 
                backgroundColor: 'transparent',
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 5
            },
            {
                label: 'Reference Profile',
                data: referenceData,
                borderColor: REFERENCE_COLOR,
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                x: {
                    title: { display: true, text: 'WAVELENGTH (AS7265X Channels)', color: '#94a3b8' },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' },
                    ticks: { color: '#E2E8F0' }
                },
                y: {
                    title: { display: true, text: 'INTENSITY / ABSORBANCE', color: '#94a3b8' },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' },
                    ticks: { color: '#E2E8F0' }
                }
            },
        }
    });
};


document.addEventListener("DOMContentLoaded", () => {
    
    // ============================================
    // 1. DONUT CHART LOGIC
    // ============================================
    const types = ["pet", "hdpe", "pp"];
    const radius = 14; 
    const circumference = 2 * Math.PI * radius; 

    let offset = 0;
    types.forEach((type) => {
        const circle = document.querySelector(`.circle.${type}`);
        if (circle) {
            const percent = parseFloat(circle.dataset.percent);
            const dash = (percent / 100) * circumference;
            circle.style.strokeDasharray = `${dash} ${circumference}`;
            circle.style.strokeDashoffset = offset; 
            offset -= dash;
        }
    });

    // ============================================
    // 2. DOWNLOAD & NO DATA MODAL LOGIC
    // ============================================
    const downloadModal = document.getElementById('download-modal');
    const noDataModal = document.getElementById('no-data-modal');
    const openDownloadModalBtn = document.getElementById('open-modal-btn');
    
    // Close buttons for download/no-data modals
    const closeDownloadX = document.querySelector('#download-modal .close-modal');
    const closeNoDataX = document.querySelector('#no-data-modal .close-no-data');
    const closeNoDataBtn = document.getElementById('close-no-data-btn');
    
    // Download Action buttons
    const downloadRangeBtn = document.getElementById('download-range-btn');
    const downloadAllBtn = document.getElementById('download-all-btn');
    
    // Inputs
    const modalStart = document.getElementById('modal-start');
    const modalEnd = document.getElementById('modal-end');

    // Helper Functions for Download Modals
    function showModal(modal) {
        if(modal) modal.style.display = 'flex'; 
    }
    function hideModal(modal) {
        if(modal) modal.style.display = 'none';
    }

    // Event Listeners for Download Modal
    if (openDownloadModalBtn) {
        openDownloadModalBtn.addEventListener('click', () => showModal(downloadModal));
    }
    if (closeDownloadX) {
        closeDownloadX.addEventListener('click', () => hideModal(downloadModal));
    }
    if (closeNoDataX) {
        closeNoDataX.addEventListener('click', () => hideModal(noDataModal));
    }
    if (closeNoDataBtn) {
        closeNoDataBtn.addEventListener('click', () => hideModal(noDataModal));
    }

    // Close Modals on Backdrop Click (Merged logic will handle specific modal checks below)

    // Download Range Logic
    if (downloadRangeBtn) {
        downloadRangeBtn.addEventListener('click', async function(){
            const start = modalStart.value;
            const end = modalEnd.value;
            
            if (!start || !end) {
                alert('Please select both start and end dates');
                return;
            }
            
            try {
                const response = await fetch('/data/download?start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end));
                
                if (response.status === 404) {
                    hideModal(downloadModal); 
                    showModal(noDataModal);   
                    return;
                }
                
                if (!response.ok) {
                    try {
                        const errData = await response.json();
                        alert('Error: ' + errData.error);
                    } catch(e) {
                        alert('Error: ' + response.statusText);
                    }
                    return;
                }
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'classification_logs.csv'; 
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                hideModal(downloadModal);
                
            } catch (error) {
                console.error('Download error:', error);
                alert('Error downloading file: ' + error.message);
            }
        });
    }

    // Download All Logic
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', async function(){
            try {
                const response = await fetch('/data/download?all=true');
                
                if (!response.ok) {
                    try {
                        const errData = await response.json();
                        alert('Error: ' + errData.error);
                    } catch(e) {
                        alert('Error: ' + response.statusText);
                    }
                    return;
                }
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'classification_logs_all.csv';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                hideModal(downloadModal); 
                
            } catch (error) {
                console.error('Download error:', error);
                alert('Error downloading file: ' + error.message);
            }
        });
    }


    // ============================================
    // 3. SPECTRAL ANALYSIS MODAL LOGIC
    // ============================================
    const spectralModal = document.getElementById('spectralAnalysisModal');
    const closeSpectralBtn = document.querySelector('.close-button');
    const confirmSpectralBtn = document.querySelector('.modal-confirm-button');
    const spectrumButtons = document.querySelectorAll('.view-spectrum');
    
    const closeSpectralModal = () => {
        spectralModal.style.display = "none";
        document.body.classList.remove('modal-open'); 
    };

    const openSpectralModal = async (dataId) => {
        // 1. Get the data from the table row
        const row = document.querySelector(`button[data-id="${dataId}"]`).closest('tr');
        if (!row) return;

        const materialType = row.querySelector('.material-tag').textContent.trim();
        const confidence = row.querySelector('.confidence-text').textContent.trim();
        const timestamp = row.querySelector('td:nth-child(2)').textContent.trim();
        
        const modalNote = `Key spectral peaks were detected, showing a strong correlation with the ${materialType} reference profile. This high certainty confirms the material type.`;

        // 2. FETCH SPECTRA DATA
        const response = await fetch(`/data/spectra/${dataId}`);
        if (!response.ok) {
            alert("Failed to fetch spectral data. Check Flask server and database connection.");
            return;
        }
        const spectra = await response.json();
        
        if (!spectra.raw_vis || !spectra.ref_vis) {
            alert("Invalid spectral data received from server.");
            return;
        }

        // 3. Populate Modal
        document.getElementById('modal-id').textContent = dataId;
        document.getElementById('modal-material').textContent = materialType;
        document.getElementById('modal-material').className = `material-tag ${materialType.toLowerCase()}`;
        document.getElementById('modal-confidence').textContent = confidence;
        document.getElementById('modal-timestamp').textContent = timestamp;
        document.getElementById('modal-analysis-note').textContent = modalNote;
        
        // 4. Setup Chart
        setupSpectralChart(
            materialType, 
            spectra.raw_vis, 
            spectra.raw_nir, 
            spectra.ref_vis, 
            spectra.ref_nir
        );
        
        // 5. Display modal
        spectralModal.style.display = "block";
        document.body.classList.add('modal-open');

        const legendMeasured = document.querySelector(".legend-color.measured");
        legendMeasured.style.backgroundColor = MATERIAL_COLORS[materialType] || "#FFFFFF";
    };

    // Attach listeners to "View Spectrum" buttons
    spectrumButtons.forEach(button => {
        button.addEventListener('click', () => {
            const dataId = button.dataset.id;
            openSpectralModal(dataId);
        });
    });

    closeSpectralBtn.onclick = closeSpectralModal;
    confirmSpectralBtn.onclick = closeSpectralModal;


    // ============================================
    // 4. GLOBAL CLICK HANDLER (For all modals)
    // ============================================
    window.onclick = function(event) {
        // Close Spectral Modal
        if (event.target == spectralModal) {
            closeSpectralModal();
        }
        // Close Download Modal
        if (event.target == downloadModal) {
            hideModal(downloadModal);
        }
        // Close No Data Modal
        if (event.target == noDataModal) {
            hideModal(noDataModal);
        }
    }

    // ============================================
    // 5. AUTO REFRESH LOGIC (Table & Summary)
    // ============================================
    
    // Refresh Table
    setInterval(async () => {
        const response = await fetch('/data/api/logs');
        if (!response.ok) return;

        const updatedLogs = await response.json();
        const tbody = document.getElementById('materials-table-body');
        tbody.innerHTML = "";

        updatedLogs.forEach(item => {
            const row = `
            <tr class="material-row ${item.material.toLowerCase()}">
                <td>${item.id}</td>
                <td>${item.timestamp}</td>
                <td class="material-cell">
                    <span class="material-tag ${item.material.toLowerCase()}">${item.material}</span>
                </td>
                <td class="confidence-bar-cell">
                    <div class="bar-and-text-container"> 
                        <span class="confidence-bar-wrapper">
                            <span class="confidence-bar ${item.material.toLowerCase()}"
                                style="--conf: ${item.confidence.replace('%','')}">
                            </span>
                        </span>
                        <span class="confidence-text">${item.confidence}</span>
                    </div>
                </td>
                <td>${item.chemical_name || "N/A"}</td>
                <td>
                    <button class="view-spectrum" data-id="${item.id}">View Spectrum</button>
                </td>
            </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });

        // Re-attach listeners for new buttons
        document.querySelectorAll('.view-spectrum').forEach(btn => {
            btn.addEventListener('click', () => openSpectralModal(btn.dataset.id));
        });

    }, 3000); 

    // Refresh Summary
    async function refreshSummary() {
        try {
            const response = await fetch('/data/summary');
            const summary = await response.json();

            // Text Updates
            document.querySelector(".card:nth-child(1) .number").textContent = summary.total_records.toLocaleString();
            document.querySelector(".percent.pet").textContent = summary.pet + "%";
            document.querySelector(".percent.hdpe").textContent = summary.hdpe + "%";
            document.querySelector(".percent.pp").textContent = summary.pp + "%";
            document.querySelector(".activity").textContent = "+" + summary.activity_24h + " ⬆";
            document.querySelector(".confidence").textContent = summary.avg_confidence + "%";

            // Donut Chart Update
            const circles = { pet: summary.pet, hdpe: summary.hdpe, pp: summary.pp };
            let offset = 0;
            const circumference = 2 * Math.PI * 14;

            for (const type of ["pet", "hdpe", "pp"]) {
                const circle = document.querySelector(`.circle.${type}`);
                if (circle) {
                    const dash = (circles[type] / 100) * circumference;
                    circle.style.strokeDasharray = `${dash} ${circumference}`;
                    circle.style.strokeDashoffset = offset;
                    offset -= dash;
                }
            }
        } catch (error) {
            console.error("Summary refresh error:", error);
        }
    }

    setInterval(() => {
        refreshSummary();
    }, 3000);
});