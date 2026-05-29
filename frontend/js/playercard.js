/**
 * ============================================================
 * playercard.js — Generatore di card giocatore in SVG (v5)
 * ============================================================
 * Compatibile con avatar SVG generato e con foto AI (ai_avatar).
 */

const GS_PlayerCard = (() => {

    // ── Colour palettes ───────────────────────────────────────────────────────
    function _marblePalette(ovr, palloneDoro) {
        palloneDoro = palloneDoro || 0;
        if (palloneDoro >= 3 || ovr >= 115) return {
            marbleA:'#140b00', marbleB:'#271200', marbleC:'#070200',
            vein:'#FF7000', vein2:'#FFD700',
            border:'#FF8C00', border2:'#FFE040',
            numCol:'#FFD700', textCol:'#fff',
            dimCol:'rgba(255,225,80,0.85)', glow:'#FF6B00',
            glowRgb:'255,107,0', tier:'LEGGENDA',
            shirtA:'#5a1a00', shirtB:'#8B2800',
            tint:'rgba(255,107,0,0.10)',
        };
        if (ovr >= 100) return {
            marbleA:'#0c0520', marbleB:'#170d38', marbleC:'#060218',
            vein:'#c084fc', vein2:'#ede9fe',
            border:'#b060ff', border2:'#e0c0ff',
            numCol:'#FFD700', textCol:'#fff',
            dimCol:'rgba(230,200,255,0.85)', glow:'#c084fc',
            glowRgb:'168,85,247', tier:'WORLD CLASS',
            shirtA:'#2e1060', shirtB:'#4a1a90',
            tint:'rgba(168,85,247,0.10)',
        };
        if (ovr >= 90) return {
            marbleA:'#060e07', marbleB:'#0b1c0d', marbleC:'#030804',
            vein:'#2dd4aa', vein2:'#a7f3d0',
            border:'#0fb97a', border2:'#6ee7b7',
            numCol:'#FFD700', textCol:'#fff',
            dimCol:'rgba(167,243,208,0.85)', glow:'#2dd4aa',
            glowRgb:'13,185,122', tier:'ELITE',
            shirtA:'#0a3020', shirtB:'#0f4830',
            tint:'rgba(13,185,122,0.10)',
        };
        if (ovr >= 80) return {
            marbleA:'#f0ead8', marbleB:'#e5dac0', marbleC:'#f8f2e8',
            vein:'#b07808', vein2:'#d4a010',
            border:'#CFA020', border2:'#e8c040',
            numCol:'#4a3000', textCol:'#16100a',
            dimCol:'rgba(70,45,0,0.85)', glow:'#CFA020',
            glowRgb:'180,130,8', tier:'ORO',
            shirtA:'#8B6300', shirtB:'#b07e00',
            tint:'rgba(180,130,8,0.07)',
        };
        if (ovr >= 70) return {
            marbleA:'#d5dae4', marbleB:'#c0c9d4', marbleC:'#dee3ed',
            vein:'#7090a8', vein2:'#a0b8c8',
            border:'#7090a8', border2:'#98b8cc',
            numCol:'#10202e', textCol:'#0e1c28',
            dimCol:'rgba(16,32,46,0.82)', glow:'#7090a8',
            glowRgb:'80,108,130', tier:'ARGENTO',
            shirtA:'#263646', shirtB:'#38506a',
            tint:'rgba(80,108,130,0.07)',
        };
        return {
            marbleA:'#e0d0b0', marbleB:'#ccb890', marbleC:'#e8dac0',
            vein:'#886010', vein2:'#a07820',
            border:'#906818', border2:'#b88828',
            numCol:'#381800', textCol:'#281404',
            dimCol:'rgba(56,24,0,0.82)', glow:'#906818',
            glowRgb:'120,88,16', tier:'BRONZO',
            shirtA:'#6b4010', shirtB:'#8b5818',
            tint:'rgba(120,88,16,0.07)',
        };
    }

    // ── Hair ──────────────────────────────────────────────────────────────────
    function _buildCardHair(style, hc, s) {
        const cx = s/2;
        if (style==='bald'||!hc) return '';
        switch(style){
            case 'short':  return `<path d="M${s*.26} ${s*.30} Q${s*.24} ${s*.13} ${cx} ${s*.11} Q${s*.76} ${s*.13} ${s*.74} ${s*.30} Q${s*.68} ${s*.22} ${s*.60} ${s*.24} Q${cx} ${s*.20} ${s*.40} ${s*.24} Q${s*.32} ${s*.22} ${s*.26} ${s*.30}Z" fill="${hc}"/>`;
            case 'medium': return `<path d="M${s*.24} ${s*.34} Q${s*.22} ${s*.15} ${s*.28} ${s*.11} Q${cx} ${s*.07} ${s*.72} ${s*.11} Q${s*.78} ${s*.15} ${s*.76} ${s*.34} Q${s*.70} ${s*.26} ${s*.62} ${s*.28} Q${cx} ${s*.24} ${s*.38} ${s*.28} Q${s*.30} ${s*.26} ${s*.24} ${s*.34}Z" fill="${hc}"/><path d="M${s*.22} ${s*.32} Q${s*.18} ${s*.42} ${s*.20} ${s*.51} Q${s*.24} ${s*.53} ${s*.26} ${s*.44} Q${s*.26} ${s*.36} ${s*.22} ${s*.32}Z" fill="${hc}"/><path d="M${s*.78} ${s*.32} Q${s*.82} ${s*.42} ${s*.80} ${s*.51} Q${s*.76} ${s*.53} ${s*.74} ${s*.44} Q${s*.74} ${s*.36} ${s*.78} ${s*.32}Z" fill="${hc}"/>`;
            case 'long':   return `<path d="M${s*.26} ${s*.32} Q${s*.24} ${s*.13} ${s*.28} ${s*.09} Q${cx} ${s*.05} ${s*.72} ${s*.09} Q${s*.76} ${s*.13} ${s*.74} ${s*.32} Q${s*.68} ${s*.24} ${s*.60} ${s*.26} Q${cx} ${s*.22} ${s*.40} ${s*.26} Q${s*.32} ${s*.24} ${s*.26} ${s*.32}Z" fill="${hc}"/><path d="M${s*.20} ${s*.34} C${s*.14} ${s*.46} ${s*.12} ${s*.58} ${s*.14} ${s*.70} C${s*.16} ${s*.80} ${s*.20} ${s*.86} ${s*.26} ${s*.88} C${s*.30} ${s*.90} ${s*.32} ${s*.84} ${s*.30} ${s*.78} C${s*.27} ${s*.68} ${s*.25} ${s*.56} ${s*.25} ${s*.44} Q${s*.24} ${s*.38} ${s*.20} ${s*.34}Z" fill="${hc}"/><path d="M${s*.80} ${s*.34} C${s*.86} ${s*.46} ${s*.88} ${s*.58} ${s*.86} ${s*.70} C${s*.84} ${s*.80} ${s*.80} ${s*.86} ${s*.74} ${s*.88} C${s*.70} ${s*.90} ${s*.68} ${s*.84} ${s*.70} ${s*.78} C${s*.73} ${s*.68} ${s*.75} ${s*.56} ${s*.75} ${s*.44} Q${s*.76} ${s*.38} ${s*.80} ${s*.34}Z" fill="${hc}"/>`;
            case 'curly':  return `<path d="M${s*.28} ${s*.32} Q${s*.22} ${s*.20} ${s*.28} ${s*.13} Q${cx} ${s*.05} ${s*.72} ${s*.13} Q${s*.78} ${s*.20} ${s*.72} ${s*.32} Q${s*.66} ${s*.24} ${cx} ${s*.22} Q${s*.34} ${s*.24} ${s*.28} ${s*.32}Z" fill="${hc}"/><circle cx="${s*.22}" cy="${s*.28}" r="${s*.08}" fill="${hc}"/><circle cx="${s*.78}" cy="${s*.28}" r="${s*.08}" fill="${hc}"/><circle cx="${s*.32}" cy="${s*.12}" r="${s*.07}" fill="${hc}"/><circle cx="${s*.68}" cy="${s*.12}" r="${s*.07}" fill="${hc}"/><circle cx="${cx}" cy="${s*.08}" r="${s*.07}" fill="${hc}"/>`;
            case 'afro':   return `<ellipse cx="${cx}" cy="${s*.18}" rx="${s*.30}" ry="${s*.18}" fill="${hc}"/><ellipse cx="${s*.20}" cy="${s*.24}" rx="${s*.10}" ry="${s*.12}" fill="${hc}"/><ellipse cx="${s*.80}" cy="${s*.24}" rx="${s*.10}" ry="${s*.12}" fill="${hc}"/>`;
            case 'mohawk': return `<path d="M${s*.42} ${s*.32} C${s*.40} ${s*.22} ${s*.42} ${s*.07} ${cx} ${s*.02} C${s*.58} ${s*.07} ${s*.60} ${s*.22} ${s*.58} ${s*.32} Q${cx} ${s*.36} ${s*.42} ${s*.32}Z" fill="${hc}"/>`;
            case 'bun':    return `<path d="M${s*.26} ${s*.30} Q${s*.24} ${s*.13} ${s*.28} ${s*.11} Q${cx} ${s*.07} ${s*.72} ${s*.11} Q${s*.76} ${s*.13} ${s*.74} ${s*.30} Q${s*.68} ${s*.22} ${s*.60} ${s*.24} Q${cx} ${s*.20} ${s*.40} ${s*.24} Q${s*.32} ${s*.22} ${s*.26} ${s*.30}Z" fill="${hc}"/><circle cx="${cx}" cy="${s*.06}" r="${s*.10}" fill="${hc}"/>`;
            default: return '';
        }
    }

    // ── Face SVG ──────────────────────────────────────────────────────────────
    function generateFaceSVG(player, cx, cy, size, shirtOverride) {
        const skinMap={light:'#FDDBB4',medium_light:'#E8B88A',medium:'#C68642',medium_dark:'#8D5524',dark:'#3B1A08'};
        const skin   = skinMap[player.skin_color]||player.skin_color||'#C68642';
        const hc     = player.hair_color||'#1a1a1a';
        const eye    = player.eye_color||'#5C3317';
        const gender = player.gender||'male';
        const defShirt = gender==='female'?'#c0397a':'#1565c0';
        const skinShirt = shirtOverride||defShirt;
        const hexToRgb=h=>{h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];};
        const shade=(h,d)=>{const[r,g,b]=hexToRgb(h||'#C68642');return'#'+[r+d,g+d,b+d].map(v=>'0'+Math.max(0,Math.min(255,v)).toString(16)).map(s=>s.slice(-2)).join('');};
        const skinDark=shade(skin,-35), skinMid=shade(skin,-14), skinHi=shade(skin,20);
        const shirtDark=shade(skinShirt,-32);
        const s=size||220, ox=cx-s/2, oy=cy-s/2, cxL=s/2;
        const headCY=s*.37, headRX=s*.235, headRY=s*.235;
        const eyeY=s*.35, noseY=s*.455, mouthY=s*.535, chinY=s*.585;
        const rawStyle=player.skin_hair||'short', styleKey=rawStyle.split('_')[0];
        const hairSVG=_buildCardHair(styleKey,styleKey==='bald'?null:hc,s);
        const uid=Math.floor(Math.random()*99000+1000);
        return `<g transform="translate(${ox.toFixed(1)},${oy.toFixed(1)})">
<defs>
  <clipPath id="hc${uid}"><rect x="${(cxL-s*.40).toFixed(1)}" y="0" width="${(s*.80).toFixed(1)}" height="${(headCY+headRY*.40).toFixed(1)}"/></clipPath>
  <linearGradient id="sg${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="${skinShirt}"/><stop offset="100%" stop-color="${shirtDark}"/>
  </linearGradient>
  <radialGradient id="hg${uid}" cx="40%" cy="35%" r="60%">
    <stop offset="0%" stop-color="${skinHi}"/><stop offset="65%" stop-color="${skin}"/><stop offset="100%" stop-color="${skinDark}"/>
  </radialGradient>
</defs>
<path d="M${(s*.02).toFixed(1)} ${s} L${(s*.04).toFixed(1)} ${(s*.76).toFixed(1)} Q${cxL} ${(s*.64).toFixed(1)} ${(s*.96).toFixed(1)} ${(s*.76).toFixed(1)} L${(s*.98).toFixed(1)} ${s}Z" fill="url(#sg${uid})"/>
<path d="M${(s*.43).toFixed(1)} ${chinY.toFixed(1)} L${(s*.41).toFixed(1)} ${(s*.72).toFixed(1)} Q${cxL} ${(s*.70).toFixed(1)} ${(s*.59).toFixed(1)} ${(s*.72).toFixed(1)} L${(s*.57).toFixed(1)} ${chinY.toFixed(1)}Z" fill="${skinMid}"/>
<ellipse cx="${cxL}" cy="${headCY.toFixed(1)}" rx="${headRX.toFixed(1)}" ry="${headRY.toFixed(1)}" fill="url(#hg${uid})"/>
<ellipse cx="${(s*.74).toFixed(1)}" cy="${(headCY+s*.02).toFixed(1)}" rx="${(s*.065).toFixed(1)}" ry="${(headRY*.72).toFixed(1)}" fill="${skinDark}" opacity="0.11"/>
<g clip-path="url(#hc${uid})">${hairSVG}</g>
<path d="M${(s*.345).toFixed(1)} ${(s*.308).toFixed(1)} Q${(s*.408).toFixed(1)} ${(s*.276).toFixed(1)} ${(s*.468).toFixed(1)} ${(s*.308).toFixed(1)}" stroke="${shade(hc||'#333',-8)}" stroke-width="${(s*.019).toFixed(1)}" fill="none" stroke-linecap="round"/>
<path d="M${(s*.532).toFixed(1)} ${(s*.308).toFixed(1)} Q${(s*.592).toFixed(1)} ${(s*.276).toFixed(1)} ${(s*.655).toFixed(1)} ${(s*.308).toFixed(1)}" stroke="${shade(hc||'#333',-8)}" stroke-width="${(s*.019).toFixed(1)}" fill="none" stroke-linecap="round"/>
<ellipse cx="${(s*.396).toFixed(1)}" cy="${eyeY.toFixed(1)}" rx="${(s*.057).toFixed(1)}" ry="${(s*.055).toFixed(1)}" fill="white"/>
<ellipse cx="${(s*.604).toFixed(1)}" cy="${eyeY.toFixed(1)}" rx="${(s*.057).toFixed(1)}" ry="${(s*.055).toFixed(1)}" fill="white"/>
<circle cx="${(s*.396).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${(s*.032).toFixed(1)}" fill="${eye}"/>
<circle cx="${(s*.604).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${(s*.032).toFixed(1)}" fill="${eye}"/>
<circle cx="${(s*.396).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${(s*.016).toFixed(1)}" fill="#0a0a0a"/>
<circle cx="${(s*.604).toFixed(1)}" cy="${eyeY.toFixed(1)}" r="${(s*.016).toFixed(1)}" fill="#0a0a0a"/>
<circle cx="${(s*.408).toFixed(1)}" cy="${(eyeY-s*.013).toFixed(1)}" r="${(s*.0075).toFixed(1)}" fill="white" opacity="0.92"/>
<circle cx="${(s*.616).toFixed(1)}" cy="${(eyeY-s*.013).toFixed(1)}" r="${(s*.0075).toFixed(1)}" fill="white" opacity="0.92"/>
<circle cx="${(s*.387).toFixed(1)}" cy="${(eyeY+s*.007).toFixed(1)}" r="${(s*.004).toFixed(1)}" fill="white" opacity="0.42"/>
<circle cx="${(s*.595).toFixed(1)}" cy="${(eyeY+s*.007).toFixed(1)}" r="${(s*.004).toFixed(1)}" fill="white" opacity="0.42"/>
<path d="M${(s*.478).toFixed(1)} ${(noseY-s*.043).toFixed(1)} Q${cxL} ${noseY.toFixed(1)} ${(s*.522).toFixed(1)} ${(noseY-s*.043).toFixed(1)}" stroke="${skinDark}" stroke-width="${(s*.011).toFixed(1)}" fill="none" stroke-linecap="round"/>
<path d="M${(s*.457).toFixed(1)} ${noseY.toFixed(1)} Q${cxL} ${(noseY+s*.015).toFixed(1)} ${(s*.543).toFixed(1)} ${noseY.toFixed(1)}" stroke="${skinDark}" stroke-width="${(s*.010).toFixed(1)}" fill="none" stroke-linecap="round"/>
<path d="M${(s*.416).toFixed(1)} ${mouthY.toFixed(1)} Q${(s*.48).toFixed(1)} ${(mouthY+s*.025).toFixed(1)} ${cxL} ${(mouthY+s*.031).toFixed(1)} Q${(s*.52).toFixed(1)} ${(mouthY+s*.025).toFixed(1)} ${(s*.584).toFixed(1)} ${mouthY.toFixed(1)}" stroke="#b86860" stroke-width="${(s*.013).toFixed(1)}" fill="none" stroke-linecap="round"/>
<ellipse cx="${cxL}" cy="${(chinY-s*.008).toFixed(1)}" rx="${(s*.055).toFixed(1)}" ry="${(s*.022).toFixed(1)}" fill="${skinHi}" opacity="0.18"/>
</g>`;
    }

    // ── Marble veins ──────────────────────────────────────────────────────────
    function _marbleVeins(W, H, col, col2) {
        return[
            `<path d="M${W*.10} 0 Q${W*.17} ${H*.14} ${W*.13} ${H*.30} Q${W*.19} ${H*.46} ${W*.26} ${H*.58}" stroke="${col}" stroke-width="1.5" fill="none" opacity="0.32"/>`,
            `<path d="M${W*.50} 0 Q${W*.58} ${H*.09} ${W*.53} ${H*.21} Q${W*.48} ${H*.37} ${W*.56} ${H*.50} Q${W*.61} ${H*.64} ${W*.52} ${H*.80}" stroke="${col}" stroke-width="1.1" fill="none" opacity="0.26"/>`,
            `<path d="M${W*.80} ${H*.06} Q${W*.70} ${H*.18} ${W*.74} ${H*.40} Q${W*.77} ${H*.53} ${W*.71} ${H*.66}" stroke="${col2}" stroke-width="0.9" fill="none" opacity="0.22"/>`,
            `<path d="M0 ${H*.40} Q${W*.09} ${H*.48} ${W*.06} ${H*.62} Q${W*.11} ${H*.74} ${W*.07} ${H}" stroke="${col}" stroke-width="0.9" fill="none" opacity="0.20"/>`,
            `<path d="M${W*.30} ${H*.03} Q${W*.36} ${H*.15} ${W*.28} ${H*.27}" stroke="${col2}" stroke-width="1.7" fill="none" opacity="0.40"/>`,
            `<path d="M${W*.64} ${H*.26} Q${W*.71} ${H*.34} ${W*.61} ${H*.44}" stroke="${col2}" stroke-width="2.0" fill="none" opacity="0.44"/>`,
            `<path d="M${W*.43} ${H*.01} Q${W*.47} ${H*.11} ${W*.41} ${H*.19}" stroke="${col}" stroke-width="0.7" fill="none" opacity="0.16"/>`,
            `<path d="M${W*.87} ${H*.33} Q${W*.92} ${H*.48} ${W*.89} ${H*.62}" stroke="${col2}" stroke-width="0.7" fill="none" opacity="0.14"/>`,
            `<path d="M${W*.18} ${H*.22} Q${W*.22} ${H*.30} ${W*.16} ${H*.40}" stroke="${col}" stroke-width="0.5" fill="none" opacity="0.12"/>`,
        ].join('');
    }

    // ── Shatter (OVR ≥ 90) ───────────────────────────────────────────────────
    function _goldShatter(W, H, col, col2) {
        const cx=W*0.27, cy=H*0.46;
        const lines=[
            [`M${cx} ${cy} L${cx+W*.42} ${cy-H*.17}`, 1.9,0.50],
            [`M${cx} ${cy} L${cx+W*.37} ${cy-H*.28}`, 1.6,0.43],
            [`M${cx} ${cy} L${cx+W*.16} ${cy-H*.34}`, 1.4,0.38],
            [`M${cx} ${cy} L${cx+W*.50} ${cy-H*.05}`, 1.2,0.34],
            [`M${cx+W*.12} ${cy-H*.08} L${cx+W*.21} ${cy-H*.18}`, 0.85,0.26],
            [`M${cx+W*.25} ${cy-H*.12} L${cx+W*.36} ${cy-H*.20}`, 0.80,0.23],
            [`M${cx} ${cy} L${cx-W*.10} ${cy-H*.11}`, 0.85,0.26],
            [`M${cx} ${cy} L${cx+W*.06} ${cy+H*.08}`, 0.75,0.20],
        ];
        return lines.map(([d,w,op],i)=>
            `<path d="${d}" stroke="${i%2===0?col:col2}" stroke-width="${w}" fill="none" opacity="${op}" stroke-linecap="round"/>`
        ).join('')+
        `<circle cx="${cx}" cy="${cy}" r="${W*.046}" fill="${col}" opacity="0.09" filter="url(#burstGlow)"/>
<circle cx="${cx}" cy="${cy}" r="${W*.017}" fill="${col2}" opacity="0.40"/>` +
        [0,1,2,3,4,5].map(i=>{const a=(i/6)*Math.PI*2,r=W*(0.052+(i%3)*0.032);return`<circle cx="${(cx+Math.cos(a)*r).toFixed(1)}" cy="${(cy+Math.sin(a)*r*.60).toFixed(1)}" r="${(0.85+i*.14).toFixed(1)}" fill="${i%2===0?col:col2}" opacity="${(0.20+i*.04).toFixed(2)}"/>`;}).join('');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function _sparkle(x,y,r,col,opacity){
        const r2=r*.38,pts=Array.from({length:8},(_,i)=>{const a=(i/8)*Math.PI*2-Math.PI/2,len=i%2===0?r:r2;return`${(x+Math.cos(a)*len).toFixed(2)},${(y+Math.sin(a)*len).toFixed(2)}`;});
        return`<polygon points="${pts.join(' ')}" fill="${col}" opacity="${opacity||.80}"/>`;
    }
    function _diamond(x,y,size,col,opacity){return`<polygon points="${x},${y-size} ${x+size},${y} ${x},${y+size} ${x-size},${y}" fill="${col}" opacity="${opacity||.92}"/>`;}
    function _trophySVG(x,y,size,col){const s=size;return`<path d="M${x-s*.46} ${y-s*.72} Q${x-s*.50} ${y-s*.22} ${x-s*.26} ${y} Q${x} ${y+s*.22} ${x+s*.26} ${y} Q${x+s*.50} ${y-s*.22} ${x+s*.46} ${y-s*.72} Z" fill="${col}" opacity="0.90"/><path d="M${x-s*.46} ${y-s*.72} Q${x-s*.64} ${y-s*.58} ${x-s*.60} ${y-s*.36} Q${x-s*.56} ${y-s*.18} ${x-s*.36} ${y-s*.16}" fill="none" stroke="${col}" stroke-width="${s*.09}" opacity="0.78" stroke-linecap="round"/><path d="M${x+s*.46} ${y-s*.72} Q${x+s*.64} ${y-s*.58} ${x+s*.60} ${y-s*.36} Q${x+s*.56} ${y-s*.18} ${x+s*.36} ${y-s*.16}" fill="none" stroke="${col}" stroke-width="${s*.09}" opacity="0.78" stroke-linecap="round"/><rect x="${x-s*.11}" y="${y}" width="${s*.22}" height="${s*.28}" rx="${s*.04}" fill="${col}" opacity="0.80"/><rect x="${x-s*.30}" y="${y+s*.28}" width="${s*.60}" height="${s*.15}" rx="${s*.06}" fill="${col}" opacity="0.83"/>`;
    }
    function _posAbbr(raw){const m={'portiere':'POR','difensore':'DIF','centrocampista':'CEN','attaccante':'ATT','ala':'ALA','trequartista':'TRE','terzino':'TER','mediano':'MED','libero':'LIB','goalkeeper':'GK','defender':'DEF','midfielder':'MID','forward':'FW','striker':'ST','winger':'WG'};if(!raw)return'ATT';return m[raw.toLowerCase()]||raw.slice(0,3).toUpperCase();}
    function _trunc(str,n){return str&&str.length>n?str.slice(0,n-1)+'…':(str||'');}

    // =========================================================================
    // MAIN GENERATE
    // =========================================================================
    function generate(player, options) {
        options = options || {};
        const W=340, H=520;
        const ovr  = parseInt(player.overall||65);
        const lang = (typeof localStorage!=='undefined'&&localStorage.getItem('gs_lang'))||'it';
        const pal  = _marblePalette(ovr, player.palloni_doro);
        const isLight = (ovr>=80&&ovr<90)||(ovr>=60&&ovr<70);
        const hasPhoto = !!player.ai_avatar;

        // ── Stat labels ───────────────────────────────────────────────────────
        const SL_MAP={it:{tiro:'TIR',velocita:'VEL',dribbling:'DRI',fisico:'FIS',mentalita:'MEN',ovr:'OVR'},en:{tiro:'SHO',velocita:'SPD',dribbling:'DRI',fisico:'PHY',mentalita:'MEN',ovr:'OVR'},de:{tiro:'SCH',velocita:'GES',dribbling:'DRI',fisico:'PHY',mentalita:'MEN',ovr:'OVR'},es:{tiro:'DIS',velocita:'VEL',dribbling:'REG',fisico:'FIS',mentalita:'MEN',ovr:'OVR'}};
        const SL=SL_MAP[lang]||SL_MAP.it;
        const stats=[
            {l:SL.tiro,     v:Math.min(99,parseInt(player.tiro||60))},
            {l:SL.velocita, v:Math.min(99,parseInt(player.velocita||60))},
            {l:SL.dribbling,v:Math.min(99,parseInt(player.dribbling||60))},
            {l:SL.fisico,   v:Math.min(99,parseInt(player.fisico||60))},
            {l:SL.mentalita,v:Math.min(99,parseInt(player.mentalita||60))},
            {l:SL.ovr,      v:Math.min(125,ovr)},
        ];

        // ── Card shape ────────────────────────────────────────────────────────
        const CX=28, CY=22;
        const oct  = `M${CX},0 H${W-CX} L${W},${CY} V${H-CY} L${W-CX},${H} H${CX} L0,${H-CY} V${CY} Z`;
        const oct1 = `M${CX+5},5 H${W-CX-5} L${W-5},${CY+5} V${H-CY-5} L${W-CX-5},${H-5} H${CX+5} L5,${H-CY-5} V${CY+5} Z`;
        const oct2 = `M${CX+9},9 H${W-CX-9} L${W-9},${CY+9} V${H-CY-9} L${W-CX-9},${H-9} H${CX+9} L9,${H-CY-9} V${CY+9} Z`;

        // ── Player info ───────────────────────────────────────────────────────
        const playerName = _trunc((player.player_name||'?').toUpperCase(),16);
        const soprannome = player.soprannome?`"${player.soprannome.toUpperCase()}"`:''
        const clubName   = _trunc((player.team_nome||'').toUpperCase(),18);
        const nation     = _trunc((player.nationality||'ITALIA').replace(/_/g,' ').toUpperCase(),14);
        const season     = player.stagione?String(player.stagione):'';
        const pos        = _posAbbr(player.position||player.ruolo);
        const pdCount    = parseInt(player.palloni_doro||0);

        const numCol = pal.numCol;
        const lblCol = isLight?'rgba(45,28,0,0.90)':'rgba(255,255,255,0.75)';
        const nameCol= pal.textCol;
        const dimCol = pal.dimCol;

        // ── Layout constants ──────────────────────────────────────────────────
        const STRIP_TOP=432, DIVIDER_Y=376, NAME_Y=404, SUB_Y=420, COL_W=W/6;

        // ── Avatar section ────────────────────────────────────────────────────
        const shirtCol = pal.shirtA;
        const FACE_SIZE=268, FACE_CX=170, FACE_CY=198;

        // Photo mode: full-bleed slice; SVG mode: generated face
        const avatarSection = hasPhoto
            ? `<image href="${player.ai_avatar}" x="0" y="0" width="${W}" height="400"
                 clip-path="url(#cardClip)" preserveAspectRatio="xMidYMin slice"/>`
            : generateFaceSVG(player, FACE_CX, FACE_CY, FACE_SIZE, shirtCol);

        // ── Effects ───────────────────────────────────────────────────────────
        const veins   = _marbleVeins(W, H, pal.vein, pal.vein2);
        const shatter = ovr>=90&&!hasPhoto ? _goldShatter(W,H,pal.vein,pal.vein2) : '';
        // For photo cards shatter is lighter and always shown for high ovr
        const shatterPhoto = ovr>=90&&hasPhoto ? _goldShatter(W,H,pal.vein,pal.vein2) : '';

        // Diagonal shimmer
        const shimmer=`
  <line x1="${-W*.22}" y1="0" x2="${W*.74}" y2="${H}" stroke="${pal.border}" stroke-width="56" opacity="0.035" stroke-linecap="butt"/>
  <line x1="${W*.28}" y1="0" x2="${W*1.22}" y2="${H}" stroke="${pal.border2}" stroke-width="28" opacity="0.025" stroke-linecap="butt"/>
  <line x1="${W*.58}" y1="0" x2="${W*1.50}" y2="${H}" stroke="${pal.border}" stroke-width="16" opacity="0.018" stroke-linecap="butt"/>`;

        // ── Corner ornaments ──────────────────────────────────────────────────
        const corners=[
            _diamond(CX+5,5,5.5,pal.border),
            _diamond(W-CX-5,5,5.5,pal.border),
            _diamond(W-5,CY+5,5.5,pal.border),
            _diamond(W-5,H-CY-5,5.5,pal.border),
            _diamond(W-CX-5,H-5,5.5,pal.border),
            _diamond(CX+5,H-5,5.5,pal.border),
            _diamond(5,H-CY-5,5.5,pal.border),
            _diamond(5,CY+5,5.5,pal.border),
        ].join('');

        // Small accent circles on each corner diamond
        const cornerDots=[
            [CX+5,5],[W-CX-5,5],[W-5,CY+5],[W-5,H-CY-5],
            [W-CX-5,H-5],[CX+5,H-5],[5,H-CY-5],[5,CY+5],
        ].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2" fill="${pal.border2}" opacity="0.70"/>`).join('');

        // ── Sparkles ──────────────────────────────────────────────────────────
        const sparkles=[
            _sparkle(W-54,DIVIDER_Y-14,4.5,pal.border,.82),
            _sparkle(22,DIVIDER_Y-16,3.4,pal.border2,.68),
            _sparkle(W-28,72,4.0,pal.border,.70),
            _sparkle(20,98,3.0,pal.border2,.56),
            _sparkle(W/2+100,28,3.6,pal.border,.68),
            _sparkle(W/2-84,34,2.6,pal.border2,.50),
            _sparkle(W-16,H/2-24,2.8,pal.border,.38),
            _sparkle(14,H/2+40,2.0,pal.border2,.28),
        ].join('');

        // ── OVR Badge ─────────────────────────────────────────────────────────
        const OVR_X=50, OVR_Y=62;
        // Photo: always dark fill for readability; SVG: adaptive
        const ovrFill   = hasPhoto?'rgba(0,0,0,0.62)':(isLight?'rgba(255,252,240,0.72)':'rgba(0,0,0,0.32)');
        const ovrRingOp = isLight&&!hasPhoto?'0.55':'0.30';
        const ovrBadge=`
  <circle cx="${OVR_X}" cy="${OVR_Y}" r="46" fill="rgba(${pal.glowRgb},${hasPhoto?'0.20':isLight?'0.12':'0.08'})" filter="url(#burstGlow)"/>
  <circle cx="${OVR_X}" cy="${OVR_Y}" r="38" fill="none" stroke="${pal.border}" stroke-width="1.8" opacity="${ovrRingOp}" stroke-dasharray="5.5 3.5"/>
  <circle cx="${OVR_X}" cy="${OVR_Y}" r="32" fill="${ovrFill}"/>
  <circle cx="${OVR_X}" cy="${OVR_Y}" r="32" fill="none" stroke="${pal.border}" stroke-width="1.6" opacity="${isLight&&!hasPhoto?'0.92':'0.78'}"/>
  <circle cx="${OVR_X}" cy="${OVR_Y}" r="29" fill="none" stroke="${pal.border2}" stroke-width="0.7" opacity="${isLight&&!hasPhoto?'0.68':'0.54'}"/>
  <text x="${OVR_X}" y="${OVR_Y+13}" font-family="'Impact','Arial Black',sans-serif"
        font-size="36" font-weight="900" fill="${numCol}" text-anchor="middle"
        filter="url(#numGlow)">${ovr}</text>
  <text x="${OVR_X}" y="${OVR_Y+27}" font-family="'Arial Narrow',system-ui,sans-serif"
        font-size="6.5" font-weight="900" fill="${dimCol}" text-anchor="middle" letter-spacing="2.5">OVR</text>`;

        // ── Quality stars ─────────────────────────────────────────────────────
        const starCount=ovr>=115?5:ovr>=100?4:ovr>=90?3:ovr>=80?2:ovr>=70?1:0;
        const starsY=OVR_Y+44;
        let starsRow='';
        const starSpacing=12, starsStartX=OVR_X-((starCount-1)*starSpacing)/2;
        for(let i=0;i<starCount;i++) starsRow+=_sparkle(starsStartX+i*starSpacing,starsY,5.0,pal.border,.90);

        // ── Trophies ──────────────────────────────────────────────────────────
        let pdBadge='';
        if(pdCount>0){
            const show=Math.min(pdCount,5), spacing=22, totalW=(show-1)*spacing;
            const startX=OVR_X-totalW/2, trophyY=starsY+28;
            for(let i=0;i<show;i++) pdBadge+=_trophySVG(startX+i*spacing,trophyY,9,pal.border);
            if(pdCount>5) pdBadge+=`<text x="${startX+show*spacing+4}" y="${trophyY+4}" font-family="'Arial Narrow',system-ui,sans-serif" font-size="7.5" font-weight="900" fill="${numCol}">+${pdCount-5}</text>`;
        }

        // ── Position badge ────────────────────────────────────────────────────
        // Photo mode: add shadow backdrop for readability
        const posBadgeBg = hasPhoto?`<rect x="${W-70}" y="7" width="42" height="23" rx="7" fill="rgba(0,0,0,0.45)" filter="url(#textShadow)"/>`:'';
        const posBadge=posBadgeBg+`
  <rect x="${W-70}" y="8" width="40" height="21" rx="7" fill="rgba(${pal.glowRgb},${hasPhoto?'0.28':'0.18'})"/>
  <rect x="${W-70}" y="8" width="40" height="21" rx="7" fill="none" stroke="${pal.border}" stroke-width="1.2" opacity="0.75"/>
  <text x="${W-50}" y="23" font-family="'Arial Narrow',system-ui,sans-serif"
        font-size="10" font-weight="900" fill="${pal.border}" text-anchor="middle" letter-spacing="1.2">${pos}</text>`;

        // ── Nation top ────────────────────────────────────────────────────────
        const nationTop=`
  <text x="${W/2}" y="20" font-family="'Arial Narrow',system-ui,sans-serif"
        font-size="7.5" font-weight="700" fill="${dimCol}" text-anchor="middle"
        letter-spacing="2.0" opacity="${hasPhoto?'0.95':'0.85'}"
        filter="${hasPhoto?'url(#textShadow)':''}">${nation}</text>
  <line x1="28" y1="27" x2="${W-28}" y2="27" stroke="${pal.border}" stroke-width="0.6" opacity="${isLight&&!hasPhoto?'0.28':'0.20'}"/>`;

        // ── Ornamental divider ────────────────────────────────────────────────
        const divider=`
  <line x1="26" y1="${DIVIDER_Y}" x2="${W/2-24}" y2="${DIVIDER_Y}" stroke="${pal.border}" stroke-width="0.9" opacity="0.70"/>
  <line x1="${W/2+24}" y1="${DIVIDER_Y}" x2="${W-26}" y2="${DIVIDER_Y}" stroke="${pal.border}" stroke-width="0.9" opacity="0.70"/>
  ${_diamond(W/2,DIVIDER_Y,5.5,pal.border,.96)}
  ${_sparkle(W/2-42,DIVIDER_Y,3.0,pal.border2,.62)}
  ${_sparkle(W/2+42,DIVIDER_Y,3.0,pal.border2,.62)}`;

        // ── Name wings ────────────────────────────────────────────────────────
        // Thin accent lines flanking the player name
        const nameHalfW = Math.min(playerName.length * (nameFontSizeCalc(playerName) * 0.29), W/2-24);
        function nameFontSizeCalc(n){return n.length>12?24:n.length>9?27:31;}
        const nameFontSize = nameFontSizeCalc(playerName);
        const wingY = NAME_Y - 14;
        const nameWings=`
  <line x1="18" y1="${wingY}" x2="${(W/2-nameHalfW-8).toFixed(1)}" y2="${wingY}" stroke="${pal.border}" stroke-width="0.8" opacity="0.55"/>
  <circle cx="18" cy="${wingY}" r="1.8" fill="${pal.border}" opacity="0.60"/>
  <circle cx="${(W/2-nameHalfW-8).toFixed(1)}" cy="${wingY}" r="1.8" fill="${pal.border2}" opacity="0.55"/>
  <line x1="${(W/2+nameHalfW+8).toFixed(1)}" y1="${wingY}" x2="${W-18}" y2="${wingY}" stroke="${pal.border}" stroke-width="0.8" opacity="0.55"/>
  <circle cx="${(W/2+nameHalfW+8).toFixed(1)}" cy="${wingY}" r="1.8" fill="${pal.border2}" opacity="0.55"/>
  <circle cx="${W-18}" cy="${wingY}" r="1.8" fill="${pal.border}" opacity="0.60"/>`;

        // ── Name block ────────────────────────────────────────────────────────
        const nameGlow=`<rect x="20" y="${NAME_Y-34}" width="${W-40}" height="42" rx="8"
    fill="rgba(${pal.glowRgb},0.09)" filter="url(#softGlow)"/>`;
        const nameBlock=nameGlow+
        `<text x="${W/2}" y="${NAME_Y}" font-family="'Impact','Arial Black',sans-serif"
        font-size="${nameFontSize}" font-weight="900" fill="${nameCol}" text-anchor="middle"
        filter="url(#nameShadow)" letter-spacing="2">${playerName}</text>`+
        (soprannome
            ?`<text x="${W/2}" y="${SUB_Y}" font-family="'Georgia',serif" font-size="10.5"
               font-style="italic" fill="${dimCol}" text-anchor="middle" letter-spacing="0.8">${soprannome}</text>`
            :(clubName?`<text x="${W/2}" y="${SUB_Y}" font-family="'Arial Narrow',system-ui,sans-serif"
               font-size="9" font-weight="700" fill="${dimCol}" text-anchor="middle"
               letter-spacing="1.2">${clubName}</text>`:''));

        // ── Tier label ────────────────────────────────────────────────────────
        const tierLabel=`<text x="${W/2}" y="${STRIP_TOP-5}" font-family="'Arial Narrow',system-ui,sans-serif"
        font-size="6" font-weight="700" fill="${dimCol}" text-anchor="middle"
        letter-spacing="4" opacity="0.36">${pal.tier}</text>`;

        // ── Stats strip ───────────────────────────────────────────────────────
        const ovrHighlight=`
  <rect x="${(COL_W*5+3).toFixed(1)}" y="${STRIP_TOP+3}" width="${(COL_W-6).toFixed(1)}" height="${H-STRIP_TOP-8}" rx="4" fill="${pal.border}" opacity="${isLight?'0.12':'0.10'}"/>
  <rect x="${(COL_W*5+3).toFixed(1)}" y="${STRIP_TOP+3}" width="${(COL_W-6).toFixed(1)}" height="${H-STRIP_TOP-8}" rx="4" fill="none" stroke="${pal.border}" stroke-width="0.8" opacity="0.32"/>`;

        const statBlocks=stats.map((st,i)=>{
            const cxS=(COL_W*i+COL_W/2).toFixed(1), isOvr=i===5;
            const col=isOvr?pal.border:numCol;
            const barW=COL_W-14, barX=(COL_W*i+7).toFixed(1);
            const fillW=Math.max(3,barW*Math.min(st.v,99)/99).toFixed(1);
            const numY=STRIP_TOP+24, barY=STRIP_TOP+30, lblY=STRIP_TOP+44;
            const gid=`bg${i}`;
            return`<defs><linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${col}" stop-opacity="0.50"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="1.0"/>
    </linearGradient></defs>
  <text x="${cxS}" y="${numY}" font-family="'Impact','Arial Black',sans-serif"
        font-size="${isOvr?23:20}" font-weight="900" fill="${col}" text-anchor="middle"
        filter="${isOvr?'url(#numGlow)':'url(#textShadow)'}">${st.v}</text>
  <rect x="${barX}" y="${barY}" width="${barW.toFixed(1)}" height="4" rx="2" fill="rgba(${isLight?'0,0,0':'255,255,255'},0.10)"/>
  <rect x="${barX}" y="${barY}" width="${fillW}" height="4" rx="2" fill="url(#${gid})"/>
  <rect x="${barX}" y="${barY}" width="${(Math.min(parseFloat(fillW),barW)*.36).toFixed(1)}" height="2" rx="1" fill="white" opacity="0.26"/>
  <text x="${cxS}" y="${lblY}" font-family="'Arial Narrow',system-ui,sans-serif"
        font-size="7" font-weight="900" fill="${lblCol}" text-anchor="middle" letter-spacing="0.6">${st.l}</text>`;
        }).join('');

        // ── Footer ────────────────────────────────────────────────────────────
        const footer=`
  <line x1="18" y1="${H-14}" x2="${W-18}" y2="${H-14}" stroke="${pal.border}" stroke-width="0.5" opacity="${isLight?'0.28':'0.20'}"/>
  <text x="18" y="${H-5}" font-family="'Arial Narrow',system-ui,sans-serif" font-size="7" font-weight="700" fill="${lblCol}" opacity="0.80">${clubName}</text>
  <text x="${W/2}" y="${H-5}" font-family="'Arial Narrow',system-ui,sans-serif" font-size="6.5" font-weight="500" fill="${lblCol}" text-anchor="middle" opacity="0.50">${season}</text>
  <text x="${W-18}" y="${H-5}" font-family="'Arial Narrow',system-ui,sans-serif" font-size="7" font-weight="700" fill="${lblCol}" text-anchor="end" opacity="0.80">${nation}</text>`;

        // =========================================================================
        // SVG ASSEMBLY
        // =========================================================================
        return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <!-- Card background -->
  <linearGradient id="mbl" x1="8%" y1="0%" x2="92%" y2="100%">
    <stop offset="0%"   stop-color="${pal.marbleC}"/>
    <stop offset="24%"  stop-color="${pal.marbleA}"/>
    <stop offset="60%"  stop-color="${pal.marbleB}"/>
    <stop offset="100%" stop-color="${pal.marbleA}"/>
  </linearGradient>
  <!-- Radial depth -->
  <radialGradient id="depthGrad" cx="50%" cy="40%" r="54%">
    <stop offset="0%"   stop-color="${pal.marbleC}" stop-opacity="0.50"/>
    <stop offset="100%" stop-color="${pal.marbleA}" stop-opacity="0"/>
  </radialGradient>
  <!-- Border -->
  <linearGradient id="brdG" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%"   stop-color="${pal.border2}"/>
    <stop offset="26%"  stop-color="${pal.border}"/>
    <stop offset="56%"  stop-color="${pal.border2}"/>
    <stop offset="100%" stop-color="${pal.border}"/>
  </linearGradient>
  <!-- Stats strip -->
  <linearGradient id="stripGrad" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%"   stop-color="${pal.marbleB}" stop-opacity="0.98"/>
    <stop offset="100%" stop-color="${pal.marbleA}" stop-opacity="1"/>
  </linearGradient>
  <!-- Avatar bottom fade -->
  <linearGradient id="avatarFadeBot" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%"   stop-color="${pal.marbleA}" stop-opacity="0"/>
    <stop offset="${hasPhoto?'42':'48'}%"  stop-color="${pal.marbleA}" stop-opacity="${hasPhoto?'0.55':'0.42'}"/>
    <stop offset="100%" stop-color="${pal.marbleA}" stop-opacity="1"/>
  </linearGradient>
  <!-- Avatar top fade -->
  <linearGradient id="avatarFadeTop" x1="0%" y1="100%" x2="0%" y2="0%">
    <stop offset="0%"   stop-color="${pal.marbleA}" stop-opacity="0"/>
    <stop offset="100%" stop-color="${pal.marbleA}" stop-opacity="${hasPhoto?'0.30':'0.18'}"/>
  </linearGradient>
  <!-- Photo side vignettes (only meaningful for photo cards) -->
  <linearGradient id="leftVig" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%"   stop-color="${pal.marbleA}" stop-opacity="${hasPhoto?'0.60':'0.28'}"/>
    <stop offset="100%" stop-color="${pal.marbleA}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="rightVig" x1="100%" y1="0%" x2="0%" y2="0%">
    <stop offset="0%"   stop-color="${pal.marbleA}" stop-opacity="${hasPhoto?'0.60':'0.28'}"/>
    <stop offset="100%" stop-color="${pal.marbleA}" stop-opacity="0"/>
  </linearGradient>
  <!-- Face spotlight -->
  <radialGradient id="faceSpot" cx="50%" cy="35%" r="46%">
    <stop offset="0%"   stop-color="${pal.glow}" stop-opacity="${hasPhoto?'0.08':isLight?'0.10':'0.15'}"/>
    <stop offset="65%"  stop-color="${pal.glow}" stop-opacity="0.03"/>
    <stop offset="100%" stop-color="${pal.marbleA}" stop-opacity="0"/>
  </radialGradient>
  <!-- Diamond tile pattern -->
  <pattern id="diaPat" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
    <polygon points="12,1 23,12 12,23 1,12" fill="none" stroke="${pal.border}" stroke-width="0.3" opacity="0.18"/>
  </pattern>
  <!-- Clips -->
  <clipPath id="cardClip"><path d="${oct}"/></clipPath>
  <!-- Filters -->
  <filter id="burstGlow" x="-70%" y="-70%" width="240%" height="240%">
    <feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="softGlow" x="-28%" y="-28%" width="156%" height="156%">
    <feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="numGlow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="5.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="textShadow">
    <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="rgba(0,0,0,0.60)"/>
  </filter>
  <filter id="nameShadow">
    <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="rgba(0,0,0,0.65)"/>
  </filter>
  <filter id="grain" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.70" numOctaves="4" stitchTiles="stitch" result="noise"/>
    <feColorMatrix in="noise" type="saturate" values="0" result="gn"/>
    <feBlend in="SourceGraphic" in2="gn" mode="soft-light" result="blend"/>
    <feComposite in="blend" in2="SourceGraphic" operator="in"/>
  </filter>
</defs>

<!-- ── OUTER BORDER ── -->
<path d="${oct}" fill="url(#brdG)"/>
<!-- ── CARD BODY ── -->
<path d="${oct1}" fill="url(#mbl)"/>
<path d="${oct1}" fill="url(#depthGrad)" clip-path="url(#cardClip)"/>
<!-- ── DIAMOND PATTERN texture ── -->
<rect width="${W}" height="${H}" fill="url(#diaPat)" clip-path="url(#cardClip)" opacity="${isLight?'0.20':'0.14'}"/>
<!-- ── MARBLE VEINS ── -->
<g clip-path="url(#cardClip)">${veins}</g>
<!-- ── SHIMMER ── -->
<g clip-path="url(#cardClip)">${shimmer}</g>
<!-- ── AVATAR ── -->
<g clip-path="url(#cardClip)">${avatarSection}</g>
<!-- Photo: theme colour tint -->
${hasPhoto?`<rect x="0" y="0" width="${W}" height="400" fill="${pal.tint}" clip-path="url(#cardClip)"/>`:''}
<!-- ── FACE SPOTLIGHT ── -->
<rect x="5" y="5" width="${W-10}" height="${H*.74}" fill="url(#faceSpot)" clip-path="url(#cardClip)"/>
<!-- ── SIDE VIGNETTES ── -->
<rect x="0" y="0" width="70" height="${H*.78}" fill="url(#leftVig)" clip-path="url(#cardClip)"/>
<rect x="${W-70}" y="0" width="70" height="${H*.78}" fill="url(#rightVig)" clip-path="url(#cardClip)"/>
<!-- ── TOP FADE ── -->
<rect x="5" y="5" width="${W-10}" height="60" fill="url(#avatarFadeTop)" clip-path="url(#cardClip)"/>
<!-- ── BOTTOM FADE ── -->
<rect x="5" y="${H*.41}" width="${W-10}" height="${H*.30}" fill="url(#avatarFadeBot)" clip-path="url(#cardClip)"/>
<!-- ── SHATTER ── -->
<g clip-path="url(#cardClip)" opacity="${hasPhoto?'0.55':'0.78'}">${hasPhoto?shatterPhoto:shatter}</g>
<!-- ── GRAIN ── -->
<path d="${oct1}" filter="url(#grain)" opacity="${isLight?'0.032':'0.048'}" clip-path="url(#cardClip)"/>
<!-- ── OVR BADGE ── -->
<g clip-path="url(#cardClip)">${ovrBadge}</g>
<!-- ── STARS ── -->
<g clip-path="url(#cardClip)">${starsRow}</g>
<!-- ── TROPHIES ── -->
<g clip-path="url(#cardClip)">${pdBadge}</g>
<!-- ── POSITION BADGE ── -->
<g clip-path="url(#cardClip)">${posBadge}</g>
<!-- ── NATION + LINE ── -->
<g clip-path="url(#cardClip)">${nationTop}</g>
<!-- ── TIER LABEL ── -->
<g clip-path="url(#cardClip)">${tierLabel}</g>
<!-- ── DIVIDER ── -->
<g clip-path="url(#cardClip)">${divider}</g>
<!-- ── NAME WINGS ── -->
<g clip-path="url(#cardClip)">${nameWings}</g>
<!-- ── NAME ── -->
<g clip-path="url(#cardClip)">${nameBlock}</g>
<!-- ── STATS STRIP ── -->
<rect x="5" y="${STRIP_TOP}" width="${W-10}" height="${H-STRIP_TOP-5}" fill="url(#stripGrad)" clip-path="url(#cardClip)"/>
<line x1="18" y1="${STRIP_TOP}" x2="${W-18}" y2="${STRIP_TOP}" stroke="${pal.border}" stroke-width="1.1" opacity="0.55" clip-path="url(#cardClip)"/>
${[1,2,3,4,5].map(i=>`<line x1="${(COL_W*i).toFixed(1)}" y1="${STRIP_TOP+7}" x2="${(COL_W*i).toFixed(1)}" y2="${H-15}" stroke="${pal.border}" stroke-width="0.5" opacity="0.18" clip-path="url(#cardClip)"/>`).join('')}
<g clip-path="url(#cardClip)">${ovrHighlight}</g>
<g clip-path="url(#cardClip)">${statBlocks}</g>
<!-- ── FOOTER ── -->
<g clip-path="url(#cardClip)">${footer}</g>
<!-- ── CORNERS + DOTS ── -->
<g clip-path="url(#cardClip)">${corners}${cornerDots}</g>
<!-- ── SPARKLES ── -->
<g clip-path="url(#cardClip)">${sparkles}</g>
<!-- ── INNER FRAMES ── -->
<path d="${oct2}" fill="none" stroke="${pal.border}" stroke-width="0.55" stroke-opacity="0.28" clip-path="url(#cardClip)"/>
<path d="${oct1}" fill="none" stroke="${pal.border2}" stroke-width="0.8" stroke-opacity="0.40" clip-path="url(#cardClip)"/>
<!-- ── OUTER BORDER redraw ── -->
<path d="${oct}" fill="none" stroke="url(#brdG)" stroke-width="6"/>
</svg>`;
    }

    // ── Render ────────────────────────────────────────────────────────────────
    function renderCard(container, player, options) {
        if(!container) return;
        container.innerHTML = generate(player, options);
        const s=container.querySelector('svg');
        if(s) s.style.cssText='width:100%;height:auto;display:block;filter:drop-shadow(0 28px 56px rgba(0,0,0,0.80))';
    }

    // ── Download ──────────────────────────────────────────────────────────────
    function downloadCard(player, options) {
        const svg=generate(player,options);
        const blob=new Blob([svg],{type:'image/svg+xml'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url; a.download=`${(player.player_name||'card').replace(/\s+/g,'_')}_golden_striker.svg`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    // ── Modal ─────────────────────────────────────────────────────────────────
    function showCardModal(player) {
        const prev=document.getElementById('gs-card-modal'); if(prev) prev.remove();
        const lang=(typeof localStorage!=='undefined'&&localStorage.getItem('gs_lang'))||'it';
        const pal=_marblePalette(parseInt(player.overall||65),player.palloni_doro);
        const T={download:{it:'⬇ Scarica SVG',en:'⬇ Download SVG',de:'⬇ SVG speichern',es:'⬇ Descargar SVG'},close:{it:'Chiudi',en:'Close',de:'Schließen',es:'Cerrar'}};
        const modal=document.createElement('div');
        modal.id='gs-card-modal';
        modal.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.92);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px';
        modal.innerHTML=`<div style="max-width:370px;width:100%;display:flex;flex-direction:column;align-items:center;gap:0">
  <div id="gs-card-content" style="border-radius:14px;overflow:hidden;width:100%"></div>
  <div style="display:flex;gap:10px;margin-top:18px;justify-content:center">
    <button onclick="GS_PlayerCard.downloadCard(window._gsCardPlayer)"
      style="background:linear-gradient(135deg,${pal.border},${pal.border2});color:${pal.numCol};border:none;padding:11px 28px;border-radius:11px;cursor:pointer;font-weight:900;font-size:.875rem;letter-spacing:.5px;box-shadow:0 4px 18px rgba(0,0,0,.45);transition:transform .15s,box-shadow .15s"
      onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 26px rgba(0,0,0,.55)'"
      onmouseout="this.style.transform='';this.style.boxShadow='0 4px 18px rgba(0,0,0,.45)'">${T.download[lang]||T.download.it}</button>
    <button onclick="document.getElementById('gs-card-modal').remove()"
      style="background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.18);padding:11px 22px;border-radius:11px;cursor:pointer;font-size:.875rem;transition:background .15s"
      onmouseover="this.style.background='rgba(255,255,255,.14)'"
      onmouseout="this.style.background='rgba(255,255,255,.08)'">${T.close[lang]||T.close.it}</button>
  </div>
</div>`;
        document.body.appendChild(modal);
        window._gsCardPlayer=player;
        renderCard(document.getElementById('gs-card-content'),player);
        modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
        if(window.GS_Particles) GS_Particles.effects.confettiRain();
    }

    return { generate, renderCard, downloadCard, showCardModal, _marblePalette };
})();

window.GS_PlayerCard = GS_PlayerCard;
