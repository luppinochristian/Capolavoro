/**
 * ============================================================
 * ui_components.js — Libreria componenti UI riutilizzabili
 * ============================================================
 * Collezione di componenti dell'interfaccia utente usati in tutto
 * il gioco, costruiti con animazioni CSS/JS native.
 *
 * COMPONENTI DISPONIBILI:
 *  - Toast notifications: messaggi temporanei (oro, verde, rosso)
 *  - Modal dialog: finestre di dialogo con overlay
 *  - Confirm dialog: dialogo di conferma con callback
 *  - Progress bar: barra di avanzamento animata
 *  - Skeleton loader: placeholder durante caricamento dati
 *  - Stat badge: badge colorato per statistiche
 *  - Countdown timer: timer a scorrimento
 *  - Shimmer effect: effetto luccichio su elementi in caricamento
 *
 * API pubblica (tramite GS_UI):
 *  - toast(msg, type, duration): mostra toast
 *  - modal(title, body, actions): apre modale
 *  - confirm(msg, onYes, onNo): dialogo conferma
 *  - progress(el, value, max): aggiorna barra avanzamento
 *
 * Esposto come oggetto globale GS_UI.
 * ============================================================
 */

const GS_UI = (() => {

    // ── Toast notification system ──────────────────────────────────────────────
    let _toastStack = [];
    let _toastContainer = null;

    function _ensureToastContainer() {
        if (_toastContainer) return;
        _toastContainer = document.createElement('div');
        _toastContainer.id = 'gs-ui-toast-container';
        _toastContainer.style.cssText = `
            position: fixed; bottom: 80px; right: 20px;
            z-index: 9996; display: flex; flex-direction: column-reverse; gap: 8px;
            pointer-events: none; max-width: 320px;
        `;
        document.body.appendChild(_toastContainer);
    }

    function toast(message, type = 'info', duration = 3500) {
        _ensureToastContainer();
        const colors = {
            info:    { bg: 'var(--card)', border: 'var(--border)',   icon: 'ℹ️' },
            success: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.4)', icon: '✅' },
            error:   { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.4)',  icon: '❌' },
            gold:    { bg: 'rgba(255,215,0,0.1)',  border: 'rgba(255,215,0,0.4)',  icon: '⭐' },
            warning: { bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.4)',  icon: '⚠️' },
        };
        const style = colors[type] || colors.info;
        const el = document.createElement('div');
        el.style.cssText = `
            background: ${style.bg}; border: 1px solid ${style.border};
            backdrop-filter: blur(8px); border-radius: 10px;
            padding: 10px 14px; font-size: 0.82rem; color: var(--text);
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            display: flex; align-items: center; gap: 8px;
            pointer-events: all; cursor: pointer;
            transform: translateX(120%); opacity: 0;
            transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1);
        `;
        el.innerHTML = `<span style="flex-shrink:0;font-size:1rem">${style.icon}</span><span style="flex:1">${message}</span>`;
        el.addEventListener('click', () => {
            el.style.transform = 'translateX(120%)';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 350);
        });
        _toastContainer.appendChild(el);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.style.transform = 'translateX(0)';
                el.style.opacity = '1';
            });
        });
        setTimeout(() => {
            el.style.transform = 'translateX(120%)';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 350);
        }, duration);
        return el;
    }

    // ── Progress modal (for long operations) ──────────────────────────────────
    function showProgressModal(title, steps) {
        const overlay = document.createElement('div');
        overlay.id = 'gs-progress-modal';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.7);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999; backdrop-filter: blur(4px);
        `;
        overlay.innerHTML = `
            <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;min-width:300px;max-width:90vw;text-align:center">
                <div style="font-size:2rem;margin-bottom:12px">⚙️</div>
                <div style="font-weight:700;color:#fff;margin-bottom:16px">${title}</div>
                <div style="background:var(--bg3);border-radius:6px;height:6px;overflow:hidden;margin-bottom:12px">
                    <div id="gs-prog-bar" style="height:100%;background:linear-gradient(90deg,var(--gold),#fff);width:0%;transition:width 0.4s ease;border-radius:6px"></div>
                </div>
                <div id="gs-prog-step" style="font-size:0.8rem;color:var(--text-dim)">Starting...</div>
            </div>`;
        document.body.appendChild(overlay);
        let current = 0;
        const update = (stepIdx, label) => {
            current = stepIdx;
            const pct = ((stepIdx + 1) / steps.length) * 100;
            const bar = document.getElementById('gs-prog-bar');
            const stepEl = document.getElementById('gs-prog-step');
            if (bar) bar.style.transform = `scaleX(${pct / 100})`;
            if (stepEl) stepEl.textContent = label || steps[stepIdx] || '';
        };
        const close = () => {
            overlay.animate([{opacity:1},{opacity:0}], {duration:300}).onfinish = () => overlay.remove();
        };
        return { update, close };
    }

    // ── Confirmation dialog ───────────────────────────────────────────────────
    function confirm(message, onConfirm, onCancel, opts = {}) {
        const lang = localStorage.getItem('gs_lang') || 'it';
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.7);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999; backdrop-filter: blur(4px); animation: fadeIn 0.2s ease;
        `;
        const confirmLabel = opts.confirmLabel || ({it:'Conferma',en:'Confirm',de:'Bestätigen',es:'Confirmar'}[lang]||'Conferma');
        const cancelLabel  = opts.cancelLabel  || ({it:'Annulla',en:'Cancel',de:'Abbrechen',es:'Cancelar'}[lang]||'Annulla');
        const dangerClass  = opts.danger ? 'background:rgba(239,68,68,0.2);border-color:rgba(239,68,68,0.5);color:#fca5a5' : 'background:linear-gradient(135deg,var(--gold),var(--gold-dark));color:#000';
        overlay.innerHTML = `
            <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:360px;width:90%;animation:fadeInUp 0.25s ease">
                <div style="font-size:0.95rem;color:var(--text);margin-bottom:20px;line-height:1.5">${message}</div>
                <div style="display:flex;gap:10px">
                    <button id="gs-confirm-cancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-dim);cursor:pointer;font-size:0.85rem">${cancelLabel}</button>
                    <button id="gs-confirm-ok" style="flex:1;padding:10px;border-radius:8px;border:1px solid transparent;${dangerClass};cursor:pointer;font-size:0.85rem;font-weight:700">${confirmLabel}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        document.getElementById('gs-confirm-ok').addEventListener('click', () => { close(); onConfirm?.(); });
        document.getElementById('gs-confirm-cancel').addEventListener('click', () => { close(); onCancel?.(); });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) { close(); onCancel?.(); } });
        return { close };
    }

    // ── Tooltip system ─────────────────────────────────────────────────────────
    let _tipEl = null;
    function showTip(targetEl, content, position = 'top') {
        hideTip();
        _tipEl = document.createElement('div');
        _tipEl.style.cssText = `
            position: fixed; background: #1e293b; border: 1px solid var(--border);
            border-radius: 8px; padding: 6px 10px; font-size: 0.72rem; color: var(--text);
            max-width: 220px; line-height: 1.4; pointer-events: none; z-index: 9999;
            animation: fadeIn 0.15s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        `;
        _tipEl.innerHTML = content;
        document.body.appendChild(_tipEl);
        const rect = targetEl.getBoundingClientRect();
        const tipW = _tipEl.offsetWidth, tipH = _tipEl.offsetHeight;
        let x, y;
        if (position === 'top') { x = rect.left + rect.width/2 - tipW/2; y = rect.top - tipH - 8; }
        else if (position === 'bottom') { x = rect.left + rect.width/2 - tipW/2; y = rect.bottom + 8; }
        else if (position === 'left') { x = rect.left - tipW - 8; y = rect.top + rect.height/2 - tipH/2; }
        else { x = rect.right + 8; y = rect.top + rect.height/2 - tipH/2; }
        x = Math.max(4, Math.min(x, window.innerWidth - tipW - 4));
        y = Math.max(4, Math.min(y, window.innerHeight - tipH - 4));
        _tipEl.style.left = x + 'px';
        _tipEl.style.top  = y + 'px';
    }
    function hideTip() { if (_tipEl) { _tipEl.remove(); _tipEl = null; } }

    // ── Collapsible section ───────────────────────────────────────────────────
    function makeCollapsible(titleEl, contentEl, opts = {}) {
        let open = opts.open ?? true;
        titleEl.style.cursor = 'pointer';
        titleEl.style.userSelect = 'none';
        const arrow = document.createElement('span');
        arrow.textContent = open ? '▾' : '▸';
        arrow.style.cssText = 'margin-left:8px;font-size:0.8rem;color:var(--text-dim);transition:transform 0.2s';
        titleEl.appendChild(arrow);
        contentEl.style.transition = 'max-height 0.3s ease, opacity 0.3s ease, overflow 0.3s';
        contentEl.style.overflow = 'hidden';
        const toggle = () => {
            open = !open;
            contentEl.style.maxHeight = open ? contentEl.scrollHeight + 'px' : '0';
            contentEl.style.opacity   = open ? '1' : '0';
            arrow.textContent = open ? '▾' : '▸';
        };
        if (!open) { contentEl.style.maxHeight = '0'; contentEl.style.opacity = '0'; }
        titleEl.addEventListener('click', toggle);
        return { toggle, isOpen: () => open };
    }

    // ── Number formatter ──────────────────────────────────────────────────────
    function formatNumber(n, decimals = 0) {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
        return parseFloat(n).toFixed(decimals);
    }

    function formatMoney(n) {
        if (n >= 1_000_000) return '€' + (n / 1_000_000).toFixed(2) + 'M';
        if (n >= 1_000)     return '€' + (n / 1_000).toFixed(1) + 'K';
        return '€' + Math.round(n).toLocaleString('it-IT');
    }

    // ── Star rating display ────────────────────────────────────────────────────
    function renderStars(container, value, max = 5, opts = {}) {
        const filled = Math.round(value);
        const color  = opts.color || '#FFD700';
        container.innerHTML = Array.from({length: max}, (_, i) => 
            `<span style="color:${i < filled ? color : 'var(--border)'}">★</span>`
        ).join('');
    }

    // ── Animated stat bar builder ─────────────────────────────────────────────
    function buildStatBar(label, value, max = 125, color = '#FFD700') {
        const pct = Math.min(100, (value / max) * 100);
        const div = document.createElement('div');
        div.style.marginBottom = '10px';
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:4px">
                <span style="color:var(--text-dim)">${label}</span>
                <span style="font-weight:700;color:${color}">${value}</span>
            </div>
            <div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden">
                <div class="gs-ui-bar-fill" style="height:100%;width:100%;transform:scaleX(0);background:linear-gradient(90deg,${color},${color}88);border-radius:3px;transform-origin:left;transition:transform 0.7s cubic-bezier(0.34,1.56,0.64,1)"></div>
            </div>`;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const fill = div.querySelector('.gs-ui-bar-fill');
                if (fill) fill.style.transform = `scaleX(${pct / 100})`;
            });
        });
        return div;
    }

    // ── Card builder ──────────────────────────────────────────────────────────
    function buildCard(opts = {}) {
        const el = document.createElement('div');
        el.className = 'card ' + (opts.className || '');
        if (opts.gold) el.classList.add('card-gold');
        if (opts.interactive) el.classList.add('card-interactive');
        if (opts.title) {
            const h = document.createElement('div');
            h.style.cssText = 'font-weight:700;font-size:0.9rem;margin-bottom:12px;color:#fff';
            h.textContent = opts.title;
            el.appendChild(h);
        }
        if (opts.content) el.insertAdjacentHTML('beforeend', opts.content);
        if (opts.onclick) el.addEventListener('click', opts.onclick);
        return el;
    }

    // ── Profile header component ──────────────────────────────────────────────
    function buildProfileHeader(player, opts = {}) {
        const lang = localStorage.getItem('gs_lang') || 'it';
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;gap:16px;padding:16px;background:var(--card);border:1px solid var(--border);border-radius:14px';
        
        const ovr = parseInt(player.overall || 0);
        const ovrColor = ovr >= 90 ? '#FFD700' : ovr >= 80 ? '#10b981' : ovr >= 70 ? '#3b82f6' : '#94a3b8';
        
        div.innerHTML = `
            <div style="width:56px;height:56px;border-radius:50%;background:var(--bg3);border:2px solid ${ovrColor};display:flex;align-items:center;justify-content:center;font-size:1.8rem;flex-shrink:0">
                ${player.ai_avatar ? `<img src="${player.ai_avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : '👤'}
            </div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:800;font-size:1rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${player.player_name}</div>
                <div style="font-size:0.75rem;color:var(--text-dim);margin-top:2px">${player.team_nome || '—'} · ${player.nationality || ''}</div>
                <div style="font-size:0.72rem;color:var(--text-dim);margin-top:1px">
                    ${{it:'Età',en:'Age',de:'Alter',es:'Edad'}[lang]||'Età'}: ${player.age || '—'} · ${player.lega_nome || '—'}
                </div>
            </div>
            <div style="text-align:center;flex-shrink:0">
                <div style="font-size:2rem;font-weight:900;color:${ovrColor};line-height:1">${ovr}</div>
                <div style="font-size:0.65rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px">OVR</div>
            </div>`;
        return div;
    }

    // ── Empty state component ─────────────────────────────────────────────────
    function buildEmptyState(icon, message, submessage = '') {
        const div = document.createElement('div');
        div.style.cssText = 'text-align:center;padding:48px 24px;color:var(--text-dim)';
        div.innerHTML = `
            <div style="font-size:3rem;margin-bottom:12px;opacity:0.5">${icon}</div>
            <div style="font-weight:700;color:var(--text);margin-bottom:6px">${message}</div>
            ${submessage ? `<div style="font-size:0.82rem">${submessage}</div>` : ''}`;
        return div;
    }

    // ── Typing animation for text ─────────────────────────────────────────────
    function typeText(el, text, speed = 25) {
        el.textContent = '';
        let i = 0;
        const cursor = document.createElement('span');
        cursor.textContent = '|';
        cursor.style.cssText = 'animation:liveBlinkDot 0.7s infinite;color:var(--gold)';
        el.appendChild(cursor);
        const interval = setInterval(() => {
            cursor.insertAdjacentText('beforebegin', text[i++]);
            if (i >= text.length) { clearInterval(interval); cursor.remove(); }
        }, speed);
        return { stop: () => { clearInterval(interval); cursor.remove(); el.textContent = text; } };
    }

    // ── Radial progress ring ──────────────────────────────────────────────────
    function buildProgressRing(value, max = 100, size = 80, strokeWidth = 6, color = '#FFD700') {
        const r = (size - strokeWidth * 2) / 2;
        const circumference = 2 * Math.PI * r;
        const pct = Math.min(1, value / max);
        const dash = pct * circumference;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.innerHTML = `
            <circle cx="${size/2}" cy="${size/2}" r="${r}"
                fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${strokeWidth}"/>
            <circle cx="${size/2}" cy="${size/2}" r="${r}"
                fill="none" stroke="${color}" stroke-width="${strokeWidth}"
                stroke-dasharray="${circumference}" stroke-dashoffset="${circumference - dash}"
                stroke-linecap="round" transform="rotate(-90 ${size/2} ${size/2})"
                style="transition:stroke-dashoffset 0.8s cubic-bezier(0.34,1.56,0.64,1);filter:drop-shadow(0 0 4px ${color}88)"/>
            <text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="middle"
                fill="${color}" font-size="${size * 0.22}" font-weight="900" font-family="system-ui">
                ${Math.round(pct * 100)}%
            </text>`;
        return svg;
    }

    // ── Copy to clipboard ─────────────────────────────────────────────────────
    function copyToClipboard(text, successMsg) {
        navigator.clipboard?.writeText(text).then(() => {
            const lang = localStorage.getItem('gs_lang') || 'it';
            toast(successMsg || ({it:'Copiato!',en:'Copied!',de:'Kopiert!',es:'¡Copiado!'}[lang]||'Copiato!'), 'success', 2000);
        });
    }

    // ── Initialize tooltip system ─────────────────────────────────────────────
    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tip]');
        if (target) showTip(target, target.dataset.tip, target.dataset.tipPos || 'top');
    });
    document.addEventListener('mouseout', (e) => {
        if (!e.target.closest('[data-tip]')) hideTip();
    });

    return { toast };
})();

window.GS_UI = GS_UI;
