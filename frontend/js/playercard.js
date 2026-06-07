/**
 * ============================================================
 * playercard.js — Generatore di card giocatore in SVG
 * ============================================================
 * Genera card visive del giocatore in formato SVG, ottimizzate
 * per la condivisione sui social e la visualizzazione in-game.
 *
 * TEMI DISPONIBILI:
 *  - gold: sfondo scuro con bordi dorati (giocatori top)
 *  - silver: grigi eleganti (giocatori medi)
 *  - elite: gradiente violetto premium (leggende)
 *  - retro: stile vintage anni '80 (Easter egg)
 *
 * ELEMENTI DELLA CARD:
 *  - Nome giocatore e soprannome
 *  - Overall in grande con colore dinamico
 *  - 6 attributi principali con barre di avanzamento
 *  - Squadra, lega e nazione corrente
 *  - Stagione e anno di carriera
 *  - Badge trofei e Palloni d'Oro
 *
 * API pubblica:
 *  - generate(player, theme): restituisce stringa SVG
 *  - download(player, theme): scarica la card come PNG
 *  - renderInContainer(el, player, theme): disegna nel DOM
 *
 * Esposto come oggetto globale GS_PlayerCard.
 * ============================================================
 */

const GS_PlayerCard = (() => {

    // ── Card themes ───────────────────────────────────────────────────────────
    const THEMES = {
        gold: {
            bg1: '#0a0e1a', bg2: '#1a1a2e',
            accent: '#FFD700', accent2: '#B8860B',
            text: '#fff', textDim: '#94a3b8',
        },
        silver: {
            bg1: '#111827', bg2: '#1f2937',
            accent: '#C0C0C0', accent2: '#808080',
            text: '#fff', textDim: '#9ca3af',
        },
        elite: {
            bg1: '#0f0a1e', bg2: '#1a0a2e',
            accent: '#a855f7', accent2: '#7c3aed',
            text: '#fff', textDim: '#c4b5fd',
        },
        fire: {
            bg1: '#1a0a00', bg2: '#2a1000',
            accent: '#f97316', accent2: '#ea580c',
            text: '#fff', textDim: '#fed7aa',
        },
        ice: {
            bg1: '#0a1a2a', bg2: '#0a2a3a',
            accent: '#38bdf8', accent2: '#0ea5e9',
            text: '#fff', textDim: '#bae6fd',
        },
        legend: {
            bg1: '#0a0500', bg2: '#150a00',
            accent: '#FFD700', accent2: '#FF6B00',
            text: '#fff', textDim: '#fbbf24',
        },
    };

    // ── Pick theme based on overall ───────────────────────────────────────────
    function pickTheme(overall, palloneDoro) {
        palloneDoro = palloneDoro || 0;
        if (palloneDoro >= 3) return THEMES.legend;
        if (overall >= 115)   return THEMES.elite;
        if (overall >= 100)   return THEMES.gold;
        if (overall >= 90)    return THEMES.fire;
        if (overall >= 80)    return THEMES.ice;
        return THEMES.silver;
    }

    // ── Overall color ─────────────────────────────────────────────────────────
    function ovrColor(ovr) {
        if (ovr >= 115) return '#a855f7';
        if (ovr >= 100) return '#FFD700';
        if (ovr >= 90)  return '#10b981';
        if (ovr >= 80)  return '#3b82f6';
        if (ovr >= 70)  return '#f59e0b';
        return '#6b7280';
    }

    // ── 2-column stat bar helper ──────────────────────────────────────────────
    function statBar2col(x, y, label, value, max, color, w) {
        const pct  = Math.min(value / max, 1);
        const barW = Math.max(4, Math.round(w * pct));
        const tc   = (typeof color === 'string' && color.startsWith('#')) ? color : '#e8ecf4';
        return `<text x="${x}" y="${y}" font-size="9" fill="#7b8ba5" font-weight="600" letter-spacing="0.5">${label}</text>` +
               `<text x="${x + w}" y="${y}" font-size="10" fill="${tc}" font-weight="900" text-anchor="end">${value}</text>` +
               `<rect x="${x}" y="${y + 4}" width="${w}" height="5" rx="2.5" fill="rgba(255,255,255,0.07)"/>` +
               `<rect x="${x}" y="${y + 4}" width="${barW}" height="5" rx="2.5" fill="${color}" opacity="0.95"/>`;
    }

    // ── Build hair SVG for card (mirrors app.js buildHairSVG logic) ──────────
    function _buildCardHair(style, hc, s) {
        const cx = s / 2;
        if (style === 'bald' || !hc) return '';
        switch (style) {
            case 'short':
                return `<path d="M${s*.26} ${s*.30} Q${s*.24} ${s*.13} ${cx} ${s*.11} Q${s*.76} ${s*.13} ${s*.74} ${s*.30} Q${s*.68} ${s*.22} ${s*.60} ${s*.24} Q${cx} ${s*.20} ${s*.40} ${s*.24} Q${s*.32} ${s*.22} ${s*.26} ${s*.30}Z" fill="${hc}"/>`;
            case 'medium':
                return `<path d="M${s*.24} ${s*.34} Q${s*.22} ${s*.15} ${s*.28} ${s*.11} Q${cx} ${s*.07} ${s*.72} ${s*.11} Q${s*.78} ${s*.15} ${s*.76} ${s*.34} Q${s*.70} ${s*.26} ${s*.62} ${s*.28} Q${cx} ${s*.24} ${s*.38} ${s*.28} Q${s*.30} ${s*.26} ${s*.24} ${s*.34}Z" fill="${hc}"/><path d="M${s*.22} ${s*.32} Q${s*.18} ${s*.42} ${s*.20} ${s*.51} Q${s*.24} ${s*.53} ${s*.26} ${s*.44} Q${s*.26} ${s*.36} ${s*.22} ${s*.32}Z" fill="${hc}"/><path d="M${s*.78} ${s*.32} Q${s*.82} ${s*.42} ${s*.80} ${s*.51} Q${s*.76} ${s*.53} ${s*.74} ${s*.44} Q${s*.74} ${s*.36} ${s*.78} ${s*.32}Z" fill="${hc}"/>`;
            case 'long':
                return `<path d="M${s*.26} ${s*.32} Q${s*.24} ${s*.13} ${s*.28} ${s*.09} Q${cx} ${s*.05} ${s*.72} ${s*.09} Q${s*.76} ${s*.13} ${s*.74} ${s*.32} Q${s*.68} ${s*.24} ${s*.60} ${s*.26} Q${cx} ${s*.22} ${s*.40} ${s*.26} Q${s*.32} ${s*.24} ${s*.26} ${s*.32}Z" fill="${hc}"/><path d="M${s*.20} ${s*.34} C${s*.14} ${s*.46} ${s*.12} ${s*.58} ${s*.14} ${s*.70} C${s*.16} ${s*.80} ${s*.20} ${s*.86} ${s*.26} ${s*.88} C${s*.30} ${s*.90} ${s*.32} ${s*.84} ${s*.30} ${s*.78} C${s*.27} ${s*.68} ${s*.25} ${s*.56} ${s*.25} ${s*.44} Q${s*.24} ${s*.38} ${s*.20} ${s*.34}Z" fill="${hc}"/><path d="M${s*.80} ${s*.34} C${s*.86} ${s*.46} ${s*.88} ${s*.58} ${s*.86} ${s*.70} C${s*.84} ${s*.80} ${s*.80} ${s*.86} ${s*.74} ${s*.88} C${s*.70} ${s*.90} ${s*.68} ${s*.84} ${s*.70} ${s*.78} C${s*.73} ${s*.68} ${s*.75} ${s*.56} ${s*.75} ${s*.44} Q${s*.76} ${s*.38} ${s*.80} ${s*.34}Z" fill="${hc}"/>`;
            case 'curly':
                return `<path d="M${s*.28} ${s*.32} Q${s*.22} ${s*.20} ${s*.28} ${s*.13} Q${cx} ${s*.05} ${s*.72} ${s*.13} Q${s*.78} ${s*.20} ${s*.72} ${s*.32} Q${s*.66} ${s*.24} ${cx} ${s*.22} Q${s*.34} ${s*.24} ${s*.28} ${s*.32}Z" fill="${hc}"/><circle cx="${s*.22}" cy="${s*.28}" r="${s*.08}" fill="${hc}"/><circle cx="${s*.78}" cy="${s*.28}" r="${s*.08}" fill="${hc}"/><circle cx="${s*.32}" cy="${s*.12}" r="${s*.07}" fill="${hc}"/><circle cx="${s*.68}" cy="${s*.12}" r="${s*.07}" fill="${hc}"/><circle cx="${cx}" cy="${s*.08}" r="${s*.07}" fill="${hc}"/><circle cx="${s*.44}" cy="${s*.10}" r="${s*.055}" fill="${hc}"/><circle cx="${s*.56}" cy="${s*.10}" r="${s*.055}" fill="${hc}"/>`;
            case 'afro':
                return `<ellipse cx="${cx}" cy="${s*.18}" rx="${s*.30}" ry="${s*.18}" fill="${hc}"/><ellipse cx="${s*.20}" cy="${s*.24}" rx="${s*.10}" ry="${s*.12}" fill="${hc}"/><ellipse cx="${s*.80}" cy="${s*.24}" rx="${s*.10}" ry="${s*.12}" fill="${hc}"/><ellipse cx="${s*.26}" cy="${s*.34}" rx="${s*.07}" ry="${s*.08}" fill="${hc}"/><ellipse cx="${s*.74}" cy="${s*.34}" rx="${s*.07}" ry="${s*.08}" fill="${hc}"/>`;
            case 'mohawk':
                return `<path d="M${s*.42} ${s*.32} C${s*.40} ${s*.22} ${s*.42} ${s*.07} ${cx} ${s*.02} C${s*.58} ${s*.07} ${s*.60} ${s*.22} ${s*.58} ${s*.32} Q${cx} ${s*.36} ${s*.42} ${s*.32}Z" fill="${hc}"/>`;
            case 'bun':
                return `<path d="M${s*.26} ${s*.30} Q${s*.24} ${s*.13} ${s*.28} ${s*.11} Q${cx} ${s*.07} ${s*.72} ${s*.11} Q${s*.76} ${s*.13} ${s*.74} ${s*.30} Q${s*.68} ${s*.22} ${s*.60} ${s*.24} Q${cx} ${s*.20} ${s*.40} ${s*.24} Q${s*.32} ${s*.22} ${s*.26} ${s*.30}Z" fill="${hc}"/><circle cx="${cx}" cy="${s*.06}" r="${s*.10}" fill="${hc}"/>`;
            default: return '';
        }
    }

    // ── Face SVG — mirrors app.js renderAvatarSVG proportions exactly ─────────
    function generateFaceSVG(player, cx, cy) {
        const skinMap = {
            light: '#FDDBB4', medium_light: '#E8B88A', medium: '#C68642',
            medium_dark: '#8D5524', dark: '#3B1A08',
        };
        const skin  = skinMap[player.skin_color] || player.skin_color || '#C68642';
        const hc    = player.hair_color || '#1a1a1a';
        const eye   = player.eye_color  || '#5C3317';
        const gender = player.gender || 'male';
        const skinShirt = gender === 'female' ? '#c0397a' : '#1565c0';

        // shade helper
        const hexToRgb = h => { h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; };
        const shade = (h,d) => { const [r,g,b]=hexToRgb(h||'#C68642'); return '#'+[r+d,g+d,b+d].map(v=>'0'+Math.max(0,Math.min(255,v)).toString(16)).map(s=>s.slice(-2)).join(''); };
        const skinDark = shade(skin, -35);
        const noseStroke = skinDark;

        // use same proportions as renderAvatarSVG — canvas size 140, centred at cx,cy
        const s = 140;
        const ox = cx - s/2, oy = cy - s/2; // offset to place within card SVG
        const headCY = s*0.40, headRX = s*0.24, headRY = s*0.24;
        const eyeY   = s*0.38;
        const noseY  = s*0.49;
        const mouthY = s*0.56;
        const chinY  = s*0.64;
        const cxL    = s/2; // local cx

        // hair style key
        const rawStyle = player.skin_hair || 'short';
        const styleKey = rawStyle.split('_')[0];
        const hairSVG  = _buildCardHair(styleKey, styleKey === 'bald' ? null : hc, s);

        return `<g transform="translate(${ox},${oy})">
  <defs>
    <clipPath id="cardHairClip">
      <rect x="${cxL - s*0.38}" y="0" width="${s*0.76}" height="${headCY + headRY*0.3}"/>
    </clipPath>
  </defs>
  <!-- Shirt/shoulders -->
  <path d="M${s*.10} ${s} L${s*.10} ${s*.80} Q${cxL} ${s*.70} ${s*.90} ${s*.80} L${s*.90} ${s}Z" fill="${skinShirt}"/>
  <!-- Neck -->
  <path d="M${s*.43} ${chinY} L${s*.40} ${s*.78} Q${cxL} ${s*.76} ${s*.60} ${s*.78} L${s*.57} ${chinY}Z" fill="${skin}"/>
  <!-- Head -->
  <ellipse cx="${cxL}" cy="${headCY}" rx="${headRX}" ry="${headRY}" fill="${skin}"/>
  <!-- Side shadow -->
  <ellipse cx="${s*.74}" cy="${headCY}" rx="${s*.07}" ry="${headRY*.85}" fill="${skinDark}" opacity="0.15"/>
  <!-- Hair clipped -->
  <g clip-path="url(#cardHairClip)">${hairSVG}</g>
  <!-- Eyebrows -->
  <path d="M${s*.34} ${s*.335} Q${s*.41} ${s*.305} ${s*.47} ${s*.335}" stroke="${hc||'#555'}" stroke-width="${s*.017}" fill="none" stroke-linecap="round"/>
  <path d="M${s*.53} ${s*.335} Q${s*.59} ${s*.305} ${s*.66} ${s*.335}" stroke="${hc||'#555'}" stroke-width="${s*.017}" fill="none" stroke-linecap="round"/>
  <!-- Eyes white -->
  <ellipse cx="${s*.40}" cy="${eyeY}" rx="${s*.055}" ry="${s*.055}" fill="white"/>
  <ellipse cx="${s*.60}" cy="${eyeY}" rx="${s*.055}" ry="${s*.055}" fill="white"/>
  <!-- Iris + pupil -->
  <circle cx="${s*.40}" cy="${eyeY}" r="${s*.032}" fill="${eye}"/>
  <circle cx="${s*.60}" cy="${eyeY}" r="${s*.032}" fill="${eye}"/>
  <circle cx="${s*.40}" cy="${eyeY}" r="${s*.016}" fill="#111"/>
  <circle cx="${s*.60}" cy="${eyeY}" r="${s*.016}" fill="#111"/>
  <!-- Eye highlights -->
  <circle cx="${s*.413}" cy="${eyeY - s*.012}" r="${s*.007}" fill="white" opacity="0.9"/>
  <circle cx="${s*.613}" cy="${eyeY - s*.012}" r="${s*.007}" fill="white" opacity="0.9"/>
  <!-- Nose -->
  <path d="M${s*.48} ${noseY-s*.04} Q${cxL} ${noseY} ${s*.52} ${noseY-s*.04}" stroke="${noseStroke}" stroke-width="${s*.012}" fill="none" stroke-linecap="round"/>
  <path d="M${s*.455} ${noseY} Q${cxL} ${noseY+s*.015} ${s*.545} ${noseY}" stroke="${noseStroke}" stroke-width="${s*.011}" fill="none" stroke-linecap="round"/>
  <!-- Mouth -->
  <path d="M${s*.41} ${mouthY} Q${cxL} ${mouthY+s*.035} ${s*.59} ${mouthY}" stroke="#c0706c" stroke-width="${s*.013}" fill="none" stroke-linecap="round"/>
</g>`;
    }

    // ── Marble card colour palettes (based on OVR) ────────────────────────────
    function _marblePalette(ovr, palloneDoro) {
        palloneDoro = palloneDoro || 0;
        if (palloneDoro >= 3 || ovr >= 115) return {
            // Legendary: obsidian/fire
            marbleA: '#1a0f00', marbleB: '#2d1800', marbleC: '#0a0500',
            vein: '#FF6B00', vein2: '#FFD700',
            border: '#FF6B00', border2: '#FFD700',
            numCol: '#FFD700', textCol: '#fff',
            statCol: '#FFD700', dimCol: 'rgba(255,215,0,0.65)',
            shimmer: 'rgba(255,107,0,0.18)',
            glow: '#FF6B00',
        };
        if (ovr >= 100) return {
            // World Class: dark marble + purple gold
            marbleA: '#10082a', marbleB: '#1c1040', marbleC: '#08041a',
            vein: '#c084fc', vein2: '#FFD700',
            border: '#a855f7', border2: '#FFD700',
            numCol: '#FFD700', textCol: '#fff',
            statCol: '#e9d5ff', dimCol: 'rgba(216,180,254,0.65)',
            shimmer: 'rgba(168,85,247,0.18)',
            glow: '#c084fc',
        };
        if (ovr >= 90) return {
            // Elite: rich dark marble + emerald
            marbleA: '#0a1a0f', marbleB: '#0f2417', marbleC: '#050f08',
            vein: '#34d399', vein2: '#FFD700',
            border: '#10b981', border2: '#6ee7b7',
            numCol: '#FFD700', textCol: '#fff',
            statCol: '#a7f3d0', dimCol: 'rgba(167,243,208,0.65)',
            shimmer: 'rgba(16,185,129,0.18)',
            glow: '#34d399',
        };
        if (ovr >= 80) return {
            // Gold: classic white marble + gold veins (like the image)
            marbleA: '#f5f0e8', marbleB: '#ede5d5', marbleC: '#faf7f0',
            vein: '#B8860B', vein2: '#FFD700',
            border: '#FFD700', border2: '#B8860B',
            numCol: '#8B6914', textCol: '#1a1206',
            statCol: '#7a5c0a', dimCol: 'rgba(139,105,20,0.7)',
            shimmer: 'rgba(255,215,0,0.22)',
            glow: '#FFD700',
        };
        if (ovr >= 70) return {
            // Silver: grey marble
            marbleA: '#dde2ea', marbleB: '#c8cfd8', marbleC: '#e8edf3',
            vein: '#8899aa', vein2: '#c0c8d4',
            border: '#8fa0b0', border2: '#c0cdd8',
            numCol: '#3a4a5a', textCol: '#1a2530',
            statCol: '#3a4a5a', dimCol: 'rgba(58,74,90,0.65)',
            shimmer: 'rgba(136,153,170,0.18)',
            glow: '#8899aa',
        };
        return {
            // Bronze: warm beige marble
            marbleA: '#e8d8c0', marbleB: '#d4c0a0', marbleC: '#f0e4cc',
            vein: '#8B6914', vein2: '#a07820',
            border: '#a07820', border2: '#c09030',
            numCol: '#5a3c0a', textCol: '#3a2608',
            statCol: '#5a3c0a', dimCol: 'rgba(90,60,10,0.65)',
            shimmer: 'rgba(160,120,32,0.18)',
            glow: '#a07820',
        };
    }

    // ── Single stat col: big number + tiny label below ────────────────────────
    function _statBlock(cx, y, label, value, numCol, lblCol) {
        return `<text x="${cx}" y="${y}" font-family="'Impact','Arial Black',sans-serif" font-size="21" font-weight="900" fill="${numCol}" text-anchor="middle" filter="url(#textShadow)">${value}</text>` +
               `<text x="${cx}" y="${y+12}" font-family="'Arial Narrow',system-ui,sans-serif" font-size="7" font-weight="800" fill="${lblCol}" text-anchor="middle" letter-spacing="0.8">${label}</text>`;
    }

    // ── Gold shatter/crack effect (like the FIFA cards) ───────────────────────
    function _goldShatter(W, H, col, col2, intensity) {
        // Radiate from a central crack point — bottom-left cluster like the image
        const cx = W * 0.30, cy = H * 0.52;
        const lines = [
            // Main diagonal crack lines going up-right
            `M${cx} ${cy} L${cx + W*0.42} ${cy - H*0.18}`,
            `M${cx} ${cy} L${cx + W*0.38} ${cy - H*0.30}`,
            `M${cx} ${cy} L${cx + W*0.20} ${cy - H*0.38}`,
            `M${cx} ${cy} L${cx + W*0.50} ${cy - H*0.08}`,
            // Secondary branches
            `M${cx + W*0.15} ${cy - H*0.10} L${cx + W*0.25} ${cy - H*0.22}`,
            `M${cx + W*0.22} ${cy - H*0.14} L${cx + W*0.30} ${cy - H*0.28}`,
            `M${cx + W*0.32} ${cy - H*0.16} L${cx + W*0.44} ${cy - H*0.25}`,
            // Short radiating spikes from center
            `M${cx} ${cy} L${cx - W*0.12} ${cy - H*0.15}`,
            `M${cx} ${cy} L${cx - W*0.08} ${cy + H*0.12}`,
            `M${cx} ${cy} L${cx + W*0.08} ${cy + H*0.10}`,
        ];
        return lines.map((d, i) => {
            const w = i < 4 ? 2.5 - i*0.3 : 1.2;
            const op = i < 4 ? 0.75 : 0.50;
            const c = i % 2 === 0 ? col : col2;
            return `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" opacity="${op}" stroke-linecap="round"/>`;
        }).join('') +
        // Glowing centre burst
        `<circle cx="${cx}" cy="${cy}" r="${W*0.06}" fill="${col}" opacity="0.18" filter="url(#burstGlow)"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${W*0.025}" fill="${col2}" opacity="0.55"/>` +
        // Small debris dots
        [0,1,2,3,4,5,6,7].map(i => {
            const angle = (i/8)*Math.PI*2;
            const r = W*(0.08 + Math.random()*0.12);
            const dx = cx + Math.cos(angle)*r;
            const dy = cy + Math.sin(angle)*r * 0.7;
            return `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${(1.2 + i*0.2).toFixed(1)}" fill="${i%2===0?col:col2}" opacity="${(0.3+i*0.07).toFixed(2)}"/>`;
        }).join('');
    }

    // ── Marble texture (fine veins on white/dark base) ────────────────────────
    function _marbleVeins(W, H, col, col2) {
        return [
            `<path d="M${W*0.12} 0 Q${W*0.18} ${H*0.15} ${W*0.14} ${H*0.32} Q${W*0.20} ${H*0.48} ${W*0.28} ${H*0.60}" stroke="${col}" stroke-width="1.4" fill="none" opacity="0.40"/>`,
            `<path d="M${W*0.52} 0 Q${W*0.60} ${H*0.10} ${W*0.55} ${H*0.22} Q${W*0.50} ${H*0.38} ${W*0.58} ${H*0.52} Q${W*0.63} ${H*0.66} ${W*0.54} ${H*0.82}" stroke="${col}" stroke-width="1.0" fill="none" opacity="0.32"/>`,
            `<path d="M${W*0.78} ${H*0.08} Q${W*0.68} ${H*0.20} ${W*0.73} ${H*0.42} Q${W*0.76} ${H*0.55} ${W*0.70} ${H*0.68}" stroke="${col2}" stroke-width="0.8" fill="none" opacity="0.28"/>`,
            `<path d="M0 ${H*0.42} Q${W*0.10} ${H*0.50} ${W*0.07} ${H*0.64} Q${W*0.12} ${H*0.76} ${W*0.08} ${H}" stroke="${col}" stroke-width="0.9" fill="none" opacity="0.26"/>`,
            `<path d="M${W*0.32} ${H*0.04} Q${W*0.38} ${H*0.16} ${W*0.30} ${H*0.28}" stroke="${col2}" stroke-width="1.6" fill="none" opacity="0.48"/>`,
            `<path d="M${W*0.66} ${H*0.28} Q${W*0.73} ${H*0.36} ${W*0.63} ${H*0.46}" stroke="${col2}" stroke-width="1.9" fill="none" opacity="0.52"/>`,
            // Extra fine veins for richness
            `<path d="M${W*0.44} ${H*0.02} Q${W*0.48} ${H*0.12} ${W*0.42} ${H*0.20}" stroke="${col}" stroke-width="0.7" fill="none" opacity="0.22"/>`,
            `<path d="M${W*0.85} ${H*0.35} Q${W*0.90} ${H*0.50} ${W*0.88} ${H*0.65}" stroke="${col2}" stroke-width="0.6" fill="none" opacity="0.20"/>`,
        ].join('');
    }

    // ── Main card generator — FIFA marble premium style ───────────────────────
    function generate(player, options) {
        options = options || {};
        const W = 340, H = 520;
        const ovr  = parseInt(player.overall || 65);
        const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('gs_lang')) || 'it';
        const pal  = _marblePalette(ovr, player.palloni_doro);

        // Stat labels — game stats only (multi-language)
        const _SL_map = {
            it: { tiro:'TIR', velocita:'VEL', dribbling:'DRI', fisico:'FIS', mentalita:'MEN', ovr:'OVR' },
            en: { tiro:'SHO', velocita:'SPD', dribbling:'DRI', fisico:'PHY', mentalita:'MEN', ovr:'OVR' },
            de: { tiro:'SCH', velocita:'GES', dribbling:'DRI', fisico:'PHY', mentalita:'MEN', ovr:'OVR' },
            es: { tiro:'DIS', velocita:'VEL', dribbling:'REG', fisico:'FIS', mentalita:'MEN', ovr:'OVR' },
        };
        const SL = _SL_map[lang] || _SL_map.it;

        const stats = [
            { l: SL.tiro,      v: Math.min(99, parseInt(player.tiro      || 60)) },
            { l: SL.velocita,  v: Math.min(99, parseInt(player.velocita  || 60)) },
            { l: SL.dribbling, v: Math.min(99, parseInt(player.dribbling || 60)) },
            { l: SL.fisico,    v: Math.min(99, parseInt(player.fisico    || 60)) },
            { l: SL.mentalita, v: Math.min(99, parseInt(player.mentalita || 60)) },
            { l: SL.ovr,       v: Math.min(125, ovr) },
        ];

        // Whether this is a light (marble-white) card or dark card
        const isLight = (ovr >= 80 && ovr < 90) || (ovr >= 60 && ovr < 70);
        const numCol  = pal.numCol;
        const lblCol  = isLight ? 'rgba(80,60,10,0.82)' : 'rgba(255,255,255,0.72)';
        const nameCol = pal.textCol;

        // Octagonal shape — matches the image proportions (slightly wider cut at top/bottom)
        const CX = 28, CY = 22; // corner cuts
        const octPath  = `M${CX},0 H${W-CX} L${W},${CY} V${H-CY} L${W-CX},${H} H${CX} L0,${H-CY} V${CY} Z`;
        const innerCut = 5;
        const octInner = `M${CX+innerCut},${innerCut} H${W-CX-innerCut} L${W-innerCut},${CY+innerCut} V${H-CY-innerCut} L${W-CX-innerCut},${H-innerCut} H${CX+innerCut} L${innerCut},${H-CY-innerCut} V${CY+innerCut} Z`;

        // Avatar — full-height portrait, bleeds over top border like FIFA
        const avatarY = -10; // avatar starts above card interior
        const avatarSection = player.ai_avatar
            ? `<image href="${player.ai_avatar}" x="28" y="${avatarY}" width="284" height="340" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMin meet"/>`
            : generateFaceSVG(player, 175, 155);

        // Gold shatter/crack effect — only for gold/marble tiers
        const shatter = (ovr >= 75)
            ? _goldShatter(W, H, pal.vein, pal.vein2, ovr)
            : '';

        // Marble veins
        const veins = _marbleVeins(W, H, pal.vein, pal.vein2);

        // Pallone d'oro badge
        const pdBadge = (player.palloni_doro || 0) > 0
            ? `<circle cx="${W-30}" cy="42" r="20" fill="${pal.border}" opacity="0.95" filter="url(#burstGlow)"/>
               <text x="${W-30}" y="38" font-size="14" text-anchor="middle" font-family="system-ui">🥇</text>
               <text x="${W-30}" y="53" font-size="9" font-weight="900" fill="${isLight ? '#3a2000' : '#000'}" text-anchor="middle">×${player.palloni_doro}</text>`
            : '';

        // Top star/badge (small emblem at top-centre like FIFA)
        const topBadge = `
  <circle cx="${W/2}" cy="18" r="14" fill="${pal.border}" opacity="0.18"/>
  <text x="${W/2}" y="23" font-size="14" text-anchor="middle" font-family="system-ui" opacity="0.90">⭐</text>`;

        // Bottom league/club strip icons
        const clubStrip = `
  <text x="22" y="${H-10}" font-family="system-ui,sans-serif" font-size="8" font-weight="700" fill="${lblCol}" opacity="0.9">${(player.team_nome||'').slice(0,16).toUpperCase()}</text>`;

        // Stat strip — 6 equal columns
        const stripTop = H - 86;
        const colW = W / 6;
        const statBlocks = stats.map((s, i) =>
            _statBlock(colW * i + colW / 2, stripTop + 26, s.l, s.v, numCol, lblCol)
        ).join('');

        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <linearGradient id="mbl" x1="5%" y1="0%" x2="95%" y2="100%">
    <stop offset="0%"   stop-color="${pal.marbleC}"/>
    <stop offset="30%"  stop-color="${pal.marbleA}"/>
    <stop offset="65%"  stop-color="${pal.marbleB}"/>
    <stop offset="100%" stop-color="${pal.marbleA}"/>
  </linearGradient>
  <linearGradient id="brdG" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%"   stop-color="${pal.border2}"/>
    <stop offset="35%"  stop-color="${pal.border}"/>
    <stop offset="65%"  stop-color="${pal.border2}"/>
    <stop offset="100%" stop-color="${pal.border}"/>
  </linearGradient>
  <linearGradient id="stripGrad" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%"   stop-color="${pal.marbleB}" stop-opacity="0.96"/>
    <stop offset="100%" stop-color="${pal.marbleA}" stop-opacity="0.99"/>
  </linearGradient>
  <linearGradient id="avatarFadeBot" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%"   stop-color="${pal.marbleA}" stop-opacity="0"/>
    <stop offset="60%"  stop-color="${pal.marbleA}" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="${pal.marbleA}" stop-opacity="1"/>
  </linearGradient>
  <linearGradient id="avatarFadeTop" x1="0%" y1="100%" x2="0%" y2="0%">
    <stop offset="0%"   stop-color="${pal.marbleA}" stop-opacity="0"/>
    <stop offset="100%" stop-color="${pal.marbleA}" stop-opacity="0.30"/>
  </linearGradient>
  <!-- Avatar clip: portrait shape, tall -->
  <clipPath id="avatarClip">
    <rect x="28" y="${avatarY}" width="284" height="340" rx="4"/>
  </clipPath>
  <clipPath id="cardClip"><path d="${octPath}"/></clipPath>
  <filter id="burstGlow" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="7" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="numGlow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="3.5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="textShadow">
    <feDropShadow dx="0" dy="1" stdDeviation="2.5" flood-color="rgba(0,0,0,0.50)"/>
  </filter>
  <filter id="nameShadow">
    <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.60)"/>
  </filter>
</defs>

<!-- ===== CARD OUTER BORDER (gold/gradient thick ring) ===== -->
<path d="${octPath}" fill="url(#brdG)"/>

<!-- ===== CARD INNER BODY (marble) ===== -->
<path d="${octInner}" fill="url(#mbl)" clip-path="url(#cardClip)"/>

<!-- Marble veins layer -->
<g clip-path="url(#cardClip)">${veins}</g>

<!-- ===== AVATAR ===== -->
<g clip-path="url(#cardClip)">${avatarSection}</g>

<!-- Avatar top-fade (subtle, keeps top area legible) -->
<rect x="4" y="4" width="${W-8}" height="90" fill="url(#avatarFadeTop)" clip-path="url(#cardClip)"/>

<!-- Avatar bottom-fade (blends into name area) -->
<rect x="4" y="${H*0.46}" width="${W-8}" height="${H*0.21}" fill="url(#avatarFadeBot)" clip-path="url(#cardClip)"/>

<!-- ===== GOLD SHATTER EFFECT ===== -->
<g clip-path="url(#cardClip)">${shatter}</g>

<!-- ===== TOP AREA: OVR (large, top-left) ===== -->
<!-- Soft glow halo behind the number -->
<circle cx="44" cy="52" r="36" fill="${pal.glow}" opacity="0.12" filter="url(#burstGlow)" clip-path="url(#cardClip)"/>
<!-- OVR number — very large, bold, glowing -->
<text x="44" y="72" font-family="'Impact','Arial Black',sans-serif" font-size="60" font-weight="900"
      fill="${numCol}" text-anchor="middle" filter="url(#numGlow)" clip-path="url(#cardClip)">${ovr}</text>

<!-- Nation top-right area -->
<text x="${W-14}" y="32" font-family="system-ui,sans-serif" font-size="8.5" font-weight="800"
      fill="${pal.dimCol}" text-anchor="end" letter-spacing="0.6" clip-path="url(#cardClip)">${(player.nationality||'Italy').replace(/_/g,' ').slice(0,14).toUpperCase()}</text>

<!-- Top badge (star) -->
${topBadge}

<!-- Pallone d'oro badge -->
${pdBadge}

<!-- ===== NAME AREA ===== -->
<!-- Thin gold separator line above name -->
<line x1="20" y1="${H-100}" x2="${W-20}" y2="${H-100}" stroke="${pal.border}" stroke-width="0.9" opacity="0.60" clip-path="url(#cardClip)"/>
<!-- Player surname — large, bold, centred -->
<text x="${W/2}" y="${H-106}" font-family="'Impact','Arial Black',sans-serif" font-size="30" font-weight="900"
      fill="${nameCol}" text-anchor="middle" filter="url(#nameShadow)" letter-spacing="2.5"
      clip-path="url(#cardClip)">${(player.player_name||'?').toUpperCase()}</text>

<!-- ===== STATS STRIP ===== -->
<!-- Strip background -->
<rect x="4" y="${stripTop}" width="${W-8}" height="${H - stripTop - 4}" fill="url(#stripGrad)" clip-path="url(#cardClip)"/>
<!-- Top separator -->
<line x1="20" y1="${stripTop}" x2="${W-20}" y2="${stripTop}" stroke="${pal.border}" stroke-width="1" opacity="0.50" clip-path="url(#cardClip)"/>

<!-- Vertical dividers between stats -->
${[1,2,3,4,5].map(i =>
    `<line x1="${(colW*i).toFixed(1)}" y1="${stripTop+5}" x2="${(colW*i).toFixed(1)}" y2="${H-10}"
           stroke="${pal.border}" stroke-width="0.6" opacity="0.30" clip-path="url(#cardClip)"/>`
).join('')}

<!-- Stat values -->
<g clip-path="url(#cardClip)">${statBlocks}</g>

<!-- Club text bottom-left -->
${clubStrip}

<!-- ===== INNER GOLD RING (thin inset border) ===== -->
<path d="${octInner}" fill="none" stroke="${pal.border}" stroke-width="0.9" stroke-opacity="0.55" clip-path="url(#cardClip)"/>

<!-- ===== OUTER BORDER re-drawn crisp on top ===== -->
<path d="${octPath}" fill="none" stroke="url(#brdG)" stroke-width="5"/>
</svg>`;
    }

    // ── Render card into a container ──────────────────────────────────────────
    function renderCard(container, player, options) {
        if (!container) return;
        container.innerHTML = generate(player, options);
        const svgEl = container.querySelector('svg');
        if (svgEl) svgEl.style.cssText = 'width:100%;height:auto;display:block;filter:drop-shadow(0 20px 40px rgba(0,0,0,0.70))';
    }

    // ── Download card as SVG ──────────────────────────────────────────────────
    function downloadCard(player, options) {
        const svg  = generate(player, options);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${(player.player_name||'card').replace(/\s+/g,'_')}_golden_striker.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ── Show card modal ───────────────────────────────────────────────────────
    function showCardModal(player) {
        const prev = document.getElementById('gs-card-modal');
        if (prev) prev.remove();

        const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('gs_lang')) || 'it';

        const modal = document.createElement('div');
        modal.id = 'gs-card-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.88);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px';
        modal.innerHTML = `
<div style="max-width:360px;width:100%">
  <div id="gs-card-content" style="border-radius:12px;overflow:hidden"></div>
  <div style="display:flex;gap:10px;margin-top:16px;justify-content:center">
    <button onclick="GS_PlayerCard.downloadCard(window._gsCardPlayer)"
      style="background:linear-gradient(135deg,#FFD700,#B8860B);color:#000;border:none;padding:10px 26px;border-radius:10px;cursor:pointer;font-weight:800;font-size:0.88rem">
      ⬇️ ${{it:'Scarica SVG',en:'Download SVG',de:'SVG herunterladen',es:'Descargar SVG'}[lang]||'Scarica SVG'}
    </button>
    <button onclick="document.getElementById('gs-card-modal').remove()"
      style="background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:10px 20px;border-radius:10px;cursor:pointer;font-size:0.88rem">
      ${{it:'Chiudi',en:'Close',de:'Schließen',es:'Cerrar'}[lang]||'Chiudi'}
    </button>
  </div>
</div>`;

        document.body.appendChild(modal);
        window._gsCardPlayer = player;
        renderCard(document.getElementById('gs-card-content'), player);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        if (window.GS_Particles) GS_Particles.effects.confettiRain();
    }

    return { generate, renderCard, downloadCard, showCardModal, _marblePalette };
})();

window.GS_PlayerCard = GS_PlayerCard;
