// js/qr-app.js
document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('dataInput');
    const gutter = document.getElementById('gutter');
    const qrContainer = document.getElementById('qrContainer');
    
    // Global State Variables
    let selectedDateStr = "";
    let selectedDatePayload = "";
    const colorPalette = ['#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0284c7', '#ea580c'];

    // Sync the vertical scrolling between textarea and gutter
    editor.addEventListener('scroll', () => {
        gutter.scrollTop = editor.scrollTop;
    });

    // Initialize Flatpickr
    flatpickr("#productionDate", {
        dateFormat: "d-m-Y",
        defaultDate: "today",
        locale: { firstDayOfWeek: 1 },
        onChange: function(selectedDates, dateString) {
            if (dateString) {
                selectedDateStr = dateString;
                selectedDatePayload = dateString.replace(/-/g, '') + '\r';
                processData();
            }
        },
        onReady: function(selectedDates, dateString) {
            selectedDateStr = dateString;
            selectedDatePayload = dateString.replace(/-/g, '') + '\r';
        }
    });

    // Trigger processing on input
    editor.addEventListener('input', () => {
        processData();
    });

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatHelper(str) {
        return escapeHtml(str)
            .replace(/\t/g, '<span style="color: #e74c3c; font-weight: 800;">[TAB]</span>')
            .replace(/\r/g, '<span style="color: #e74c3c; font-weight: 800;">[CR]</span>');
    }

    function processData() {
        const rawText = editor.value; 
        // Splitting explicitly by \n ensures 1:1 mapping with textarea visual lines
        const lines = rawText.split('\n');

        let parsedRows = [];
        let order = [];
        let groups = {};

        // Extraction & Classification
        lines.forEach((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                parsedRows.push({ valid: false });
                return;
            }

            let cols = line.split('\t');
            let article = '', qty = 0, mode = 'A';

            if (cols.length === 4 || cols[0].trim().toUpperCase() === 'VOMM1') {
                mode = 'B';
                article = cols[1] ? cols[1].trim() : '';
                qty = parseFloat(cols[cols.length - 1].replace(',', '.')) || 0;
            } else if (cols.length >= 2) {
                mode = 'A';
                article = cols[0] ? cols[0].trim() : '';
                qty = parseFloat(cols[cols.length - 1].replace(',', '.')) || 0;
            } else {
                parsedRows.push({ valid: false });
                return; 
            }

            const paddedArticle = article.padStart(7, '0');
            parsedRows.push({
                valid: true,
                article: paddedArticle,
                qty: qty,
                mode: mode
            });
        });

        // Deduplication & Aggregation
        parsedRows.forEach(row => {
            if (!row.valid) return;
            if (!groups[row.article]) {
                groups[row.article] = {
                    article: row.article,
                    qty: 0,
                    mode: row.mode,
                    count: 0,
                    color: null
                };
                order.push(row.article);
            }
            groups[row.article].qty = Math.round((groups[row.article].qty + row.qty) * 1000) / 1000;
            groups[row.article].count += 1;
        });

        // Assign Colors to Aggregated Items
        let colorIndex = 0;
        order.forEach(art => {
            if (groups[art].count > 1) {
                groups[art].color = colorPalette[colorIndex % colorPalette.length];
                colorIndex++;
            }
        });

        // Render Visual Marker Gutter
        let gutterHtml = '';
        parsedRows.forEach(row => {
            if (row.valid && groups[row.article] && groups[row.article].color) {
                gutterHtml += `<div class="gutter-line"><div class="marker-dot" style="background-color: ${groups[row.article].color};"></div></div>`;
            } else {
                gutterHtml += `<div class="gutter-line"></div>`;
            }
        });
        gutter.innerHTML = gutterHtml;

        // Build QR Cards
        renderCards(order, groups);
    }

    function renderCards(order, groups) {
        qrContainer.innerHTML = '';

        order.forEach(art => {
            const group = groups[art];
            
            let artPayload = '';
            if (group.mode === 'B') {
                artPayload = `${group.article}\tP018\tP018\tZD01\r`;
            } else {
                artPayload = `${group.article}\tP018\tP011\tZD01\r`;
            }
            let qtyPayload = `${group.qty}\r`;

            const card = document.createElement('div');
            card.className = 'card';
            
            // Apply visual indicator for aggregated cards
            if (group.color) {
                card.style.borderColor = group.color;
                card.style.boxShadow = `0 4px 15px ${group.color}33`;
            }

            // Notice we removed the data-value attributes entirely
            card.innerHTML = `
                <div class="qr-block">
                    <div class="qr-title">Article</div>
                    <div class="qr-value" ${group.color ? `style="color: ${group.color};"` : ''}>${group.article}</div>
                    <canvas class="qr-canvas-art"></canvas>
                    <div class="payload-helper">${formatHelper(artPayload)}</div>
                </div>
                <div class="qr-block">
                    <div class="qr-title">Quantity</div>
                    <div class="qr-value" ${group.color ? `style="color: ${group.color};"` : ''}>${group.qty}</div>
                    <canvas class="qr-canvas-qty"></canvas>
                    <div class="payload-helper">${formatHelper(qtyPayload)}</div>
                </div>
                <div class="qr-block">
                    <div class="qr-title">Production Date</div>
                    <div class="qr-value">${selectedDateStr}</div>
                    <canvas class="qr-canvas-date"></canvas>
                    <div class="payload-helper">${formatHelper(selectedDatePayload)}</div>
                </div>
                <div class="card-actions">
                    <button class="btn-scan" onclick="toggleScan(this)">Mark Scanned</button>
                </div>
            `;
            qrContainer.appendChild(card);

            // Generate QR codes immediately by passing the raw JS strings directly
            // This bypasses HTML attribute normalization, preserving the \r perfectly
            new QRious({
                element: card.querySelector('.qr-canvas-art'),
                value: artPayload,
                size: 150,
                level: 'M',
                padding: 0
            });

            new QRious({
                element: card.querySelector('.qr-canvas-qty'),
                value: qtyPayload,
                size: 150,
                level: 'M',
                padding: 0
            });

            new QRious({
                element: card.querySelector('.qr-canvas-date'),
                value: selectedDatePayload,
                size: 150,
                level: 'M',
                padding: 0
            });
        });
    }
    // Expose scan toggle to window
    window.toggleScan = function(btn) {
        const card = btn.closest('.card');
        card.classList.toggle('scanned');
        if (card.classList.contains('scanned')) {
            btn.innerText = 'Scanned (Undo)';
        } else {
            btn.innerText = 'Mark Scanned';
        }
    };
    
    // Initialize empty gutter on load
    processData();
});