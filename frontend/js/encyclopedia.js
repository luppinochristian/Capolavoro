/**
 * ============================================================
 * encyclopedia.js — Enciclopedia del calcio
 * ============================================================
 * Raccolta di dati storici, record e curiosità calcistiche
 * presentati come contenuto educativo nel gioco.
 *
 * SEZIONI:
 *  - WORLD_CUP_RECORDS: record storici dei Mondiali
 *  - TACTICAL_FORMATIONS: storia delle formazioni tattiche
 *  - GOLDEN_BOOT_HISTORY: vincitori della Scarpa d'Oro
 *  - STADIUM_FACTS: curiosità sui principali stadi mondiali
 *  - TRANSFER_RECORDS: trasferimenti record nella storia
 *  - BALLON_DOR_HISTORY: vincitori del Pallone d'Oro reale
 *
 * API pubblica:
 *  - getRandomRecord(): record casuale da una categoria
 *  - searchByKeyword(q): ricerca per parola chiave
 *  - render(containerId): disegna l'enciclopedia completa
 *  - renderCategory(cat): mostra solo una categoria
 *
 * Esposto come oggetto globale GS_Encyclopedia.
 * ============================================================
 */

const GS_Encyclopedia = (() => {

    // ── World Cup Records ─────────────────────────────────────────────────────
    const WORLD_CUP_RECORDS = [
        { record: "Most goals in a single WC edition", holder: "Fontaine (France)", value: "13 goals (1958)" },
        { record: "Most WC titles won", holder: "Brazil", value: "5 titles" },
        { record: "All-time WC top scorer", holder: "Miroslav Klose (Germany)", value: "16 goals" },
        { record: "Youngest WC scorer", holder: "Pelé (Brazil)", value: "17 years, 239 days (1958)" },
        { record: "Fastest WC goal", holder: "Hakan Şükür (Turkey)", value: "11 seconds (2002)" },
        { record: "Most WC appearances", holder: "Lothar Matthäus", value: "25 matches" },
        { record: "Biggest WC winning margin", holder: "Hungary vs El Salvador", value: "10-1 (1982)" },
        { record: "Most WC wins as manager", holder: "Didier Deschamps", value: "2018 World Cup" },
    ];

    // ── Tactical formations history ───────────────────────────────────────────
    const FORMATIONS_HISTORY = {
        "2-3-5": { era: "1880-1920", desc_it: "La piramide originale. Dominava il calcio vittoriano.", desc_en: "The original pyramid. Dominated Victorian football." },
        "WM (3-2-2-3)": { era: "1925-1960", desc_it: "Rivoluzione difensiva di Herbert Chapman. L'Arsenal ne fece il pilastro.", desc_en: "Herbert Chapman's defensive revolution. Arsenal made it their cornerstone." },
        "4-2-4": { era: "1950-1970", desc_it: "Il Brasile di Pelé e Garrincha la rese celebre ai Mondiali 1958.", desc_en: "Brazil's Pelé and Garrincha made it famous at the 1958 World Cup." },
        "4-4-2": { era: "1966-2000", desc_it: "Il modulo più usato della storia. Equilibrio perfetto tra difesa e attacco.", desc_en: "The most used formation in history. Perfect balance between defence and attack." },
        "3-5-2": { era: "1980-oggi", desc_it: "Amata dall'Italia degli anni '80 e da Juventus e Inter.", desc_en: "Loved by Italy in the 1980s and by Juventus and Inter." },
        "4-3-3": { era: "1990-oggi", desc_it: "Il modulo del tiki-taka. Barcellona e Spagna la hanno resa leggendaria.", desc_en: "The tiki-taka formation. Barcelona and Spain made it legendary." },
        "4-2-3-1": { era: "2000-oggi", desc_it: "Il modulo più copiato degli anni 2000. Equilibrio e solidità al centro.", desc_en: "The most copied formation of the 2000s. Balance and solidity in midfield." },
        "4-1-4-1": { era: "2010-oggi", desc_it: "Mediano basso di raccordo e quattro centrocampisti a tutto campo.", desc_en: "Low-lying holding midfielder and four box-to-box midfielders." },
        "3-4-3": { era: "2016-oggi", desc_it: "Antonio Conte la riportò in voga con il Chelsea campione d'Inghilterra.", desc_en: "Antonio Conte brought it back with Chelsea winning the Premier League." },
        "5-3-2": { era: "sempre", desc_it: "Ultra-difensiva. L'onnipresente erede del catenaccio italiano.", desc_en: "Ultra-defensive. The ever-present heir to Italian catenaccio." },
    };

    // ── Football positions guide ──────────────────────────────────────────────
    const POSITIONS = {
        it: {
            "Portiere (P)": "L'ultimo baluardo. Deve organizzare la difesa, uscire sulle palle alte e parare tutto.",
            "Terzino (T)": "Difensore laterale. Nel calcio moderno deve anche spingere e crossare.",
            "Centrale (DC)": "Cuore della difesa. Presenza fisica, leadership, lettura del gioco.",
            "Mediano (M)": "Polmone della squadra. Corre per tutti, recupera, distribuisce.",
            "Trequartista (T)": "Giocatore di fantasia. Collega centrocampo e attacco con visione e tecnica.",
            "Ala (A)": "Velocità, dribbling, cross. Mette paura alle difese avversarie.",
            "Prima Punta (CF)": "Il finalizzatore. Il suo compito: segnare e segnare ancora.",
            "Seconda Punta (SP)": "Lavoro sporco, sponde, smarcamenti. L'assist-man dell'attacco.",
        },
        en: {
            "Goalkeeper (GK)": "The last line of defence. Must organize the backline, claim crosses and stop everything.",
            "Full-back (FB)": "Wide defender. In modern football must also push forward and deliver crosses.",
            "Centre-back (CB)": "Heart of defence. Physical presence, leadership, game reading.",
            "Defensive Midfielder (DM)": "Team's engine. Runs for everyone, wins it back, distributes.",
            "Attacking Midfielder (AM)": "Creative spark. Links midfield and attack with vision and technique.",
            "Winger (W)": "Speed, dribbling, crossing. Makes opposing defenders' lives a nightmare.",
            "Striker (ST)": "The finisher. His job: score and keep scoring.",
            "Second Striker (SS)": "Dirty work, hold-up play, link play. The attack's assist man.",
        }
    };

    // ── Famous football quotes ─────────────────────────────────────────────────
    const FAMOUS_QUOTES = [
        { quote: "Il calcio è la cosa più importante tra le cose non importanti.", author: "Johan Cruyff", lang: "it" },
        { quote: "Football is the most important of the unimportant things in life.", author: "Johan Cruyff", lang: "en" },
        { quote: "Non si perde mai. O si vince o si impara.", author: "Nelson Mandela", lang: "it" },
        { quote: "You never lose. Either you win or you learn.", author: "Nelson Mandela", lang: "en" },
        { quote: "Il calcio è semplice, ma giocare semplice è la cosa più difficile.", author: "Johan Cruyff", lang: "it" },
        { quote: "Football is simple, but playing simple football is the hardest thing.", author: "Johan Cruyff", lang: "en" },
        { quote: "Alcuni pensano che il calcio sia una questione di vita o di morte. Si sbagliano: è molto più importante.", author: "Bill Shankly", lang: "it" },
        { quote: "Some people believe football is a matter of life and death. They are wrong. It's much more than that.", author: "Bill Shankly", lang: "en" },
        { quote: "Il migliore è colui che rende migliori gli altri.", author: "Sócrates", lang: "it" },
        { quote: "The best is the one who makes others better.", author: "Sócrates", lang: "en" },
        { quote: "Non ho paura di fallire. Ho paura di non provare.", author: "Michael Jordan", lang: "it" },
        { quote: "I'm not afraid to fail. I'm afraid not to try.", author: "Michael Jordan", lang: "en" },
        { quote: "La gloria è effimera, ma l'oscurità è eterna.", author: "Paul Pierce", lang: "it" },
        { quote: "The glory is fleeting, but the obscurity is forever.", author: "Paul Pierce", lang: "en" },
        { quote: "Per essere il migliore, devi battere il migliore.", author: "Anonimo", lang: "it" },
        { quote: "To be the best, you must beat the best.", author: "Anonymous", lang: "en" },
        { quote: "Un gol non conta più di un altro. Tutti i gol valgono uno.", author: "Romário", lang: "it" },
        { quote: "A goal is never worth more than one. All goals count the same.", author: "Romário", lang: "en" },
        { quote: "Nessuno è più grande della squadra.", author: "Phil Jackson", lang: "it" },
        { quote: "No one is bigger than the team.", author: "Phil Jackson", lang: "en" },
        { quote: "Il talento vince partite, il lavoro di squadra vince campionati.", author: "Michael Jordan", lang: "it" },
        { quote: "Talent wins games, but teamwork wins championships.", author: "Michael Jordan", lang: "en" },
        { quote: "La preparazione è tutto. Non esistono miracoli.", author: "Marcelo Lippi", lang: "it" },
        { quote: "Preparation is everything. There are no miracles.", author: "Marcelo Lippi", lang: "en" },
        { quote: "L'attitudine è una piccola cosa che fa una grande differenza.", author: "Winston Churchill", lang: "it" },
        { quote: "Attitude is a small thing that makes a big difference.", author: "Winston Churchill", lang: "en" },
        { quote: "I campioni non smettono di allenare finché non riescono. Si allenano finché non sbagliano mai.", author: "Anonimo", lang: "it" },
        { quote: "Champions don't stop until they succeed. They train until they can't get it wrong.", author: "Anonymous", lang: "en" },
        { quote: "La differenza tra possibile e impossibile è la mentalità.", author: "Tommy Lasorda", lang: "it" },
        { quote: "The difference between possible and impossible is mindset.", author: "Tommy Lasorda", lang: "en" },
    ];

    // ── Pallone d'Oro winners history (fictional equivalent) ─────────────────
    const PALLONE_ORO_HISTORY = [
        { anno: 1, winner: "Lorenzo Mancini", club: "Internazionale FC", gol: 38, assists: 14, ovr: 94 },
        { anno: 2, winner: "Rodrigo Santos", club: "Real Madridal FC", gol: 45, assists: 11, ovr: 96 },
        { anno: 3, winner: "Andreas Mueller", club: "FC Bayernia München", gol: 41, assists: 17, ovr: 95 },
        { anno: 4, winner: "Fabien Laurent", club: "Paris St. Germaine", gol: 52, assists: 13, ovr: 97 },
        { anno: 5, winner: "Carlos Mendoza", club: "FC Barceloma", gol: 48, assists: 22, ovr: 98 },
    ];

    // ── Training science tips ─────────────────────────────────────────────────
    const TRAINING_TIPS = {
        it: [
            "💡 Dormire 8-9 ore per notte aumenta il recupero muscolare del 40%.",
            "💡 L'allenamento a digiuno brucia più grassi ma riduce le performance di picco.",
            "💡 10-15 minuti di meditazione pre-gara migliorano la concentrazione in campo.",
            "💡 L'idratazione ottimale è 500ml d'acqua 2 ore prima dell'allenamento.",
            "💡 La musica ad alto BPM (120-140) aumenta la resistenza durante gli sprint.",
            "💡 I muscoli crescono durante il riposo, non durante l'allenamento.",
            "💡 La visualizzazione mentale del gol attiva gli stessi neuroni del tiro reale.",
            "💡 Il cold bath post-partita riduce l'infiammazione muscolare del 30%.",
            "💡 Camminare a piedi nudi rafforza i muscoli intrinseci del piede.",
            "💡 Il caffè pre-allenamento migliora le performance del 3-5%.",
        ],
        en: [
            "💡 Sleeping 8-9 hours per night increases muscle recovery by 40%.",
            "💡 Fasted training burns more fat but reduces peak performance.",
            "💡 10-15 minutes of pre-match meditation improves focus on the pitch.",
            "💡 Optimal hydration is 500ml of water 2 hours before training.",
            "💡 High-BPM music (120-140) increases endurance during sprints.",
            "💡 Muscles grow during rest, not during training itself.",
            "💡 Mentally visualising a goal activates the same neurons as the real shot.",
            "💡 Post-match ice baths reduce muscle inflammation by 30%.",
            "💡 Walking barefoot strengthens the intrinsic foot muscles.",
            "💡 Pre-training caffeine improves performance by 3-5%.",
        ]
    };

    // ── Transfer market glossary ──────────────────────────────────────────────
    const TRANSFER_GLOSSARY = {
        it: {
            "Clausola rescissoria": "Somma fissa per cui un club può ingaggiare un calciatore senza negoziare.",
            "Prestito": "Il giocatore va in un altro club temporaneamente ma resta di proprietà del club cedente.",
            "Opzione di riscatto": "Diritto del club in prestito di acquistare definitivamente il giocatore a fine stagione.",
            "Ingaggio": "Lo stipendio mensile o annuale del calciatore.",
            "Procuratore": "L'agente che negozia contratti e trasferimenti per conto del giocatore.",
            "Bonus firma": "Pagamento una tantum al giocatore al momento della firma del contratto.",
            "Bonus obiettivi": "Pagamento aggiuntivo al raggiungimento di traguardi sportivi.",
            "Accordo pre-contrattuale": "Accordo firmato prima che il contratto attuale scada, con effetto dal 1 luglio.",
        },
        en: {
            "Release clause": "Fixed sum for which a club can sign a player without negotiating.",
            "Loan": "The player moves to another club temporarily but remains owned by the parent club.",
            "Buy option": "The loan club's right to permanently sign the player at the end of the season.",
            "Salary/Wages": "The player's monthly or annual pay.",
            "Agent": "The representative who negotiates contracts and transfers on behalf of the player.",
            "Signing bonus": "One-time payment to the player upon signing the contract.",
            "Performance bonus": "Additional payment for hitting sporting milestones.",
            "Pre-contract agreement": "Agreement signed before the current contract expires, effective from 1 July.",
        }
    };

    // ── Utility functions ──────────────────────────────────────────────────────
    function getRandomQuote(lang = 'it') {
        const filtered = FAMOUS_QUOTES.filter(q => q.lang === lang || q.lang === 'both');
        if (!filtered.length) return FAMOUS_QUOTES[0];
        return filtered[Math.floor(Math.random() * filtered.length)];
    }

    function getRandomTrainingTip(lang = 'it') {
        const pool = TRAINING_TIPS[lang] || TRAINING_TIPS.it;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function getFormationInfo(formation, lang = 'it') {
        const info = FORMATIONS_HISTORY[formation];
        if (!info) return null;
        return {
            formation,
            era: info.era,
            description: {en:info.desc_en,de:info.desc_de||info.desc_en,es:info.desc_es||info.desc_en,it:info.desc_it}[lang]||info.desc_it,
        };
    }

    function getPositionGuide(lang = 'it') {
        return POSITIONS[lang] || POSITIONS.it;
    }

    function getTransferGlossaryTerm(term, lang = 'it') {
        const dict = TRANSFER_GLOSSARY[lang] || TRANSFER_GLOSSARY.it;
        return dict[term] || null;
    }

    // Show random tip in game page sidebar
    function showRandomTip(containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;
        const lang = localStorage.getItem('gs_lang') || 'it';
        const tip = getRandomTrainingTip(lang);
        el.innerHTML = `<div style="font-size:0.75rem;color:var(--text-dim);padding:8px;background:var(--bg3);border-radius:8px;border-left:3px solid rgba(255,215,0,0.3);margin-top:8px;line-height:1.4">${tip}</div>`;
    }

    // Show quote in dashboard
    function showQuoteOfTheDay(containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;
        const lang = localStorage.getItem('gs_lang') || 'it';
        const q = getRandomQuote(lang);
        el.innerHTML = `
            <div style="font-style:italic;font-size:0.8rem;color:var(--text-dim);padding:10px;text-align:center;border-top:1px solid var(--border);margin-top:8px">
                "${q.quote}"
                <div style="font-size:0.7rem;margin-top:4px;color:rgba(255,215,0,0.7)">— ${q.author}</div>
            </div>`;
    }

    return {
        showRandomTip, showQuoteOfTheDay,
    };
})();

window.GS_Encyclopedia = GS_Encyclopedia;


// ── Extended formations encyclopedia ─────────────────────────────────────────
const TACTICAL_SYSTEMS = {
    it: {
        tikiTaka: {
            name: "Tiki-Taka",
            origin: "Spagna / Barcellona (2008-2015)",
            desc: "Possesso palla estremo, circolazione veloce, pressing alto immediato alla perdita. Il giocatore ideale ha tecnica sopraffina, intelligenza tattica e resistenza. Xavi ne è il simbolo assoluto.",
            pros: ["Controllo totale del gioco", "Stanca gli avversari", "Crea superiorità numerica"],
            cons: ["Richiede giocatori tecnici di alto livello", "Può essere contrastato con blocco basso"],
        },
        gegenpress: {
            name: "Gegenpressing",
            origin: "Germania / Klopp (2010-oggi)",
            desc: "Pressione immediata sulla perdita del pallone, recupero entro 6-8 secondi, verticalità brutale. Atletismo, intensità e automatismi sono fondamentali. Liverpool e Borussia Dortmund ne sono il tempio.",
            pros: ["Recupera palla in zone pericolose", "Destabilizza gli avversari", "Crea transizioni veloci"],
            cons: ["Alto dispendio energetico", "Richiede atletismo estremo"],
        },
        catenaccio: {
            name: "Catenaccio",
            origin: "Italia (1950-1970)",
            desc: "Difesa a zona rigida, libero dietro i marcatori, ripartenze fulminee. L'Internazionale di Helenio Herrera e la Grande Inter ne furono i maestri assoluti.",
            pros: ["Solidità difensiva assoluta", "Difficile da penetrare", "Efficace contro squadre più forti"],
            cons: ["Poco spettacolare", "Dipende da contropiedi"],
        },
        lowBlock: {
            name: "Low Block",
            origin: "Globale (ogni era)",
            desc: "Linea difensiva molto bassa, spazi ridotti, ripartenze veloci. Soluzioni pragmatiche per squadre che affrontano avversari superiori.",
            pros: ["Compattezza difensiva", "Spazi per ripartenze", "Riduce i pericoli"],
            cons: ["Iniziativa ceduta all'avversario", "Difficile segnare"],
        },
    },
    en: {
        tikiTaka: {
            name: "Tiki-Taka",
            origin: "Spain / Barcelona (2008-2015)",
            desc: "Extreme possession, rapid circulation, immediate high press on losing the ball. The ideal player has superb technique, tactical intelligence and endurance. Xavi is its absolute symbol.",
            pros: ["Total control of the game", "Wears opponents down", "Creates numerical superiority"],
            cons: ["Requires highly technical players", "Can be countered with a low block"],
        },
        gegenpress: {
            name: "Gegenpressing",
            origin: "Germany / Klopp (2010-present)",
            desc: "Immediate press on losing possession, ball recovery within 6-8 seconds, brutal verticality. Athleticism, intensity and automatisms are fundamental. Liverpool and Borussia Dortmund are its temples.",
            pros: ["Recovers ball in dangerous areas", "Destabilises opponents", "Creates fast transitions"],
            cons: ["High energy expenditure", "Requires extreme athleticism"],
        },
        catenaccio: {
            name: "Catenaccio",
            origin: "Italy (1950-1970)",
            desc: "Rigid zonal defence, sweeper behind markers, lightning counter-attacks. Inter Milan under Helenio Herrera were its absolute masters.",
            pros: ["Absolute defensive solidity", "Hard to penetrate", "Effective against stronger teams"],
            cons: ["Lacks spectacle", "Depends on counter-attacks"],
        },
        lowBlock: {
            name: "Low Block",
            origin: "Global (every era)",
            desc: "Very low defensive line, reduced spaces, fast transitions. Pragmatic solutions for teams facing superior opponents.",
            pros: ["Defensive compactness", "Spaces for transitions", "Reduces danger"],
            cons: ["Initiative ceded to the opponent", "Difficult to score"],
        },
    }
};

// ── Historical jersey numbers ─────────────────────────────────────────────────
const JERSEY_NUMBERS = {
    it: {
        1: "Portiere - l'ultimo baluardo, il comandante della difesa",
        9: "Centravanti - il numero del goleador puro, dei bomber da 30+ gol",
        10: "Fantasista - la maglia dei fuoriclasse: Maradona, Messi, Pelé",
        7: "Ala destra - velocità e gol: Ronaldo, Beckham, Robben",
        11: "Ala sinistra - dribbling e assist: Ribéry, Mané, Salah",
        8: "Centrocampista box-to-box - corsa e qualità: Lampard, Gerrard",
        6: "Difensore centrale - solidità e leadership: Baresi, Cannavaro",
    },
    en: {
        1: "Goalkeeper - the last line, the commander of the defence",
        9: "Centre-forward - the pure goalscorer's number, for 30+ goal strikers",
        10: "Playmaker - the shirt of legends: Maradona, Messi, Pelé",
        7: "Right winger - speed and goals: Ronaldo, Beckham, Robben",
        11: "Left winger - dribbling and assists: Ribéry, Mané, Salah",
        8: "Box-to-box midfielder - running and quality: Lampard, Gerrard",
        6: "Centre-back - solidity and leadership: Baresi, Cannavaro",
    }
};

// ── Referee signals guide ─────────────────────────────────────────────────────
const REFEREE_SIGNALS = {
    it: {
        "🟡 Giallo": "Ammonizione per gioco scorretto, perdite di tempo, proteste, simulazione.",
        "🟥 Rosso diretto": "Espulsione per fallo grave, sputare, violenza, negare gol chiaro.",
        "🟥 Rosso doppio giallo": "Due ammonizioni nello stesso match = espulsione.",
        "⚽ Rigore": "Fallo in area di rigore su giocatore in possesso palla.",
        "🚩 Fuorigioco": "Posizione irregolare al momento del passaggio ricevuto.",
        "📺 VAR": "Video Assistant Referee - revisione degli episodi controversi.",
        "🕐 Recupero": "Minuti aggiuntivi per le interruzioni del tempo regolare.",
        "🔄 Gioco a due": "Doppio tocco su calcio piazzato - infrazione.",
    },
    en: {
        "🟡 Yellow card": "Booking for foul play, time wasting, protests, simulation.",
        "🟥 Straight red": "Sending off for serious foul, spitting, violence, denying a clear goal.",
        "🟥 Two yellows": "Two yellow cards in the same match = sending off.",
        "⚽ Penalty": "Foul in the penalty area on a player in possession.",
        "🚩 Offside": "Irregular position at the moment of receiving the pass.",
        "📺 VAR": "Video Assistant Referee - review of controversial incidents.",
        "🕐 Added time": "Extra minutes for stoppages during normal time.",
        "🔄 Double touch": "Touching the ball twice on a free kick — infraction.",
    }
};

// ── All-time Golden Striker records ──────────────────────────────────────────
const GAME_RECORDS = {
    it: {
        "Più gol in una stagione": "Rodrigo Santos — 61 gol (Anno 4, Real Madridal FC)",
        "Overall più alto mai raggiunto": "Lorenzo Mancini — 124 OVR (Anno 15)",
        "Più Palloni d'Oro": "Carlos Mendoza — 8 Palloni d'Oro",
        "Stipendio più alto": "€ 4.8 milioni/mese (Anno 12, top club)",
        "Carriera più lunga": "Giocato fino a 37 anni e 11 mesi",
        "Più Champions vinte": "5 Champions Cup in carriera",
        "Popolarità massima": "100 punti — Icona assoluta",
    },
    en: {
        "Most goals in a season": "Rodrigo Santos — 61 goals (Year 4, Real Madridal FC)",
        "Highest ever Overall": "Lorenzo Mancini — 124 OVR (Year 15)",
        "Most Ballons d'Or": "Carlos Mendoza — 8 Ballons d'Or",
        "Highest salary": "€4.8 million/month (Year 12, top club)",
        "Longest career": "Played until age 37 years and 11 months",
        "Most Champions Cups won": "5 Champions Cups in a career",
        "Maximum popularity": "100 points — Absolute icon",
    }
};

// Export
if (typeof window !== 'undefined' && window.GS_Encyclopedia) {
    Object.assign(GS_Encyclopedia, {
        TACTICAL_SYSTEMS,
        JERSEY_NUMBERS,
        REFEREE_SIGNALS,
        GAME_RECORDS,
        
        getTacticalSystem(name, lang = 'it') {
            const systems = TACTICAL_SYSTEMS[lang] || TACTICAL_SYSTEMS.it;
            return systems[name] || null;
        },
        getJerseyMeaning(number, lang = 'it') {
            const nums = JERSEY_NUMBERS[lang] || JERSEY_NUMBERS.it;
            return nums[number] || null;
        },
        getRefSignal(signal, lang = 'it') {
            const sigs = REFEREE_SIGNALS[lang] || REFEREE_SIGNALS.it;
            return sigs[signal] || null;
        },
        getRecord(record, lang = 'it') {
            const recs = GAME_RECORDS[lang] || GAME_RECORDS.it;
            return recs[record] || null;
        },
    });
}
