/**
 * ============================================================
 * charts.js — Grafici canvas per statistiche di carriera
 * ============================================================
 * Libreria di grafici custom basata su canvas HTML5 per
 * visualizzare le statistiche della carriera del giocatore.
 *
 * GRAFICI DISPONIBILI:
 *  - drawLineChart(): andamento temporale (overall, gol, morale)
 *  - drawBarChart(): confronto per stagione o attributo
 *  - drawRadarChart(): grafico radar degli attributi del giocatore
 *  - drawDonutChart(): distribuzione gol/assist/voti
 *  - drawMiniSparkline(): mini grafico inline per dashboard
 *
 * COSTANTI COLORI (palette gioco):
 *  - GOLD (#FFD700), GREEN (#00C566), BLUE (#3b82f6)
 *  - PURPLE (#8b5cf6), RED (#ef4444), DIM (#94a3b8)
 *
 * Tutti i grafici sono responsive e si adattano alla dimensione
 * del canvas genitore. Supportano animazione all'ingresso.
 *
 * Esposto come oggetto globale GS_Charts.
 * ============================================================
 */

const GS_Charts = (() => {
    const GOLD   = '#FFD700';
    const GREEN  = '#10b981';
    const GREEN2 = '#009950';
    const BLUE   = '#3b82f6';
    const PURPLE = '#8b5cf6';
    const RED    = '#ef4444';
    const DIM    = '#94a3b8';
    const BG3    = '#1f2937';

    // ── Helpers ───────────────────────────────────────────────────────────────
    function getCanvas(id, w, h) {
        let c = document.getElementById(id);
        if (!c) {
            c = document.createElement('canvas');
            c.id = id;
        }
        const dpr = window.devicePixelRatio || 1;
        const cssW = w || c.parentElement?.offsetWidth || 400;
        const cssH = h || 200;
        c.width  = Math.round(cssW * dpr);
        c.height = Math.round(cssH * dpr);
        c.style.width  = cssW + 'px';
        c.style.height = cssH + 'px';
        const ctx = c.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return c;
    }

    function roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ── Bar Chart ─────────────────────────────────────────────────────────────
    function barChart(container, data, opts = {}) {
        const _bW = container.offsetWidth, _bH = opts.height || 220;
        const canvas = getCanvas(opts.id || 'gs-bar-chart', _bW, _bH);
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const W = _bW, H = _bH;
        const pad = { top: 30, right: 20, bottom: 50, left: 45 };
        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;

        ctx.clearRect(0, 0, W, H);

        if (!data || !data.length) {
            ctx.fillStyle = DIM;
            ctx.font = '14px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('No data yet', W / 2, H / 2);
            return canvas;
        }

        const maxVal = Math.max(...data.map(d => d.value), 1);
        const colors = opts.colors || [GOLD, GREEN, BLUE, PURPLE, RED];
        const barW = Math.min(chartW / data.length * 0.6, 60);
        const gap  = chartW / data.length;

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (chartH * i) / 4;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(W - pad.right, y);
            ctx.stroke();

            // Y-axis labels
            const val = Math.round(maxVal * (4 - i) / 4);
            ctx.fillStyle = DIM;
            ctx.font = '11px system-ui';
            ctx.textAlign = 'right';
            ctx.fillText(val, pad.left - 6, y + 4);
        }

        // Bars
        data.forEach((d, i) => {
            const barH = (d.value / maxVal) * chartH;
            const x = pad.left + gap * i + (gap - barW) / 2;
            const y = pad.top + chartH - barH;
            const color = d.color || colors[i % colors.length];

            // Shadow glow
            ctx.shadowColor = color;
            ctx.shadowBlur  = 8;

            // Gradient fill
            const grad = ctx.createLinearGradient(x, y, x, y + barH);
            grad.addColorStop(0, color);
            grad.addColorStop(1, color + '44');
            ctx.fillStyle = grad;
            roundRect(ctx, x, y, barW, barH, 4);
            ctx.fill();

            ctx.shadowBlur = 0;

            // Value label
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(d.value, x + barW / 2, y - 6);

            // X label
            ctx.fillStyle = DIM;
            ctx.font = '11px system-ui';
            const label = d.label || `${i + 1}`;
            const maxLabelW = gap - 4;
            ctx.save();
            ctx.translate(x + barW / 2, pad.top + chartH + 14);
            if (label.length > 6) {
                ctx.rotate(-0.5);
                ctx.textAlign = 'right';
            }
            ctx.fillText(label.length > 8 ? label.slice(0, 7) + '…' : label, 0, 0);
            ctx.restore();
        });

        // Title
        if (opts.title) {
            ctx.fillStyle = GOLD;
            ctx.font = 'bold 13px system-ui';
            ctx.textAlign = 'left';
            ctx.fillText(opts.title, pad.left, 18);
        }

        return canvas;
    }

    // ── Line Chart ────────────────────────────────────────────────────────────
    function lineChart(container, datasets, opts = {}) {
        const _lW = container.offsetWidth, _lH = opts.height || 220;
        const canvas = getCanvas(opts.id || 'gs-line-chart', _lW, _lH);
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const W = _lW, H = _lH;
        const pad = { top: 30, right: 20, bottom: 45, left: 45 };
        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;

        ctx.clearRect(0, 0, W, H);

        const allVals = datasets.flatMap(ds => ds.data);
        if (!allVals.length) return canvas;

        const maxVal = Math.max(...allVals, 1);
        const minVal = Math.min(...allVals, 0);
        const range  = maxVal - minVal || 1;
        const colors = opts.colors || [GOLD, GREEN, BLUE, PURPLE];
        const labels = opts.labels || datasets[0].data.map((_, i) => `${i + 1}`);
        const n = datasets[0].data.length;

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (chartH * i) / 4;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(W - pad.right, y);
            ctx.stroke();
            const val = Math.round(minVal + range * (4 - i) / 4);
            ctx.fillStyle = DIM;
            ctx.font = '11px system-ui';
            ctx.textAlign = 'right';
            ctx.fillText(val, pad.left - 6, y + 4);
        }

        // Lines
        datasets.forEach((ds, di) => {
            const color = ds.color || colors[di % colors.length];
            ctx.beginPath();
            ds.data.forEach((val, i) => {
                const x = pad.left + (chartW * i) / Math.max(n - 1, 1);
                const y = pad.top + chartH - ((val - minVal) / range) * chartH;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = color;
            ctx.shadowBlur  = 6;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Area fill
            ctx.beginPath();
            ds.data.forEach((val, i) => {
                const x = pad.left + (chartW * i) / Math.max(n - 1, 1);
                const y = pad.top + chartH - ((val - minVal) / range) * chartH;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.lineTo(pad.left + chartW, pad.top + chartH);
            ctx.lineTo(pad.left, pad.top + chartH);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
            grad.addColorStop(0, color + '44');
            grad.addColorStop(1, color + '00');
            ctx.fillStyle = grad;
            ctx.fill();

            // Dots
            ds.data.forEach((val, i) => {
                const x = pad.left + (chartW * i) / Math.max(n - 1, 1);
                const y = pad.top + chartH - ((val - minVal) / range) * chartH;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur  = 8;
                ctx.fill();
                ctx.shadowBlur = 0;
            });
        });

        // X labels
        labels.forEach((label, i) => {
            const x = pad.left + (chartW * i) / Math.max(n - 1, 1);
            ctx.fillStyle = DIM;
            ctx.font = '11px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(label, x, H - 8);
        });

        // Legend
        datasets.forEach((ds, di) => {
            if (!ds.label) return;
            const color = ds.color || colors[di % colors.length];
            const lx = pad.left + di * 100;
            ctx.fillStyle = color;
            ctx.fillRect(lx, 8, 16, 3);
            ctx.fillStyle = '#fff';
            ctx.font = '11px system-ui';
            ctx.textAlign = 'left';
            ctx.fillText(ds.label, lx + 20, 14);
        });

        if (opts.title) {
            ctx.fillStyle = GOLD;
            ctx.font = 'bold 13px system-ui';
            ctx.textAlign = 'right';
            ctx.fillText(opts.title, W - pad.right, 18);
        }

        return canvas;
    }

    // ── Radar Chart ───────────────────────────────────────────────────────────
    function radarChart(container, stats, opts = {}) {
        const size = opts.size || 260;
        const canvas = getCanvas(opts.id || 'gs-radar-chart', size, size);
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const W = size, H = size;
        const MARGIN = 52; // more margin for full label names
        const cx = W / 2, cy = H / 2;
        const r  = (Math.min(W, H) / 2 - MARGIN) * 0.85; // fits labels within canvas

        ctx.clearRect(0, 0, W, H);

        const keys   = Object.keys(stats);
        const values = Object.values(stats);
        const maxVal = opts.max || 125;
        const n      = keys.length;

        // Draw web
        for (let ring = 1; ring <= 5; ring++) {
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const angle = (2 * Math.PI * i) / n - Math.PI / 2;
                const rr = (r * ring) / 5;
                i === 0
                    ? ctx.moveTo(cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr)
                    : ctx.lineTo(cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr);
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Axes
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * i) / n - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Data polygon
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * i) / n - Math.PI / 2;
            const val = Math.min(values[i], maxVal) / maxVal;
            const rr = r * val;
            i === 0
                ? ctx.moveTo(cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr)
                : ctx.lineTo(cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr);
        }
        ctx.closePath();
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, GREEN + 'bb');
        grad.addColorStop(1, GREEN2 + '33');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = GREEN;
        ctx.lineWidth = 2;
        ctx.shadowColor = GREEN;
        ctx.shadowBlur  = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Dots
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * i) / n - Math.PI / 2;
            const val = Math.min(values[i], maxVal) / maxVal;
            const rr = r * val;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr, 4, 0, Math.PI * 2);
            ctx.fillStyle = GREEN;
            ctx.shadowColor = GREEN;
            ctx.shadowBlur  = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Labels — full names with value, no truncation
        ctx.save();
        const labelPad = MARGIN * 0.95;
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * i) / n - Math.PI / 2;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const lx = cx + cosA * (r + labelPad);
            const ly = cy + sinA * (r + labelPad * 0.85);

            const label = keys[i];
            // Split long labels at space for two-line display
            const words = label.split(' ');
            const fontSize = 10;
            ctx.font = `700 ${fontSize}px 'Barlow Condensed', system-ui`;
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.textAlign = cosA > 0.15 ? 'left' : cosA < -0.15 ? 'right' : 'center';
            ctx.textBaseline = sinA > 0.15 ? 'top' : sinA < -0.15 ? 'bottom' : 'middle';

            if (words.length > 1 && label.length > 8) {
                // Two lines
                const mid = Math.ceil(words.length / 2);
                const line1 = words.slice(0, mid).join(' ');
                const line2 = words.slice(mid).join(' ');
                const lineH = fontSize + 2;
                const offY = sinA > 0.15 ? 0 : sinA < -0.15 ? -lineH : -lineH / 2;
                ctx.fillText(line1, lx, ly + offY);
                ctx.fillText(line2, lx, ly + offY + lineH);
                // Value
                ctx.font = `700 9px 'Barlow Condensed', system-ui`;
                ctx.fillStyle = GREEN;
                ctx.fillText(values[i], lx, ly + offY + lineH * 2 + 2);
            } else {
                ctx.fillText(label, lx, ly);
                ctx.font = `700 9px 'Barlow Condensed', system-ui`;
                ctx.fillStyle = GREEN;
                const valOffY = sinA > 0.15 ? fontSize + 3 : sinA < -0.15 ? -(fontSize + 3) : fontSize + 3;
                ctx.fillText(values[i], lx, ly + valOffY);
            }
        }
        ctx.restore();

        return canvas;
    }

    // ── Animated number counter ───────────────────────────────────────────────
    function animateNumber(el, from, to, duration = 800, suffix = '') {
        const start = performance.now();
        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(from + (to - from) * ease) + suffix;
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // ── Stat bar animation ────────────────────────────────────────────────────
    function animateStatBar(barEl, from, to, max = 125, duration = 600) {
        const start = performance.now();
        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const val = from + (to - from) * ease;
            barEl.style.width = `${(val / max) * 100}%`;
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    return { barChart, lineChart, radarChart };
})();

window.GS_Charts = GS_Charts;
