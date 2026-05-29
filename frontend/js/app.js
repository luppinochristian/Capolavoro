/**
 * ============================================================
 * app.js — Modulo principale dell'applicazione Golden Striker
 * ============================================================
 * File JavaScript più grande del progetto (~5000 righe).
 * Coordina tutta la logica client-side del gioco:
 *
 * SEZIONI PRINCIPALI:
 *  - Stringhe UI bilingue (IT/EN) e sistema di internazionalizzazione
 *  - Gestione autenticazione: login, registrazione, verifica email OTP,
 *    reset password, modalità ospite
 *  - Navigazione tra pagine e rendering UI
 *  - Dashboard principale con notizie, statistiche e azioni mensili
 *  - Sistema di traduzione notizie in tempo reale via API Anthropic
 *  - Selezione e creazione carriere
 *  - Pagine: Abilità, Agente, Notizie, Classifica, Champions,
 *            Obiettivi, Strutture, Trasferimenti, Epilogo
 *  - Funzioni API (api(), toast(), renderGame(), renderDashboard())
 *  - Cambio lingua (setLanguage()) e applicazione traduzioni
 *
 * DIPENDENZE (caricati prima in index.html):
 *  gamedata.js, locale.js, commentary.js, achievements.js,
 *  season_planner.js, tutorial.js, ui_components.js, analytics.js,
 *  timeline.js, particles.js, charts.js, encyclopedia.js,
 *  animations.js, playercard.js
 * ============================================================
 */
// ── CONFIG ──
const API_BASE = '/backend/api';
let currentPlayer = null;
let selectedActions = [];
let _pendingDashboardRefresh = false;
let authToken       = localStorage.getItem('gs_token') || null;
let currentCareerId = parseInt(localStorage.getItem('gs_career') || '0') || null;
let selectedSkin      = '#C68642';
let selectedEye       = '#5C3317';
let selectedHairStyle = 'short';
let selectedHairColor = '#1a1a1a';

// ── HAIR STYLES ──
const HAIR_STYLE_DEFS = [
    { id: 'short',  label: {it:'Corto', en:'Short',  de:'Kurz',    es:'Corto'},  emoji: '💈' },
    { id: 'medium', label: {it:'Medio', en:'Medium', de:'Mittel',  es:'Medio'},  emoji: '💇' },
    { id: 'long',   label: {it:'Lungo', en:'Long',   de:'Lang',    es:'Largo'},  emoji: '🧖' },
    { id: 'curly',  label: {it:'Ricci', en:'Curly',  de:'Lockig',  es:'Rizado'}, emoji: '🌀' },
    { id: 'afro',   label: {it:'Afro',  en:'Afro',   de:'Afro',    es:'Afro'},   emoji: '✊' },
    { id: 'mohawk', label: {it:'Mohawk',en:'Mohawk', de:'Mohawk',  es:'Mohawk'}, emoji: '🤘' },
    { id: 'bun',    label: {it:'Coda',  en:'Bun',    de:'Dutt',    es:'Moño'},   emoji: '🎀' },
    { id: 'bald',   label: {it:'Rasato',en:'Bald',   de:'Kahl',    es:'Calvo'},  emoji: '🧑‍🦲' },
];

const HAIR_PRESET_COLORS = [
    '#1a1a1a','#2d1a0e','#3d2b1f','#5c3317',
    '#8B4513','#A0522D','#C4893E','#D4A017',
    '#F5C842','#C0392B','#922B21','#7D3C98',
    '#808080','#b0b0b0','#d4d4d4','#ffffff',
];

const SKIN_COLORS = {
    light:'#FDDBB4', medium_light:'#E8B88A', medium:'#C68642',
    medium_dark:'#8D5524', dark:'#3B1A08'
};

const EYE_PRESETS = [
    '#5C3317','#3d1f0a','#1E90FF','#4169E1','#228B22','#2E8B57',
    '#8B6914','#D4A017','#708090','#536878','#8B0000','#800080',
    '#4B0082','#1a1a2e'
];

// ── TRADUZIONI (IT / EN) ──
const TRANSLATIONS = {
    it: {
        nav_dashboard:'🏠 Dashboard', nav_game:'⚽ Gioca', nav_career:'📊 Carriera',
        nav_transfer:'🔄 Trasferimento', nav_strutture:'🏗️ Strutture',
        nav_classifica:'🏟️ Classifica', nav_agente:'🤝 Agente',
        nav_notizie:'📰 Notizie', nav_skilltree:'🌟 Abilità',
        settings_title:'Impostazioni', settings_language:'🌐 Lingua / Language',
        settings_navigate:'🗺️ Navigazione', settings_main_menu:'Menu Principale',
        settings_main_menu_sub:'Cambia carriera o creane una nuova',
        settings_feedback:'Richiedi un Update', settings_feedback_sub:'Invia suggerimenti agli sviluppatori',
        settings_account:'👤 Account', settings_logout:'Logout Completo',
        settings_logout_sub:'Disconnetti account e torna al login',
        auth_login:'Accedi', auth_register:'Registrati',
        auth_login_btn:'⚽ Accedi', auth_register_btn:'🌟 Crea Account',
        auth_userauth_confirm_pw:'Conferma Password',
        auth_forgot_link:'Password dimenticata?', auth_forgot_btn:'📧 Invia Istruzioni',
        auth_back_login:'← Torna al Login', create_name_label:'Nome Carriera',
        create_player_label:'Nome Calciatore', create_gender:'Sesso', create_age:'Età',
        create_nationality:'Nazionalità', create_foot:'🦶 Piede Preferito',
        create_skin:'🧑 Carnagione', create_eyes:'👁️ Colore Occhi',
        create_hairstyle:'✂️ Taglio', create_haircolor:'🎨 Colore Capelli',
        create_start_btn:'🌟 Inizia la Carriera!',
        cc_step1:'Identità', cc_step2:'Aspetto', cc_step3:'Stile', cc_step4:'Conferma',
        cc_step1_title:'Chi sei?', cc_step1_sub:'Il tuo nome entrerà nella storia del calcio',
        cc_step2_title:'Il tuo aspetto', cc_step2_sub:'Personalizza il tuo calciatore',
        cc_step3_title:'Il tuo stile', cc_step3_sub:'Come giochi in campo?',
        cc_step4_title:'Pronto per la gloria?', cc_step4_sub:'Controlla i tuoi dettagli e inizia',
        cc_back:'← Indietro', cc_next:'Avanti →',
        cc_role:'Ruolo / Specializzazione', cc_role_hint:'+5 alla stat principale a inizio carriera',
        gender_male:'⚽ Maschio', gender_female:'⚽ Femmina',
        foot_right:'👟 Destro', foot_left:'👟 Sinistro',
        career_new:'➕ Nuova Carriera', career_select_title:'Le tue Carriere',
        ai_describe_label:'✨ Descrivi il tuo calciatore',
        ai_generate_btn:'🎨 Genera Immagine',
        dash_period:'Periodo', dash_money:'Soldi', dash_goals:'⚽ Gol Stagione',
        dash_assists:'🎯 Assist Stagione', dash_facility:'Struttura',
        dash_tech_stats:'📊 Statistiche Tecniche', dash_phys_cond:'🔋 Condizione Fisica',
        stat_tiro:'Tiro', stat_velocita:'Velocità', stat_dribbling:'Dribbling',
        stat_fisico:'Fisico', stat_mentalita:'Mentalità',
        stat_piede_forte:'🦶 Piede Forte', stat_piede_debole:'🦶 Piede Debole',
        stat_skill_lvl:'🎯 Livello Skill',
        stat_energia:'Energia', stat_morale:'Morale', stat_popolarita:'Popolarità',
        dash_season:'Stag.', dash_season_full:'Stagione', dash_age:'Età',
        dash_latest_news:'📰 Ultime Notizie',
        dash_activities:'📋 Ultime Attività',
        dash_no_news:'Gioca il primo mese per ricevere notizie!',
        page_game:'⚽ Gioca il Mese', page_career:'📊 Carriera',
        page_transfer:'🔄 Trasferimento', page_strutture:'🏗️ Struttura Personale',
        page_agente:'🤝 Agente Personale', page_notizie:'📰 Notizie',
        page_skilltree:'🌟 Albero delle Abilità',
        page_classifica:'🏟️ Classifica',
        classifica_subtitle:'Classifica in tempo reale di ogni lega e Champions Cup',
        transfer_subtitle:'Scegli la tua prossima squadra. Squadre migliori = più soldi e visibilità!',
        strutture_subtitle:'Investi i tuoi soldi per migliorare la struttura di allenamento e crescere più velocemente.',
        agente_subtitle:'Un buon agente negozia stipendi migliori e porta offerte dai top club',
        notizie_subtitle:'Gli ultimi aggiornamenti sulla tua carriera',
        skilltree_subtitle:'Raggiungi milestone nelle statistiche per sbloccare potenziamenti unici',
        nav_achievements:'🏅 Premi',
        view_card:'Carta',
        page_achievements:'🏅 Obiettivi Sbloccati',
        achievements_subtitle:'Completa sfide per sbloccare badge esclusivi',
        achievements_unlocked:'sbloccati',
        ach_category_milestones:'🌟 Milestone',
        ach_category_scoring:'⚽ Gol & Assist',
        ach_category_growth:'📈 Crescita',
        ach_category_trophies:'🏆 Trofei',
        ach_category_career:'💼 Carriera',
        ach_category_skills:'✨ Abilità',
        ach_category_facilities:'🏗️ Strutture',
        ach_category_secrets:'🔒 Segreti',
        dash_current_status:'📈 Status Attuale',
        results_title:'📊 Risultati del Mese',
        results_close:'✅ Continua',
        skill_pts_zero:'0 punti abilità disponibili',
        st_strong_foot:'🦶 PIEDE FORTE', st_weak_foot:'🦶 PIEDE DEBOLE', st_skill_lvl:'🎯 LIVELLO SKILL',
        st_strong_hint:'Potenzia con: Tiro Potente, Tiro a Giro, Rabona',
        st_weak_hint:'Potenzia con: Freddezza, Istinto del Goleador',
        st_skill_hint:'Sale sbloccando più abilità nell\'albero',
        register_username_hint:'Solo lettere, numeri e _ (3-30 caratteri)',
        register_pw_label:'Password (min 6 caratteri)',
        forgot_desc:'Inserisci la tua email e ti manderemo le istruzioni per reimpostare la password.',
        careers_limit:'Hai raggiunto il limite di 5 carriere.',
        update_request_desc:'Scrivi le tue idee, suggerimenti o segnalazioni. Verranno inviate agli sviluppatori.',
        update_send_btn:'📨 Invia', update_sent_ok:'✅ Richiesta inviata! Grazie per il tuo suggerimento.',
        btn_cancel:'Annulla',
        menu_change_career:'Cambia Carriera',
        menu_change_career_sub:'Torna alla selezione carriere',
        menu_settings:'Impostazioni',
        menu_settings_sub:'Lingua, account, tutorial',
        menu_logout:'Logout',
        menu_logout_sub:'Disconnetti account',
        reg_err_userreg_err_email:'Inserisci una email valida',
        reg_err_password:'Le password non coincidono',
        verify_title:'Verifica Email',
        verify_subtitle:'Abbiamo inviato un codice a 6 cifre a',
        verify_btn:'✅ Verifica',
        verify_resend:'Reinvia codice',
        verify_resend_wait:'Reinvia tra',
        verify_err_code:'Inserisci il codice a 6 cifre',
        verify_success:'Account verificato! Benvenuto!',
        ai_avatar_err_nodesc:'⚠️ Scrivi una descrizione!',
        ai_avatar_err_nogen:"Prima genera un'immagine AI, oppure torna alla modalità Default.",
        ai_avatar_generating:'⏳ Generando...',
        ai_avatar_ready:'✅ Pronto!',
        ai_avatar_regen:'🔄 Rigenera',
        tab_lega:'📋 Lega', tab_champions:'🏆 Champions Cup', tab_calendario:'📅 Calendario',
        select_league:'Seleziona una lega',
        stat_gol:'gol', stat_assist:'assist', stat_voto:'voto',
        stat_partite:'partite', stat_trofei:'trofei', stat_palloni:'Palloni d\'Oro',
        match_win:'VITTORIA', match_draw:'PAREGGIO', match_loss:'SCONFITTA',
        match_home:'🏠 Casa', match_away:'✈️ Trasferta',
        league_div1:'Prima Divisione', league_div2:'Seconda Serie',
        career_trophies_title:'🏅 Trofei e Riconoscimenti',
        pallone_top:'Pallone d\'Oro Top',
        career_best_rating_label:'Miglior Valutazione',
        classifica_legend_champion:'🥇 Campione',
        classifica_legend_top3:'🥉 Podio',
        classifica_legend_top4:'⭐ Champions Cup',
        classifica_legend_retro:'📉 Zona retrocessione',
        injury_blocked:'Sei infortunato, non puoi allenarti fisicamente!',
        energy_blocked:'Energia a zero! Riposati prima di allenarti.',
        actions_max:'Puoi scegliere massimo 3 azioni!',
        ai_preview_hint:'Scrivi una descrizione<br>e premi Genera',
        // Obiettivi stagionali — usati dinamicamente con _t('obj_'+ob.tipo)
        obj_gol_stagione:'Segna {0} gol in stagione',
        obj_assist_stagione:'Fornisci {0} assist in stagione',
        obj_media_voto:'Mantieni una media voto ≥ 7.0',
        obj_overall:'Raggiungi Overall {0}',
        obj_popolarita:'Raggiungi {0} di popolarità',
        obj_complete:'Completato',
        obj_header:'🎯 Obiettivi Stagionali',
        obj_completed:'completati',
        obj_title:'🎯 Obiettivi Stagione',
        // Form registrazione
        register_pw_placeholder:'Scegli una password (min 6 caratteri)',
        register_pw2_placeholder:'Ripeti la password',
        // Restore: cc_role names/subs, auth labels, career defaults, nation search
        default_career_name:'La mia Carriera',
        cc_nation_search:'🔍 Cerca nazione...',
        auth_username:'Username',
        auth_confirm_pw:'Conferma Password',
        cc_role_bomber:'⚽ Bomber', cc_role_bomber_sub:'+5 Tiro',
        cc_role_fantasista:'✨ Fantasista', cc_role_fantasista_sub:'+5 Dribbling',
        cc_role_ala:'⚡ Ala', cc_role_ala_sub:'+5 Velocità',
        cc_role_regista:'🧠 Regista', cc_role_regista_sub:'+5 Mentalità',
        cc_role_tuttocampista:'💪 Tuttocampista', cc_role_tuttocampista_sub:'+5 Fisico',
        conn_tooltip_retooltip_delete:'Elimina',
        btn_generate_img:'🎨 Genera Immagine',
        default_career_injury_banner:'🩹 Sei infortunato — <strong>{0} {1}</strong>. Puoi solo riposare, allenarti mentalmente o fare attività social.',
        injury_mese:'mese rimanente', injury_mesi:'mesi rimanenti',
        energy_zero_banner:'⚡ Energia esaurita — non puoi allenarti fisicamente. Riposati prima!',
        energy_low_banner:'⚠️ Energia bassa ({0}) — rischio infortuni elevato negli allenamenti fisici!',
        res_section_training:'🏋️ Allenamento',
        res_section_injuries:'🚑 Infortuni',
        res_section_champions:'🏆 Champions Cup',
        res_section_matches:'⚽ Partite del mese',
        res_section_other:'📋 Altro',
        champions_badge:'🌟 Champions Cup',
        pallone_badge:"🥇 Pallone d'Oro",
        transfer_toast:'✈️ Trasferito a {0}!',
        transfer_confirm:'Trasferirsi a {0}?',
        api_error_label:'Errore: ',
        api_resp_invalid:'Risposta non valida',
        error_generic_msg:'Errore. Riprova.',
        error_unknown:'Errore sconosciuto',
        conn_error_short:'Errore di connessione',
        server_resp_invalid:'Risposta del server non valida',
        ai_retry_msg:'⚠️ Riprova o modifica la descrizione',
        ai_gender_changed:'⚠️ Sesso cambiato — rigenera l\'immagine',
        prereq_unlock:'Sblocca prima il prerequisito!',
        no_career:'Nessuna carriera ancora.\nCreane una per iniziare!',
        no_preview:'Nessuna\nanteprima',
        img_available:'Immagine\ndisponibile',
        welcome_career:'Benvenuto! La tua carriera inizia ora! ⚽',
        rename_career_prompt:'Nuovo nome carriera:',
        delete_career_confirm:'Eliminare la carriera "{0}"?\nQuesta azione è irreversibile!',
        career_deleted:'Carriera eliminata',
        no_activity:'Nessuna attività ancora',
        loading:'⏳ Caricamento...',
        no_seasons:'Nessuna stagione giocata ancora.',
        loading_teams:'Caricamento squadre...',
        loading_leagues:'Caricamento leghe...',
        loading_champions:'Caricamento Champions Cup...',
        error_loading_teams:'Errore caricamento squadre.',
        no_agent:'Nessun agente disponibile.',
        agent_empty:'👤 Non hai ancora un agente. Assumine uno per massimizzare i guadagni e facilitare i trasferimenti!',
        agent_choose:'Scegli il tuo agente',
        no_matches:'Nessuna partita giocata ancora in questa lega.',
        champions_not_started_full:'🏆 La Champions Cup non è ancora iniziata. Le squadre si qualificano a settembre (top 4 di ogni Prima Divisione).',
        bracket_no_data_full:'Nessun tabellone ancora disponibile.',
        bracket_tbd:'In attesa',
        skill_maxed:'Abilità già al massimo!',
        end_career_banner:'🏁 FINE CARRIERA!',
        struttura_current:'Struttura Attuale',
        struttura_buy:'🏗️ Acquista',
        struttura_locked:'🔒 Sequenziale',
        struttura_no_funds:'💸 Fondi insuff.',
        ts_ovr:'⚽ OVR Squadra', ts_salary:'💰 Stipendio', ts_pop:'🏟️ Popolarità',
        salary_base:'base', salary_buono:'buono', salary_ottimo:'ottimo', salary_alto:'alto', salary_top:'top',
        transfer_current_team:'✅ Squadra Attuale',
        ag_level:'Livello', ag_salary_bonus:'stipendio', ag_ovr_bonus:'OVR trasferimento',
        ag_monthly_est:'Bonus mensile stimato', ag_ovr_note:'(basato sul tuo OVR attuale)',
        ag_req_prev:'Richiede prima Lv.', ag_req_pop:'Serve pop.', ag_req_money:'Mancano',
        ag_hire_btn:'🤝 Assumi', ag_upgrade_btn:'⬆️ Upgrade', ag_pop_free:'Libero',
        ag_owned:'✅ Attivo',
        obj_morale_prize:'morale',
        strutture_bonus_training:'Allenamento',
        strutture_bonus_growth:'Crescita',
        strutture_bonus_injury:'Infortuni',
        game_choose_actions:'🎮 Scegli le tue Azioni',
        game_choose_sub:'Seleziona 1-3 azioni mensili. Le scelte influenzano stats, energia e performance.',
        game_play_sub:'Scegli fino a 3 azioni per questo mese, poi simula le partite',
        play_btn:'⚽ Seleziona almeno 1 azione', play_btn_ready:'⚽ Gioca Mese',
        career_subtitle:'Storico delle tue stagioni — clicca su un anno per i dettagli',
        career_tab_seasons:'📅 Stagioni', career_tab_log:'📋 Log Partite',
        career_ongoing:'in corso', career_no_data:'Nessun dato',
        career_best_rating:'MIGLIOR VALUTAZIONE',
        career_year_label:'Anno',
        month_1:'Gen',month_2:'Feb',month_3:'Mar',month_4:'Apr',month_5:'Mag',month_6:'Giu',
        month_7:'Lug',month_8:'Ago',month_9:'Set',month_10:'Ott',month_11:'Nov',month_12:'Dic',
        month_full_1:'Gennaio',month_full_2:'Febbraio',month_full_3:'Marzo',month_full_4:'Aprile',
        month_full_5:'Maggio',month_full_6:'Giugno',month_full_7:'Luglio',month_full_8:'Agosto',
        month_full_9:'Settembre',month_full_10:'Ottobre',month_full_11:'Novembre',month_full_12:'Dicembre',
        // Piede lato
        foot_sx:'Sinistro', foot_dx:'Destro',
        // Transfer
        transfer_ovr_req:'🎯 OVR richiesto', transfer_btn_go:'✈️ Trasferisciti', transfer_agent_bonus:'🤝 Agente attivo: -{0}% OVR richiesto per il trasferimento',
        transfer_no_teams:'Nessuna squadra in questa lega.',
        // Career
        career_no_data_season:'Nessun dato disponibile per questa stagione.',
        career_best_gol_label:'Miglior partita per Gol', career_best_assist_label:'Miglior partita per Assist',
        // Objectives
        // Agent
        agent_active_badge:'✅ Agente attivo',
        // Status
        sim_running:'⏳ Simulazione in corso...', ai_gen_running:'⏳ Generazione in corso (5-15s)...',
        // Senza squadra
        no_team:'Senza squadra',
        guest_desc:'Vuoi provare senza registrarti?',
        guest_btn:'👤 Modalità Ospite',
        guest_banner:'👤 Stai giocando come Ospite — i progressi non vengono salvati.',
        guest_save_prompt:'Crea un account gratuito per salvare la tua carriera!',
        update_request_placeholder:'Descrivi le tue idee, suggerimenti o bug...',
        color_hair_label:'Colore Capelli',
        color_eye_label:'Colore Occhi',
        agente_min_chars:'Testo troppo corto.',
        conn_error:'Errore di connessione. Riprova.',
        reg_err_username:'Username non valido.',
        tooltip_rename:'Rinomina carriera',
        guest_register_btn:'💾 Registrati e Salva',
    },
    en: {
        nav_dashboard:'🏠 Dashboard', nav_game:'⚽ Play', nav_career:'📊 Career',
        nav_transfer:'🔄 Transfer', nav_strutture:'🏗️ Facilities',
        nav_classifica:'🏟️ Standings', nav_agente:'🤝 Agent',
        nav_notizie:'📰 News', nav_skilltree:'🌟 Skills',
        settings_title:'Settings', settings_language:'🌐 Language / Lingua',
        settings_navigate:'🗺️ Navigation', settings_main_menu:'Main Menu',
        settings_main_menu_sub:'Switch career or create a new one',
        settings_feedback:'Request an Update', settings_feedback_sub:'Send suggestions to the developers',
        settings_account:'👤 Account', settings_logout:'Full Logout',
        settings_logout_sub:'Disconnect account and return to login',
        auth_login:'Login', auth_register:'Sign Up',
        auth_login_btn:'⚽ Login', auth_register_btn:'🌟 Create Account',
        auth_userauth_confirm_pw:'Confirm Password',
        auth_forgot_link:'Forgot password?', auth_forgot_btn:'📧 Send Instructions',
        auth_back_login:'← Back to Login', create_name_label:'Career Name',
        create_player_label:'Player Name', create_gender:'Gender', create_age:'Age',
        create_nationality:'Nationality', create_foot:'🦶 Preferred Foot',
        create_skin:'🧑 Skin Tone', create_eyes:'👁️ Eye Color',
        create_hairstyle:'✂️ Hairstyle', create_haircolor:'🎨 Hair Color',
        create_start_btn:'🌟 Start this Career!',
        cc_step1:'Identity', cc_step2:'Appearance', cc_step3:'Style', cc_step4:'Confirm',
        cc_step1_title:'Who are you?', cc_step1_sub:'Your name will go down in football history',
        cc_step2_title:'Your appearance', cc_step2_sub:'Customize your player',
        cc_step3_title:'Your style', cc_step3_sub:'How do you play on the pitch?',
        cc_step4_title:'Ready for glory?', cc_step4_sub:'Check your details and start',
        cc_back:'← Back', cc_next:'Next →',
        cc_role:'Role / Specialization', cc_role_hint:'+5 to main stat at career start',
        gender_male:'⚽ Male', gender_female:'⚽ Female',
        foot_right:'👟 Right', foot_left:'👟 Left',
        career_new:'➕ New Career', career_select_title:'Your Careers',
        ai_describe_label:'✨ Describe your player',
        ai_generate_btn:'🎨 Generate Image',
        dash_period:'Period', dash_money:'Budget', dash_goals:'⚽ Season Goals',
        dash_assists:'🎯 Season Assists', dash_facility:'Facility',
        dash_tech_stats:'📊 Technical Stats', dash_phys_cond:'🔋 Physical Condition',
        stat_tiro:'Shooting', stat_velocita:'Speed', stat_dribbling:'Dribbling',
        stat_fisico:'Physical', stat_mentalita:'Mental',
        stat_piede_forte:'🦶 Strong Foot', stat_piede_debole:'🦶 Weak Foot',
        stat_skill_lvl:'🎯 Skill Level',
        stat_energia:'Energy', stat_morale:'Morale', stat_popolarita:'Popularity',
        dash_season:'Season', dash_season_full:'Season', dash_age:'Age',
        dash_latest_news:'📰 Latest News',
        dash_activities:'📋 Recent Activity',
        dash_no_news:'Play the first month to receive news!',
        page_game:'⚽ Play the Month', page_career:'📊 Career',
        page_transfer:'🔄 Transfer', page_strutture:'🏗️ Personal Facilities',
        page_agente:'🤝 Personal Agent', page_notizie:'📰 News',
        page_skilltree:'🌟 Skill Tree',
        page_classifica:'🏟️ Standings',
        classifica_subtitle:'Live standings for every league and Champions Cup',
        transfer_subtitle:'Choose your next team. Better teams = more money and visibility!',
        strutture_subtitle:'Invest your money to improve your training facility and grow faster.',
        agente_subtitle:'A good agent negotiates better wages and brings offers from top clubs',
        notizie_subtitle:'The latest updates on your career',
        skilltree_subtitle:'Reach stat milestones to unlock unique upgrades',
        nav_achievements:'🏅 Awards',
        view_card:'Card',
        page_achievements:'🏅 Achievements',
        achievements_subtitle:'Complete challenges to unlock exclusive badges',
        achievements_unlocked:'unlocked',
        ach_category_milestones:'🌟 Milestones',
        ach_category_scoring:'⚽ Goals & Assists',
        ach_category_growth:'📈 Growth',
        ach_category_trophies:'🏆 Trophies',
        ach_category_career:'💼 Career',
        ach_category_skills:'✨ Skills',
        ach_category_facilities:'🏗️ Facilities',
        ach_category_secrets:'🔒 Secrets',
        dash_current_status:'📈 Current Status',
        results_title:'📊 Monthly Results',
        results_close:'✅ Continue',
        skill_pts_zero:'0 skill points available',
        st_strong_foot:'🦶 STRONG FOOT', st_weak_foot:'🦶 WEAK FOOT', st_skill_lvl:'🎯 SKILL LEVEL',
        st_strong_hint:'Upgrade with: Power Shot, Curl, Rabona',
        st_weak_hint:'Upgrade with: Composure, Striker Instinct',
        st_skill_hint:'Increases by unlocking more skills in the tree',
        register_username_hint:'Letters, numbers and _ only (3-30 chars)',
        register_pw_label:'Password (min 6 chars)',
        forgot_desc:'Enter your email and we will send you instructions to reset your password.',
        careers_limit:'You have reached the limit of 5 careers.',
        update_request_desc:'Write your ideas, suggestions or bug reports. They will be sent to the developers.',
        update_send_btn:'📨 Send', update_sent_ok:'✅ Request sent! Thank you for your feedback.',
        btn_cancel:'Cancel',
        menu_change_career:'Change Career',
        menu_change_career_sub:'Back to career selection',
        menu_settings:'Settings',
        menu_settings_sub:'Language, account, tutorial',
        menu_logout:'Logout',
        menu_logout_sub:'Disconnect account',
        reg_err_userreg_err_email:'Please enter a valid email',
        reg_err_password:'Passwords do not match',
        verify_title:'Verify Email',
        verify_subtitle:'We sent a 6-digit code to',
        verify_btn:'✅ Verify',
        verify_resend:'Resend code',
        verify_resend_wait:'Resend in',
        verify_err_code:'Please enter the 6-digit code',
        verify_success:'Account verified! Welcome!',
        ai_avatar_err_nodesc:'⚠️ Write a description!',
        ai_avatar_err_nogen:'First generate an AI image, or go back to Default mode.',
        ai_avatar_generating:'⏳ Generating...',
        ai_avatar_ready:'✅ Ready!',
        ai_avatar_regen:'🔄 Regenerate',
        tab_lega:'📋 League', tab_champions:'🏆 Champions Cup', tab_calendario:'📅 Calendar',
        select_league:'Select a league',
        stat_gol:'goals', stat_assist:'assists', stat_voto:'rating',
        stat_partite:'matches', stat_trofei:'trophies', stat_palloni:'Ballon d\'Or',
        match_win:'WIN', match_draw:'DRAW', match_loss:'LOSS',
        match_home:'🏠 Home', match_away:'✈️ Away',
        league_div1:'First Division', league_div2:'Second Division',
        career_trophies_title:'🏅 Trophies & Honours',
        pallone_top:"Ballon d'Or Top",
        career_best_rating_label:'Best Rating',
        classifica_legend_champion:'🥇 Champion',
        classifica_legend_top3:'🥉 Podium',
        classifica_legend_top4:'⭐ Champions Cup',
        classifica_legend_retro:'📉 Relegation zone',
        injury_blocked:'You are injured, you cannot train physically!',
        energy_blocked:'Energy at zero! Rest before training.',
        actions_max:'You can choose a maximum of 3 actions!',
        ai_preview_hint:'Write a description<br>and press Generate',
        // Season objectives — used dynamically with _t('obj_'+ob.tipo)
        obj_gol_stagione:'Score {0} goals this season',
        obj_assist_stagione:'Provide {0} assists this season',
        obj_media_voto:'Keep an average rating ≥ 7.0',
        obj_overall:'Reach Overall {0}',
        obj_popolarita:'Reach {0} popularity',
        obj_complete:'Completed',
        obj_header:'🎯 Season Objectives',
        obj_completed:'completed',
        obj_title:'🎯 Season Objectives',
        // Registration form
        register_pw_placeholder:'Choose a password (min 6 chars)',
        register_pw2_placeholder:'Repeat the password',
        // Restore: cc_role names/subs, auth labels, career defaults, nation search
        default_career_name:'My Career',
        cc_nation_search:'🔍 Search nation...',
        auth_username:'Username',
        auth_confirm_pw:'Confirm Password',
        cc_role_bomber:'⚽ Striker', cc_role_bomber_sub:'+5 Shooting',
        cc_role_fantasista:'✨ Playmaker', cc_role_fantasista_sub:'+5 Dribbling',
        cc_role_ala:'⚡ Winger', cc_role_ala_sub:'+5 Speed',
        cc_role_regista:'🧠 Midfielder', cc_role_regista_sub:'+5 Mental',
        cc_role_tuttocampista:'💪 All-rounder', cc_role_tuttocampista_sub:'+5 Physical',
        conn_tooltip_retooltip_delete:'Delete',
        btn_generate_img:'🎨 Generate Image',
        default_career_injury_banner:'🩹 You are injured — <strong>{0} {1}</strong>. You can only rest, train mentally or do social activities.',
        injury_mese:'month remaining', injury_mesi:'months remaining',
        energy_zero_banner:'⚡ Energy depleted — you cannot train physically. Rest first!',
        energy_low_banner:'⚠️ Low energy ({0}) — high injury risk for physical training!',
        res_section_training:'🏋️ Training',
        res_section_injuries:'🚑 Injuries',
        res_section_champions:'🏆 Champions Cup',
        res_section_matches:'⚽ Month matches',
        res_section_other:'📋 Other',
        champions_badge:'🌟 Champions Cup',
        pallone_badge:"🥇 Ballon d'Or",
        transfer_toast:'✈️ Transferred to {0}!',
        transfer_confirm:'Transfer to {0}?',
        api_error_label:'Error: ',
        api_resp_invalid:'Invalid response',
        error_generic_msg:'Error. Please try again.',
        error_unknown:'Unknown error',
        conn_error_short:'Connection error',
        server_resp_invalid:'Invalid server response',
        ai_retry_msg:'⚠️ Try again or modify the description',
        ai_gender_changed:'⚠️ Gender changed — regenerate the image',
        prereq_unlock:'Unlock the prerequisite first!',
        no_career:'No careers yet.\nCreate one to get started!',
        no_preview:'No\npreview',
        img_available:'Image\navailable',
        welcome_career:'Welcome! Your career starts now! ⚽',
        rename_career_prompt:'New career name:',
        delete_career_confirm:'Delete career "{0}"?\nThis action cannot be undone!',
        career_deleted:'Career deleted',
        no_activity:'No activity yet',
        loading:'⏳ Loading...',
        no_seasons:'No seasons played yet.',
        loading_teams:'Loading teams...',
        loading_leagues:'Loading leagues...',
        loading_champions:'Loading Champions Cup...',
        error_loading_teams:'Error loading teams.',
        no_agent:'No agent available.',
        agent_empty:"👤 You don't have an agent yet. Hire one to maximise earnings and ease transfers!",
        agent_choose:'Choose your agent',
        no_matches:'No matches played yet in this league.',
        champions_not_started_full:"🏆 Champions Cup hasn't started yet. Teams qualify in September (top 4 of each First Division).",
        bracket_no_data_full:'No bracket data available yet.',
        bracket_tbd:'To be decided',
        skill_maxed:'Skill already maxed!',
        end_career_banner:'🏁 END OF CAREER!',
        struttura_current:'Current Facility',
        struttura_buy:'🏗️ Buy',
        struttura_locked:'🔒 Sequential',
        struttura_no_funds:'💸 Insufficient funds',
        ts_ovr:'⚽ Team OVR', ts_salary:'💰 Salary', ts_pop:'🏟️ Popularity',
        salary_base:'base', salary_buono:'fair', salary_ottimo:'good', salary_alto:'high', salary_top:'top',
        transfer_current_team:'✅ Current Team',
        ag_level:'Level', ag_salary_bonus:'salary', ag_ovr_bonus:'OVR transfer',
        ag_monthly_est:'Estimated monthly bonus', ag_ovr_note:'(based on your current OVR)',
        ag_req_prev:'Requires Lv.', ag_req_pop:'Need pop.', ag_req_money:'Missing',
        ag_hire_btn:'🤝 Hire', ag_upgrade_btn:'⬆️ Upgrade', ag_pop_free:'Free',
        ag_owned:'✅ Active',
        obj_morale_prize:'morale',
        strutture_bonus_training:'Training',
        strutture_bonus_growth:'Growth',
        strutture_bonus_injury:'Injuries',
        game_choose_actions:'🎮 Choose your Actions',
        game_choose_sub:'Select 1-3 monthly actions. Your choices affect stats, energy and match performance.',
        game_play_sub:'Choose up to 3 actions for this month, then simulate the matches',
        play_btn:'⚽ Select at least 1 action', play_btn_ready:'⚽ Play Month',
        career_subtitle:'History of your seasons — click a year for details',
        career_tab_seasons:'📅 Seasons', career_tab_log:'📋 Match Log',
        career_ongoing:'ongoing', career_no_data:'No data',
        career_best_rating:'BEST RATING',
        career_year_label:'Year',
        month_1:'Jan',month_2:'Feb',month_3:'Mar',month_4:'Apr',month_5:'May',month_6:'Jun',
        month_7:'Jul',month_8:'Aug',month_9:'Sep',month_10:'Oct',month_11:'Nov',month_12:'Dec',
        month_full_1:'January',month_full_2:'February',month_full_3:'March',month_full_4:'April',
        month_full_5:'May',month_full_6:'June',month_full_7:'July',month_full_8:'August',
        month_full_9:'September',month_full_10:'October',month_full_11:'November',month_full_12:'December',
        // Piede lato
        foot_sx:'Left', foot_dx:'Right',
        // Transfer
        transfer_ovr_req:'🎯 OVR required', transfer_btn_go:'✈️ Transfer', transfer_agent_bonus:'🤝 Agent active: -{0}% OVR requirement for transfer',
        transfer_no_teams:'No teams in this league.',
        // Career
        career_no_data_season:'No data available for this season.',
        career_best_gol_label:'Best match (Goals)', career_best_assist_label:'Best match (Assists)',
        // Objectives
        // Agent
        agent_active_badge:'✅ Agent active',
        // Status
        sim_running:'⏳ Simulating...', ai_gen_running:'⏳ Generating (5-15s)...',
        // Senza squadra
        no_team:'No team',
        guest_desc:'Want to try without signing up?',
        guest_btn:'👤 Guest Mode',
        guest_banner:'👤 Playing as Guest — progress will not be saved.',
        guest_save_prompt:'Create a free account to save your career!',
        update_request_placeholder:'Describe your ideas, suggestions or bugs...',
        color_hair_label:'Hair Color',
        color_eye_label:'Eye Color',
        agente_min_chars:'Text too short.',
        conn_error:'Connection error. Please retry.',
        reg_err_username:'Invalid username.',
        tooltip_rename:'Rename career',
        guest_register_btn:'💾 Sign Up & Save',
    },
    de: {
        nav_dashboard:'🏠 Dashboard', nav_game:'⚽ Spielen', nav_career:'📊 Karriere',
        nav_transfer:'🔄 Transfer', nav_strutture:'🏗️ Einrichtungen',
        nav_classifica:'🏟️ Tabelle', nav_agente:'🤝 Agent',
        nav_notizie:'📰 Nachrichten', nav_skilltree:'🌟 Fähigkeiten',
        settings_title:'Einstellungen', settings_language:'🌐 Sprache',
        settings_navigate:'🗺️ Navigation', settings_main_menu:'Hauptmenü',
        settings_main_menu_sub:'Karriere wechseln oder neue erstellen',
        settings_feedback:'Update anfordern', settings_feedback_sub:'Vorschläge an Entwickler senden',
        settings_account:'👤 Konto', settings_logout:'Vollständiger Logout',
        settings_logout_sub:'Konto trennen und zur Anmeldung zurückkehren',
        auth_login:'Anmelden', auth_register:'Registrieren',
        auth_login_btn:'⚽ Anmelden', auth_register_btn:'🌟 Konto erstellen',
        auth_userauth_confirm_pw:'Passwort bestätigen',
        auth_forgot_link:'Passwort vergessen?', auth_forgot_btn:'📧 Anleitung senden',
        auth_back_login:'← Zurück zum Login', create_name_label:'Karriere-Name',
        create_player_label:'Spielername', create_gender:'Geschlecht', create_age:'Alter',
        create_nationality:'Nationalität', create_foot:'🦶 Bevorzugter Fuß',
        create_skin:'🧑 Hautfarbe', create_eyes:'👁️ Augenfarbe',
        create_hairstyle:'✂️ Frisur', create_haircolor:'🎨 Haarfarbe',
        create_start_btn:'🌟 Karriere starten!',
        cc_step1:'Identität', cc_step2:'Aussehen', cc_step3:'Stil', cc_step4:'Bestätigen',
        cc_step1_title:'Wer bist du?', cc_step1_sub:'Dein Name wird in die Fußballgeschichte eingehen',
        cc_step2_title:'Dein Aussehen', cc_step2_sub:'Passe deinen Spieler an',
        cc_step3_title:'Dein Stil', cc_step3_sub:'Wie spielst du auf dem Platz?',
        cc_step4_title:'Bereit für den Ruhm?', cc_step4_sub:'Überprüfe deine Angaben und starte',
        cc_back:'← Zurück', cc_next:'Weiter →',
        cc_role:'Rolle / Spezialisierung', cc_role_hint:'+5 zur Hauptwertung zu Karrierebeginn',
        gender_male:'⚽ Männlich', gender_female:'⚽ Weiblich',
        foot_right:'👟 Rechts', foot_left:'👟 Links',
        career_new:'➕ Neue Karriere', career_select_title:'Deine Karrieren',
        ai_describe_label:'✨ Beschreibe deinen Spieler',
        ai_generate_btn:'🎨 Bild generieren',
        dash_period:'Zeitraum', dash_money:'Budget', dash_goals:'⚽ Saisontore',
        dash_assists:'🎯 Saisonvorlagen', dash_facility:'Einrichtung',
        dash_tech_stats:'📊 Technische Werte', dash_phys_cond:'🔋 Körperliche Verfassung',
        stat_tiro:'Schuss', stat_velocita:'Geschwindigkeit', stat_dribbling:'Dribbling',
        stat_fisico:'Physis', stat_mentalita:'Mental',
        stat_piede_forte:'🦶 Starker Fuß', stat_piede_debole:'🦶 Schwacher Fuß',
        stat_skill_lvl:'🎯 Skill-Level',
        stat_energia:'Energie', stat_morale:'Moral', stat_popolarita:'Popularität',
        dash_season:'Saison', dash_season_full:'Saison', dash_age:'Alter',
        dash_latest_news:'📰 Neueste Nachrichten',
        dash_activities:'📋 Letzte Aktivitäten',
        dash_no_news:'Spiele den ersten Monat, um Nachrichten zu erhalten!',
        page_game:'⚽ Monat spielen', page_career:'📊 Karriere',
        page_transfer:'🔄 Transfer', page_strutture:'🏗️ Persönliche Einrichtung',
        page_agente:'🤝 Persönlicher Agent', page_notizie:'📰 Nachrichten',
        page_skilltree:'🌟 Fähigkeitsbaum',
        page_classifica:'🏟️ Tabelle',
        classifica_subtitle:'Live-Tabelle für jede Liga und den Champions Cup',
        transfer_subtitle:'Wähle dein nächstes Team. Bessere Teams = mehr Geld und Sichtbarkeit!',
        strutture_subtitle:'Investiere dein Geld, um deine Trainingseinrichtung zu verbessern.',
        agente_subtitle:'Ein guter Agent verhandelt bessere Gehälter und bringt Angebote von Top-Klubs',
        notizie_subtitle:'Die neuesten Updates deiner Karriere',
        skilltree_subtitle:'Erreiche Stat-Meilensteine, um einzigartige Upgrades freizuschalten',
        nav_achievements:'🏅 Auszeichnungen',
        view_card:'Karte',
        page_achievements:'🏅 Errungenschaften',
        achievements_subtitle:'Schließe Herausforderungen ab, um exklusive Abzeichen zu erhalten',
        achievements_unlocked:'freigeschaltet',
        ach_category_milestones:'🌟 Meilensteine',
        ach_category_scoring:'⚽ Tore & Vorlagen',
        ach_category_growth:'📈 Wachstum',
        ach_category_trophies:'🏆 Trophäen',
        ach_category_career:'💼 Karriere',
        ach_category_skills:'✨ Fähigkeiten',
        ach_category_facilities:'🏗️ Einrichtungen',
        ach_category_secrets:'🔒 Geheimnisse',
        dash_current_status:'📈 Aktueller Status',
        results_title:'📊 Monatliche Ergebnisse',
        results_close:'✅ Weiter',
        skill_pts_zero:'0 Skillpunkte verfügbar',
        st_strong_foot:'🦶 STARKER FUß', st_weak_foot:'🦶 SCHWACHER FUß', st_skill_lvl:'🎯 SKILL-LEVEL',
        st_strong_hint:'Verbessern mit: Mächtiger Schuss, Kurvenball, Rabona',
        st_weak_hint:'Verbessern mit: Kaltblütigkeit, Stürmerinstinkt',
        st_skill_hint:'Steigt durch Freischalten weiterer Fähigkeiten',
        register_username_hint:'Nur Buchstaben, Zahlen und _ (3-30 Zeichen)',
        register_pw_label:'Passwort (mind. 6 Zeichen)',
        forgot_desc:'Gib deine E-Mail ein und wir senden dir Anweisungen zum Zurücksetzen.',
        careers_limit:'Du hast das Limit von 5 Karrieren erreicht.',
        update_request_desc:'Schreibe deine Ideen, Vorschläge oder Fehlerberichte.',
        update_send_btn:'📨 Senden', update_sent_ok:'✅ Anfrage gesendet! Danke für dein Feedback.',
        btn_cancel:'Abbrechen',
        menu_change_career:'Karriere wechseln',
        menu_change_career_sub:'Zurück zur Karriereauswahl',
        menu_settings:'Einstellungen',
        menu_settings_sub:'Sprache, Konto, Tutorial',
        menu_logout:'Logout',
        menu_logout_sub:'Konto trennen',
        reg_err_userreg_err_email:'Bitte gib eine gültige E-Mail ein',
        reg_err_password:'Passwörter stimmen nicht überein',
        verify_title:'E-Mail bestätigen',
        verify_subtitle:'Wir haben einen 6-stelligen Code gesendet an',
        verify_btn:'✅ Bestätigen',
        verify_resend:'Code erneut senden',
        verify_resend_wait:'Erneut senden in',
        verify_err_code:'Bitte gib den 6-stelligen Code ein',
        verify_success:'Konto bestätigt! Willkommen!',
        ai_avatar_err_nodesc:'⚠️ Schreibe eine Beschreibung!',
        ai_avatar_err_nogen:'Generiere zuerst ein KI-Bild oder gehe zurück zum Standard-Modus.',
        ai_avatar_generating:'⏳ Generiere...',
        ai_avatar_ready:'✅ Bereit!',
        ai_avatar_regen:'🔄 Neu generieren',
        tab_lega:'📋 Liga', tab_champions:'🏆 Champions Cup', tab_calendario:'📅 Kalender',
        select_league:'Liga auswählen',
        stat_gol:'Tore', stat_assist:'Vorlagen', stat_voto:'Bewertung',
        stat_partite:'Spiele', stat_trofei:'Trophäen', stat_palloni:'Ballon d\'Or',
        match_win:'SIEG', match_draw:'UNENTSCHIEDEN', match_loss:'NIEDERLAGE',
        match_home:'🏠 Heim', match_away:'✈️ Auswärts',
        league_div1:'Erste Division', league_div2:'Zweite Division',
        career_trophies_title:'🏅 Trophäen & Ehrungen',
        pallone_top:'Ballon d\'Or Top',
        career_best_rating_label:'Beste Bewertung',
        classifica_legend_champion:'🥇 Meister',
        classifica_legend_top3:'🥉 Podium',
        classifica_legend_top4:'⭐ Champions Cup',
        classifica_legend_retro:'📉 Abstiegszone',
        injury_blocked:'Du bist verletzt, du kannst nicht physisch trainieren!',
        energy_blocked:'Energie bei null! Ruh dich aus, bevor du trainierst.',
        actions_max:'Du kannst maximal 3 Aktionen wählen!',
        ai_preview_hint:'Beschreibung schreiben<br>und Generieren drücken',
        obj_gol_stagione:'{0} Tore in dieser Saison schießen',
        obj_assist_stagione:'{0} Vorlagen in dieser Saison geben',
        obj_media_voto:'Durchschnittsbewertung ≥ 7.0 halten',
        obj_overall:'Overall {0} erreichen',
        obj_popolarita:'{0} Popularität erreichen',
        obj_complete:'Abgeschlossen',
        obj_header:'🎯 Saisonziele',
        obj_completed:'abgeschlossen',
        obj_title:'🎯 Saisonziele',
        register_pw_placeholder:'Passwort wählen (mind. 6 Zeichen)',
        register_pw2_placeholder:'Passwort wiederholen',
        default_career_name:'Meine Karriere',
        cc_nation_search:'🔍 Nation suchen...',
        auth_username:'Benutzername',
        auth_confirm_pw:'Passwort bestätigen',
        cc_role_bomber:'⚽ Stürmer', cc_role_bomber_sub:'+5 Schuss',
        cc_role_fantasista:'✨ Spielmacher', cc_role_fantasista_sub:'+5 Dribbling',
        cc_role_ala:'⚡ Außenstürmer', cc_role_ala_sub:'+5 Geschwindigkeit',
        cc_role_regista:'🧠 Mittelfeldspieler', cc_role_regista_sub:'+5 Mental',
        cc_role_tuttocampista:'💪 Allrounder', cc_role_tuttocampista_sub:'+5 Physis',
        conn_tooltip_retooltip_delete:'Löschen',
        btn_generate_img:'🎨 Bild generieren',
        default_career_injury_banner:'🩹 Du bist verletzt — <strong>{0} {1}</strong>. Du kannst nur ruhen, mental trainieren oder soziale Aktivitäten machen.',
        injury_mese:'verbleibender Monat', injury_mesi:'verbleibende Monate',
        energy_zero_banner:'⚡ Energie erschöpft — du kannst nicht physisch trainieren. Ruh dich zuerst aus!',
        energy_low_banner:'⚠️ Niedrige Energie ({0}) — hohes Verletzungsrisiko beim physischen Training!',
        res_section_training:'🏋️ Training',
        res_section_injuries:'🚑 Verletzungen',
        res_section_champions:'🏆 Champions Cup',
        res_section_matches:'⚽ Monats-Spiele',
        res_section_other:'📋 Sonstiges',
        champions_badge:'🌟 Champions Cup',
        pallone_badge:'🥇 Ballon d\'Or',
        transfer_toast:'✈️ Zu {0} transferiert!',
        transfer_confirm:'Zu {0} transferieren?',
        api_error_label:'Fehler: ',
        api_resp_invalid:'Ungültige Antwort',
        error_generic_msg:'Fehler. Bitte versuche es erneut.',
        error_unknown:'Unbekannter Fehler',
        conn_error_short:'Verbindungsfehler',
        server_resp_invalid:'Ungültige Serverantwort',
        ai_retry_msg:'⚠️ Versuche es erneut oder ändere die Beschreibung',
        ai_gender_changed:'⚠️ Geschlecht geändert — Bild neu generieren',
        prereq_unlock:'Schalte zuerst die Voraussetzung frei!',
        no_career:'Noch keine Karrieren.\nErstelle eine, um zu beginnen!',
        no_preview:'Keine\nVorschau',
        img_available:'Bild\nverfügbar',
        welcome_career:'Willkommen! Deine Karriere beginnt jetzt! ⚽',
        rename_career_prompt:'Neuer Karrierename:',
        delete_career_confirm:'Karriere "{0}" löschen?\nDiese Aktion kann nicht rückgängig gemacht werden!',
        career_deleted:'Karriere gelöscht',
        no_activity:'Noch keine Aktivität',
        loading:'⏳ Laden...',
        no_seasons:'Noch keine Saisons gespielt.',
        loading_teams:'Teams laden...',
        loading_leagues:'Ligen laden...',
        loading_champions:'Champions Cup laden...',
        error_loading_teams:'Fehler beim Laden der Teams.',
        no_agent:'Kein Agent verfügbar.',
        agent_empty:'👤 Du hast noch keinen Agenten. Stelle einen ein, um Einnahmen zu maximieren!',
        agent_choose:'Deinen Agenten wählen',
        no_matches:'Noch keine Spiele in dieser Liga.',
        champions_not_started_full:'🏆 Der Champions Cup hat noch nicht begonnen. Teams qualifizieren sich im September (Top 4 jeder Ersten Division).',
        bracket_no_data_full:'Noch keine Bracket-Daten verfügbar.',
        bracket_tbd:'Noch zu bestimmen',
        skill_maxed:'Fähigkeit bereits maximiert!',
        end_career_banner:'🏁 KARRIERE BEENDET!',
        struttura_current:'Aktuelle Einrichtung',
        struttura_buy:'🏗️ Kaufen',
        struttura_locked:'🔒 Sequenziell',
        struttura_no_funds:'💸 Unzureichende Mittel',
        ts_ovr:'⚽ Team-OVR', ts_salary:'💰 Gehalt', ts_pop:'🏟️ Popularität',
        salary_base:'basis', salary_buono:'fair', salary_ottimo:'gut', salary_alto:'hoch', salary_top:'top',
        transfer_current_team:'✅ Aktuelles Team',
        ag_level:'Level', ag_salary_bonus:'Gehalt', ag_ovr_bonus:'OVR-Transfer',
        ag_monthly_est:'Geschätzter monatlicher Bonus', ag_ovr_note:'(basierend auf deinem aktuellen OVR)',
        ag_req_prev:'Benötigt Lv.', ag_req_pop:'Benötigt Pop.', ag_req_money:'Fehlend',
        ag_hire_btn:'🤝 Einstellen', ag_upgrade_btn:'⬆️ Upgrade', ag_pop_free:'Frei',
        ag_owned:'✅ Aktiv',
        obj_morale_prize:'Moral',
        strutture_bonus_training:'Training',
        strutture_bonus_growth:'Wachstum',
        strutture_bonus_injury:'Verletzungen',
        game_choose_actions:'🎮 Wähle deine Aktionen',
        game_choose_sub:'Wähle 1-3 monatliche Aktionen. Deine Wahl beeinflusst Werte, Energie und Leistung.',
        game_play_sub:'Wähle bis zu 3 Aktionen für diesen Monat, dann simuliere die Spiele',
        play_btn:'⚽ Mindestens 1 Aktion wählen', play_btn_ready:'⚽ Monat spielen',
        career_subtitle:'Geschichte deiner Saisons — klicke auf ein Jahr für Details',
        career_tab_seasons:'📅 Saisons', career_tab_log:'📋 Spielprotokoll',
        career_ongoing:'laufend', career_no_data:'Keine Daten',
        career_best_rating:'BESTE BEWERTUNG',
        career_year_label:'Jahr',
        month_1:'Jan',month_2:'Feb',month_3:'Mär',month_4:'Apr',month_5:'Mai',month_6:'Jun',
        month_7:'Jul',month_8:'Aug',month_9:'Sep',month_10:'Okt',month_11:'Nov',month_12:'Dez',
        month_full_1:'Januar',month_full_2:'Februar',month_full_3:'März',month_full_4:'April',
        month_full_5:'Mai',month_full_6:'Juni',month_full_7:'Juli',month_full_8:'August',
        month_full_9:'September',month_full_10:'Oktober',month_full_11:'November',month_full_12:'Dezember',
        foot_sx:'Links', foot_dx:'Rechts',
        transfer_ovr_req:'🎯 OVR benötigt', transfer_btn_go:'✈️ Transferieren', transfer_agent_bonus:'🤝 Agent aktiv: -{0}% OVR-Anforderung für Transfer',
        transfer_no_teams:'Keine Teams in dieser Liga.',
        career_no_data_season:'Keine Daten für diese Saison verfügbar.',
        career_best_gol_label:'Bestes Spiel (Tore)', career_best_assist_label:'Bestes Spiel (Vorlagen)',
        agent_active_badge:'✅ Agent aktiv',
        sim_running:'⏳ Simuliere...', ai_gen_running:'⏳ Generiere (5-15s)...',
        no_team:'Kein Team',
        guest_desc:'Möchtest du ohne Registrierung ausprobieren?',
        guest_btn:'👤 Gast-Modus',
        guest_banner:'👤 Du spielst als Gast — Fortschritt wird nicht gespeichert.',
        guest_save_prompt:'Erstelle ein kostenloses Konto, um deine Karriere zu speichern!',
        update_request_placeholder:'Beschreibe deine Ideen, Vorschläge oder Fehler...',
        color_hair_label:'Haarfarbe',
        color_eye_label:'Augenfarbe',
        agente_min_chars:'Text zu kurz.',
        conn_error:'Verbindungsfehler. Bitte erneut versuchen.',
        reg_err_username:'Ungültiger Benutzername.',
        tooltip_rename:'Karriere umbenennen',
        guest_register_btn:'💾 Registrieren & Speichern',
    },
    es: {
        nav_dashboard:'🏠 Panel', nav_game:'⚽ Jugar', nav_career:'📊 Carrera',
        nav_transfer:'🔄 Transferencia', nav_strutture:'🏗️ Instalaciones',
        nav_classifica:'🏟️ Clasificación', nav_agente:'🤝 Agente',
        nav_notizie:'📰 Noticias', nav_skilltree:'🌟 Habilidades',
        settings_title:'Ajustes', settings_language:'🌐 Idioma',
        settings_navigate:'🗺️ Navegación', settings_main_menu:'Menú Principal',
        settings_main_menu_sub:'Cambiar carrera o crear una nueva',
        settings_feedback:'Solicitar una Actualización', settings_feedback_sub:'Enviar sugerencias a los desarrolladores',
        settings_account:'👤 Cuenta', settings_logout:'Cerrar Sesión Completo',
        settings_logout_sub:'Desconectar cuenta y volver al inicio de sesión',
        auth_login:'Iniciar sesión', auth_register:'Registrarse',
        auth_login_btn:'⚽ Iniciar sesión', auth_register_btn:'🌟 Crear Cuenta',
        auth_userauth_confirm_pw:'Confirmar Contraseña',
        auth_forgot_link:'¿Olvidaste tu contraseña?', auth_forgot_btn:'📧 Enviar Instrucciones',
        auth_back_login:'← Volver al Login', create_name_label:'Nombre de Carrera',
        create_player_label:'Nombre del Jugador', create_gender:'Género', create_age:'Edad',
        create_nationality:'Nacionalidad', create_foot:'🦶 Pie Preferido',
        create_skin:'🧑 Tono de Piel', create_eyes:'👁️ Color de Ojos',
        create_hairstyle:'✂️ Peinado', create_haircolor:'🎨 Color de Pelo',
        create_start_btn:'🌟 ¡Comenzar Carrera!',
        cc_step1:'Identidad', cc_step2:'Apariencia', cc_step3:'Estilo', cc_step4:'Confirmar',
        cc_step1_title:'¿Quién eres?', cc_step1_sub:'Tu nombre pasará a la historia del fútbol',
        cc_step2_title:'Tu apariencia', cc_step2_sub:'Personaliza tu jugador',
        cc_step3_title:'Tu estilo', cc_step3_sub:'¿Cómo juegas en el campo?',
        cc_step4_title:'¿Listo para la gloria?', cc_step4_sub:'Comprueba tus datos y empieza',
        cc_back:'← Atrás', cc_next:'Siguiente →',
        cc_role:'Rol / Especialización', cc_role_hint:'+5 a la stat principal al inicio de carrera',
        gender_male:'⚽ Masculino', gender_female:'⚽ Femenino',
        foot_right:'👟 Derecho', foot_left:'👟 Izquierdo',
        career_new:'➕ Nueva Carrera', career_select_title:'Tus Carreras',
        ai_describe_label:'✨ Describe tu jugador',
        ai_generate_btn:'🎨 Generar Imagen',
        dash_period:'Período', dash_money:'Presupuesto', dash_goals:'⚽ Goles de Temporada',
        dash_assists:'🎯 Asistencias de Temporada', dash_facility:'Instalación',
        dash_tech_stats:'📊 Stats Técnicas', dash_phys_cond:'🔋 Condición Física',
        stat_tiro:'Disparo', stat_velocita:'Velocidad', stat_dribbling:'Regate',
        stat_fisico:'Físico', stat_mentalita:'Mental',
        stat_piede_forte:'🦶 Pie Fuerte', stat_piede_debole:'🦶 Pie Débil',
        stat_skill_lvl:'🎯 Nivel de Habilidad',
        stat_energia:'Energía', stat_morale:'Moral', stat_popolarita:'Popularidad',
        dash_season:'Temporada', dash_season_full:'Temporada', dash_age:'Edad',
        dash_latest_news:'📰 Últimas Noticias',
        dash_activities:'📋 Actividad Reciente',
        dash_no_news:'¡Juega el primer mes para recibir noticias!',
        page_game:'⚽ Jugar el Mes', page_career:'📊 Carrera',
        page_transfer:'🔄 Transferencia', page_strutture:'🏗️ Instalaciones Personales',
        page_agente:'🤝 Agente Personal', page_notizie:'📰 Noticias',
        page_skilltree:'🌟 Árbol de Habilidades',
        page_classifica:'🏟️ Clasificación',
        classifica_subtitle:'Clasificación en tiempo real de cada liga y la Copa de Campeones',
        transfer_subtitle:'Elige tu próximo equipo. ¡Mejores equipos = más dinero y visibilidad!',
        strutture_subtitle:'Invierte tu dinero para mejorar tu instalación de entrenamiento.',
        agente_subtitle:'Un buen agente negocia mejores salarios y trae ofertas de los mejores clubes',
        notizie_subtitle:'Las últimas actualizaciones de tu carrera',
        skilltree_subtitle:'Alcanza hitos de estadísticas para desbloquear mejoras únicas',
        nav_achievements:'🏅 Logros',
        view_card:'Tarjeta',
        page_achievements:'🏅 Logros',
        achievements_subtitle:'Completa desafíos para desbloquear insignias exclusivas',
        achievements_unlocked:'desbloqueados',
        ach_category_milestones:'🌟 Hitos',
        ach_category_scoring:'⚽ Goles y Asistencias',
        ach_category_growth:'📈 Crecimiento',
        ach_category_trophies:'🏆 Trofeos',
        ach_category_career:'💼 Carrera',
        ach_category_skills:'✨ Habilidades',
        ach_category_facilities:'🏗️ Instalaciones',
        ach_category_secrets:'🔒 Secretos',
        dash_current_status:'📈 Estado Actual',
        results_title:'📊 Resultados del Mes',
        results_close:'✅ Continuar',
        skill_pts_zero:'0 puntos de habilidad disponibles',
        st_strong_foot:'🦶 PIE FUERTE', st_weak_foot:'🦶 PIE DÉBIL', st_skill_lvl:'🎯 NIVEL DE HABILIDAD',
        st_strong_hint:'Mejorar con: Disparo Potente, Vaselina, Rabona',
        st_weak_hint:'Mejorar con: Frialdad, Instinto Goleador',
        st_skill_hint:'Aumenta desbloqueando más habilidades en el árbol',
        register_username_hint:'Solo letras, números y _ (3-30 caracteres)',
        register_pw_label:'Contraseña (mín. 6 caracteres)',
        forgot_desc:'Introduce tu email y te enviaremos instrucciones para restablecer la contraseña.',
        careers_limit:'Has alcanzado el límite de 5 carreras.',
        update_request_desc:'Escribe tus ideas, sugerencias o reportes de errores.',
        update_send_btn:'📨 Enviar', update_sent_ok:'✅ ¡Solicitud enviada! Gracias por tu sugerencia.',
        btn_cancel:'Cancelar',
        menu_change_career:'Cambiar Carrera',
        menu_change_career_sub:'Volver a la selección de carreras',
        menu_settings:'Ajustes',
        menu_settings_sub:'Idioma, cuenta, tutorial',
        menu_logout:'Cerrar Sesión',
        menu_logout_sub:'Desconectar cuenta',
        reg_err_userreg_err_email:'Introduce un email válido',
        reg_err_password:'Las contraseñas no coinciden',
        verify_title:'Verificar Email',
        verify_subtitle:'Enviamos un código de 6 dígitos a',
        verify_btn:'✅ Verificar',
        verify_resend:'Reenviar código',
        verify_resend_wait:'Reenviar en',
        verify_err_code:'Introduce el código de 6 dígitos',
        verify_success:'¡Cuenta verificada! ¡Bienvenido!',
        ai_avatar_err_nodesc:'⚠️ ¡Escribe una descripción!',
        ai_avatar_err_nogen:'Primero genera una imagen IA, o vuelve al modo predeterminado.',
        ai_avatar_generating:'⏳ Generando...',
        ai_avatar_ready:'✅ ¡Listo!',
        ai_avatar_regen:'🔄 Regenerar',
        tab_lega:'📋 Liga', tab_champions:'🏆 Copa de Campeones', tab_calendario:'📅 Calendario',
        select_league:'Seleccionar una liga',
        stat_gol:'goles', stat_assist:'asistencias', stat_voto:'valoración',
        stat_partite:'partidos', stat_trofei:'trofeos', stat_palloni:'Balón de Oro',
        match_win:'VICTORIA', match_draw:'EMPATE', match_loss:'DERROTA',
        match_home:'🏠 Local', match_away:'✈️ Visitante',
        league_div1:'Primera División', league_div2:'Segunda División',
        career_trophies_title:'🏅 Trofeos y Honores',
        pallone_top:'Balón de Oro Top',
        career_best_rating_label:'Mejor Valoración',
        classifica_legend_champion:'🥇 Campeón',
        classifica_legend_top3:'🥉 Podio',
        classifica_legend_top4:'⭐ Copa de Campeones',
        classifica_legend_retro:'📉 Zona de descenso',
        injury_blocked:'¡Estás lesionado, no puedes entrenar físicamente!',
        energy_blocked:'¡Energía a cero! Descansa antes de entrenar.',
        actions_max:'¡Puedes elegir un máximo de 3 acciones!',
        ai_preview_hint:'Escribe una descripción<br>y pulsa Generar',
        obj_gol_stagione:'Marca {0} goles esta temporada',
        obj_assist_stagione:'Da {0} asistencias esta temporada',
        obj_media_voto:'Mantén una valoración media ≥ 7.0',
        obj_overall:'Alcanza Overall {0}',
        obj_popolarita:'Alcanza {0} de popularidad',
        obj_complete:'Completado',
        obj_header:'🎯 Objetivos de Temporada',
        obj_completed:'completados',
        obj_title:'🎯 Objetivos de Temporada',
        register_pw_placeholder:'Elige una contraseña (mín. 6 caracteres)',
        register_pw2_placeholder:'Repite la contraseña',
        default_career_name:'Mi Carrera',
        cc_nation_search:'🔍 Buscar nación...',
        auth_username:'Usuario',
        auth_confirm_pw:'Confirmar Contraseña',
        cc_role_bomber:'⚽ Delantero', cc_role_bomber_sub:'+5 Disparo',
        cc_role_fantasista:'✨ Mediapunta', cc_role_fantasista_sub:'+5 Regate',
        cc_role_ala:'⚡ Extremo', cc_role_ala_sub:'+5 Velocidad',
        cc_role_regista:'🧠 Centrocampista', cc_role_regista_sub:'+5 Mental',
        cc_role_tuttocampista:'💪 Todocampista', cc_role_tuttocampista_sub:'+5 Físico',
        conn_tooltip_retooltip_delete:'Eliminar',
        btn_generate_img:'🎨 Generar Imagen',
        default_career_injury_banner:'🩹 Estás lesionado — <strong>{0} {1}</strong>. Solo puedes descansar, entrenar mentalmente o hacer actividades sociales.',
        injury_mese:'mes restante', injury_mesi:'meses restantes',
        energy_zero_banner:'⚡ Energía agotada — no puedes entrenar físicamente. ¡Descansa primero!',
        energy_low_banner:'⚠️ Energía baja ({0}) — ¡alto riesgo de lesión en entrenamientos físicos!',
        res_section_training:'🏋️ Entrenamiento',
        res_section_injuries:'🚑 Lesiones',
        res_section_champions:'🏆 Copa de Campeones',
        res_section_matches:'⚽ Partidos del mes',
        res_section_other:'📋 Otros',
        champions_badge:'🌟 Copa de Campeones',
        pallone_badge:'🥇 Balón de Oro',
        transfer_toast:'✈️ ¡Transferido a {0}!',
        transfer_confirm:'¿Transferirse a {0}?',
        api_error_label:'Error: ',
        api_resp_invalid:'Respuesta no válida',
        error_generic_msg:'Error. Por favor, inténtalo de nuevo.',
        error_unknown:'Error desconocido',
        conn_error_short:'Error de conexión',
        server_resp_invalid:'Respuesta del servidor no válida',
        ai_retry_msg:'⚠️ Inténtalo de nuevo o modifica la descripción',
        ai_gender_changed:'⚠️ Género cambiado — regenera la imagen',
        prereq_unlock:'¡Desbloquea primero el prerequisito!',
        no_career:'Aún no hay carreras.\n¡Crea una para empezar!',
        no_preview:'Sin\nvista previa',
        img_available:'Imagen\ndisponible',
        welcome_career:'¡Bienvenido! ¡Tu carrera comienza ahora! ⚽',
        rename_career_prompt:'Nuevo nombre de carrera:',
        delete_career_confirm:'¿Eliminar carrera "{0}"?\n¡Esta acción no se puede deshacer!',
        career_deleted:'Carrera eliminada',
        no_activity:'Sin actividad aún',
        loading:'⏳ Cargando...',
        no_seasons:'Aún no se han jugado temporadas.',
        loading_teams:'Cargando equipos...',
        loading_leagues:'Cargando ligas...',
        loading_champions:'Cargando Copa de Campeones...',
        error_loading_teams:'Error al cargar equipos.',
        no_agent:'No hay agente disponible.',
        agent_empty:'👤 Aún no tienes agente. ¡Contrata uno para maximizar ganancias!',
        agent_choose:'Elige tu agente',
        no_matches:'Aún no se han jugado partidos en esta liga.',
        champions_not_started_full:'🏆 La Copa de Campeones aún no ha comenzado. Los equipos se clasifican en septiembre (top 4 de cada Primera División).',
        bracket_no_data_full:'Aún no hay datos del cuadro disponibles.',
        bracket_tbd:'Por determinar',
        skill_maxed:'¡Habilidad ya al máximo!',
        end_career_banner:'🏁 ¡FIN DE CARRERA!',
        struttura_current:'Instalación Actual',
        struttura_buy:'🏗️ Comprar',
        struttura_locked:'🔒 Secuencial',
        struttura_no_funds:'💸 Fondos insuficientes',
        ts_ovr:'⚽ OVR Equipo', ts_salary:'💰 Salario', ts_pop:'🏟️ Popularidad',
        salary_base:'base', salary_buono:'justo', salary_ottimo:'bueno', salary_alto:'alto', salary_top:'top',
        transfer_current_team:'✅ Equipo Actual',
        ag_level:'Nivel', ag_salary_bonus:'salario', ag_ovr_bonus:'OVR transferencia',
        ag_monthly_est:'Bonus mensual estimado', ag_ovr_note:'(basado en tu OVR actual)',
        ag_req_prev:'Requiere Nv.', ag_req_pop:'Necesita pop.', ag_req_money:'Faltan',
        ag_hire_btn:'🤝 Contratar', ag_upgrade_btn:'⬆️ Mejorar', ag_pop_free:'Libre',
        ag_owned:'✅ Activo',
        obj_morale_prize:'moral',
        strutture_bonus_training:'Entrenamiento',
        strutture_bonus_growth:'Crecimiento',
        strutture_bonus_injury:'Lesiones',
        game_choose_actions:'🎮 Elige tus Acciones',
        game_choose_sub:'Selecciona 1-3 acciones mensuales. Tus elecciones afectan stats, energía y rendimiento.',
        game_play_sub:'Elige hasta 3 acciones para este mes, luego simula los partidos',
        play_btn:'⚽ Selecciona al menos 1 acción', play_btn_ready:'⚽ Jugar Mes',
        career_subtitle:'Historial de tus temporadas — haz clic en un año para detalles',
        career_tab_seasons:'📅 Temporadas', career_tab_log:'📋 Registro de Partidos',
        career_ongoing:'en curso', career_no_data:'Sin datos',
        career_best_rating:'MEJOR VALORACIÓN',
        career_year_label:'Año',
        month_1:'Ene',month_2:'Feb',month_3:'Mar',month_4:'Abr',month_5:'May',month_6:'Jun',
        month_7:'Jul',month_8:'Ago',month_9:'Sep',month_10:'Oct',month_11:'Nov',month_12:'Dic',
        month_full_1:'Enero',month_full_2:'Febrero',month_full_3:'Marzo',month_full_4:'Abril',
        month_full_5:'Mayo',month_full_6:'Junio',month_full_7:'Julio',month_full_8:'Agosto',
        month_full_9:'Septiembre',month_full_10:'Octubre',month_full_11:'Noviembre',month_full_12:'Diciembre',
        foot_sx:'Izquierdo', foot_dx:'Derecho',
        transfer_ovr_req:'🎯 OVR requerido', transfer_btn_go:'✈️ Transferirse', transfer_agent_bonus:'🤝 Agente activo: -{0}% OVR requerido para transferencia',
        transfer_no_teams:'No hay equipos en esta liga.',
        career_no_data_season:'No hay datos disponibles para esta temporada.',
        career_best_gol_label:'Mejor partido (Goles)', career_best_assist_label:'Mejor partido (Asistencias)',
        agent_active_badge:'✅ Agente activo',
        sim_running:'⏳ Simulando...', ai_gen_running:'⏳ Generando (5-15s)...',
        no_team:'Sin equipo',
        guest_desc:'¿Quieres probar sin registrarte?',
        guest_btn:'👤 Modo Invitado',
        guest_banner:'👤 Jugando como Invitado — el progreso no se guardará.',
        guest_save_prompt:'¡Crea una cuenta gratuita para guardar tu carrera!',
        update_request_placeholder:'Describe tus ideas, sugerencias o errores...',
        color_hair_label:'Color de Pelo',
        color_eye_label:'Color de Ojos',
        agente_min_chars:'Texto demasiado corto.',
        conn_error:'Error de conexión. Por favor, inténtalo de nuevo.',
        reg_err_username:'Nombre de usuario no válido.',
        tooltip_rename:'Renombrar carrera',
        guest_register_btn:'💾 Registrarse y Guardar',
    }
}
let currentLang = localStorage.getItem('gs_lang') || 'it';
let _cachedCareers = null; // cache for re-rendering career list on lang change

function _t(key) {
    return TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS['it']?.[key] ?? key;
}

// ── NEWS: no client-side translation needed ──────────────────────────────────
// The backend (extra.php) returns news already in the correct language.
// News are stored bilingually in the DB and served in the right language via X-Lang header.
let _rawNewsData = null;
async function _translateNewsItems(newsArray /*, targetLang */) {
    return newsArray; // passthrough — translation handled server-side
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('gs_lang', lang);
    // Update lang buttons in settings modal
    ['it','en','de','es'].forEach(l => document.getElementById('lang-btn-'+l)?.classList.toggle('active', lang === l));
    // Update header flag switcher - show flag + code for clarity
    const flagEl = document.getElementById('lang-switcher-flag');
    const flagMap  = { it:'🇮🇹', en:'🇬🇧', de:'🇩🇪', es:'🇪🇸' };
    const codeMap  = { it:'IT',   en:'EN',   de:'DE',   es:'ES'   };
    if (flagEl) {
        flagEl.innerHTML = `${flagMap[lang] || '🇮🇹'} <span style="font-size:0.7rem;font-weight:700;letter-spacing:0.5px;">${codeMap[lang] || 'IT'}</span>`;
    }
    ['it','en','de','es'].forEach(l => document.getElementById('lang-sw-'+l)?.classList.toggle('active', lang === l));
    // Update html lang attribute for accessibility
    document.getElementById('html-root')?.setAttribute('lang', lang);
    // Apply all data-i18n elements
    _applyTranslations();
    // Update nav buttons
    _updateNavLabels();
    attachTooltips();
    // Re-render current page text
    if (currentPlayer) {
        _buildActionsGrid();  // Rebuild with updated language
        renderGame();
        renderDashboard(); // also reloads dashboard news in new language
        // Se la pagina notizie è visibile, ricarica con la nuova lingua
        const notizieEl = document.getElementById('notizie-page');
        if (notizieEl && notizieEl.classList.contains('active')) {
            loadNotizie();
        }
        // Ricarica achievements se visibile
        const achEl = document.getElementById('achievements-page');
        if (achEl && achEl.classList.contains('active')) {
            loadAchievements();
        }
        // Ricarica le altre pagine con testo dinamico se visibili
        const activePageEl = document.querySelector('.page.active');
        const activePage = activePageEl?.id?.replace('-page', '');
        if (activePage === 'career')    loadCareer();
        if (activePage === 'strutture') loadStrutture();
        if (activePage === 'agente')    loadAgente();
        if (activePage === 'skilltree') loadSkillTree();
        if (activePage === 'transfer')  loadTransfer();
        if (activePage === 'classifica') loadClassifica();
        // Also re-render heatmap if calendar tab is active inside career page
        if (activePage === 'career') {
            loadCalendarioTab();
            // Reload analytics chart labels and career log headers
            loadCareerAnalytics();
            if (document.getElementById('career-log-tab')?.classList.contains('active')) loadCareerLog();
        }
    } else {
        // No career selected — re-render career list if visible (language change on select screen)
        if (_cachedCareers !== null) {
            renderCareerList(_cachedCareers);
        }
    }
    // Update tutorial language if active
    if (window.GS_Tutorial?.updateLang) GS_Tutorial.updateLang();
}

// Reload dashboard news from server in current language
function _applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const txt = _t(key);
        if (txt) el.textContent = txt;
    });
    // Handle placeholder translations
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const txt = _t(key);
        if (txt) el.placeholder = txt;
    });
    // Handle title/aria-label translations
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const txt = _t(key);
        if (txt) el.title = txt;
    });
    // Placeholders dinamici
    const aiPlaceholder = document.getElementById('ai-avatar-placeholder');
    if (aiPlaceholder) {
        const aiHints = {
            it: 'es: capelli ricci neri, occhi verdi, carnagione scura',
            en: 'e.g. curly black hair, green eyes, dark complexion',
            de: 'z.B. lockiges schwarzes Haar, grüne Augen, dunkle Haut',
            es: 'ej: pelo rizado negro, ojos verdes, tez oscura',
        };
        aiPlaceholder.placeholder = aiHints[currentLang] || aiHints.it;
    }
    const nationSearch = document.getElementById('cc-nation-search-input');
    if (nationSearch) {
        nationSearch.placeholder = _t('cc_nation_search');
    }
    // Ricostruisci lista nazioni con nuovo ordinamento linguistico
    if (document.getElementById('cc-nation-list')) {
        ccBuildNationList(nationSearch?.value || '');
        // Aggiorna il testo del trigger con la lingua corrente
        const curKey = document.getElementById('c-nationality')?.value || 'Italy';
        const curNat = CC_ALL_NATIONS.find(n => n.key === curKey);
        if (curNat) {
            const tName = document.getElementById('cc-trigger-name');
            if (tName) tName.textContent = ({en:curNat.key.replace(/_/g,' '),it:curNat.key_it,de:curNat.key_de||curNat.key_it,es:curNat.key_es||curNat.key_it})[currentLang]||curNat.key_it;
        }
    }
    const feedbackArea = document.getElementById('update-request-text');
    if (feedbackArea) {
        feedbackArea.placeholder = _t('update_request_placeholder');
    }
    const pwField = document.getElementById('r-password');
    if (pwField) pwField.placeholder = _t('register_pw_placeholder');
    const pw2Field = document.getElementById('r-password2');
    if (pw2Field) pw2Field.placeholder = _t('register_pw2_placeholder');
}

function _updateNavLabels() {
    const map = {
        dashboard: _t('nav_dashboard'), game: _t('nav_game'), career: _t('nav_career'),
        transfer: _t('nav_transfer'), strutture: _t('nav_strutture'),
        classifica: _t('nav_classifica'), agente: _t('nav_agente'),
        notizie: _t('nav_notizie'), skilltree: _t('nav_skilltree'), achievements: _t('nav_achievements'),
    };
    document.querySelectorAll('#main-nav button[data-page]').forEach(btn => {
        const page = btn.dataset.page;
        if (map[page]) btn.textContent = map[page];
    });
}

// Settings modal
function openSettings() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    // Sync lang buttons
    ['it','en','de','es'].forEach(l => document.getElementById('lang-btn-'+l)?.classList.toggle('active', currentLang === l));
    // Show/hide home button based on page
    const inGame = !!currentCareerId;
    const homeBtn = document.getElementById('settings-btn-home');
    if (homeBtn) homeBtn.style.display = inGame ? 'flex' : 'none';
    _applyTranslations();
    modal.classList.add('active');
}
function closeSettings() {
    document.getElementById('settings-modal')?.classList.remove('active');
}

// ── SVG CAPELLI ──
function buildHairSVG(style, hc, s) {
    // Proporzioni allineate alla nuova testa: cy=0.40, ry=0.24 → top=0.16, sides=0.16-0.64
    const cx = s / 2;
    if (style === 'bald' || !hc) return '';
    switch (style) {
        case 'short':
            // Copertura top+tempie, niente che scende oltre le orecchie
            return `<path d="M${s*0.26} ${s*0.30}\n                Q${s*0.24} ${s*0.13} ${cx} ${s*0.11}\n                Q${s*0.76} ${s*0.13} ${s*0.74} ${s*0.30}\n                Q${s*0.68} ${s*0.22} ${s*0.60} ${s*0.24}\n                Q${cx} ${s*0.20} ${s*0.40} ${s*0.24}\n                Q${s*0.32} ${s*0.22} ${s*0.26} ${s*0.30}Z"\n                fill="${hc}"/>`;
        case 'medium':
            return `<path d="M${s*0.24} ${s*0.34}\n                Q${s*0.22} ${s*0.15} ${s*0.28} ${s*0.11}\n                Q${cx} ${s*0.07} ${s*0.72} ${s*0.11}\n                Q${s*0.78} ${s*0.15} ${s*0.76} ${s*0.34}\n                Q${s*0.70} ${s*0.26} ${s*0.62} ${s*0.28}\n                Q${cx} ${s*0.24} ${s*0.38} ${s*0.28}\n                Q${s*0.30} ${s*0.26} ${s*0.24} ${s*0.34}Z" fill="${hc}"/>\n                <path d="M${s*0.22} ${s*0.32} Q${s*0.18} ${s*0.42} ${s*0.20} ${s*0.51} Q${s*0.24} ${s*0.53} ${s*0.26} ${s*0.44} Q${s*0.26} ${s*0.36} ${s*0.22} ${s*0.32}Z" fill="${hc}"/>\n                <path d="M${s*0.78} ${s*0.32} Q${s*0.82} ${s*0.42} ${s*0.80} ${s*0.51} Q${s*0.76} ${s*0.53} ${s*0.74} ${s*0.44} Q${s*0.74} ${s*0.36} ${s*0.78} ${s*0.32}Z" fill="${hc}"/>`;
        case 'long':
            return `<path d="M${s*0.26} ${s*0.32}\n                Q${s*0.24} ${s*0.13} ${s*0.28} ${s*0.09}\n                Q${cx} ${s*0.05} ${s*0.72} ${s*0.09}\n                Q${s*0.76} ${s*0.13} ${s*0.74} ${s*0.32}\n                Q${s*0.68} ${s*0.24} ${s*0.60} ${s*0.26}\n                Q${cx} ${s*0.22} ${s*0.40} ${s*0.26}\n                Q${s*0.32} ${s*0.24} ${s*0.26} ${s*0.32}Z" fill="${hc}"/>\n                <path d="M${s*0.20} ${s*0.34} C${s*0.14} ${s*0.46} ${s*0.12} ${s*0.58} ${s*0.14} ${s*0.70} C${s*0.16} ${s*0.80} ${s*0.20} ${s*0.86} ${s*0.26} ${s*0.88} C${s*0.30} ${s*0.90} ${s*0.32} ${s*0.84} ${s*0.30} ${s*0.78} C${s*0.27} ${s*0.68} ${s*0.25} ${s*0.56} ${s*0.25} ${s*0.44} Q${s*0.24} ${s*0.38} ${s*0.20} ${s*0.34}Z" fill="${hc}"/>\n                <path d="M${s*0.80} ${s*0.34} C${s*0.86} ${s*0.46} ${s*0.88} ${s*0.58} ${s*0.86} ${s*0.70} C${s*0.84} ${s*0.80} ${s*0.80} ${s*0.86} ${s*0.74} ${s*0.88} C${s*0.70} ${s*0.90} ${s*0.68} ${s*0.84} ${s*0.70} ${s*0.78} C${s*0.73} ${s*0.68} ${s*0.75} ${s*0.56} ${s*0.75} ${s*0.44} Q${s*0.76} ${s*0.38} ${s*0.80} ${s*0.34}Z" fill="${hc}"/>`;
        case 'curly':
            return `<path d="M${s*0.28} ${s*0.32}\n                Q${s*0.22} ${s*0.20} ${s*0.28} ${s*0.13}\n                Q${cx} ${s*0.05} ${s*0.72} ${s*0.13}\n                Q${s*0.78} ${s*0.20} ${s*0.72} ${s*0.32}\n                Q${s*0.66} ${s*0.24} ${cx} ${s*0.22}\n                Q${s*0.34} ${s*0.24} ${s*0.28} ${s*0.32}Z" fill="${hc}"/>\n                <circle cx="${s*0.22}" cy="${s*0.28}" r="${s*0.08}" fill="${hc}"/>\n                <circle cx="${s*0.78}" cy="${s*0.28}" r="${s*0.08}" fill="${hc}"/>\n                <circle cx="${s*0.32}" cy="${s*0.12}" r="${s*0.07}" fill="${hc}"/>\n                <circle cx="${s*0.68}" cy="${s*0.12}" r="${s*0.07}" fill="${hc}"/>\n                <circle cx="${cx}" cy="${s*0.08}" r="${s*0.07}" fill="${hc}"/>\n                <circle cx="${s*0.44}" cy="${s*0.10}" r="${s*0.055}" fill="${hc}"/>\n                <circle cx="${s*0.56}" cy="${s*0.10}" r="${s*0.055}" fill="${hc}"/>`;
        case 'afro':
            return `<ellipse cx="${cx}" cy="${s*0.18}" rx="${s*0.30}" ry="${s*0.18}" fill="${hc}"/>\n                <ellipse cx="${s*0.20}" cy="${s*0.24}" rx="${s*0.10}" ry="${s*0.12}" fill="${hc}"/>\n                <ellipse cx="${s*0.80}" cy="${s*0.24}" rx="${s*0.10}" ry="${s*0.12}" fill="${hc}"/>\n                <ellipse cx="${s*0.26}" cy="${s*0.34}" rx="${s*0.07}" ry="${s*0.08}" fill="${hc}"/>\n                <ellipse cx="${s*0.74}" cy="${s*0.34}" rx="${s*0.07}" ry="${s*0.08}" fill="${hc}"/>`;
        case 'mohawk':
            return `<path d="M${s*0.42} ${s*0.32}\n                C${s*0.40} ${s*0.22} ${s*0.42} ${s*0.07} ${cx} ${s*0.02}\n                C${s*0.58} ${s*0.07} ${s*0.60} ${s*0.22} ${s*0.58} ${s*0.32}\n                Q${cx} ${s*0.36} ${s*0.42} ${s*0.32}Z" fill="${hc}"/>`;
        case 'bun':
            return `<path d="M${s*0.26} ${s*0.30}\n                Q${s*0.24} ${s*0.13} ${s*0.28} ${s*0.11}\n                Q${cx} ${s*0.07} ${s*0.72} ${s*0.11}\n                Q${s*0.76} ${s*0.13} ${s*0.74} ${s*0.30}\n                Q${s*0.68} ${s*0.22} ${s*0.60} ${s*0.24}\n                Q${cx} ${s*0.20} ${s*0.40} ${s*0.24}\n                Q${s*0.32} ${s*0.22} ${s*0.26} ${s*0.30}Z" fill="${hc}"/>\n                <circle cx="${cx}" cy="${s*0.06}" r="${s*0.10}" fill="${hc}"/>`;
        default:
            return '';
    }
}

function hairStyleSwatchSVG(styleId, size = 44) {
    const s = size, cx = s / 2;
    const skin = '#C68642';
    const hc = styleId === 'bald' ? null : '#3d2b1f';
    const hair = buildHairSVG(styleId, hc, s);
    return `<svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="${cx}" cy="${s*0.56}" rx="${s*0.26}" ry="${s*0.28}" fill="${skin}"/>
        ${hair}
        <circle cx="${s*0.41}" cy="${s*0.52}" r="${s*0.035}" fill="#333"/>
        <circle cx="${s*0.59}" cy="${s*0.52}" r="${s*0.035}" fill="#333"/>
        <path d="M${s*0.42} ${s*0.65} Q${cx} ${s*0.68} ${s*0.58} ${s*0.65}" stroke="#c0706c" stroke-width="1.0" fill="none" stroke-linecap="round"/>
    </svg>`;
}

function renderAvatarSVG(skinVal, hairStyle, eyeColor, gender, size = 120, hairColor = null) {
    const skin = SKIN_COLORS[skinVal] || skinVal || '#C68642';
    const eye  = (typeof eyeColor === 'string' && eyeColor.startsWith('#')) ? eyeColor : '#5C3317';
    const hc   = hairColor || selectedHairColor || '#1a1a1a';
    const s    = size, cx = s / 2;
    const styleKey = hairStyle ? hairStyle.split('_')[0] : 'short';
    const hairSVG = buildHairSVG(styleKey, styleKey === 'bald' ? null : hc, s);

    // Tonalità pelle derivate
    const hexToRgb = h => { h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; };
    const shade = (h, d) => { const [r,g,b]=hexToRgb(h||'#C68642'); return '#'+[r+d,g+d,b+d].map(v=>'0'+Math.max(0,Math.min(255,v)).toString(16)).map(s=>s.slice(-2)).join(''); };
    const skinDark  = shade(skin, -35);
    const skinShirt = gender === 'female' ? '#c0397a' : '#1565c0';

    // Proporzioni: testa più compatta, niente rect-collo separato
    // Testa: cy=0.40, ry=0.24 → top=0.16, bottom=0.64 (niente spazio doppio mento)
    // Collo+spalle: path continuo dalla base della testa
    // Naso: piccolo hint triangolare
    const headCY = s*0.40, headRX = s*0.24, headRY = s*0.24;
    const eyeY   = s*0.38;
    const noseY  = s*0.49;
    const mouthY = s*0.56;  // bocca più vicina al centro → meno spazio sotto
    const chinY  = s*0.64;  // = bottom della testa

    // uid to avoid duplicate clipPath ids when multiple avatars on page
    const _uid = s + '_' + Math.floor(Math.random()*9999);
    return `<svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg" style="overflow:hidden;display:block">
        <defs>
          <clipPath id="hairClip-${_uid}">
            <!-- Allow hair above head + clip to sides so no stray strands on bg -->
            <rect x="${cx - s*0.38}" y="0" width="${s*0.76}" height="${headCY + headRY*0.3}"/>
          </clipPath>
          <clipPath id="avatarBodyClip-${_uid}">
            <rect x="0" y="0" width="${s}" height="${s}"/>
          </clipPath>
        </defs>
        <!-- Spalle / maglietta -->
        <path d="M${s*0.10} ${s*1.00} L${s*0.10} ${s*0.80} Q${cx} ${s*0.70} ${s*0.90} ${s*0.80} L${s*0.90} ${s*1.00}Z" fill="${skinShirt}"/>
        <path d="M${s*0.10} ${s*0.80} Q${cx} ${s*0.70} ${s*0.90} ${s*0.80}" stroke="${skinShirt}" stroke-width="${s*0.01}" fill="none"/>
        <!-- Collo: path continuo senza stacco -->
        <path d="M${s*0.43} ${chinY} L${s*0.40} ${s*0.78} Q${cx} ${s*0.76} ${s*0.60} ${s*0.78} L${s*0.57} ${chinY}Z" fill="${skin}"/>
        <!-- Testa: forma ellittica con chin definito (nessun doppio mento) -->
        <ellipse cx="${cx}" cy="${headCY}" rx="${headRX}" ry="${headRY}" fill="${skin}"/>
        <!-- Leggera ombra laterale sul viso -->
        <ellipse cx="${s*0.74}" cy="${headCY}" rx="${s*0.07}" ry="${headRY*0.85}" fill="${skinDark}" opacity="0.15"/>
        <!-- Capelli clippati: nessuna ciocca fuori dalla testa -->
        <g clip-path="url(#hairClip-${_uid})">${hairSVG}</g>
        <!-- Sopracciglia -->
        <path d="M${s*0.34} ${s*0.335} Q${s*0.41} ${s*0.305} ${s*0.47} ${s*0.335}" stroke="${hc||'#555'}" stroke-width="${s*0.017}" fill="none" stroke-linecap="round"/>
        <path d="M${s*0.53} ${s*0.335} Q${s*0.59} ${s*0.305} ${s*0.66} ${s*0.335}" stroke="${hc||'#555'}" stroke-width="${s*0.017}" fill="none" stroke-linecap="round"/>
        <!-- Occhi bianchi -->
        <ellipse cx="${s*0.40}" cy="${eyeY}" rx="${s*0.055}" ry="${s*0.055}" fill="white"/>
        <ellipse cx="${s*0.60}" cy="${eyeY}" rx="${s*0.055}" ry="${s*0.055}" fill="white"/>
        <!-- Iride + pupilla -->
        <circle cx="${s*0.40}" cy="${eyeY}" r="${s*0.032}" fill="${eye}"/>
        <circle cx="${s*0.60}" cy="${eyeY}" r="${s*0.032}" fill="${eye}"/>
        <circle cx="${s*0.40}" cy="${eyeY}" r="${s*0.016}" fill="#111"/>
        <circle cx="${s*0.60}" cy="${eyeY}" r="${s*0.016}" fill="#111"/>
        <!-- Riflessi occhi -->
        <circle cx="${s*0.413}" cy="${eyeY-s*0.012}" r="${s*0.007}" fill="white" opacity="0.9"/>
        <circle cx="${s*0.613}" cy="${eyeY-s*0.012}" r="${s*0.007}" fill="white" opacity="0.9"/>
        <!-- Naso: piccolo e discreto -->
        <path d="M${s*0.48} ${noseY-s*0.04} Q${cx} ${noseY} ${s*0.52} ${noseY-s*0.04}" stroke="${skinDark}" stroke-width="${s*0.012}" fill="none" stroke-linecap="round"/>
        <path d="M${s*0.455} ${noseY} Q${cx} ${noseY+s*0.015} ${s*0.545} ${noseY}" stroke="${skinDark}" stroke-width="${s*0.011}" fill="none" stroke-linecap="round"/>
        <!-- Bocca: sorriso naturale -->
        <path d="M${s*0.41} ${mouthY} Q${cx} ${mouthY+s*0.035} ${s*0.59} ${mouthY}" stroke="#c0706c" stroke-width="${s*0.013}" fill="none" stroke-linecap="round"/>
    </svg>`;
}

// ── SKIN TONE PICKER ──
const SKIN_TONES = [
    { hex: '#FDDBB4', label: 'Molto chiara' },
    { hex: '#F5C89A', label: 'Chiara' },
    { hex: '#EDB882', label: 'Chiara calda' },
    { hex: '#E8A96E', label: 'Chiara dorata' },
    { hex: '#C68642', label: 'Media' },
    { hex: '#B5722E', label: 'Media scura' },
    { hex: '#A0572A', label: 'Ambra' },
    { hex: '#8D5524', label: 'Marrone' },
    { hex: '#5C3317', label: 'Marrone scuro' },
    { hex: '#3B1A08', label: 'Molto scura' },
];

function buildSkinTonePicker() {
    const wrap = document.getElementById('skin-tone-picker');
    if (!wrap) return;
    wrap.innerHTML = SKIN_TONES.map(t => {
        const isActive = selectedSkin === t.hex;
        return `<div class="skin-tone-swatch ${isActive ? 'active' : ''}"
            title="${t.label}" style="background:${t.hex}"
            onclick="selectSkinTone('${t.hex}',this)"></div>`;
    }).join('');
}

function selectSkinTone(hex, el) {
    selectedSkin = hex;
    document.querySelectorAll('.skin-tone-swatch').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    updateAvatar();
}

// ── HAIR PICKER ──
function buildHairPicker() {
    const styleEl = document.getElementById('hair-style-picker');
    if (styleEl) {
        styleEl.innerHTML = HAIR_STYLE_DEFS.map(h => {
            const isActive = h.id === selectedHairStyle;
            const label = (typeof h.label === 'object') ? (h.label[currentLang] || h.label.en || h.label.it) : h.label;
            return `<div class="hair-swatch ${isActive ? 'active' : ''}"
                data-val="${h.id}" title="${label}"
                onclick="selectHairStyle('${h.id}', this)">
                ${hairStyleSwatchSVG(h.id, 44)}
                <span class="hair-swatch-label">${label}</span>
            </div>`;
        }).join('');
    }
    buildHairColorPicker();
}

function buildHairColorPicker() {
    const colorEl = document.getElementById('hair-color-picker');
    if (!colorEl) return;
    colorEl.innerHTML = `
        <div style="position:relative;display:inline-block">
            <button class="cp-open-btn" id="cp-hair-btn"
                onclick="openColorPicker('hair')"
                style="background:${selectedHairColor}">
                <span class="cp-btn-ring"></span>
            </button>
            ${buildColorPickerHTML('hair', selectedHairColor, HAIR_PRESET_COLORS)}
        </div>
        <span class="cp-open-label">${_t('color_hair_label')}</span>`;
    requestAnimationFrame(() => {
        const [h,s,v] = hexToHSV(selectedHairColor);
        drawGradientCanvas('cp-hair-grad', h);
        drawHueSlider('cp-hair-hue');
        updateGradCursor('hair', s, 100 - v);
        updateHueCursor('hair', (h / 360) * 100);
    });
}

function selectHairStyle(val, el) {
    selectedHairStyle = val;
    document.querySelectorAll('#hair-style-picker .hair-swatch').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    updateAvatar();
}

function updateAvatar() {
    const gender = _ccGender || document.getElementById('c-gender')?.value || 'male';
    const el = document.getElementById('avatar-preview');
    if (el) el.innerHTML = renderAvatarSVG(selectedSkin, selectedHairStyle, selectedEye, gender, 110, selectedHairColor);
}

// ── EYE PICKER ──
function buildEyePicker() {
    const el = document.getElementById('eye-picker-wrap');
    if (!el) return;
    el.innerHTML = `
        <div style="position:relative;display:inline-block">
            <button class="cp-open-btn" id="cp-eye-btn"
                onclick="openColorPicker('eye')"
                style="background:${selectedEye}">
                <span class="cp-btn-ring"></span>
            </button>
            ${buildColorPickerHTML('eye', selectedEye, EYE_PRESETS)}
        </div>
        <span class="cp-open-label">${_t('color_eye_label')}</span>`;
    requestAnimationFrame(() => {
        const [h,s,v] = hexToHSV(selectedEye);
        drawGradientCanvas('cp-eye-grad', h);
        drawHueSlider('cp-eye-hue');
        updateGradCursor('eye', s, 100 - v);
        updateHueCursor('eye', (h / 360) * 100);
    });
}

// ── CUSTOM COLOR PICKER (shared) ──
let cpEyeOpen = false, cpHairOpen = false;
let cpEyeHue = 0, cpHairHue = 0;

function hexToHSV(hex) {
    let r = parseInt(hex.slice(1,3),16)/255;
    let g = parseInt(hex.slice(3,5),16)/255;
    let b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let h = 0, s = max === 0 ? 0 : d/max, v = max;
    if (d !== 0) {
        if (max===r) h = ((g-b)/d % 6);
        else if (max===g) h = (b-r)/d + 2;
        else h = (r-g)/d + 4;
        h = Math.round(h*60); if (h<0) h+=360;
    }
    return [h, Math.round(s*100), Math.round(v*100)];
}

function hsvToHex(h, s, v) {
    s /= 100; v /= 100;
    const f = n => { const k=(n+h/60)%6; return v-v*s*Math.max(0,Math.min(k,4-k,1)); };
    return '#'+[f(5),f(3),f(1)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
}

function drawGradientCanvas(canvasId, hue) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = `hsl(${hue},100%,50%)`;
    ctx.fillRect(0,0,W,H);
    const wGrad = ctx.createLinearGradient(0,0,W,0);
    wGrad.addColorStop(0,'rgba(255,255,255,1)');
    wGrad.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = wGrad; ctx.fillRect(0,0,W,H);
    const bGrad = ctx.createLinearGradient(0,0,0,H);
    bGrad.addColorStop(0,'rgba(0,0,0,0)');
    bGrad.addColorStop(1,'rgba(0,0,0,1)');
    ctx.fillStyle = bGrad; ctx.fillRect(0,0,W,H);
}

function drawHueSlider(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0,0,canvas.width,0);
    const stops = [0,'#ff0000',1/6,'#ffff00',2/6,'#00ff00',3/6,'#00ffff',4/6,'#0000ff',5/6,'#ff00ff',1,'#ff0000'];
    for (let i=0;i<stops.length;i+=2) grad.addColorStop(stops[i], stops[i+1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,canvas.width,canvas.height);
}

function openColorPicker(type) {
    const isEye = type === 'eye';
    const otherId = isEye ? 'hair' : 'eye';
    const otherPopup = document.getElementById(`cp-${otherId}-popup`);
    if (otherPopup) otherPopup.style.display = 'none';
    if (isEye) cpHairOpen=false; else cpEyeOpen=false;

    const popup = document.getElementById(`cp-${type}-popup`);
    if (!popup) return;
    const isOpen = isEye ? cpEyeOpen : cpHairOpen;
    if (isOpen) {
        popup.style.display = 'none';
        if (isEye) cpEyeOpen=false; else cpHairOpen=false;
        return;
    }
    popup.style.display = 'block';
    if (isEye) cpEyeOpen=true; else cpHairOpen=true;

    const hex = isEye ? selectedEye : selectedHairColor;
    const [h,s,v] = hexToHSV(hex);
    if (isEye) cpEyeHue=h; else cpHairHue=h;
    initColorPickerCanvas(type, h, s, v, hex);

    setTimeout(() => {
        document.addEventListener('click', (e) => closePickerOutside(e, type), {once:true, capture:true});
    }, 50);
}

function closePickerOutside(e, type) {
    const popup = document.getElementById(`cp-${type}-popup`);
    const btn = document.getElementById(`cp-${type}-btn`);
    if (popup && !popup.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
        popup.style.display = 'none';
        if (type==='eye') cpEyeOpen=false; else cpHairOpen=false;
    }
}

function initColorPickerCanvas(type, h, s, v, hex) {
    const gradId = `cp-${type}-grad`;
    const hueId  = `cp-${type}-hue`;
    drawGradientCanvas(gradId, h);
    drawHueSlider(hueId);

    const gradCanvas = document.getElementById(gradId);
    if (gradCanvas) {
        updateGradCursor(type, s, 100 - v);   // usa % direttamente
        gradCanvas.onmousedown = (e) => {
            const move = (ev) => {
                const rect = gradCanvas.getBoundingClientRect();
                const xPct = Math.max(0, Math.min((ev.clientX - rect.left) / rect.width * 100, 100));
                const yPct = Math.max(0, Math.min((ev.clientY - rect.top)  / rect.height * 100, 100));
                const ns = Math.round(xPct);
                const nv = Math.round(100 - yPct);
                updateGradCursor(type, xPct, yPct);
                applyPickerColor(type, hsvToHex(type==='eye'?cpEyeHue:cpHairHue, ns, nv), false);
            };
            const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);};
            document.addEventListener('mousemove',move);
            document.addEventListener('mouseup',up);
            move(e);
        };
    }

    const hueCanvas = document.getElementById(hueId);
    if (hueCanvas) {
        updateHueCursor(type, (h/360)*100);   // usa % direttamente
        hueCanvas.onmousedown = (e) => {
            const move = (ev) => {
                const rect = hueCanvas.getBoundingClientRect();
                const xPct = Math.max(0, Math.min((ev.clientX - rect.left) / rect.width * 100, 100));
                const newH = Math.round((xPct / 100) * 360);
                if (type==='eye') cpEyeHue=newH; else cpHairHue=newH;
                updateHueCursor(type, xPct);
                drawGradientCanvas(gradId, newH);
                const cur = document.getElementById(`cp-${type}-grad-cursor`);
                if (cur && gradCanvas) {
                    const cx2 = parseFloat(cur.dataset.xpct || '50');
                    const cy2 = parseFloat(cur.dataset.ypct || '50');
                    const ns = Math.round(cx2);
                    const nv = Math.round(100 - cy2);
                    applyPickerColor(type, hsvToHex(newH, ns, nv), false);
                }
            };
            const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);};
            document.addEventListener('mousemove',move);
            document.addEventListener('mouseup',up);
            move(e);
        };
    }

    const hexInp = document.getElementById(`cp-${type}-hex`);
    if (hexInp) hexInp.value = hex.replace('#','').toUpperCase();
    const preview = document.getElementById(`cp-${type}-preview`);
    if (preview) preview.style.background = hex;
}

function updateGradCursor(type, xPct, yPct) {
    const cur = document.getElementById(`cp-${type}-grad-cursor`);
    if (!cur) return;
    cur.style.left = xPct + '%';
    cur.style.top  = yPct + '%';
    cur.dataset.xpct = xPct;
    cur.dataset.ypct = yPct;
}

function updateHueCursor(type, xPct) {
    const cur = document.getElementById(`cp-${type}-hue-cursor`);
    if (!cur) return;
    cur.style.left = xPct + '%';
}

function applyPickerColor(type, hex, updateCursor=true) {
    if (type === 'eye') selectedEye = hex;
    else selectedHairColor = hex;
    const preview = document.getElementById(`cp-${type}-preview`);
    if (preview) preview.style.background = hex;
    const hexInp = document.getElementById(`cp-${type}-hex`);
    if (hexInp) hexInp.value = hex.replace('#','').toUpperCase();
    const btn = document.getElementById(`cp-${type}-btn`);
    if (btn) btn.style.background = hex;
    updateAvatar();
}

function onPickerHexInput(type, val) {
    val = val.replace(/[^0-9a-fA-F]/g,'').slice(0,6);
    document.getElementById(`cp-${type}-hex`).value = val;
    if (val.length === 6) {
        const hex = '#' + val;
        const [h,s,v] = hexToHSV(hex);
        if (type==='eye') cpEyeHue=h; else cpHairHue=h;
        drawGradientCanvas(`cp-${type}-grad`, h);
        drawHueSlider(`cp-${type}-hue`);
        updateGradCursor(type, s, 100 - v);
        updateHueCursor(type, (h/360)*100);
        applyPickerColor(type, hex, false);
    }
}

function buildColorPickerHTML(type, currentHex, presets) {
    const presetsHtml = presets.map(c =>
        `<div class="cp-swatch" style="background:${c}" title="${c}"
            onclick="applyPickerColor('${type}','${c}',true);buildPickerAfterSwatchClick('${type}')"></div>`
    ).join('');
    return `
    <div class="cp-popup" id="cp-${type}-popup" style="display:none">
        <div class="cp-gradient-wrap">
            <canvas id="cp-${type}-grad" width="220" height="130" class="cp-grad-canvas"></canvas>
            <div class="cp-cursor" id="cp-${type}-grad-cursor"></div>
        </div>
        <div class="cp-sliders">
            <div class="cp-slider-row">
                <div class="cp-preview" id="cp-${type}-preview" style="background:${currentHex}"></div>
                <div class="cp-slider-col">
                    <div class="cp-hue-wrap">
                        <canvas id="cp-${type}-hue" width="160" height="12" class="cp-hue-canvas"></canvas>
                        <div class="cp-hue-cursor" id="cp-${type}-hue-cursor"></div>
                    </div>
                </div>
            </div>
            <div class="cp-hex-row">
                <span class="cp-hash">#</span>
                <input class="cp-hex-input" id="cp-${type}-hex" maxlength="6"
                    value="${currentHex.replace('#','').toUpperCase()}"
                    oninput="onPickerHexInput('${type}',this.value)">
            </div>
        </div>
        <div class="cp-presets">${presetsHtml}</div>
    </div>`;
}

function buildPickerAfterSwatchClick(type) {
    if (type === 'eye') {
        buildEyePicker();
        const popup = document.getElementById('cp-eye-popup');
        if (popup) { popup.style.display='block'; const [h,s,v]=hexToHSV(selectedEye); cpEyeHue=h; initColorPickerCanvas('eye',h,s,v,selectedEye); }
    } else {
        buildHairColorPicker();
        const popup = document.getElementById('cp-hair-popup');
        if (popup) { popup.style.display='block'; const [h,s,v]=hexToHSV(selectedHairColor); cpHairHue=h; initColorPickerCanvas('hair',h,s,v,selectedHairColor); }
    }
}

// ── EXIT DROPDOWN ──

function goToCareerSelect() {
    document.getElementById('exit-dropdown')?.classList.remove('open');
    currentCareerId = null;
    localStorage.removeItem('gs_career');
    api('auth.php', { action: 'careers' }, 'GET').then(res => {
        if (res.error) { doLogout(); return; }
        const emailStored = localStorage.getItem('gs_email') || '';
        showCareerSelect(res, emailStored);
    });
}

// ── RICHIEDI UPDATE ──
function openUpdateRequest() {
    document.getElementById('exit-dropdown')?.classList.remove('open');
    const modal = document.getElementById('update-request-modal');
    const txt = document.getElementById('update-request-text');
    const err = document.getElementById('update-request-error');
    const ok  = document.getElementById('update-request-ok');
    if (txt) txt.value = '';
    if (err) err.textContent = '';
    if (ok)  ok.style.display = 'none';
    if (modal) modal.classList.add('active');
}

function closeUpdateRequest() {
    document.getElementById('update-request-modal')?.classList.remove('active');
}

async function sendUpdateRequest() {
    try {
    const txt = document.getElementById('update-request-text')?.value.trim();
    const err = document.getElementById('update-request-error');
    const ok  = document.getElementById('update-request-ok');
    if (err) err.textContent = '';
    if (!txt || txt.length < 10) {
        if (err) err.textContent = _t('agente_min_chars');
        return;
    }
    const res = await api('auth.php', { action: 'send_update_request', message: txt }, 'POST');
    if (res.error) { if (err) err.textContent = res.error; return; }
    if (ok) ok.style.display = 'block';
    setTimeout(closeUpdateRequest, 2500);
    } catch(e) { console.error('sendUpdateRequest error:', e); }
}

// ========================

// ── ENHANCED MATCH LOG VIEWER ──

let _logFilterEsito  = 'all';
let _logFilterSeason = 'all';
let _logSearchQuery  = '';
let _logPage         = 0;
const LOG_PAGE_SIZE  = 20;

function switchCareerTab(tab) {
    const seasonsList = document.getElementById('career-seasons-list');
    const logContainer = document.getElementById('career-log-container');
    const tabSeasons = document.getElementById('career-tab-seasons');
    const tabLog = document.getElementById('career-tab-log');
    if (tab === 'seasons') {
        if (seasonsList) seasonsList.style.display = '';
        if (logContainer) logContainer.style.display = 'none';
        if (tabSeasons) tabSeasons.classList.add('active');
        if (tabLog) tabLog.classList.remove('active');
    } else {
        if (seasonsList) seasonsList.style.display = 'none';
        if (logContainer) logContainer.style.display = '';
        if (tabSeasons) tabSeasons.classList.remove('active');
        if (tabLog) tabLog.classList.add('active');
        loadCareerLog();
    }
}

async function loadCareerLog() {
    try {
    const container = document.getElementById('career-log-container');
    if (!container) return;
    container.innerHTML = `<div class="gs-skeleton-wrap">${['100%','80%','90%','70%','85%'].map(w=>`<div class="gs-skeleton-line" style="width:${w}"></div>`).join('')}</div>`;

    const [logData, p] = await Promise.all([
        api('player.php', { action: 'log', career_id: currentCareerId }, 'GET'),
        api('player.php', { action: 'get', career_id: currentCareerId }, 'GET'),
    ]);

    if (!Array.isArray(logData) || !logData.length) {
        container.innerHTML = `<p style="color:var(--text-dim);padding:20px;text-align:center">${_t('no_seasons')}</p>`;
        return;
    }

    // Build filter UI
    const seasons = [...new Set(logData.map(l => l.anno))].sort((a,b) => b - a);
    const filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center';
    filterBar.innerHTML = `
        <input type="text" placeholder="${{it:'Cerca avversario...',en:'Search opponent...',de:'Gegner suchen...',es:'Buscar rival...'}[currentLang]||'Cerca avversario...'}"
            style="flex:1;min-width:160px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--text);font-size:0.82rem"
            id="log-search" oninput="filterLog(this.value,'search')">
        <select style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:0.82rem" onchange="filterLog(this.value,'season')" id="log-season-filter">
            <option value="all">${{it:'Tutte le stagioni',en:'All seasons',de:'Alle Saisons',es:'Todas las temporadas'}[currentLang]||'Tutte le stagioni'}</option>
            ${seasons.map(s => `<option value="${s}">${{it:'Stagione',en:'Season',de:'Saison',es:'Temporada'}[currentLang]||'Stagione'} ${s}</option>`).join('')}
        </select>
        <div style="display:flex;gap:4px">
            ${['all','V','P','S'].map(e => `<button onclick="filterLog('${e}','esito')" 
                style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-dim);font-size:0.75rem;cursor:pointer;font-weight:700"
                class="log-esito-btn" data-esito="${e}">${e === 'all' ? ({it:'Tutti',en:'All',de:'Alle',es:'Todos'}[currentLang]||'Tutti') : e === 'V' ? (currentLang === 'en' ? 'W' : 'V') : e === 'P' ? 'D' : (currentLang === 'en' ? 'L' : 'S')}</button>`).join('')}
        </div>`;

    // Stats summary
    const wins = logData.filter(l => l.esito === 'V').length;
    const draws = logData.filter(l => l.esito === 'P').length;
    const losses = logData.filter(l => l.esito === 'S').length;
    const totalGol = logData.reduce((a, l) => a + parseInt(l.gol || 0), 0);
    const totalAssist = logData.reduce((a, l) => a + parseInt(l.assist || 0), 0);
    const avgVoto = logData.length ? (logData.reduce((a, l) => a + parseFloat(l.voto || 6), 0) / logData.length).toFixed(2) : '0';

    const statsBar = document.createElement('div');
    statsBar.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px';
    const statItems = [
        { val: logData.length, lbl: {it:'Partite',en:'Matches',de:'Spiele',es:'Partidos'}[currentLang]||'Partite', color: '#fff' },
        { val: wins, lbl: {it:'Vittorie',en:'Wins',de:'Siege',es:'Victorias'}[currentLang]||'Vittorie', color: '#10b981' },
        { val: draws, lbl: {it:'Pareggi',en:'Draws',de:'Unentschieden',es:'Empates'}[currentLang]||'Pareggi', color: '#eab308' },
        { val: losses, lbl: {it:'Sconfitte',en:'Losses',de:'Niederlagen',es:'Derrotas'}[currentLang]||'Sconfitte', color: '#ef4444' },
        { val: totalGol, lbl: {it:'Gol',en:'Goals',de:'Tore',es:'Goles'}[currentLang]||'Gol', color: '#FFD700' },
        { val: totalAssist, lbl: {it:'Assist',en:'Assists',de:'Vorlagen',es:'Asistencias'}[currentLang]||'Assist', color: '#3b82f6' },
        { val: avgVoto, lbl: {it:'Media Voto',en:'Avg Rating',de:'Ø Bewertung',es:'Media Valoración'}[currentLang]||'Media Voto', color: '#8b5cf6' },
    ];
    statsBar.innerHTML = statItems.map(s => `
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 14px;text-align:center;flex:1;min-width:70px">
            <div style="font-size:1.3rem;font-weight:900;color:${s.color}">${s.val}</div>
            <div style="font-size:0.65rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">${s.lbl}</div>
        </div>`).join('');

    // Log table
    const tableWrap = document.createElement('div');
    tableWrap.id = 'log-table-wrap';
    tableWrap.className = 'table-scroll';

    container.innerHTML = '';
    container.appendChild(filterBar);
    container.appendChild(statsBar);
    container.appendChild(tableWrap);

    // Store data for filtering
    container._logData = logData;
    renderLogTable(logData, tableWrap);
    } catch(e) { console.error('loadCareerLog error:', e); }
}

function filterLog(val, type) {
    const container = document.getElementById('career-log-container');
    if (!container?._logData) return;
    if (type === 'search') _logSearchQuery = val.toLowerCase();
    if (type === 'season') _logFilterSeason = val;
    if (type === 'esito')  { _logFilterEsito = val; updateLogEsitoButtons(val); }
    _logPage = 0;

    let filtered = container._logData;
    if (_logFilterSeason !== 'all') filtered = filtered.filter(l => l.anno == _logFilterSeason);
    if (_logFilterEsito !== 'all')  filtered = filtered.filter(l => l.esito === _logFilterEsito);
    if (_logSearchQuery)            filtered = filtered.filter(l => (l.avv||'').toLowerCase().includes(_logSearchQuery));

    const wrap = document.getElementById('log-table-wrap');
    if (wrap) renderLogTable(filtered, wrap);
}

function updateLogEsitoButtons(active) {
    document.querySelectorAll('.log-esito-btn').forEach(btn => {
        const isActive = btn.dataset.esito === active;
        btn.style.background = isActive ? 'rgba(255,215,0,0.12)' : 'transparent';
        btn.style.borderColor = isActive ? 'var(--gold)' : 'var(--border)';
        btn.style.color = isActive ? 'var(--gold)' : 'var(--text-dim)';
    });
}

function renderLogTable(data, container) {
    if (!data.length) {
        container.innerHTML = `<p style="color:var(--text-dim);padding:20px;text-align:center">${_t('no_seasons')}</p>`;
        return;
    }

    const esitoColors = { V: '#10b981', P: '#eab308', S: '#ef4444' };
    const esitoLabels = {
        V: {it:'V',en:'W',de:'S',es:'V'}[currentLang]||'V',
        P: 'D',
        S: {it:'S',en:'L',de:'N',es:'D'}[currentLang]||'S',
    };

    let html = `
        <table class="table-gs table-responsive" style="width:100%">
            <thead>
                <tr>
                    <th>${{it:'Stag/Mese',en:'Season/Month',de:'Sais/Monat',es:'Temp/Mes'}[currentLang]||'Stag/Mese'}</th>
                    <th>${{it:'Avversario',en:'Opponent',de:'Gegner',es:'Rival'}[currentLang]||'Avversario'}</th>
                    <th>${{it:'Esito',en:'Result',de:'Ergebnis',es:'Resultado'}[currentLang]||'Esito'}</th>
                    <th>⚽</th>
                    <th>🎯</th>
                    <th>★</th>
                </tr>
            </thead>
            <tbody>`;

    const paginated = data.slice(0, LOG_PAGE_SIZE * (_logPage + 1));
    paginated.forEach(l => {
        if (!l.avv || l.avv === '__riepilogo') return;
        const color = esitoColors[l.esito] || '#94a3b8';
        const lbl   = esitoLabels[l.esito] || l.esito;
        const voto  = parseFloat(l.voto || 6).toFixed(1);
        const votoColor = voto >= 7.5 ? '#10b981' : voto <= 5.5 ? '#ef4444' : '#fff';
        html += `
            <tr>
                <td><span style="color:var(--text-dim);font-size:0.72rem">A${l.anno}/M${l.mese}</span></td>
                <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(l.avv||'').replace(/"/g,'&quot;')}">${(l.avv||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
                <td><span class="badge" style="background:${color}22;color:${color};border-color:${color}44">${lbl}</span></td>
                <td style="font-weight:700;color:${parseInt(l.gol)>0?'#FFD700':'var(--text-dim)'}">${l.gol||0}</td>
                <td style="color:${parseInt(l.assist)>0?'#3b82f6':'var(--text-dim)'}">${l.assist||0}</td>
                <td style="font-weight:700;color:${votoColor}">${voto}</td>
            </tr>`;
    });

    html += '</tbody></table>';

    if (data.length > paginated.length) {
        html += `<button onclick="loadMoreLog()" style="width:100%;padding:10px;margin-top:8px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text-dim);cursor:pointer;font-size:0.82rem">
            ${{it:'Carica altri...',en:'Load more...',de:'Mehr laden...',es:'Cargar más...'}[currentLang]||'Carica altri...'} (${data.length - paginated.length} ${{it:'rimanenti',en:'remaining',de:'verbleibend',es:'restantes'}[currentLang]||'rimananti'})
        </button>`;
    }

    container.innerHTML = html;
    container._fullData = data;
}

function loadMoreLog() {
    _logPage++;
    const container = document.getElementById('log-table-wrap');
    if (container?._fullData) renderLogTable(container._fullData, container);
}

// ── CAREER COMPARISON & ANALYTICS ──

async function loadCareerAnalytics() {
    try {
    const container = document.getElementById('career-seasons-list');
    if (!container) return;

    const [seasons, logData, p] = await Promise.all([
        api('player.php', { action: 'season' }, 'GET'),
        api('player.php', { action: 'log', career_id: currentCareerId }, 'GET'),
        api('player.php', { action: 'get', career_id: currentCareerId }, 'GET'),
    ]);

    if (!seasons?.length || !p) return;

    const lang = currentLang;

    // ── Career KPI Summary ────────────────────────────────────────────────
    const kpiWrap = document.createElement('div');
    kpiWrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;margin-bottom:20px';
    
    const totalGol    = seasons.reduce((a, s) => a + parseInt(s.gol || 0), 0);
    const totalAssist = seasons.reduce((a, s) => a + parseInt(s.assist || 0), 0);
    const bestSeason  = seasons.reduce((best, s) => parseInt(s.gol || 0) > parseInt(best.gol || 0) ? s : best, seasons[0]);
    const avgVoto     = seasons.length ? (seasons.reduce((a, s) => a + parseFloat(s.media_voto || 6), 0) / seasons.length).toFixed(2) : '—';
    const totalPd     = parseInt(p.palloni_doro || 0);
    const totalTrofei = parseInt(p.trofei || 0);

    const kpis = [
        { icon: '⚽', val: totalGol,    lbl: {it:'Gol Carriera',en:'Career Goals',de:'Karriere-Tore',es:'Goles Carrera'}[lang]||'Gol Carriera', color: '#FFD700' },
        { icon: '🎯', val: totalAssist, lbl: {it:'Assist Carriera',en:'Career Assists',de:'Karriere-Vorlagen',es:'Asistencias Carrera'}[lang]||'Assist Carriera', color: '#3b82f6' },
        { icon: '⭐', val: avgVoto,     lbl: {it:'Media Voto',en:'Avg Rating',de:'Ø Bewertung',es:'Media Valoración'}[lang]||'Media Voto', color: '#8b5cf6' },
        { icon: '🏆', val: totalTrofei, lbl: {it:'Trofei',en:'Trophies',de:'Trophäen',es:'Trofeos'}[lang]||'Trofei', color: '#10b981' },
        { icon: '🥇', val: totalPd,     lbl: {it:"Palloni d'Or",en:"Ballon d'Or",de:"Ballon d'Or",es:"Balón de Oro"}[lang]||"Palloni d'Or", color: '#f59e0b' },
        { icon: '📅', val: seasons.length, lbl: {it:'Stagioni',en:'Seasons',de:'Saisons',es:'Temporadas'}[lang]||'Stagioni', color: '#64748b' },
    ];

    kpiWrap.innerHTML = kpis.map(k => `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:1.5rem;margin-bottom:4px">${k.icon}</div>
            <div style="font-size:1.4rem;font-weight:900;color:${k.color}">${k.val}</div>
            <div style="font-size:0.68rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-top:3px">${k.lbl}</div>
        </div>`).join('');

    // ── Best season highlight ─────────────────────────────────────────────
    const bestWrap = document.createElement('div');
    bestWrap.style.cssText = 'background:linear-gradient(135deg,rgba(255,215,0,0.08),var(--card));border:1px solid rgba(255,215,0,0.3);border-radius:14px;padding:16px;margin-bottom:20px';
    bestWrap.innerHTML = `
        <div style="font-size:0.72rem;font-weight:800;color:var(--gold);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">
            🏆 ${{it:'Miglior Stagione',en:'Best Season',de:'Beste Saison',es:'Mejor Temporada'}[lang]||'Miglior Stagione'} — ${{it:'Anno',en:'Year',de:'Jahr',es:'Año'}[lang]||'Anno'} ${bestSeason.anno}
        </div>
        <div style="display:flex;gap:20px;flex-wrap:wrap">
            <div><span style="font-size:1.8rem;font-weight:900;color:#FFD700">${bestSeason.gol}</span>
                 <span style="font-size:0.75rem;color:var(--text-dim);margin-left:4px">${{it:'gol',en:'goals',de:'Tore',es:'goles'}[lang]||'gol'}</span></div>
            <div><span style="font-size:1.8rem;font-weight:900;color:#3b82f6">${bestSeason.assist}</span>
                 <span style="font-size:0.75rem;color:var(--text-dim);margin-left:4px">${{it:'assist',en:'assists',de:'Vorlagen',es:'asistencias'}[lang]||'assist'}</span></div>
            <div><span style="font-size:1.8rem;font-weight:900;color:#8b5cf6">${parseFloat(bestSeason.media_voto || 6).toFixed(2)}</span>
                 <span style="font-size:0.75rem;color:var(--text-dim);margin-left:4px">${{it:'media voto',en:'avg rating',de:'Ø Wertung',es:'media valoración'}[lang]||'media voto'}</span></div>
            <div><span style="font-size:1.8rem;font-weight:900;color:#10b981">${bestSeason.partite || 0}</span>
                 <span style="font-size:0.75rem;color:var(--text-dim);margin-left:4px">${{it:'partite',en:'matches',de:'Spiele',es:'partidos'}[lang]||'partite'}</span></div>
        </div>
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:8px">
            🏟️ ${bestSeason.team_nome || '—'} · ${bestSeason.lega_nome || '—'}
        </div>`;

    // ── Quote of the day ──────────────────────────────────────────────────
    const quoteWrap = document.createElement('div');
    quoteWrap.id = 'career-quote-of-day';
    if (window.GS_Encyclopedia) GS_Encyclopedia.showQuoteOfTheDay('career-quote-of-day');

    // Insert analytics before existing content
    const existingContent = container.innerHTML;
    container.innerHTML = '';
    container.appendChild(kpiWrap);
    container.appendChild(bestWrap);
    container.appendChild(quoteWrap);
    
    // Restore existing season list below
    const div = document.createElement('div');
    div.innerHTML = existingContent;
    container.appendChild(div);
    } catch(e) { console.error('loadCareerAnalytics error:', e); }
}

// ── HELP SYSTEM & TOOLTIPS ──

const GS_HELP_TEXTS = {
    it: {
        overall: "L'Overall è la media delle 5 statistiche tecniche (max 125). Determina quali squadre puoi raggiungere e la tua competitività in campo.",
        tiro: "La qualità del tiro. Influenza la probabilità di segnare e il tipo di gol disponibili nel match.",
        velocita: "La velocità di sprint. Fondamentale per i contropiedi e per superare i difensori.",
        dribbling: "La tecnica individuale. Migliora la qualità delle azioni e sblocca mosse speciali.",
        fisico: "La forza e resistenza fisica. Riduce il rischio infortuni e migliora i contrasti.",
        mentalita: "La lucidità mentale. Migliora le decisioni in campo nei momenti cruciali.",
        popolarita: "La tua fama nel mondo del calcio. Cresce con i gol, le vittorie e i premi.",
        energia: "Il carburante fisico. Si consuma con l'allenamento, si recupera con il riposo.",
        morale: "Lo stato emotivo. Alto morale = prestazioni migliori. Cura il tuo umore!",
        soldi: "I guadagni della tua carriera. Usali per la struttura e per l'agente.",
        pallone_doro: "Il massimo riconoscimento calcistico. Si vince con gol, assist, voto medio alto e overall elevato.",
        struttura: "La tua struttura di allenamento personale. Più è avanzata, più cresci velocemente.",
        agente: "Il tuo procuratore. Ti aiuta a guadagnare di più e a trasferirsi in club migliori.",
        champions: "La Champions Cup: il torneo per élite europee. Top 4 della Prima Divisione si qualificano.",
        skill_tree: "L'albero delle abilità. Ogni skill sbloccata aggiunge bonus permanenti alle stats.",
    },
    en: {
        overall: "Overall is the average of 5 technical stats (max 125). Determines which clubs you can reach and your competitiveness on the pitch.",
        tiro: "Shot quality. Affects the probability of scoring and the types of goals available in matches.",
        velocita: "Sprint speed. Essential for counter-attacks and beating defenders.",
        dribbling: "Individual technique. Improves action quality and unlocks special moves.",
        fisico: "Physical strength and endurance. Reduces injury risk and improves tackles.",
        mentalita: "Mental clarity. Improves on-pitch decisions in crucial moments.",
        popolarita: "Your fame in the football world. Grows with goals, wins and awards.",
        energia: "Physical fuel. Used by training, recovered with rest.",
        morale: "Emotional state. High morale = better performances. Look after your mood!",
        soldi: "Career earnings. Use them for facilities and your agent.",
        pallone_doro: "The highest football honour. Won with goals, assists, high average rating and overall.",
        struttura: "Your personal training facility. The more advanced, the faster you grow.",
        agente: "Your agent. Helps you earn more and move to better clubs.",
        champions: "Champions Cup: the European elite tournament. Top 4 of First Division qualify.",
        skill_tree: "The skill tree. Each unlocked skill adds permanent stat bonuses.",
    },
    de: {
        overall: "Der Overall ist der Durchschnitt der 5 technischen Werte (max 125). Bestimmt, welche Klubs du erreichen kannst und wie konkurrenzfähig du bist.",
        tiro: "Schussqualität. Beeinflusst die Torchance und die verfügbaren Tortypen im Spiel.",
        velocita: "Sprintgeschwindigkeit. Entscheidend für Konter und das Überwinden von Verteidigern.",
        dribbling: "Individuelle Technik. Verbessert Aktionen und schaltet Spezialmoves frei.",
        fisico: "Körperkraft und Ausdauer. Reduziert Verletzungsrisiko und verbessert Zweikämpfe.",
        mentalita: "Mentale Klarheit. Verbessert Entscheidungen auf dem Platz in entscheidenden Momenten.",
        popolarita: "Dein Ruhm in der Fußballwelt. Wächst durch Tore, Siege und Auszeichnungen.",
        energia: "Körperlicher Treibstoff. Verbraucht durch Training, erholt durch Ruhe.",
        morale: "Emotionaler Zustand. Hohe Moral = bessere Leistungen. Pflege deine Stimmung!",
        soldi: "Karriere-Einnahmen. Nutze sie für die Einrichtung und deinen Agenten.",
        pallone_doro: "Die höchste Fußballauszeichnung. Gewonnen durch Tore, Vorlagen, hohe Bewertung und Overall.",
        struttura: "Deine persönliche Trainingseinrichtung. Je fortschrittlicher, desto schneller wächst du.",
        agente: "Dein Agent. Hilft dir mehr zu verdienen und in bessere Klubs zu wechseln.",
        champions: "Champions Cup: das europäische Elite-Turnier. Top 4 der Ersten Division qualifizieren sich.",
        skill_tree: "Der Fähigkeitsbaum. Jede freigeschaltete Fähigkeit fügt permanente Stat-Boni hinzu.",
    },
    es: {
        overall: "El Overall es la media de 5 estadísticas técnicas (máx 125). Determina qué clubes puedes alcanzar y tu competitividad en el campo.",
        tiro: "Calidad del disparo. Afecta la probabilidad de marcar y los tipos de goles disponibles.",
        velocita: "Velocidad de sprint. Esencial para los contragolpes y para superar defensas.",
        dribbling: "Técnica individual. Mejora la calidad de las acciones y desbloquea movimientos especiales.",
        fisico: "Fuerza y resistencia física. Reduce el riesgo de lesiones y mejora los duelos.",
        mentalita: "Claridad mental. Mejora las decisiones en el campo en los momentos cruciales.",
        popolarita: "Tu fama en el mundo del fútbol. Crece con goles, victorias y premios.",
        energia: "Combustible físico. Lo consume el entrenamiento, lo recupera el descanso.",
        morale: "Estado emocional. Alta moral = mejores actuaciones. ¡Cuida tu estado de ánimo!",
        soldi: "Ingresos de tu carrera. Úsalos para las instalaciones y tu agente.",
        pallone_doro: "El máximo reconocimiento del fútbol. Se gana con goles, asistencias, alta media y overall.",
        struttura: "Tu instalación de entrenamiento personal. Cuanto más avanzada, más rápido creces.",
        agente: "Tu agente. Te ayuda a ganar más y a fichar por mejores clubes.",
        champions: "Copa de Campeones: el torneo de élite europeo. Top 4 de la Primera División se clasifican.",
        skill_tree: "El árbol de habilidades. Cada habilidad desbloqueada añade bonificaciones permanentes.",
    }
};

function attachTooltips() {
    // Attach help text to stat rows
    const tooltipMap = {
        '[data-stat="tiro"]':         'tiro',
        '[data-stat="velocita"]':     'velocita',
        '[data-stat="dribbling"]':    'dribbling',
        '[data-stat="fisico"]':       'fisico',
        '[data-stat="mentalita"]':    'mentalita',
        '[data-special="energia"]':   'energia',
        '[data-special="morale"]':    'morale',
        '[data-special="popolarita"]':'popolarita',
        '.overall-circle':             'overall',
        '#info-soldi':                 'soldi',
        '#info-struttura':             'struttura',
        '#info-agente':                'agente',
        '#info-pallone-doro':          'pallone_doro',
        '#nav-skilltree':              'skill_tree',
        '#nav-classifica':             'champions',
    };

    Object.entries(tooltipMap).forEach(([selector, key]) => {
        document.querySelectorAll(selector).forEach(el => {
            const lang = currentLang || 'it';
            // Always refresh tooltip on lang change (remove cache guard)
            el.dataset.tip = GS_HELP_TEXTS[lang]?.[key] || GS_HELP_TEXTS.it[key] || '';
            el.dataset.tipPos = 'top';
        });
    });
}

// ── KEYBOARD SHORTCUTS ──

const GS_SHORTCUTS = {
    'g': () => { if (document.getElementById('game-page')?.classList.contains('active')) document.getElementById('play-month-btn')?.click(); },
    '1': () => showPage('dashboard'),
    '2': () => showPage('game'),
    '3': () => showPage('career'),
    '4': () => showPage('transfer'),
    '5': () => showPage('notizie'),
    '6': () => showPage('skilltree'),
    '7': () => showPage('achievements'),
    'a': () => showPage('agente'),
    'c': () => showPage('classifica'),
    '?': () => { if (window.GS_Tutorial) GS_Tutorial.start(true); },
    'Escape': () => {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
            m.classList.remove('active');
        });
    },
};

document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts in input fields
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const handler = GS_SHORTCUTS[e.key];
    if (handler) { e.preventDefault(); handler(); }
});

// ── PERFORMANCE MONITOR ──

const GS_Performance = {
    _fps: 0, _lastTime: 0, _frames: 0,
    _monitoring: false,

    start() {
        this._monitoring = true;
        this._lastTime = performance.now();
        this._frames = 0;
        const loop = (now) => {
            if (!this._monitoring) return;
            this._frames++;
            if (now - this._lastTime >= 1000) {
                this._fps = this._frames;
                this._frames = 0;
                this._lastTime = now;
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    },

    stop() { this._monitoring = false; },
    getFPS() { return this._fps; },

    // Check if device is low-performance
    isLowPerformance() {
        return this._fps > 0 && this._fps < 30;
    },

    // Reduce animation complexity on low-end devices
    adaptAnimations() {
        if (this.isLowPerformance()) {
            document.body.classList.add('reduced-motion');
        }
    }
};

// ── ACHIEVEMENTS PAGE ──
async function loadAchievements() {
    if (!window.GS_Achievements) return;
    const grid    = document.getElementById('achievements-grid');
    const fillEl  = document.getElementById('ach-progress-fill');
    const countEl = document.getElementById('ach-count');
    const totalEl = document.getElementById('ach-total');
    if (!grid) return;

    const all = GS_Achievements.getAll();
    const unlocked = GS_Achievements.getUnlockedCount();
    const total = GS_Achievements.getTotalCount();

    if (fillEl) fillEl.style.transform = `scaleX(${unlocked / total})`;
    if (countEl) countEl.textContent = unlocked;
    if (totalEl) totalEl.textContent = total;

    // Group by category
    const categories = ['milestones', 'scoring', 'growth', 'trophies', 'career', 'skills', 'facilities', 'secrets'];
    const byCategory = {};
    all.forEach(a => {
        if (!byCategory[a.category]) byCategory[a.category] = [];
        byCategory[a.category].push(a);
    });

    const catKeys = {
        milestones: _t('ach_category_milestones'), scoring: _t('ach_category_scoring'),
        growth: _t('ach_category_growth'), trophies: _t('ach_category_trophies'),
        career: _t('ach_category_career'), skills: _t('ach_category_skills'),
        facilities: _t('ach_category_facilities'), secrets: _t('ach_category_secrets'),
    };

    let html = '';
    categories.forEach(cat => {
        const items = byCategory[cat];
        if (!items?.length) return;
        html += `<div class="ach-category-title">${catKeys[cat] || cat}</div>`;
        html += '<div class="ach-grid" style="margin-bottom:8px">';
        items.forEach(a => {
            const locked = !a.isUnlocked;
            const secret = a.secret && locked;
            const nameKey = {en:a.name_en||a.name,de:a.name_de||a.name_en||a.name,es:a.name_es||a.name_en||a.name,it:a.name}[currentLang]||a.name;
            const descKey = {en:a.desc_en||a.desc,de:a.desc_de||a.desc_en||a.desc,es:a.desc_es||a.desc_en||a.desc,it:a.desc}[currentLang]||a.desc;
            html += `
                <div class="ach-card ${a.isUnlocked ? 'unlocked' : 'locked'} ${secret ? 'secret' : ''}">
                    <span class="ach-icon">${secret ? '🔒' : a.icon}</span>
                    <div class="ach-body">
                        <div class="ach-name">${secret ? '???' : nameKey}</div>
                        <div class="ach-desc">${secret ? ({it:'Obiettivo segreto',en:'Secret achievement',de:'Geheime Errungenschaft',es:'Logro secreto'}[currentLang]||'Obiettivo segreto') : descKey}</div>
                        ${a.isUnlocked ? `<div class="ach-unlocked-label">✓ ${{it:'Sbloccato',en:'Unlocked',de:'Freigeschaltet',es:'Desbloqueado'}[currentLang]||'Sbloccato'}</div>` : ''}
                    </div>
                </div>`;
        });
        html += '</div>';
    });
    grid.innerHTML = html;
}

// ── EXTENDED EVENT SYSTEM ──

const GS_Events = {
    _listeners: {},

    on(event, handler) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(handler);
    },

    off(event, handler) {
        if (this._listeners[event]) {
            this._listeners[event] = this._listeners[event].filter(h => h !== handler);
        }
    },

    emit(event, data) {
        (this._listeners[event] || []).forEach(h => {
            try { h(data); } catch(e) { console.warn('Event handler error:', e); }
        });
    },
};

// ── Register core event handlers ──────────────────────────────────────────────
GS_Events.on('goal', ({ player, gol, esito }) => {
    if (window.GS_Particles) GS_Particles.effects.goalCelebration();
});

GS_Events.on('win', ({ player }) => {
    if (window.GS_Particles) GS_Particles.effects.confettiRain();
});

GS_Events.on('year_end', ({ newYear, player }) => {
    if (window.GS_Particles) GS_Particles.effects.fireworks?.(3);
});

GS_Events.on('achievement', ({ achievement }) => {
});

GS_Events.on('skill_unlock', ({ skillId, level }) => {
});

// Make available globally
window.GS_Events = GS_Events;

// INIT
// ========================
document.addEventListener('DOMContentLoaded', async () => {
    // Nascondi solo il nav (non lang-switcher e settings, sempre visibili)
    const mainNav = document.getElementById('main-nav');
    if (mainNav) mainNav.style.display = 'none';
    // lang-switcher e settings sempre visibili fin dall'inizio
    const exitWrapInit = document.getElementById('exit-dropdown-wrap');
    if (exitWrapInit) exitWrapInit.style.display = 'flex';
    const langWrapInit = document.getElementById('lang-switcher-wrap');
    if (langWrapInit) langWrapInit.style.display = 'flex';

    // Init header flag
    const flagElInit = document.getElementById('lang-switcher-flag');
    const _flagMap = { it:'🇮🇹', en:'🇬🇧', de:'🇩🇪', es:'🇪🇸' };
    const _codeMap = { it:'IT',   en:'EN',   de:'DE',   es:'ES'   };
    if (flagElInit) {
        flagElInit.innerHTML = `${_flagMap[currentLang] || '🇮🇹'} <span style="font-size:0.7rem;font-weight:700;letter-spacing:0.5px;">${_codeMap[currentLang] || 'IT'}</span>`;
    }
    ['it','en','de','es'].forEach(l => document.getElementById('lang-sw-'+l)?.classList.toggle('active', currentLang === l));

    // Close lang dropdown on outside click
    document.addEventListener('click', (e) => {
        const wrap = document.getElementById('lang-switcher-wrap');
        if (wrap && !wrap.contains(e.target)) {
            document.getElementById('lang-switcher-dropdown')?.classList.remove('open');
        }
    });

    // Language init
    _applyTranslations();
    _updateNavLabels();
    ['it','en','de','es'].forEach(l => document.getElementById('lang-btn-'+l)?.classList.toggle('active', currentLang === l));

    // Build actions grid on load
    _buildActionsGrid();
    // AI avatar prompt
    document.getElementById('ai-avatar-prompt')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateAIAvatar(); }
    });

    document.querySelectorAll('.auth-tab').forEach(btn => {
        btn.addEventListener('click', () => showAuthTab(btn.dataset.tab));
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        // If verify panel is visible and focused in code input, confirm code (not re-send)
        const verifyPanel = document.getElementById('verify-panel');
        if (verifyPanel && verifyPanel.style.display !== 'none' && getComputedStyle(verifyPanel).display !== 'none') {
            e.preventDefault();
            doVerifyCode();
            return;
        }
        const active = document.querySelector('.auth-tab.active');
        if (!active) return;
        if (active.dataset.tab === 'login') doLogin();
        else if (active.dataset.tab === 'register') doRegister();
    });

    if (authToken) {
        const res = await api('auth.php', { action: 'check' }, 'GET');
        if (res.logged) {
            if (currentCareerId && res.careers?.find(c => c.id == currentCareerId)) {
                await loadPlayer();
                // Reapply language now that game elements are visible
                _applyTranslations();
                _updateNavLabels();
                showPage('dashboard');
                return;
            } else {
                showCareerSelect(res.careers, res.email || localStorage.getItem('gs_email') || '');
                return;
            }
        } else {
            authToken = null; currentCareerId = null;
            localStorage.removeItem('gs_token');
            localStorage.removeItem('gs_career');
        }
    }
    showPage('auth');
    buildSkinTonePicker();
    buildHairPicker();
    updateAvatar();
});

// ── API HELPER ──
async function api(endpoint, data = {}, method = 'POST') {
    try {
        let url = `${API_BASE}/${endpoint}`;
        const opts = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': authToken || '',
                'X-Lang': currentLang || 'it'
            }
        };
        if (method === 'GET') {
            data.token = authToken || '';
            if (currentCareerId) data.career_id = currentCareerId;
            data.lang = currentLang || 'it';
            data._t = Date.now();
            url += '?' + new URLSearchParams(data);
        } else {
            data.token = authToken || '';
            if (currentCareerId && !data.career_id) data.career_id = currentCareerId;
            data.lang = currentLang || 'it';
            opts.body = JSON.stringify(data);
        }
        const res = await fetch(url, opts);
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch(e) {
            console.error('Risposta non JSON:', text);
            return { error: _t('server_resp_invalid') + ': ' + text.substring(0, 200) };
        }
    } catch (e) {
        console.error('Fetch error:', e);
        return { error: _t('conn_error') };
    }
}

// ── NAVIGATION ──
function showPage(page) {
    // ── Auth guard: block protected pages if not logged in / guest ──
    const protectedPages = ['dashboard','game','career','transfer','strutture','classifica','agente','notizie','skilltree','achievements'];
    if (protectedPages.includes(page) && !currentCareerId && !_isGuestMode) {
        showPage('auth');
        return;
    }
    const targetPage = document.getElementById(`${page}-page`);
    // Safety: sempre nascondere nav principale sulla pagina auth
    if (page === 'auth') {
        const mn = document.getElementById('main-nav');
        if (mn) mn.style.display = 'none';
        // lang-switcher e settings restano sempre visibili anche in auth
    }
    if (!targetPage) { console.error(`Pagina non trovata: ${page}-page`); return; }
    // Flash on page change
    const overlay = document.getElementById('gs-page-overlay');
    if (overlay) { overlay.classList.add('flash'); setTimeout(() => overlay.classList.remove('flash'), 200); }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    targetPage.classList.add('active');
    document.querySelectorAll('nav button[data-page]').forEach(b => {
        const isActive = b.dataset.page === page;
        b.classList.toggle('active', isActive);
        if (isActive) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
    });
    document.getElementById('main-nav').style.display = (page !== 'auth' && page !== 'career-select') ? 'flex' : 'none';

    const exitWrap    = document.getElementById('exit-dropdown-wrap');
    const exitOptHome = document.getElementById('exit-opt-home');
    const exitDivHome = document.getElementById('exit-divider-home');
    const isInGame    = (page !== 'auth' && page !== 'career-select');
    // lang-switcher e settings sempre visibili
    if (exitWrap) exitWrap.style.display = 'flex';
    const langWrap = document.getElementById('lang-switcher-wrap');
    if (langWrap) langWrap.style.display = 'flex';
    const inCareer = isInGame && page !== 'career-select';
    if (exitOptHome) exitOptHome.style.display = inCareer ? 'flex' : 'none';
    if (exitDivHome) exitDivHome.style.display = inCareer ? 'block' : 'none';

    if (page === 'dashboard') renderDashboard();
    if (page === 'game')      renderGame();
    if (page === 'career')    loadCareer();
    if (page === 'transfer')  loadTransfer();
    if (page === 'strutture') loadStrutture();
    if (page === 'classifica') loadClassifica();
    if (page === 'agente')     loadAgente();
    if (page === 'notizie')    loadNotizie();
    if (page === 'achievements') loadAchievements();
    if (page === 'skilltree')  loadSkillTree();
}

document.querySelectorAll('nav button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
});

// ── AUTH ──
function showAuthTab(tab) {
    // Always hide verify panel and restore normal auth UI
    const vp = document.getElementById('verify-panel');
    if (vp) vp.style.display = 'none';
    if (_verifyResendTimer) { clearInterval(_verifyResendTimer); _verifyResendTimer = null; }
    // Restore auth tabs and forms
    document.querySelectorAll('.auth-tabs, .auth-forgot').forEach(el => el.style.display = '');
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
    document.querySelector(`.auth-tab[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById('login-form').style.display    = tab === 'login'    ? 'block' : 'none';
    document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('forgot-form').style.display   = 'none';
    // Nasconde solo il nav principale, non lang-switcher e settings
    const mn = document.getElementById('main-nav');
    if (mn) mn.style.display = 'none';
}
function showForgot() {
    ['login-form','register-form'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
    document.getElementById('forgot-form').style.display = 'block';
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
}

async function doLogin() {
    const email    = document.getElementById('l-email')?.value.trim();
    const password = document.getElementById('l-password')?.value;
    const errEl    = document.getElementById('login-error');
    if (errEl) errEl.textContent = '';
    const res = await api('auth.php', { action:'login', email, password }, 'POST');
    if (res.error) { if (errEl) errEl.textContent = res.error; return; }
    authToken = res.token;
    localStorage.setItem('gs_token', authToken);
    localStorage.setItem('gs_email', email);
    currentCareerId = null; localStorage.removeItem('gs_career');
    showCareerSelect(res.careers || [], res.email || email);
}

async function doRegister() {
    const username = document.getElementById('r-username')?.value.trim();
    const email    = document.getElementById('r-email')?.value.trim();
    const password = document.getElementById('r-password')?.value;
    const pass2    = document.getElementById('r-password2')?.value;
    const errEl    = document.getElementById('register-error');
    if (errEl) errEl.textContent = '';
    if (!username) { if(errEl) errEl.textContent=_t('reg_err_username'); return; }
    if (!email) { if(errEl) errEl.textContent=_t('reg_err_email'); return; }
    if (password !== pass2) { if(errEl) errEl.textContent=_t('reg_err_password'); return; }
    const res = await api('auth.php', { action:'register', email, username, password }, 'POST');
    if (res.error) { if(errEl) errEl.textContent = res.error; return; }
    if (res.pending_verification) {
        showVerifyPanel(email);
    }
}

// ── EMAIL VERIFICATION PANEL ────────────────────────────────────────────────
let _verifyEmail = '';
let _verifyResendTimer = null;

function showVerifyPanel(email) {
    _verifyEmail = email;
    // Hide register form, show verify panel
    const authBox = document.querySelector('.auth-box');
    if (!authBox) return;

    // Create verify panel if not exists
    let panel = document.getElementById('verify-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'verify-panel';
        panel.style.cssText = 'display:none;flex-direction:column;gap:16px;';
        panel.innerHTML = `
            <div style="text-align:center;margin-bottom:4px;">
                <div style="font-size:38px;margin-bottom:8px;">📧</div>
                <div id="verify-title-txt" style="font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:6px;"></div>
                <div id="verify-sub-txt" style="font-size:0.82rem;color:#94a3b8;line-height:1.5;"></div>
                <div id="verify-email-txt" style="font-size:0.9rem;font-weight:700;color:#FFD700;margin-top:4px;"></div>
            </div>
            <div style="display:flex;gap:8px;justify-content:center;margin:8px 0;" id="verify-digits-wrap">
                ${[0,1,2,3,4,5].map(i=>`<input id="vd${i}" type="text" inputmode="numeric" maxlength="1"
                    style="width:44px;height:54px;text-align:center;font-size:22px;font-weight:800;
                    background:#0a0f1e;border:2px solid #FFD70044;border-radius:10px;color:#FFD700;
                    outline:none;transition:border-color .2s;" />`).join('')}
            </div>
            <div id="verify-error" style="color:#ff6b6b;font-size:0.82rem;min-height:18px;text-align:center;"></div>
            <button id="verify-submit-btn" onclick="doVerifyCode()"
                style="width:100%;padding:13px;background:linear-gradient(135deg,#FFD700,#B8860B);
                color:#000;border:none;border-radius:10px;font-weight:800;font-size:1rem;cursor:pointer;">
            </button>
            <div style="text-align:center;margin-top:4px;">
                <button id="verify-resend-btn" onclick="doResendCode()"
                    style="background:none;border:none;font-size:0.82rem;cursor:pointer;color:#FFD700;font-weight:600;padding:4px 8px;border-radius:6px;"></button>
            </div>
        `;
        authBox.appendChild(panel);

        // Auto-advance digits
        for (let i = 0; i < 6; i++) {
            const inp = document.getElementById(`vd${i}`);
            inp.addEventListener('input', () => {
                inp.value = inp.value.replace(/\D/g,'').slice(-1);
                if (inp.value && i < 5) document.getElementById(`vd${i+1}`).focus();
            });
            inp.addEventListener('keydown', e => {
                if (e.key === 'Backspace' && !inp.value && i > 0) document.getElementById(`vd${i-1}`).focus();
                if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); doVerifyCode(); }
            });
            inp.addEventListener('focus', () => { inp.style.borderColor='#FFD700'; });
            inp.addEventListener('blur', () => { inp.style.borderColor='#FFD70044'; });
        }
    }

    // Update texts
    document.getElementById('verify-title-txt').textContent = _t('verify_title');
    document.getElementById('verify-sub-txt').textContent   = _t('verify_subtitle');
    document.getElementById('verify-email-txt').textContent = email;
    document.getElementById('verify-submit-btn').textContent = _t('verify_btn');
    document.getElementById('verify-error').textContent = '';

    // Nasconde tutti i pannelli interni dell'auth box e mostra il pannello di verifica
    // al posto dei form di registrazione/login (i selettori coprono tutti gli elementi visibili)
    ['login-form', 'register-form', 'forgot-form'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    authBox.querySelectorAll('.auth-tabs, .auth-forgot').forEach(el => el.style.display = 'none');
    panel.style.display = 'flex';

    // Start resend countdown
    startResendCountdown();
    document.getElementById('vd0')?.focus();
}

function startResendCountdown() {
    const btn = document.getElementById('verify-resend-btn');
    if (!btn) return;
    clearInterval(_verifyResendTimer);
    let secs = 30;
    btn.disabled = true;
    btn.style.opacity = '0.45';
    btn.style.cursor = 'default';
    const tick = () => {
        btn.textContent = `${_t('verify_resend_wait')} ${secs}s`;
        if (secs <= 0) {
            clearInterval(_verifyResendTimer);
            btn.textContent = _t('verify_resend');
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
        secs--;
    };
    tick();
    _verifyResendTimer = setInterval(tick, 1000);
}

async function doVerifyCode() {
    const code = [0,1,2,3,4,5].map(i => document.getElementById(`vd${i}`)?.value || '').join('');
    const errEl = document.getElementById('verify-error');
    if (errEl) errEl.textContent = '';
    if (code.length !== 6) { if(errEl) errEl.textContent = _t('verify_err_code'); return; }
    const btn = document.getElementById('verify-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    const res = await api('auth.php', { action:'verify_code', email:_verifyEmail, code }, 'POST');
    if (btn) { btn.disabled = false; btn.textContent = _t('verify_btn'); }
    if (res.error) { if(errEl) errEl.textContent = res.error; [0,1,2,3,4,5].forEach(i=>{ const d=document.getElementById(`vd${i}`); if(d){d.value='';d.style.borderColor='#ff6b6b';} }); document.getElementById('vd0')?.focus(); return; }
    authToken = res.token;
    localStorage.setItem('gs_token', authToken);
    localStorage.setItem('gs_email', _verifyEmail);
    if (res.username) localStorage.setItem('gs_username', res.username);
    clearInterval(_verifyResendTimer);
    toast(_t('verify_success'), 'gold');
    currentCareerId = null;
    showCareerSelect([], _verifyEmail);
}

async function doResendCode() {
    const btn = document.getElementById('verify-resend-btn');
    if (btn && btn.disabled) return;
    const res = await api('auth.php', { action:'resend_code', email:_verifyEmail }, 'POST');
    if (res.error) { const errEl=document.getElementById('verify-error'); if(errEl) errEl.textContent=res.error; return; }
    startResendCountdown();
    toast('📧 ' + (_t('verify_resend')), 'gold');
}

async function doForgot() {
    const email = document.getElementById('f-email')?.value.trim();
    const errEl = document.getElementById('forgot-error');
    if (errEl) errEl.textContent = '';
    const res = await api('auth.php', { action:'request_reset', email }, 'POST');
    if (res.error) { if(errEl) errEl.textContent = res.error; return; }
    if (errEl) { errEl.style.color='#4caf50'; errEl.textContent = res.msg || 'Istruzioni inviate!'; }
}

// ── GUEST MODE ──────────────────────────────────────────────────────────────
let _isGuestMode = false;

function startGuestMode() {
    _isGuestMode = true;
    // Crea un player demo in memoria senza toccare il server
    currentPlayer = {
        id: 'guest', career_name: 'Demo Career', player_name: 'Guest Player',
        gender: 'male', age: 20, overall: 65,
        tiro: 62, velocita: 68, dribbling: 65, fisico: 63, mentalita: 64,
        popolarita: 15, energia: 85, morale: 75,
        soldi: 25000, gol_carriera: 0, assist_carriera: 0,
        trofei: 0, palloni_doro: 0, struttura_livello: 0,
        team_id: 1, team_nome: 'FC Demo', team_stelle: 2, team_ovr: 65,
        lega_id: 1, lega_nome: 'Seria Alfa', lega_livello: 1,
        nazione_nome: 'Italy',
        mese_corrente: 9, anno_corrente: 1,
        infortuni_mesi: 0, trasferimento_anno: 0,
        piede_forte: 3, piede_debole: 2, livello_skill: 2,
        moltiplicatore_stipendio: 100,
        skin_color: 'medium', skin_hair: 'short_black',
        eye_color: 'brown', hair_color: '#1a1a1a',
        ai_avatar: null,
    };
    currentCareerId = 'guest';

    _applyTranslations();
    _updateNavLabels();
    showPage('dashboard');
    renderDashboard();

    // Banner ospite persistente
    _showGuestBanner();
}

function _showGuestBanner() {
    let banner = document.getElementById('guest-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'guest-banner';
        banner.style.cssText = [
            'position:fixed;bottom:0;left:0;right:0;z-index:2500',
            'background:var(--card2);border-top:2px solid var(--green)',
            'padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px',
            'font-size:0.82rem;color:var(--text-mid)',
        ].join(';');
        document.body.appendChild(banner);
    }
    banner.innerHTML = `
        <span>${_t('guest_banner')}</span>
        <div style="display:flex;gap:8px;align-items:center">
            <span style="color:var(--text-dim);font-size:0.75rem">${_t('guest_save_prompt')}</span>
            <button onclick="exitGuestMode()" style="padding:6px 14px;background:var(--green);color:#000;border:none;border-radius:6px;font-family:var(--font-display);font-weight:800;font-size:0.8rem;letter-spacing:1px;text-transform:uppercase;cursor:pointer">${_t('guest_register_btn')}</button>
        </div>`;
    banner.style.display = 'flex';
}

function exitGuestMode() {
    _isGuestMode = false;
    currentPlayer = null;
    currentCareerId = null;
    const banner = document.getElementById('guest-banner');
    if (banner) banner.style.display = 'none';
    showPage('auth');
    showAuthTab('register');
}

async function doLogout() {
    document.getElementById('exit-dropdown')?.classList.remove('open');
    await api('auth.php', { action:'logout' }, 'POST');
    authToken = null; currentPlayer = null; currentCareerId = null;
    _cachedCareers = null;
    localStorage.removeItem('gs_token');
    localStorage.removeItem('gs_career');
    document.getElementById('auth-box-main').style.display  = 'block';
    document.getElementById('career-select-box').style.display = 'none';
    document.getElementById('create-career-box').style.display = 'none';
    showPage('auth'); showAuthTab('login');
}

// ── CARRIERE ──
function showCareerSelect(careers, email) {
    showPage('auth');
    document.getElementById('auth-box-main').style.display     = 'none';
    document.getElementById('career-select-box').style.display = 'block';
    document.getElementById('create-career-box').style.display = 'none';
    // Ensure nav is always hidden on career-select
    const mn = document.getElementById('main-nav');
    if (mn) mn.style.display = 'none';
    const emailEl = document.getElementById('career-account-email');
    if (emailEl) emailEl.textContent = email || '';
    _cachedCareers = careers; // cache for language-change re-render
    renderCareerList(careers);
    const exitWrap    = document.getElementById('exit-dropdown-wrap');
    const exitOptHome = document.getElementById('exit-opt-home');
    const exitDivHome = document.getElementById('exit-divider-home');
    if (exitWrap) exitWrap.style.display = 'flex';
    const langWrap2 = document.getElementById('lang-switcher-wrap');
    if (langWrap2) langWrap2.style.display = 'flex';
    if (exitOptHome) exitOptHome.style.display = 'none';
    if (exitDivHome) exitDivHome.style.display = 'none';
}

function renderCareerList(careers) {
    const el       = document.getElementById('careers-list');
    const btnNew   = document.getElementById('btn-new-career');
    const limitMsg = document.getElementById('careers-limit-msg');
    if (!el) return;
    if (!careers || careers.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:12px">⚽</div><p>${_t('no_career').replace('\\n','<br>')}</p></div>`;
        if (btnNew) btnNew.style.display = 'block';
        if (limitMsg) limitMsg.style.display = 'none';
        return;
    }
    const gIcon = g => g === 'female' ? '👩' : '👦';
    el.innerHTML = careers.map(c => `
        <div class="career-card" onclick="selectCareer(${c.id})">
            <div class="career-avatar">${
                c.has_ai_avatar
                    ? `<div style="width:52px;height:52px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:1.4rem">🤖</div>`
                    : renderAvatarSVG(c.skin_color||'medium',c.skin_hair||'short_black',c.eye_color||'brown',c.gender||'male',52,c.hair_color||'#1a1a1a')
            }</div>
            <div class="career-info">
                <div class="career-title">${gIcon(c.gender)} ${c.career_name}</div>
                <div class="career-sub">${c.player_name} · OVR ${c.overall} · ${_t('career_year_label')} ${c.anno_corrente}</div>
                <div class="career-sub" style="color:var(--text-dim)">${c.team_nome||''} ${c.lega_nome?'— '+c.lega_nome:''}</div>
                <div class="career-stats">
                    <span>⚽ ${c.gol_carriera} ${_t('stat_gol')}</span>
                    <span>🏆 ${c.trofei} ${_t('stat_trofei')}</span>
                    <span>🌟 ${c.palloni_doro} ${_t('stat_palloni')}</span>
                </div>
            </div>
            <div class="career-actions" onclick="event.stopPropagation()">
                <button onclick="renameCareer(${c.id},'${(c.career_name||'').replace(/'/g,"\\'")}')" title="${_t('tooltip_rename')}">✏️</button>
                <button onclick="confirmDeleteCareer(${c.id},'${(c.career_name||'').replace(/'/g,"\\'")}')" title="${_t('tooltip_delete')}" style="color:#ff6b6b">🗑️</button>
            </div>
        </div>`).join('');
    if (careers.length >= 5) { if(btnNew) btnNew.style.display='none'; if(limitMsg) limitMsg.style.display='block'; }
    else { if(btnNew) btnNew.style.display='block'; if(limitMsg) limitMsg.style.display='none'; }
}

async function selectCareer(id) {
    currentCareerId = id; localStorage.setItem('gs_career', id);
    if (window.GS_Achievements) GS_Achievements.setCareer(id);
    await loadPlayer();
    // Reapply language after entering game so nav and all data-i18n elements are correct
    _applyTranslations();
    _updateNavLabels();
    showPage('dashboard');
}

function showCreateCareer() {
    const cnInput = document.getElementById('c-career-name');
    if (cnInput) cnInput.value = _t('default_career_name');

    document.getElementById('career-select-box').style.display = 'none';
    document.getElementById('create-career-box').style.display = 'flex';
    // Reset all wizard step panels to avoid stale state from previous sessions
    for (let i = 1; i <= 4; i++) {
        const p = document.getElementById(`cc-step-${i}`);
        if (p) { p.classList.remove('active', 'exit'); }
    }
    selectedSkin = '#C68642'; selectedEye = '#5C3317';
    selectedHairStyle = 'short'; selectedHairColor = '#1a1a1a';
    // Reset to default mode every time we open
    _aiAvatarUrl = null;
    _aiPromptSaved = null;
    setAvatarMode('default');
    buildSkinTonePicker();
    buildHairPicker();
    buildEyePicker();
    updateAvatar();
    // Wizard init
    _ccCurrentStep = 1; _ccGender = 'male'; _ccFoot = 'dx'; _ccRole = 'bomber';
    ccGoStep(1);
    setTimeout(() => {
        ccBuildNationList();
        ccBuildRoleGrid();
        // Inizializza il trigger con la nazione di default
        const defNat = CC_ALL_NATIONS.find(n => n.key === 'Italy') || CC_ALL_NATIONS[0];
        if (defNat) {
            const triggerFlag = document.getElementById('cc-trigger-flag');
            const triggerName = document.getElementById('cc-trigger-name');
            if (triggerFlag) triggerFlag.src = 'https://flagcdn.com/w40/' + defNat.iso + '.png';
            if (triggerName) triggerName.textContent = {it:'Italia',en:'Italy',de:'Italien',es:'Italia'}[currentLang]||'Italia';
            const trigger = document.getElementById('cc-nation-trigger');
            if (trigger) trigger.style.setProperty('--nat-color', defNat.color || '#888');
        }
        // Chiudi dropdown cliccando fuori
        document.addEventListener('click', function _natOutside(e) {
            if (!e.target.closest('#cc-nation-dropdown')) {
                document.getElementById('cc-nation-panel')?.classList.remove('open');
                document.getElementById('cc-nation-dropdown')?.classList.remove('open');
            }
        }, { capture: true, once: false });
    }, 50);
}

// ── Character Creation Wizard ────────────────────────────────────────────────
let _ccCurrentStep = 1;
let _ccGender = 'male';
let _ccFoot = 'dx';
let _ccRole = 'bomber';
const CC_ROLES = [
    { id:'bomber',        statKey:'tiro',      icon:'⚽' },
    { id:'fantasista',    statKey:'dribbling', icon:'✨' },
    { id:'ala',           statKey:'velocita',  icon:'⚡' },
    { id:'regista',       statKey:'mentalita', icon:'🧠' },
    { id:'tuttocampista', statKey:'fisico',    icon:'💪' },
];
const CC_ALL_NATIONS = [
    {key:'Albania',      key_it:'Albania',          key_de:'Albanien',        key_es:'Albania',         iso:'al', color:'#e41e20'},
    {key:'Algeria',      key_it:'Algeria',          key_de:'Algerien',        key_es:'Argelia',         iso:'dz', color:'#006233'},
    {key:'Argentina',    key_it:'Argentina',        key_de:'Argentinien',     key_es:'Argentina',       iso:'ar', color:'#74acdf'},
    {key:'Australia',    key_it:'Australia',        key_de:'Australien',      key_es:'Australia',       iso:'au', color:'#00008b'},
    {key:'Austria',      key_it:'Austria',          key_de:'Österreich',      key_es:'Austria',         iso:'at', color:'#ed2939'},
    {key:'Belgium',      key_it:'Belgio',           key_de:'Belgien',         key_es:'Bélgica',         iso:'be', color:'#ef3340'},
    {key:'Bolivia',      key_it:'Bolivia',          key_de:'Bolivien',        key_es:'Bolivia',         iso:'bo', color:'#d52b1e'},
    {key:'Bosnia',       key_it:'Bosnia',           key_de:'Bosnien',         key_es:'Bosnia',          iso:'ba', color:'#002395'},
    {key:'Brazil',       key_it:'Brasile',          key_de:'Brasilien',       key_es:'Brasil',          iso:'br', color:'#009c3b'},
    {key:'Bulgaria',     key_it:'Bulgaria',         key_de:'Bulgarien',       key_es:'Bulgaria',        iso:'bg', color:'#00966e'},
    {key:'Cameroon',     key_it:'Camerun',          key_de:'Kamerun',         key_es:'Camerún',         iso:'cm', color:'#007a5e'},
    {key:'Canada',       key_it:'Canada',           key_de:'Kanada',          key_es:'Canadá',          iso:'ca', color:'#ff0000'},
    {key:'Chile',        key_it:'Cile',             key_de:'Chile',           key_es:'Chile',           iso:'cl', color:'#d52b1e'},
    {key:'China',        key_it:'Cina',             key_de:'China',           key_es:'China',           iso:'cn', color:'#de2910'},
    {key:'Colombia',     key_it:'Colombia',         key_de:'Kolumbien',       key_es:'Colombia',        iso:'co', color:'#fcd116'},
    {key:'CostaRica',    key_it:'Costa Rica',       key_de:'Costa Rica',      key_es:'Costa Rica',      iso:'cr', color:'#002b7f'},
    {key:'Croatia',      key_it:'Croazia',          key_de:'Kroatien',        key_es:'Croacia',         iso:'hr', color:'#e31837'},
    {key:'CzechRepublic',key_it:'Rep. Ceca',        key_de:'Tschechien',      key_es:'Rep. Checa',      iso:'cz', color:'#d7141a'},
    {key:'DRCongo',      key_it:'Congo DR',         key_de:'DR Kongo',        key_es:'RD Congo',        iso:'cd', color:'#007fff'},
    {key:'Denmark',      key_it:'Danimarca',        key_de:'Dänemark',        key_es:'Dinamarca',       iso:'dk', color:'#c60c30'},
    {key:'Ecuador',      key_it:'Ecuador',          key_de:'Ecuador',         key_es:'Ecuador',         iso:'ec', color:'#ffd100'},
    {key:'Egypt',        key_it:'Egitto',           key_de:'Ägypten',         key_es:'Egipto',          iso:'eg', color:'#ce1126'},
    {key:'England',      key_it:'Inghilterra',      key_de:'England',         key_es:'Inglaterra',      iso:'gb-eng', color:'#cf142b'},
    {key:'Finland',      key_it:'Finlandia',        key_de:'Finnland',        key_es:'Finlandia',       iso:'fi', color:'#003580'},
    {key:'France',       key_it:'Francia',          key_de:'Frankreich',      key_es:'Francia',         iso:'fr', color:'#002395'},
    {key:'Germany',      key_it:'Germania',         key_de:'Deutschland',     key_es:'Alemania',        iso:'de', color:'#555'},
    {key:'Ghana',        key_it:'Ghana',            key_de:'Ghana',           key_es:'Ghana',           iso:'gh', color:'#006b3f'},
    {key:'Greece',       key_it:'Grecia',           key_de:'Griechenland',    key_es:'Grecia',          iso:'gr', color:'#0d5eaf'},
    {key:'Hungary',      key_it:'Ungheria',         key_de:'Ungarn',          key_es:'Hungría',         iso:'hu', color:'#ce2939'},
    {key:'Iceland',      key_it:'Islanda',          key_de:'Island',          key_es:'Islandia',        iso:'is', color:'#003897'},
    {key:'Iran',         key_it:'Iran',             key_de:'Iran',            key_es:'Irán',            iso:'ir', color:'#239f40'},
    {key:'Ireland',      key_it:'Irlanda',          key_de:'Irland',          key_es:'Irlanda',         iso:'ie', color:'#169b62'},
    {key:'Italy',        key_it:'Italia',           key_de:'Italien',         key_es:'Italia',          iso:'it', color:'#009246'},
    {key:'Ivory_Coast',  key_it:"Costa d'Avorio",   key_de:'Elfenbeinküste',  key_es:'Costa de Marfil', iso:'ci', color:'#f77f00'},
    {key:'Jamaica',      key_it:'Giamaica',         key_de:'Jamaika',         key_es:'Jamaica',         iso:'jm', color:'#000000'},
    {key:'Japan',        key_it:'Giappone',         key_de:'Japan',           key_es:'Japón',           iso:'jp', color:'#bc002d'},
    {key:'Mali',         key_it:'Mali',             key_de:'Mali',            key_es:'Malí',            iso:'ml', color:'#14b53a'},
    {key:'Mexico',       key_it:'Messico',          key_de:'Mexiko',          key_es:'México',          iso:'mx', color:'#006847'},
    {key:'Montenegro',   key_it:'Montenegro',       key_de:'Montenegro',      key_es:'Montenegro',      iso:'me', color:'#d4af37'},
    {key:'Morocco',      key_it:'Marocco',          key_de:'Marokko',         key_es:'Marruecos',       iso:'ma', color:'#c1272d'},
    {key:'Netherlands',  key_it:'Olanda',           key_de:'Niederlande',     key_es:'Países Bajos',    iso:'nl', color:'#ae1c28'},
    {key:'Nigeria',      key_it:'Nigeria',          key_de:'Nigeria',         key_es:'Nigeria',         iso:'ng', color:'#008751'},
    {key:'Norway',       key_it:'Norvegia',         key_de:'Norwegen',        key_es:'Noruega',         iso:'no', color:'#ef2b2d'},
    {key:'Paraguay',     key_it:'Paraguay',         key_de:'Paraguay',        key_es:'Paraguay',        iso:'py', color:'#d52b1e'},
    {key:'Peru',         key_it:'Perù',             key_de:'Peru',            key_es:'Perú',            iso:'pe', color:'#d91023'},
    {key:'Poland',       key_it:'Polonia',          key_de:'Polen',           key_es:'Polonia',         iso:'pl', color:'#dc143c'},
    {key:'Portugal',     key_it:'Portogallo',       key_de:'Portugal',        key_es:'Portugal',        iso:'pt', color:'#006600'},
    {key:'Qatar',        key_it:'Qatar',            key_de:'Katar',           key_es:'Catar',           iso:'qa', color:'#8d1b3d'},
    {key:'Romania',      key_it:'Romania',          key_de:'Rumänien',        key_es:'Rumanía',         iso:'ro', color:'#002b7f'},
    {key:'Russia',       key_it:'Russia',           key_de:'Russland',        key_es:'Rusia',           iso:'ru', color:'#cc0000'},
    {key:'SaudiArabia',  key_it:'Arabia Saudita',   key_de:'Saudi-Arabien',   key_es:'Arabia Saudita',  iso:'sa', color:'#006c35'},
    {key:'Scotland',     key_it:'Scozia',           key_de:'Schottland',      key_es:'Escocia',         iso:'gb-sct', color:'#003078'},
    {key:'Senegal',      key_it:'Senegal',          key_de:'Senegal',         key_es:'Senegal',         iso:'sn', color:'#00853f'},
    {key:'Serbia',       key_it:'Serbia',           key_de:'Serbien',         key_es:'Serbia',          iso:'rs', color:'#c6363c'},
    {key:'Slovakia',     key_it:'Slovacchia',       key_de:'Slowakei',        key_es:'Eslovaquia',      iso:'sk', color:'#0b4ea2'},
    {key:'Slovenia',     key_it:'Slovenia',         key_de:'Slowenien',       key_es:'Eslovenia',       iso:'si', color:'#003da5'},
    {key:'SouthAfrica',  key_it:'Sudafrica',        key_de:'Südafrika',       key_es:'Sudáfrica',       iso:'za', color:'#007749'},
    {key:'SouthKorea',   key_it:'Corea del Sud',    key_de:'Südkorea',        key_es:'Corea del Sur',   iso:'kr', color:'#cd2e3a'},
    {key:'Spain',        key_it:'Spagna',           key_de:'Spanien',         key_es:'España',          iso:'es', color:'#c60b1e'},
    {key:'Sweden',       key_it:'Svezia',           key_de:'Schweden',        key_es:'Suecia',          iso:'se', color:'#006aa7'},
    {key:'Switzerland',  key_it:'Svizzera',         key_de:'Schweiz',         key_es:'Suiza',           iso:'ch', color:'#ff0000'},
    {key:'Tunisia',      key_it:'Tunisia',          key_de:'Tunesien',        key_es:'Túnez',           iso:'tn', color:'#e70013'},
    {key:'Turkey',       key_it:'Turchia',          key_de:'Türkei',          key_es:'Turquía',         iso:'tr', color:'#e30a17'},
    {key:'Ukraine',      key_it:'Ucraina',          key_de:'Ukraine',         key_es:'Ucrania',         iso:'ua', color:'#005bbb'},
    {key:'Uruguay',      key_it:'Uruguay',          key_de:'Uruguay',         key_es:'Uruguay',         iso:'uy', color:'#5aaaa8'},
    {key:'USA',          key_it:'USA',              key_de:'USA',             key_es:'EE. UU.',          iso:'us', color:'#3c3b6e'},
    {key:'Venezuela',    key_it:'Venezuela',        key_de:'Venezuela',       key_es:'Venezuela',       iso:'ve', color:'#cf142b'},
    {key:'Wales',        key_it:'Galles',           key_de:'Wales',           key_es:'Gales',           iso:'gb-wls', color:'#00ab39'},
];

function ccGoStep(n) {
    // Reset ALL panels first to avoid stale 'active' classes from previous sessions
    for (let i = 1; i <= 4; i++) {
        const p = document.getElementById(`cc-step-${i}`);
        if (p) { p.classList.remove('active'); p.classList.remove('exit'); }
    }
    const old = document.getElementById(`cc-step-${_ccCurrentStep}`);
    if (old && _ccCurrentStep !== n) { old.classList.add('exit'); setTimeout(() => old.classList.remove('exit'), 300); }
    _ccCurrentStep = n;
    const panel = document.getElementById(`cc-step-${n}`);
    if (panel) { setTimeout(() => panel.classList.add('active'), 50); }
    // Pills
    for (let i = 1; i <= 4; i++) {
        const pill = document.getElementById(`pill-${i}`);
        if (!pill) continue;
        pill.className = 'cc-step-pill' + (i < n ? ' done' : i === n ? ' active' : '');
    }
    for (let i = 1; i <= 3; i++) {
        const line = document.getElementById(`line-${i}-${i+1}`);
        if (line) line.className = 'cc-step-line' + (i < n ? ' done' : '');
    }
    if (n === 4) ccBuildSummary();
}

function ccNextStep(from) {
    if (from === 1) {
        const name = document.getElementById('c-name')?.value.trim();
        if (!name) { ccShakeField('c-name'); return; }
    }
    if (from === 2) {
        const isAIMode  = document.getElementById('btn-mode-ai')?.classList.contains('active');
            if (isAIMode && !_aiPromptSaved) {
            const errEl = document.getElementById('create-error');
            if (errEl) errEl.textContent = _t('ai_avatar_err_nogen');
            return;
        }
    }
    ccGoStep(from + 1);
}

function ccShakeField(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.borderColor = 'var(--red)';
    el.classList.add('cc-shake');
    setTimeout(() => { el.style.borderColor = ''; el.classList.remove('cc-shake'); }, 600);
    el.focus();
}

function ccSetGender(val) {
    if (_ccGender === val) return; // nessun cambiamento, evita reset inutile
    _ccGender = val;
    document.querySelectorAll('#gender-toggle .cc-toggle').forEach(b => b.classList.toggle('active', b.dataset.val === val));
    updateAvatar();

    // Se c'era un avatar AI generato col sesso precedente, va invalidato:
    // mostrarlo con il sesso sbagliato o rigenerarlo silenziosamente sarebbe confuso.
    if (_aiAvatarUrl) {
        _aiAvatarUrl   = null;
        _aiPromptSaved = null;
        // Se siamo nel tab AI, mostra l'hint invece della vecchia immagine
        const aiPanel = document.getElementById('avatar-ai-panel');
        if (aiPanel && aiPanel.style.display !== 'none') {
            const prev     = document.getElementById('avatar-preview');
            const statusEl = document.getElementById('ai-status');
            const btn      = document.getElementById('ai-generate-btn');
            if (prev)     prev.innerHTML = `<div style="color:var(--text-dim);font-size:0.75rem;text-align:center;padding:16px;line-height:1.5">${_t('ai_preview_hint')}</div>`;
            if (statusEl) statusEl.textContent = _t('ai_gender_changed') || '⚠️ Sesso cambiato — rigenera l\'immagine';
            if (btn)      btn.textContent = _t('btn_generate_img');
        }
    }
}

function ccSetFoot(val) {
    _ccFoot = val;
    document.getElementById('c-piede-preferito').value = val;
    document.querySelectorAll('#foot-toggle .cc-toggle').forEach(b => b.classList.toggle('active', b.dataset.val === val));
}

function ccAgeStep(delta) {
    const input = document.getElementById('c-age');
    const display = document.getElementById('c-age-display');
    let val = parseInt(input.value) + delta;
    val = Math.max(16, Math.min(22, val));
    input.value = val;
    display.textContent = val;
}

function ccBuildNationList(filter = '') {
    const list = document.getElementById('cc-nation-list');
    if (!list) return;
    const current = document.getElementById('c-nationality')?.value || 'Italy';
    const fLow = filter.toLowerCase();

    // Pick name key for current language
    const nameKey = { en: 'key', it: 'key_it', de: 'key_de', es: 'key_es' }[currentLang] || 'key_it';
    const locale  = { en: 'en', it: 'it', de: 'de', es: 'es' }[currentLang] || 'it';
    let sorted = [...CC_ALL_NATIONS].sort((a, b) =>
        (a[nameKey] || a.key).localeCompare(b[nameKey] || b.key, locale)
    );

    if (filter) {
        sorted = sorted.filter(n =>
            n.key.toLowerCase().includes(fLow) ||
            (n.key_it || '').toLowerCase().includes(fLow) ||
            (n.key_de || '').toLowerCase().includes(fLow) ||
            (n.key_es || '').toLowerCase().includes(fLow) ||
            n.key.toLowerCase().replace(/_/g,' ').includes(fLow)
        );
    }

    list.innerHTML = sorted.map(n => {
        const name = (n[nameKey] || n.key).replace(/_/g,' ');
        return `<div class="cc-nation-item ${n.key === current ? 'active' : ''}"
             style="--nat-color: ${n.color || '#888'};"
             onclick="ccSelectNation('${n.key}')">
            <img class="cc-nation-flag-img"
                 src="https://flagcdn.com/w40/${n.iso}.png"
                 alt="${n.key}"
                 onerror="this.style.display='none'">
            <span class="cc-nation-name">${name}</span>
        </div>`;
    }).join('');
}

function ccFilterNations(val) {
    ccBuildNationList(val);
}

function ccToggleNationDropdown() {
    const panel = document.getElementById('cc-nation-panel');
    const dropdown = document.getElementById('cc-nation-dropdown');
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
        panel.classList.remove('open');
        dropdown?.classList.remove('open');
    } else {
        panel.classList.add('open');
        dropdown?.classList.add('open');
        ccBuildNationList('');
        const search = document.getElementById('cc-nation-search-input');
        if (search) { search.value = ''; search.focus(); }
        // Scroll to active item
        setTimeout(() => {
            const active = panel.querySelector('.cc-nation-item.active');
            if (active) active.scrollIntoView({ block: 'nearest' });
        }, 60);
    }
}

function ccSelectNation(key) {
    document.getElementById('c-nationality').value = key;
    const n = CC_ALL_NATIONS.find(n => n.key === key);
    if (n) {
        const nameKey = { en: 'key', it: 'key_it', de: 'key_de', es: 'key_es' }[currentLang] || 'key_it';
        const name = (n[nameKey] || n.key).replace(/_/g,' ');
        const triggerFlag = document.getElementById('cc-trigger-flag');
        const triggerName = document.getElementById('cc-trigger-name');
        if (triggerFlag) { triggerFlag.src = 'https://flagcdn.com/w40/' + n.iso + '.png'; triggerFlag.alt = n.key; }
        if (triggerName) triggerName.textContent = name;
        const trigger = document.getElementById('cc-nation-trigger');
        if (trigger) trigger.style.setProperty('--nat-color', n.color || '#888');
    }
    // Close dropdown
    document.getElementById('cc-nation-panel')?.classList.remove('open');
    document.getElementById('cc-nation-dropdown')?.classList.remove('open');
    // Rebuild to update active state
    ccBuildNationList(document.getElementById('cc-nation-search-input')?.value || '');
}

function ccBuildRoleGrid() {
    const grid = document.getElementById('cc-role-grid');
    if (!grid) return;
    grid.innerHTML = CC_ROLES.map(r => `
        <div class="cc-role-card ${r.id === _ccRole ? 'active' : ''}" onclick="ccSelectRole('${r.id}')">
            <div class="cc-role-icon">${r.icon}</div>
            <div class="cc-role-name" data-i18n="cc_role_${r.id}">${_t('cc_role_'+r.id)}</div>
            <div class="cc-role-sub" data-i18n="cc_role_${r.id}_sub">${_t('cc_role_'+r.id+'_sub')}</div>
        </div>
    `).join('');
}

function ccSelectRole(id) {
    _ccRole = id;
    document.getElementById('c-role').value = id;
    document.querySelectorAll('.cc-role-card').forEach(c => c.classList.toggle('active', c.onclick?.toString().includes(`'${id}'`)));
    ccBuildRoleGrid();
}

function ccBuildSummary() {
    const name = document.getElementById('c-name')?.value.trim() || '—';
    const career = document.getElementById('c-career-name')?.value.trim() || _t('default_career_name');
    const age = document.getElementById('c-age')?.value || '17';
    const natKey = document.getElementById('c-nationality')?.value || 'Italy';
    const nation = CC_ALL_NATIONS.find(n => n.key === natKey);
    const role = CC_ROLES.find(r => r.id === _ccRole);
    const foot = _ccFoot === 'dx' ? _t('foot_right') : _t('foot_left');

    document.getElementById('cc-summary-name').textContent = name;
    document.getElementById('cc-summary-career').textContent = career;
    document.getElementById('cc-summary-tags').innerHTML = [
        `<span class="cc-tag" style="border: 1.5px solid ${nation?.color||'var(--border)'};">${({en:natKey.replace(/_/g,' '),it:nation?.key_it||natKey,de:nation?.key_de||natKey,es:nation?.key_es||natKey})[currentLang]||nation?.key_it||natKey}</span>`,
        `<span class="cc-tag">🎂 ${age} ${{it:'anni',en:'yrs',de:'J.',es:'años'}[currentLang]||'anni'}</span>`,
        `<span class="cc-tag">${role?.icon||''} ${_t('cc_role_'+_ccRole)}</span>`,
        `<span class="cc-tag">🦶 ${foot}</span>`,
    ].join('');

    // Clone avatar nella summary
    // Se siamo in modalità AI usiamo direttamente _aiAvatarUrl per evitare la race
    // condition in cui il clone cattura lo spinner mentre l'img sta ancora caricando
    const dest = document.getElementById('cc-summary-avatar');
    if (dest) {
        const isAI = document.getElementById('btn-mode-ai')?.classList.contains('active');
        if (isAI && _aiAvatarUrl) {
            dest.innerHTML = `<img src="${_aiAvatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="avatar">`;
        } else {
            const src = document.getElementById('avatar-preview');
            if (src) dest.innerHTML = src.innerHTML;
        }
    }
}


// ── AI Avatar mode ────────────────────────────────────────────────────────
let _aiAvatarUrl   = null;  // URL o data URL dell'immagine AI generata
let _aiGenerating  = false; // flag anti-doppio-click

function setAvatarMode(mode) {
    const isAI  = mode === 'ai';
    const isDef = mode === 'default';
    // Toggle tabs
    document.getElementById('btn-mode-default')?.classList.toggle('active', isDef);
    document.getElementById('btn-mode-ai')?.classList.toggle('active', isAI);
    
    // Toggle panels
    const defPanel = document.getElementById('avatar-default-panel');
    const aiPanel  = document.getElementById('avatar-ai-panel');
    
    if (defPanel) defPanel.style.display = isDef  ? 'block' : 'none';
    if (aiPanel)  aiPanel.style.display  = isAI   ? 'block' : 'none';
    
    // Sesso: nascosto in AI
    const genderRow = document.getElementById('gender-row');
    if (genderRow) genderRow.style.display = isAI ? 'none' : '';
    // Preview: torna all'SVG se si torna a default, ma NON azzera _aiAvatarUrl
    // così se l'utente clicca accidentalmente Default e torna in AI, l'immagine è ancora lì
    if (isDef) {
        const prev = document.getElementById('avatar-preview');
        if (prev) prev.innerHTML = '';
        updateAvatar();
    } else if (isAI && _aiAvatarUrl) {
        _showAIPreview(_aiAvatarUrl);
    } else if (!isDef) {
        const prev = document.getElementById('avatar-preview');
        if (prev) {
            prev.innerHTML = `<div style="color:var(--text-dim);font-size:0.75rem;text-align:center;padding:16px;line-height:1.5">${_t('ai_preview_hint')}</div>`;
        }
    }
}

// Prompt salvato per passarlo al DB al momento della creazione carriera
let _aiPromptSaved = null;  // prompt AI per Pollinations, resettato ad ogni nuova carriera

async function generateAIAvatar() {
    if (_aiGenerating) return; // evita doppio-click / race condition
    const promptEl   = document.getElementById('ai-avatar-prompt');
    const statusEl   = document.getElementById('ai-status');
    const btn        = document.getElementById('ai-generate-btn');
    const userPrompt = promptEl?.value.trim();
    if (!userPrompt) {
        if (statusEl) statusEl.textContent = _t('ai_avatar_err_nodesc');
        promptEl?.focus();
        return;
    }
    _aiGenerating = true;
    if (statusEl) statusEl.textContent = _t('ai_gen_running');
    if (btn) { btn.disabled = true; btn.textContent = _t('ai_avatar_generating'); }

    const prev = document.getElementById('avatar-preview');
    if (prev) prev.innerHTML = '<div class="ai-spinner"></div>';

    try {
        // Proxy PHP → Pollinations.ai (evita problemi CORS, ritorna base64)
        // Passa anche il genere selezionato per generare figura maschile/femminile corretta
        const res = await api('ai_avatar.php', { prompt: userPrompt, gender: _ccGender || 'male' }, 'POST');
        if (res.error) throw new Error(res.error);

        _aiPromptSaved = res.prompt;
        _aiAvatarUrl   = res.url;

        _showAIPreview(res.url, statusEl, btn);
    } catch(e) {
        if (statusEl) statusEl.textContent = '❌ ' + (e.message || _t('error_generic_msg'));
        if (btn) { btn.disabled = false; btn.textContent = _t('btn_generate_img'); }
        if (prev) prev.innerHTML = '<div style="color:var(--text-dim);font-size:0.75rem;text-align:center;padding:16px;line-height:1.5">' + _t('no_preview').replace('\n','<br>') + '</div>';
    } finally {
        _aiGenerating = false;
    }
}

function _showAIPreview(url, statusEl, btn) {
    const prev = document.getElementById('avatar-preview');
    if (!prev) return;
    // Mostra loader finché l'immagine non è caricata
    prev.innerHTML = `<div class="ai-spinner"></div>`;
    const img = new Image();
    img.onload = () => {
        prev.innerHTML = '';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
        prev.appendChild(img);
        if (statusEl) statusEl.textContent = _t('ai_avatar_ready');
        if (btn) { btn.disabled = false; btn.textContent = _t('ai_avatar_regen'); }
    };
    img.onerror = () => {
        prev.innerHTML = `<div style="color:var(--text-dim);font-size:0.72rem;text-align:center;padding:12px;line-height:1.5">${_t('no_preview').replace('\n','<br>')}</div>`;
        if (statusEl) statusEl.textContent = _t('ai_retry_msg');
        if (btn) { btn.disabled = false; btn.textContent = _t('btn_generate_img'); }
    };
    img.src = url;
    img.alt = 'AI Avatar';
}

// Intercetta Enter nel textarea AI per generare

function showCareerSelectBack() {
    document.getElementById('career-select-box').style.display = 'block';
    document.getElementById('create-career-box').style.display = 'none';
}

let _ccCreating = false; // flag anti-doppio-submit creazione carriera

async function doCreateCareer() {
    if (_ccCreating) return;
    const career_name     = (document.getElementById('c-career-name')?.value.trim()) || _t('default_career_name');
    const player_name     = document.getElementById('c-name')?.value.trim();
    const gender          = _ccGender || 'male';
    const age             = document.getElementById('c-age')?.value || '17';
    const nationality     = document.getElementById('c-nationality')?.value || 'Italy';
    const piede_preferito = _ccFoot || 'dx';
    const piede_forte_lato  = piede_preferito;
    const piede_debole_lato = piede_preferito === 'dx' ? 'sx' : 'dx';
    const role            = _ccRole || 'bomber';
    const errEl = document.getElementById('create-error');
    if (errEl) errEl.textContent = '';
    if (!player_name) { ccShakeField('c-name'); ccGoStep(1); return; }

    // Modalità AI: l'avatar è un'immagine generata
    const isAIMode  = document.getElementById('btn-mode-ai')?.classList.contains('active');
    if (isAIMode && (!_aiPromptSaved || !_aiAvatarUrl)) {
        if (errEl) errEl.textContent = _t('ai_avatar_err_nogen');
        return;
    }

    // Disabilita il bottone per evitare doppio submit
    _ccCreating = true;
    const submitBtn = document.querySelector('.cc-btn-start');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳...'; }

    try {
        const res = await api('auth.php', {
            action:'create_career', career_name, player_name, gender, age, nationality, role,
            skin_hair:  isAIMode ? 'ai' : selectedHairStyle,
            skin_color: isAIMode ? 'ai' : selectedSkin,
            eye_color:  isAIMode ? 'ai' : selectedEye,
            hair_color: isAIMode ? 'ai' : selectedHairColor,
            ai_prompt:  isAIMode ? _aiPromptSaved : null,
            ai_avatar:  isAIMode ? _aiAvatarUrl : null,
            piede_forte: 3, piede_debole: 2, piede_forte_lato, piede_debole_lato
        }, 'POST');
        if (res.error) { if(errEl) errEl.textContent = res.error; return; }
        currentCareerId = res.career_id; localStorage.setItem('gs_career', currentCareerId);
        await loadPlayer();
        _applyTranslations();
        _updateNavLabels();
        showPage('dashboard');
        if (window.GS_Particles) GS_Particles.effects.confettiRain();
        toast(_t('welcome_career'), 'gold');
        // Tutorial al PRIMO accesso: reset + avvio immediato alla creazione carriera
        setTimeout(() => {
            if (window.GS_Tutorial) { GS_Tutorial.reset(); GS_Tutorial.start(true); }
        }, 1200);
    } catch(e) {
        if (errEl) errEl.textContent = _t('error_generic_msg');
    } finally {
        _ccCreating = false;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = _t('create_start_btn') || '🌟 Inizia la Carriera!'; }
    }
}

async function renameCareer(id, currentName) {
    try {
    const name = prompt(_t('rename_career_prompt'), currentName);
    if (!name || name.trim() === currentName) return;
    const res = await api('auth.php', { action:'rename_career', career_id:id, name:name.trim() }, 'POST');
    if (res.error) { toast(res.error,'error'); return; }
    renderCareerList(res.careers);
    } catch(e) { console.error('renameCareer error:', e); }
}

async function confirmDeleteCareer(id, name) {
    try {
    if (!confirm(_t('delete_career_confirm').replace('{0}', name))) return;
    const res = await api('auth.php', { action:'delete_career', career_id:id }, 'POST');
    if (res.error) { toast(res.error,'error'); return; }
    renderCareerList(res.careers); toast(_t('career_deleted'),'info');
    } catch(e) { console.error('confirmDeleteCareer error:', e); }
}

// ── LOAD PLAYER ──
async function loadPlayer() {
    if (!currentCareerId) return;
    const [res, agRes] = await Promise.all([
        api('player.php', { action:'get', career_id:currentCareerId }, 'GET'),
        api('agente.php', { action:'get', career_id:currentCareerId }, 'GET')
    ]);
    if (res && !res.error) {
        const agSconti = {1:2.5, 2:5.0, 3:7.5, 4:10.0, 5:15.0};
        res.agent_ovr_sconto = agSconti[agRes?.livello] || 0;
        // Check achievements on any player data load
        if (window.GS_Achievements) GS_Achievements.checkFromPlayer(res);
        // Show contextual tutorial tips
        if (window.GS_AdvancedTutorial) GS_AdvancedTutorial.checkContext(res);
        currentPlayer = res;
    }
}

// ── DASHBOARD ──
function renderDashboard() {
    if (!currentPlayer) return;
    const p = currentPlayer;

    document.getElementById('player-name-display').textContent = p.player_name;
    // Show milestone badge
    if (window.GS_Locale) {
        const m = GS_Locale.getMilestone(parseInt(p.overall || 0));
        const existingBadge = document.getElementById('player-milestone-badge');
        if (existingBadge) { existingBadge.textContent = m.label; existingBadge.style.color = m.color; }
        else {
            const nameEl = document.getElementById('player-name-display');
            const badge = document.createElement('span');
            badge.id = 'player-milestone-badge';
            badge.style.cssText = `font-size:0.68rem;font-weight:800;padding:2px 8px;border-radius:10px;margin-left:8px;color:${m.color};background:rgba(255,255,255,0.05);border:1px solid ${m.color}44;vertical-align:middle`;
            badge.textContent = m.label;
            nameEl.insertAdjacentElement('afterend', badge);
        }
    }
    const _natDisplay = (() => {
        const n = CC_ALL_NATIONS.find(x => x.key === p.nationality);
        if (!n) return p.nationality;
        return ({en:n.key.replace(/_/g,' '),it:n.key_it,de:n.key_de||n.key_it,es:n.key_es||n.key_it})[currentLang]||n.key_it;
    })();
    document.getElementById('player-subtitle').textContent = `${_natDisplay} · ${p.age} ${_t('dash_age')} · ${_t('dash_season_full')} ${p.anno_corrente}`;

    const avatarWrap = document.querySelector('.player-avatar');
    if (avatarWrap) {
        if (p.ai_avatar) {
            avatarWrap.innerHTML = `<img src="${p.ai_avatar}" style="width:72px;height:72px;object-fit:cover;border-radius:50%" alt="avatar">`;
        } else {
            avatarWrap.innerHTML = renderAvatarSVG(p.skin_color||'medium', p.skin_hair||'short_black', p.eye_color||'brown', p.gender||'male', 72, p.hair_color||'#1a1a1a');
        }
        avatarWrap.style.background = 'transparent';
        avatarWrap.style.border = '3px solid var(--gold)';
    }

    const stars = '⭐'.repeat(parseInt(p.team_stelle || 1));
    const legaInfo = p.lega_nome ? ` · ${p.nazione_bandiera || ''} ${p.lega_nome}` : '';
    document.getElementById('player-team').textContent = `${stars} ${p.team_nome || _t('no_team')}${legaInfo}`;

    // OVR circle — anima da 0% → valore reale via rAF (cross-browser)
    const ov = parseInt(p.overall || 0);
    const targetPct = Math.min(100, (ov / 125) * 100);
    const circle = document.getElementById('overall-circle');
    const ovValEl = document.getElementById('overall-value');
    circle.style.setProperty('--pct', '0%');
    ovValEl.textContent = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => {
        _animateCounter(ovValEl, 0, ov, 950);
        _animateOvrCircle(circle, 0, targetPct, 950);
    }));

    ['tiro','velocita','dribbling','fisico','mentalita'].forEach(s => {
        const val = parseInt(p[s] || 0);
        const row = document.querySelector(`[data-stat="${s}"]`);
        if (row) {
            const pct   = Math.min(100,(val/125)*100);
            const bar   = row.querySelector('.stat-bar');
            const valEl = row.querySelector('.stat-value');
            if (val >= 100) { bar.classList.add('stat-bar-super'); valEl.classList.add('legendary'); }
            else { bar.classList.remove('stat-bar-super'); valEl.classList.remove('legendary'); }
            bar.style.transform = 'scaleX(0)';
            valEl.textContent = '0';
            requestAnimationFrame(() => requestAnimationFrame(() => {
                bar.style.transform = `scaleX(${pct / 100})`;
                _animateCounter(valEl, 0, val, 900);
            }));
        }
    });

    renderSpecialBar('energia',    parseInt(p.energia),    'bar-green');
    renderSpecialBar('morale',     parseInt(p.morale),     'bar-blue');
    renderSpecialBar('popolarita', parseInt(p.popolarita), 'bar-purple');

    // Soldi — anima dal valore precedente al nuovo
    const soldiEl = document.getElementById('info-soldi');
    const prevSoldi = parseFloat(soldiEl.dataset.raw ?? p.soldi);
    const newSoldi  = parseFloat(p.soldi);
    soldiEl.dataset.raw = newSoldi;
    if (prevSoldi !== newSoldi) {
        _animateMoneyCounter(soldiEl, prevSoldi, newSoldi, 900);
    } else {
        soldiEl.textContent = formatMoney(newSoldi);
    }

    document.getElementById('info-struttura').textContent = getStrutturaName(p.struttura_livello);

    // Mostra "Stagione X — NomeMese" per chiarire che l'anno è l'anno della stagione
    const _meseNome = getMeseName(p.mese_corrente);
    document.getElementById('info-mese').textContent = `${_t('dash_season')} ${p.anno_corrente} — ${getMeseName(p.mese_corrente, true)}`;

    _loadSeasonStats(p.anno_corrente);

    const pf = parseInt(p.piede_forte || 3);
    const pd = parseInt(p.piede_debole || 2);
    const ls = parseInt(p.livello_skill || 2);
    const pfLato = p.piede_forte_lato === 'sx' ? _t('foot_sx') : _t('foot_dx');
    const pdLato = p.piede_debole_lato === 'sx' ? _t('foot_sx') : _t('foot_dx');
    const pfEl = document.getElementById('info-piede-forte');
    const pdEl = document.getElementById('info-piede-debole');
    const lsEl = document.getElementById('info-livello-skill');
    if (pfEl) pfEl.innerHTML = `${'⭐'.repeat(pf)}${'☆'.repeat(5-pf)} <small style="color:var(--text-dim)">${pfLato}</small>`;
    if (pdEl) pdEl.innerHTML = `${'⭐'.repeat(pd)}${'☆'.repeat(5-pd)} <small style="color:var(--text-dim)">${pdLato}</small>`;
    if (lsEl) lsEl.textContent = '⭐'.repeat(ls) + '☆'.repeat(5-ls) + ` (${ls}/5)`;

    loadDashboardObiettivi();
    loadDashboardNotizie();
    // Attach help tooltips after render
    setTimeout(attachTooltips, 300);
}

async function _loadSeasonStats(anno) {
    try {
    const golEl    = document.getElementById('info-gol');
    const assistEl = document.getElementById('info-assist');
    if (!golEl || !assistEl) return;
    const res = await api('player.php', { action: 'season_detail', anno }, 'GET');
    if (res && !res.error) {
        if (parseInt(res.gol ?? 0) > parseInt(golEl.textContent || '0')) {
            if (window.GS_Particles) GS_Particles.effects.goalCelebration();
        }
        golEl.textContent    = res.gol ?? 0;
        assistEl.textContent = res.assist ?? 0;
    } else {
        golEl.textContent    = 0;
        assistEl.textContent = 0;
    }
    } catch(e) { console.error('_loadSeasonStats error:', e); }
}

function renderSpecialBar(id, val, cls) {
    const el = document.querySelector(`[data-special="${id}"]`);
    if (!el) return;
    const bar   = el.querySelector('.stat-bar');
    const valEl = el.querySelector('.stat-value');
    // Rimuovi eventuali classi colore precedenti prima di aggiungere
    el.classList.remove('bar-green', 'bar-blue', 'bar-purple');
    el.classList.add(cls);
    bar.style.transform = 'scaleX(0)';
    valEl.textContent = '0';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            bar.style.transform = `scaleX(${val / 100})`;
            _animateCounter(valEl, 0, val, 700);
        });
    });
}

// Contatore numerico animato: scorre da `from` a `to` in `duration`ms
function _animateCounter(el, from, to, duration) {
    if (!window.requestAnimationFrame) { el.textContent = to; return; }
    const start = performance.now();
    const diff  = to - from;
    function step(now) {
        const elapsed  = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 4); // easeOutQuart
        el.textContent = Math.round(from + diff * eased);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// Anima il conic-gradient dell'overall circle da fromPct% → toPct%
function _animateOvrCircle(el, fromPct, toPct, duration) {
    if (!window.requestAnimationFrame) { el.style.setProperty('--pct', toPct + '%'); return; }
    const start = performance.now();
    const diff  = toPct - fromPct;
    function step(now) {
        const elapsed  = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 4); // easeOutQuart
        el.style.setProperty('--pct', (fromPct + diff * eased).toFixed(2) + '%');
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// Contatore soldi animato: scorre da `from` a `to` formattando come denaro
function _animateMoneyCounter(el, from, to, duration) {
    if (!window.requestAnimationFrame) { el.textContent = formatMoney(to); return; }
    const start = performance.now();
    const diff  = to - from;
    function step(now) {
        const elapsed  = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 4);
        el.textContent = formatMoney(from + diff * eased);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}
function renderGame() {
    if (!currentPlayer) return;
    // Rebuild actions grid in current language on every render
    _buildActionsGrid();
    // Show training tip
    if (window.GS_Encyclopedia) GS_Encyclopedia.showRandomTip('gs-training-tip-card');
    // Show pre-match hype
    if (window.GS_GameData) setTimeout(() => GS_GameData.showPreMatchHype(), 100);
    const p = currentPlayer;
    const dotsEl = document.getElementById('month-dots');
    dotsEl.innerHTML = '';
    // La stagione va da Settembre(9) a Giugno(6): 9,10,11,12,1,2,3,4,5,6
    const SEASON_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
    const MONTH_ABBR    = [''].concat([1,2,3,4,5,6,7,8,9,10,11,12].map(m => _t('month_'+m)));
    const currentIdx = SEASON_MONTHS.indexOf(p.mese_corrente);

    SEASON_MONTHS.forEach((m, idx) => {
        const dot = document.createElement('div');
        const isDone    = currentIdx > -1 && idx < currentIdx;
        const isCurrent = m === p.mese_corrente;
        dot.className = 'month-dot' + (isDone ? ' done' : isCurrent ? ' current' : '');
        dot.title = MONTH_ABBR[m];
        dotsEl.appendChild(dot);
    });

    // Calcola l'anno di inizio stagione: la stagione inizia a settembre
    // → Set-Dic appartengono all'anno corrente, Gen-Giu all'anno corrente (stesso anno di stagione)
    // Ma per chiarezza mostriamo "Stagione X" che va da set(anno) a giu(anno)
    const meseCorrente = parseInt(p.mese_corrente || 9);
    // Anno di inizio stagione: se siamo in Set-Dic è p.anno_corrente, se in Gen-Giu è p.anno_corrente
    // L'anno della stagione è sempre p.anno_corrente (che avanza solo dopo giugno)
    const annoStagione = parseInt(p.anno_corrente || 1);
    document.getElementById('current-month-text').textContent =
        `${MONTH_ABBR[meseCorrente]} · ${_t('dash_season_full')} ${annoStagione} · ${_t('dash_age')} ${p.age}`;
    document.getElementById('g-overall').textContent = p.overall;
    document.getElementById('g-energia').textContent = p.energia;
    document.getElementById('g-morale').textContent  = p.morale;
    document.getElementById('g-soldi').textContent   = formatMoney(p.soldi);
    selectedActions = [];
    updatePlayBtn();

    const infortuni = parseInt(p.infortuni_mesi ?? 0);
    const energia   = parseInt(p.energia ?? 0);

    // Azioni fisiche — bloccate se infortunato O se energia = 0
    const AZIONI_FISICHE = ['allenamento_tiro','allenamento_velocita','dribbling',
                            'allenamento_fisico','allenamento_speciale'];
    document.querySelectorAll('.action-btn').forEach(b => {
        b.classList.remove('selected', 'action-blocked', 'action-warn');
        const id = b.dataset.action;
        const isFisica = AZIONI_FISICHE.includes(id);
        if (isFisica && (infortuni > 0 || energia === 0)) {
            b.classList.add('action-blocked');
            b.disabled = true;
        } else {
            b.disabled = false;
            // Warning giallo se energia bassa (1-25) per azioni fisiche
            if (isFisica && energia > 0 && energia <= 25) b.classList.add('action-warn');
        }
    });

    // Banner stato sopra la griglia
    const actionsPanel = document.querySelector('.actions-panel');
    const existingBanner = actionsPanel?.querySelector('.game-state-banner');
    if (existingBanner) existingBanner.remove();
    if (actionsPanel) {
        let bannerHTML = '';
        if (infortuni > 0) {
            bannerHTML = _t('default_career_injury_banner').replace('{0}', infortuni).replace('{1}', infortuni===1 ? _t('injury_mese') : _t('injury_mesi'));
        } else if (energia === 0) {
            bannerHTML = _t('energy_zero_banner');
        } else if (energia <= 25) {
            bannerHTML = _t('energy_low_banner').replace('{0}', energia);
        }
        if (bannerHTML) {
            const banner = document.createElement('div');
            banner.className = `game-state-banner ${infortuni > 0 ? 'banner-infortuni' : energia === 0 ? 'banner-no-energia' : 'banner-warn-energia'}`;
            banner.innerHTML = bannerHTML;
            actionsPanel.insertBefore(banner, actionsPanel.querySelector('.actions-grid'));
        }
    }

    updatePlayBtn();
    loadRecentLog();
}

const ACTIONS_DEF = [
    { id: 'allenamento_tiro',      icon: '🎯',
      name_it: 'Allena Tiro',         name_en: 'Shooting Training',  name_de: 'Schusstraining',       name_es: 'Entrenamiento de Disparo',
      desc_it: 'Migliora la precisione in porta',     desc_en: 'Improve shooting accuracy',
      desc_de: 'Verbessere die Genauigkeit vor dem Tor', desc_es: 'Mejora la precisión ante la portería' },
    { id: 'allenamento_velocita',  icon: '⚡',
      name_it: 'Allena Velocità',      name_en: 'Speed Training',     name_de: 'Schnelligkeitstraining', name_es: 'Entrenamiento de Velocidad',
      desc_it: 'Aumenta la velocità di corsa',        desc_en: 'Increase running speed',
      desc_de: 'Erhöhe die Laufgeschwindigkeit',      desc_es: 'Aumenta la velocidad de carrera' },
    { id: 'dribbling',             icon: '🏃',
      name_it: 'Allena Dribbling',     name_en: 'Dribbling',          name_de: 'Dribbling-Training',   name_es: 'Entrenamiento de Regate',
      desc_it: 'Migliora il controllo palla',         desc_en: 'Improve ball control',
      desc_de: 'Verbessere die Ballkontrolle',        desc_es: 'Mejora el control del balón' },
    { id: 'allenamento_fisico',    icon: '💪',
      name_it: 'Allena Fisico',        name_en: 'Physical Training',  name_de: 'Körpertraining',       name_es: 'Entrenamiento Físico',
      desc_it: 'Costruisci massa muscolare',          desc_en: 'Build muscle mass',
      desc_de: 'Baue Muskelmasse auf',               desc_es: 'Desarrolla masa muscular' },
    { id: 'allenamento_mentalita', icon: '🧠',
      name_it: 'Allena Mentalità',     name_en: 'Mental Training',    name_de: 'Mentaltraining',       name_es: 'Entrenamiento Mental',
      desc_it: 'Migliora focus e resistenza mentale', desc_en: 'Improve focus and mental stamina',
      desc_de: 'Verbessere Fokus und mentale Stärke', desc_es: 'Mejora el enfoque y la resistencia mental' },
    { id: 'riposo',                icon: '😴',
      name_it: 'Riposo',               name_en: 'Rest',               name_de: 'Ruhe',                 name_es: 'Descanso',
      desc_it: 'Recupera energia e morale',           desc_en: 'Recover energy and morale',
      desc_de: 'Energie und Moral erholen',           desc_es: 'Recupera energía y moral' },
    { id: 'social',                icon: '📱',
      name_it: 'Attività Social',      name_en: 'Social Activity',    name_de: 'Soziale Aktivitäten',  name_es: 'Actividades Sociales',
      desc_it: 'Aumenta la popolarità',               desc_en: 'Increase popularity',
      desc_de: 'Popularität steigern',                desc_es: 'Aumenta la popularidad' },
    { id: 'allenamento_speciale',  icon: '🔥',
      name_it: 'Allenamento Speciale', name_en: 'Special Training',   name_de: 'Spezialtraining',      name_es: 'Entrenamiento Especial',
      desc_it: 'Alto rischio, alto guadagno',         desc_en: 'High risk, high reward',
      desc_de: 'Hohes Risiko, hoher Gewinn',          desc_es: 'Alto riesgo, alta recompensa' },
];
function getActions() {
    return ACTIONS_DEF.map(a => ({
        id: a.id, icon: a.icon,
        name: {en:a.name_en,de:a.name_de||a.name_en,es:a.name_es||a.name_en,it:a.name_it}[currentLang]||a.name_it,
        desc: {en:a.desc_en,de:a.desc_de||a.desc_en,es:a.desc_es||a.desc_en,it:a.desc_it}[currentLang]||a.desc_it,
    }));
}
function _buildActionsGrid() {
    const grid = document.getElementById('actions-grid');
    if (!grid) return;
    grid.innerHTML = getActions().map(a => `
        <button class="action-btn" data-action="${a.id}" onclick="toggleAction('${a.id}', this)">
            <span class="action-icon">${a.icon}</span>
            <div class="action-name">${a.name}</div>
            <div class="action-desc">${a.desc}</div>
        </button>`).join('');
}

function toggleAction(id, el) {
    if (el.classList.contains('action-blocked')) {
        const infortuni = parseInt(currentPlayer?.infortuni_mesi ?? 0);
        const energia   = parseInt(currentPlayer?.energia ?? 0);
        if (infortuni > 0) toast(_t('injury_blocked'), 'error');
        else if (energia === 0) toast(_t('energy_blocked'), 'error');
        return;
    }
    if (selectedActions.includes(id)) {
        selectedActions = selectedActions.filter(a => a !== id);
        el.classList.remove('selected');
    } else if (selectedActions.length < 3) {
        selectedActions.push(id);
        el.classList.add('selected');
    } else {
        toast(_t('actions_max'), 'error');
    }
    updatePlayBtn();
}

function updatePlayBtn() {
    const btn = document.getElementById('play-month-btn');
    btn.disabled = selectedActions.length === 0;
    btn.textContent = selectedActions.length > 0
        ? `${_t('play_btn_ready')} (${selectedActions.length})`
        : _t('play_btn');
}

document.getElementById('play-month-btn')?.addEventListener('click', async () => {
    if (selectedActions.length === 0) return;
    // Guest mode: non può giocare partite reali
    if (_isGuestMode) {
        toast({it:'👤 Modalità Ospite — registrati per salvare la carriera e giocare!',en:'👤 Guest mode — sign up to save your career and play!',de:'👤 Gastmodus — registriere dich, um deine Karriere zu speichern!',es:'👤 Modo Invitado — regístrate para guardar tu carrera!'}[currentLang]||'👤 Modalità Ospite — registrati per salvare la carriera e giocare!', 'gold');
        setTimeout(() => exitGuestMode(), 1800);
        return;
    }
    const btn = document.getElementById('play-month-btn');
    btn.disabled = true;
    btn.textContent = _t('sim_running');
    const res = await api('game.php', { action: 'play_month', azioni: selectedActions });
    if (res.error) {
        toast(res.error, 'error');
        btn.disabled = false;
        updatePlayBtn();
        return;
    }
    await loadPlayer();

    // Particles for special events
    if (window.GS_Particles) {
        if (res.pallone_doro?.pos === 1 || res.champions_win || res.promozione?.includes('PROMOZIONE')) {
            GS_Particles.effects.confettiRain();
        }
    }

    // Achievements check
    if (window.GS_Achievements && currentPlayer) {
        GS_Achievements.checkMonthResults(res, currentPlayer);
        GS_Achievements.checkFromPlayer(currentPlayer);
    }

    // Live commentary
    if (window.GS_Commentary && res.lega_msgs?.length > 0) {
        const lm = res.lega_msgs[0];
        const seq = GS_Commentary.generateMatchSequence(
            currentPlayer?.player_name || '',
            currentPlayer?.team_nome || '',
            lm.player_gol || 0,
            lm.esito || 'P',
            currentLang
        );
        GS_Commentary.playCommentary(seq, 3500);
    }

    if (res.pallone_doro?.pos === 1) {
        // Show Pallone d'Or speech
        if (window.GS_Locale) {
            const speech = GS_Locale.getPalloneSpeech();
            setTimeout(() => {
                const speechEl = document.getElementById('pd-speech');
                if (speechEl) { speechEl.textContent = speech; speechEl.style.display = 'block'; }
            }, 1500);
        }
        await _showPalloneDoro(res.pallone_doro.msg);
    }
    showResults(res);
    renderGame();
    // Aggiorna dashboard solo se non è già la pagina attiva —
    // se lo è, renderDashboard parte al close del modal tramite _pendingDashboardRefresh
    const dashActive = document.getElementById('dashboard-page')?.classList.contains('active');
    if (dashActive) {
        _pendingDashboardRefresh = true;
    } else {
        renderDashboard();
    }
});

function showResults(res) {
    const modal = document.getElementById('results-modal');
    const list  = document.getElementById('results-list');
    const allenamento = [], infortuni = [], altri = [], champions = [];

    (res.risultati || []).forEach(r => {
        if (r.startsWith('🩹') || r.startsWith('🚑') || r.startsWith('🚨') || r.startsWith('🤕') || r.includes('INFORTUN') || r.includes('infortun') || r.includes('Verletz') || r.includes('lesión') || r.includes('Lesión') || r.includes('blessure')) infortuni.push(r);
        else if (r.startsWith('🎯')||r.startsWith('⚡')||r.startsWith('💪')||
                 r.startsWith('🏃')||r.startsWith('😴')||r.startsWith('📱')||
                 r.startsWith('🔥')||r.startsWith('🧠')) allenamento.push(r);
        else if (r.startsWith('⚽ ')) { /* skip */ }
        else if (r.startsWith('🏆')||r.startsWith('💔 Champions')) champions.push(r);
        else altri.push(r);
    });

    const legaMsgs = res.lega_msgs || [];
    let html = '';

    if (res.pallone_doro?.pos > 0)
        html += `<div class="res-banner">🏆 ${res.pallone_doro.msg}</div>`;
    if (res.fine_carriera)
        html += `<div class="res-banner">${_t('end_career_banner')}</div>`;
    if (res.promozione) {
        const tipo = res.promozione.includes('PROMOZIONE') ? 'promozione' : 'retrocessione';
        html += `<div class="res-banner ${tipo}-banner">${res.promozione}</div>`;
    }
    if (allenamento.length) {
        html += `<div class="res-section"><div class="res-section-title">${_t('res_section_training')}</div>
            <div class="res-row-wrap">${allenamento.map(r=>`<div class="res-chip">${r}</div>`).join('')}</div></div>`;
    }
    if (infortuni.length) {
        html += `<div class="res-section infortuni-section"><div class="res-section-title">${_t('res_section_injuries')}</div>
            ${infortuni.map(r=>`<div class="res-chip danger">${r}</div>`).join('')}</div>`;
    }
    if (legaMsgs.length) {
        const esitoColor = { V:'#4ade80', P:'#facc15', S:'#f87171' };
        const esitoLabel = { V:_t('match_win'), P:_t('match_draw'), S:_t('match_loss') };
        html += `<div class="res-section"><div class="res-section-title">${_t('res_section_matches')}</div><div class="res-matches">`;
        legaMsgs.forEach(m => {
            let esito = (m.esito || '').toString().trim().toUpperCase();
            if (esito !== 'V' && esito !== 'P' && esito !== 'S') esito = 'S';
            if (parseInt(m.gf) === parseInt(m.gs)) esito = 'P';
            const color = esitoColor[esito] || '#aaa';
            const label = esitoLabel[esito] || esito;
            const punti = esito === 'V' ? 3 : esito === 'P' ? 1 : 0;
            html += `<div class="res-match-card" style="border-top:3px solid ${color}" data-gol="${m.player_gol ?? 0}" data-esito="${esito}">
                <div class="res-match-header">
                    <span class="res-match-giornata">G${m.giornata}</span>
                    <span class="res-match-esito" style="color:${color}">${label}</span>
                    <span class="res-match-casa">${m.isHome ? _t('match_home') : _t('match_away')}</span>
                </div>
                <div class="res-match-score">${m.gf} – ${m.gs}</div>
                <div class="res-match-vs">vs <strong>${m.avv}</strong></div>
                <div class="res-match-pts">+${punti} pt</div>
                <div class="res-match-stats">
                    <span>⚽ ${m.player_gol ?? '-'} ${_t('stat_gol')}</span>
                    <span>🎯 ${m.player_assist ?? '-'} assist</span>
                    <span>📊 ${m.player_voto ?? '-'}</span>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    }
    if (champions.length) {
        html += `<div class="res-section"><div class="res-section-title">${_t('res_section_champions')}</div>
            ${champions.map(r=>`<div class="res-chip">${r}</div>`).join('')}</div>`;
    }
    if (altri.length) {
        html += `<div class="res-section"><div class="res-section-title">${_t('res_section_other')}</div>
            <div class="res-row-wrap">${altri.map(r=>`<div class="res-chip">${r}</div>`).join('')}</div></div>`;
    }

    list.innerHTML = html;
    _animateResultsModal(modal, res);
}

function _animateResultsModal(modal, res) {
    // 1. Mostra overlay — forza reflow prima di aggiungere modal-fade-in
    // così la transizione background parte sempre, anche su Safari
    modal.classList.add('active');
    void modal.offsetHeight; // forza reflow
    requestAnimationFrame(() => modal.classList.add('modal-fade-in'));

    // 2. Titolo entra dall'alto
    const title = modal.querySelector('h3');
    if (title) setTimeout(() => title.classList.add('anim-in'), 120);

    // 3. Sezioni e banner con stagger progressivo
    const sections = modal.querySelectorAll('.res-section, .res-banner');
    sections.forEach((el, i) => {
        setTimeout(() => el.classList.add('anim-in'), 350 + i * 250);
    });

    // 4. Card partite: flip sequenziale
    // Le card partono dopo che la sezione "Partite" ha finito la sua transizione (delay + 400ms durata)
    const cards = modal.querySelectorAll('.res-match-card');
    const lastSectionDelay = sections.length > 0 ? 350 + (sections.length - 1) * 250 : 350;
    const cardStart = lastSectionDelay + 600; // attendi fine transizione dell'ultima sezione
    cards.forEach((card, i) => {
        setTimeout(() => {
            card.classList.add('flipped');
            if (parseInt(card.dataset.gol) >= 3) {
                setTimeout(() => _burstBalls(card), 200);
            }
        }, cardStart + i * 500);
    });

    // 5. Confetti se campionato vinto
    const hasCampionato = (res.risultati || []).some(r => r.includes('CAMPIONI') || r.includes('campionato'));
    if (hasCampionato) {
        setTimeout(() => _launchConfetti(), cardStart + cards.length * 500 + 200);
    }
}

function _launchConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#FFD700','#FFC200','#fff','#FFE566','#ff9f00','#fffacd','#ffdd44'];
    const count = 120;

    for (let i = 0; i < count; i++) {
        const c = document.createElement('div');
        c.className = 'confetto';
        const size = 7 + Math.random() * 8;
        const duration = 2.2 + Math.random() * 2;
        const delay = Math.random() * 1.2;
        c.style.cssText = `
            left: ${Math.random() * 100}%;
            width: ${size}px; height: ${size}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            animation-duration: ${duration}s;
            animation-delay: ${delay}s;
        `;
        container.appendChild(c);
    }

    // Rimuovi dopo la fine
    setTimeout(() => container.remove(), 5000);
}

function _burstBalls(card) {
    // Web Animations API non supportata su browser molto vecchi — skip silenzioso
    if (typeof card.animate !== 'function') return;

    const container = document.createElement('div');
    container.className = 'ball-burst-container';
    document.body.appendChild(container);

    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Su mobile schermo piccolo riduci numero palloni e distanza
    const isMobile = window.innerWidth < 600;
    const count = isMobile ? 6 : 10;
    const baseDist = isMobile ? 50 : 80;

    for (let i = 0; i < count; i++) {
        const b = document.createElement('div');
        b.className = 'burst-ball';
        b.textContent = '⚽';
        const angle = (360 / count) * i;
        const dist = baseDist + Math.random() * (isMobile ? 40 : 80);
        const rad = (angle * Math.PI) / 180;
        const tx = Math.cos(rad) * dist;
        const ty = Math.sin(rad) * dist;
        const duration = 0.7 + Math.random() * 0.4;
        b.style.cssText = `left: ${cx}px; top: ${cy}px;`;
        b.animate([
            { transform: 'translate(-50%,-50%) scale(0.2) rotate(0deg)', opacity: 1 },
            { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.1) rotate(${angle}deg)`, opacity: 1, offset: 0.6 },
            { transform: `translate(calc(-50% + ${tx * 1.3}px), calc(-50% + ${ty * 1.3}px)) scale(0.6) rotate(${angle * 2}deg)`, opacity: 0 }
        ], { duration: duration * 1000, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' });
        container.appendChild(b);
    }

    setTimeout(() => container.remove(), 1500);
}

// ── PALLONE D'ORO FULLSCREEN ──────────────────────────────────────────────
function _showPalloneDoro(msg) {
    return new Promise(resolve => {
        _launchPdStars();

        const overlay = document.createElement('div');
        overlay.className = 'pallone-doro-overlay';
        overlay.innerHTML = `
            <div class="pallone-doro-title">
                <span class="pallone-doro-trophy">🏆</span>
                <div class="pallone-doro-text">PALLONE D'ORO!</div>
                <div class="pallone-doro-sub">${msg || ''}</div>
                <div id="pd-speech" class="pd-speech" style="display:none;font-style:italic;color:rgba(255,215,0,0.85);font-size:0.92rem;max-width:380px;text-align:center;margin-top:16px;padding:10px 16px;border:1px solid rgba(255,215,0,0.2);border-radius:8px;background:rgba(255,215,0,0.04);"></div>
            </div>`;
        document.body.appendChild(overlay);

        let dismissed = false;
        const dismiss = () => {
            if (dismissed) return;
            dismissed = true;
            overlay.style.transition = 'opacity 0.5s ease';
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.remove(); resolve(); }, 500);
        };

        // Click per skip anticipato
        overlay.addEventListener('click', dismiss);

        void overlay.offsetHeight;
        requestAnimationFrame(() => overlay.classList.add('show'));

        // Auto-dismiss dopo 2.8s
        setTimeout(dismiss, 2800);
    });
}

function _launchPdStars() {
    const container = document.createElement('div');
    container.className = 'pd-star-container';
    document.body.appendChild(container);

    const symbols = ['⭐','🌟','✨','💫','🏆'];
    const count   = 30;
    for (let i = 0; i < count; i++) {
        const s = document.createElement('div');
        s.className = 'pd-star';
        s.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        const duration = 1.8 + Math.random() * 1.8;
        const delay    = Math.random() * 1.5;
        s.style.cssText = `
            left: ${Math.random() * 100}%;
            font-size: ${0.9 + Math.random() * 1.2}rem;
            animation-duration: ${duration}s;
            animation-delay: ${delay}s;
        `;
        container.appendChild(s);
    }
    setTimeout(() => container.remove(), 4000);
}

// ── SKILL TREE PARTICELLE ─────────────────────────────────────────────────
function _skillParticleBurst(btnEl, color, preRect) {
    // Fallback se Web Animations API non è disponibile
    if (typeof Element.prototype.animate !== 'function') return;

    const container = document.createElement('div');
    container.className = 'skill-particle-container';
    document.body.appendChild(container);

    const rect  = preRect || btnEl.getBoundingClientRect();
    const cx    = rect.left + rect.width / 2;
    const cy    = rect.top  + rect.height / 2;
    const count = window.innerWidth < 600 ? 8 : 14;

    for (let i = 0; i < count; i++) {
        const p       = document.createElement('div');
        p.className   = 'skill-particle';
        // Alterna cerchio e quadrato per varietà
        p.style.cssText = `
            left: ${cx}px; top: ${cy}px;
            background: ${color};
            border-radius: ${i % 3 === 0 ? '2px' : '50%'};
            width: ${5 + Math.random() * 6}px;
            height: ${5 + Math.random() * 6}px;
            box-shadow: 0 0 6px ${color};
        `;
        const angle    = (360 / count) * i + (Math.random() * 20 - 10);
        const dist     = 45 + Math.random() * 55;
        const rad      = (angle * Math.PI) / 180;
        const tx       = Math.cos(rad) * dist;
        const ty       = Math.sin(rad) * dist;
        const duration = 500 + Math.random() * 300;

        p.animate([
            { transform: 'translate(-50%,-50%) scale(0)',   opacity: 1 },
            { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.2)`, opacity: 1, offset: 0.5 },
            { transform: `translate(calc(-50% + ${tx*1.4}px), calc(-50% + ${ty*1.4}px)) scale(0)`, opacity: 0 }
        ], { duration, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' });

        container.appendChild(p);
    }
    setTimeout(() => container.remove(), 900);
}

document.getElementById('close-results')?.addEventListener('click', () => {
    const modal = document.getElementById('results-modal');
    modal.classList.remove('active', 'modal-fade-in');
    modal.querySelectorAll('.anim-in').forEach(el => el.classList.remove('anim-in'));
    modal.querySelectorAll('.flipped').forEach(el => el.classList.remove('flipped'));
    // Aggiorna dashboard ora che è visibile — le barre animano correttamente
    if (_pendingDashboardRefresh) {
        _pendingDashboardRefresh = false;
        renderDashboard();
    }
});

async function loadRecentLog() {
    try {
    const res = await api('player.php', { action: 'log' }, 'GET');
    const logEl = document.getElementById('recent-log');
    if (!logEl) return;
    if (!res || res.error || !res.length) {
        logEl.innerHTML = `<li class="log-item" style="color:var(--text-dim)">${_t('no_activity')}</li>`;
        return;
    }
    logEl.innerHTML = res.slice(0, 6).map(l => `
        <li class="log-item">
            <div class="log-date">${getMeseName(l.mese)} ${_t('career_year_label')} ${l.anno}${l.avv ? ` · vs ${l.avv}` : ''}</div>
            <div class="log-text">${l.gol}⚽ ${l.assist}🎯 ${_t('stat_voto').charAt(0).toUpperCase()+_t('stat_voto').slice(1)}: ${l.voto}</div>
            ${l.evento_speciale ? `<div style="color:var(--gold);font-size:0.75rem">🎲 ${l.evento_speciale}</div>` : ''}
        </li>
    `).join('');
    } catch(e) { console.error('loadRecentLog error:', e); }
}

// ── CAREER ──
async function loadCareer() {
    try {
    const container = document.getElementById('career-seasons-list');
    container.innerHTML = `<p class="loading">${_t('loading')}</p>`;

    const [seasons, p] = await Promise.all([
        api('player.php', { action: 'season' }, 'GET'),
        api('player.php', { action: 'get', career_id: currentCareerId }, 'GET')
    ]);
    const annoCorrente = p?.anno_corrente ?? 0;

    // Load enhanced analytics after seasons render
    setTimeout(loadCareerAnalytics, 100);

    // ── Career Charts ───────────────────────────────────────────
    if (window.GS_Charts && seasons?.length > 1) {
        const careerHeader = document.getElementById('career-seasons-list');
        const chartsDiv = document.createElement('div');
        chartsDiv.className = 'career-charts-grid';
        chartsDiv.style.marginBottom = '20px';

        // Goals per season bar chart
        const goalBox = document.createElement('div');
        goalBox.className = 'career-chart-box';
        const goalData = (seasons || []).slice(0, 8).reverse().map(s => ({
            label: `A${s.anno}`,
            value: parseInt(s.gol || 0),
            color: '#FFD700',
        }));
        GS_Charts.barChart(goalBox, goalData, { id: 'chart-goals', title: '⚽ Gol / Stagione', height: 180 });
        chartsDiv.appendChild(goalBox);

        // OVR progression line chart
        const ovrBox = document.createElement('div');
        ovrBox.className = 'career-chart-box';
        const seasonsSorted = (seasons || []).slice(0, 8).reverse();
        GS_Charts.lineChart(ovrBox, [{
            data: seasonsSorted.map(s => parseInt(s.media_voto || 6)),
            label: _t('career_best_rating'),
            color: '#10b981',
        }], {
            id: 'chart-ovr',
            title: '📈 Voto Medio',
            labels: seasonsSorted.map(s => `A${s.anno}`),
            height: 180,
        });
        chartsDiv.appendChild(ovrBox);

        // Stats radar
        if (p) {
            const radarBox = document.createElement('div');
            radarBox.className = 'career-chart-box radar-chart-container';
            GS_Charts.radarChart(radarBox, {
                [_t('stat_tiro')]: parseInt(p.tiro || 0),
                [_t('stat_velocita')]: parseInt(p.velocita || 0),
                [_t('stat_dribbling')]: parseInt(p.dribbling || 0),
                [_t('stat_fisico')]: parseInt(p.fisico || 0),
                [_t('stat_mentalita')]: parseInt(p.mentalita || 0),
            }, { id: 'career-radar', size: 240 });
            chartsDiv.appendChild(radarBox);
        }

        // Assist bar chart
        const assistBox = document.createElement('div');
        assistBox.className = 'career-chart-box';
        const assistData = (seasons || []).slice(0, 8).reverse().map(s => ({
            label: `A${s.anno}`,
            value: parseInt(s.assist || 0),
            color: '#3b82f6',
        }));
        GS_Charts.barChart(assistBox, assistData, { id: 'chart-assists', title: '🎯 Assist / Stagione', height: 180 });
        chartsDiv.appendChild(assistBox);

        // Remove old charts if they exist (prevent duplicates on re-render)
        const existingCharts = careerHeader.parentElement.querySelector('.career-charts-grid');
        if (existingCharts) existingCharts.remove();
        careerHeader.parentElement.insertBefore(chartsDiv, careerHeader);

    // ── Analytics dashboard ──────────────────────────────────────────────────
    if (window.GS_Analytics && p) {
        const analyticsDash = document.getElementById('career-analytics-dash');
        if (analyticsDash) {
            analyticsDash.innerHTML = ''; // Clear previous content
            analyticsDash.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px';
            const label = document.createElement('div');
            label.style.cssText = 'font-size:0.72rem;font-weight:800;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px';
            label.textContent = {it:'🏃 Prestazioni',en:'🏃 Performance',de:'🏃 Leistung',es:'🏃 Rendimiento'}[currentLang]||'🏃 Prestazioni';
            analyticsDash.appendChild(label);
            const keyStatsEl = document.createElement('div');
            analyticsDash.appendChild(keyStatsEl);
            GS_Analytics.renderKeyStats(keyStatsEl, p, []);
        }
    }

    // ── W/L/D Pie chart ──────────────────────────────────────────────────────
    if (window.GS_Analytics) {
        const log = await api('player.php', { action: 'log', career_id: currentCareerId }, 'GET');
        const pieWrap = document.getElementById('career-wld-pie');
        if (pieWrap && log?.length) {
            pieWrap.innerHTML = ''; // Clear previous
            const pieContainer = document.createElement('div');
            pieWrap.appendChild(pieContainer);
            GS_Analytics.renderWLDPie(pieContainer, log);

            // Also render goal heatmap
            const heatWrap = document.createElement('div');
            heatWrap.style.marginTop = '16px';
            const heatLabel = document.createElement('div');
            heatLabel.style.cssText = 'font-size:0.72rem;font-weight:800;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px';
            heatLabel.textContent = {it:'⚽ Gol/Mese',en:'⚽ Goals/Month',de:'⚽ Tore/Monat',es:'⚽ Goles/Mes'}[currentLang]||'⚽ Gol/Mese';
            pieWrap.appendChild(heatLabel);
            GS_Analytics.renderGoalHeatmap(pieWrap, log);
        }
    }

    // ── Career Timeline ──────────────────────────────────────────────────────
    if (window.GS_Timeline) {
        const timelineWrap = document.getElementById('career-timeline-wrap');
        const achievData = window.GS_Achievements ? GS_Achievements.getAll() : [];
        if (timelineWrap) GS_Timeline.render(timelineWrap, seasons, p, achievData);
    }
    }

    // Anno corrente in cima (se ha già giocato almeno 1 mese in questa stagione)
    const tuttiAnni = [...(seasons || [])];
    const anniNellaStagione = tuttiAnni.map(s => s.anno);
    const haAnnoCorrente = anniNellaStagione.includes(annoCorrente);

    // Aggiungi anno corrente (in corso) se non già nella lista stagioni completate
    let rows = [];
    if (!haAnnoCorrente && annoCorrente > 0) {
        rows.push({ anno: annoCorrente, inCorso: true, gol: '-', assist: '-', partite: '-', media_voto: '-', lega_nome: p?.lega_nome || '', team_nome: p?.team_nome || '' });
    }
    rows = rows.concat((seasons || []).map(s => ({ ...s, inCorso: false })));

    if (!rows.length) {
        container.innerHTML = `<p style="color:var(--text-dim);text-align:center;padding:40px">${_t('no_seasons')}</p>`;
        return;
    }

    container.innerHTML = rows.map(s => {
        const inCorso = s.inCorso || s.anno === annoCorrente;
        const tag = inCorso ? `<span class="career-year-tag">${_t('career_ongoing')}</span>` : '';
        return `
        <div class="career-year-row ${inCorso ? 'in-corso' : ''}" id="career-row-${s.anno}">
            <div class="career-year-header" onclick="toggleCareerYear(${s.anno})">
                <span class="career-year-title">${_t('career_year_label')} ${s.anno}</span>
                ${tag}
                <span class="career-year-stats">
                    <span>⚽ <strong>${s.gol ?? '-'}</strong> ${_t('stat_gol')}</span>
                    <span>🎯 <strong>${s.assist ?? '-'}</strong> assist</span>
                    <span>🏟️ <strong>${s.partite ?? '-'}</strong> ${_t('stat_partite')}</span>
                    <span>⭐ <strong>${s.media_voto ?? '-'}</strong> ${_t('stat_voto')}</span>
                    ${s.lega_nome ? `<span style="color:var(--text-dim)">${s.lega_nome}</span>` : ''}
                </span>
                <span class="career-year-chevron">▼</span>
            </div>
            <div class="career-year-detail" id="career-detail-${s.anno}">
                <p style="color:var(--text-dim);font-size:0.85rem;padding:12px 0">${_t('loading')}</p>
            </div>
        </div>`;
    }).join('');
    } catch(e) { console.error('loadCareer error:', e); }
}

async function toggleCareerYear(anno) {
    const row    = document.getElementById(`career-row-${anno}`);
    const detail = document.getElementById(`career-detail-${anno}`);
    if (!row || !detail) return;

    const isOpen = row.classList.contains('open');
    if (isOpen) {
        row.classList.remove('open');
        return;
    }

    row.classList.add('open');

    // Per l'anno in corso non cachare mai (i dati cambiano ogni mese)
    const isCurrentYear = row.classList.contains('in-corso');
    if (detail.dataset.loaded && !isCurrentYear) return;
    detail.dataset.loaded = '1';

    const res = await api('player.php', { action: 'season_detail', anno }, 'GET');
    if (!res || res.error) {
        detail.innerHTML = `<p style="color:var(--text-dim);padding:8px 0">${_t('career_no_data_season')}</p>`;
        return;
    }

    const getMeseNome = (m) => ['','Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'][m] || `M${m}`;

    // Trofei
    let trofeiHTML = '';
    const trofei = [];
    if (res.campionato_vinto) {
        const lv = parseInt(res.campionato_vinto.livello ?? 1);
        const nome = res.campionato_vinto.lega_nome || (lv === 1 ? _t('league_div1') : _t('league_div2'));
        trofei.push(`<span class="career-trofeo-badge ${lv === 1 ? 'trofeo-campionato-1' : 'trofeo-campionato-2'}">🏆 ${nome}</span>`);
    }
    if (res.champions_win) {
        trofei.push(`<span class="career-trofeo-badge trofeo-champions">${_t('champions_badge')}</span>`);
    }
    if (res.pallone_doro_pos === 1) {
        trofei.push(`<span class="career-trofeo-badge trofeo-pallone">${_t('pallone_badge')}</span>`);
    } else if (res.pallone_doro_pos > 0 && res.pallone_doro_pos <= 3) {
        trofei.push(`<span class="career-trofeo-badge" style="background:rgba(148,163,184,0.12);border-color:var(--text-dim);color:var(--text-dim)">🥈 ${_t('pallone_top')} ${res.pallone_doro_pos}</span>`);
    }
    if (trofei.length) {
        trofeiHTML = `<div style="margin-top:16px"><div style="font-size:0.75rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">${_t('career_trophies_title')}</div><div class="career-trofei">${trofei.join('')}</div></div>`;
    }

    // Card best performances
    // tipo: 'gol' | 'assist' | 'rating' (internal key, not display label)
    const fmtLog = (log, tipo) => {
        const label = tipo === 'gol'    ? _t('career_best_gol_label')
                    : tipo === 'assist' ? _t('career_best_assist_label')
                    :                    _t('career_best_rating_label');
        if (!log) return `<div class="career-detail-card"><div class="career-detail-label">${label}</div><div class="career-detail-sub">${_t('career_no_data')}</div></div>`;
        const mese = getMeseNome(parseInt(log.mese));
        const logAnno = log.anno || anno;
        const avvStr = log.avversario ? ` · vs ${log.avversario}` : '';
        const dataStr = `${mese} ${_t('career_year_label')} ${logAnno}${avvStr}`;
        if (tipo === 'gol')
            return `<div class="career-detail-card">
                <div class="career-detail-label">⚽ ${label}</div>
                <div class="career-detail-val">${log.gol} ${_t('stat_gol')}</div>
                <div class="career-detail-sub">${dataStr}</div>
                <div class="career-detail-sub">${log.assist} ${_t('stat_assist')} · ${_t('stat_voto')} ${log.voto}</div>
            </div>`;
        if (tipo === 'assist')
            return `<div class="career-detail-card">
                <div class="career-detail-label">🎯 ${label}</div>
                <div class="career-detail-val">${log.assist} ${_t('stat_assist')}</div>
                <div class="career-detail-sub">${dataStr}</div>
                <div class="career-detail-sub">${log.gol} ${_t('stat_gol')} · ${_t('stat_voto')} ${log.voto}</div>
            </div>`;
        return `<div class="career-detail-card">
            <div class="career-detail-label">⭐ ${label}</div>
            <div class="career-detail-val">${_t('stat_voto').charAt(0).toUpperCase()+_t('stat_voto').slice(1)} ${log.voto}</div>
            <div class="career-detail-sub">${dataStr}</div>
            <div class="career-detail-sub">${log.gol} ${_t('stat_gol')} · ${log.assist} ${_t('stat_assist')}</div>
        </div>`;
    };

    detail.innerHTML = `
        <div class="career-detail-grid">
            ${fmtLog(res.best_gol, 'gol')}
            ${fmtLog(res.best_assist, 'assist')}
            ${fmtLog(res.best_voto, 'rating')}
        </div>
        ${trofeiHTML}
    `;
}

// ── TRANSFER (BUG CORRETTO — funzione completata) ──
let _trNaz = null, _trLiv = null;

async function loadTransfer() {
    const el = document.getElementById('teams-grid');
    el.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-dim)">${_t('loading')}</div>`;

    const [teams, p, leghe] = await Promise.all([
        api('player.php', { action: 'teams' }, 'GET'),
        api('player.php', { action: 'get', career_id: currentCareerId }, 'GET'),
        api('player.php', { action: 'leghe' }, 'GET')
    ]);

    if (!p || p.error || !Array.isArray(teams) || !Array.isArray(leghe)) {
        el.innerHTML = `<div style="text-align:center;padding:48px;color:#f87171">${_t('error_loading_teams')}</div>`;
        return;
    }
    currentPlayer = p;

    if (!_trNaz) {
        const ml = leghe.find(l => l.id == p.lega_id);
        _trNaz = ml ? ml.nazione_id : leghe[0]?.nazione_id;
        _trLiv = ml ? ml.livello    : 1;
    }

    renderTransferUI(teams, p, leghe);
}

function renderTransferUI(teams, p, leghe) {
    const el = document.getElementById('teams-grid');

    // Ragruppa leghe per nazione
    const nazioniMap = {};
    leghe.forEach(l => {
        if (!nazioniMap[l.nazione_id]) nazioniMap[l.nazione_id] = { nome: l.nazione_nome, bandiera: l.bandiera, leghe: [] };
        nazioniMap[l.nazione_id].leghe.push(l);
    });

    // Filtro nazione tabs
    let nazHtml = '';
    Object.entries(nazioniMap).forEach(([nid, naz]) => {
        const isActive  = nid == _trNaz;
        const isCurrent = naz.leghe.some(l => l.id == p.lega_id);
        nazHtml += `<button class="nazione-tab ${isActive?'active':''} ${isCurrent?'current-naz':''}"
            onclick="selectTrNaz('${nid}')">
            ${naz.bandiera} ${naz.nome}${isCurrent?' ★':''}
        </button>`;
    });

    // Filtro lega subtabs per la nazione selezionata
    const nazioneSelezionata = nazioniMap[_trNaz];
    let legaHtml = '';
    if (nazioneSelezionata) {
        nazioneSelezionata.leghe.forEach(l => {
            const isActive  = l.livello == _trLiv && l.nazione_id == _trNaz;
            const isCurrent = l.id == p.lega_id;
            legaHtml += `<button class="lega-subtab ${isActive?'active':''} ${isCurrent?'current-lega':''}"
                onclick="selectTrLiv(${l.livello})">
                ${l.nome} ${isCurrent?'★':''}
            </button>`;
        });
    }

    // Filtra le squadre per la lega selezionata
    const legaCorrente = leghe.find(l => l.nazione_id == _trNaz && l.livello == _trLiv);
    const teamsFiltrati = legaCorrente ? teams.filter(t => t.lega_id == legaCorrente.id) : [];

    // Card squadre
    const ovr = parseInt(p.overall || 0);
    // agScontoOvr è una percentuale (es. 5.0 = 5%) — stessa logica del backend
    const agScontoPerc = p.agent_ovr_sconto || 0;
    // Mappa stelle → OVR minimo, identica al backend (changeTeam)
    const STELLE_OVR_MAP = {1: 55, 2: 75, 3: 90, 4: 105, 5: 120};

    let cardsHtml = '';
    if (teamsFiltrati.length === 0) {
        cardsHtml = `<div style="text-align:center;padding:32px;color:var(--text-dim)">${_t('transfer_no_teams')}</div>`;
    } else {
        const sorted = [...teamsFiltrati].sort((a,b) => parseInt(b.stelle)-parseInt(a.stelle) || parseInt(b.popolarita)-parseInt(a.popolarita));
        cardsHtml = '<div class="teams-grid-inner">';
        sorted.forEach(t => {
            const isCurrent = t.id == p.team_id;
            const stelle = '⭐'.repeat(parseInt(t.stelle));
            const teamOvr = parseInt(t.ovr || 50);
            // Requisito OVR basato sulle stelle, con sconto % agente — uguale al backend
            const minOvr = STELLE_OVR_MAP[parseInt(t.stelle)] ?? 55;
            const minOvrScontato = parseInt(t.stelle) > 1
                ? Math.max(55, Math.floor(minOvr * (1 - agScontoPerc / 100)))
                : minOvr;
            const canTransfer = !isCurrent && ovr >= minOvrScontato;
            const stelleNum = parseInt(t.stelle) || 1;
            const salaryMultMap = {1:'1×', 2:'1.5×', 3:'2×', 4:'3×', 5:'5×'};
            const salaryLabelMap = {1:_t('salary_base'), 2:_t('salary_buono'), 3:_t('salary_ottimo'), 4:_t('salary_alto'), 5:_t('salary_top')};
            const salaryMult = salaryMultMap[stelleNum] || '1×';
            const salaryLabel = salaryLabelMap[stelleNum] || 'base';
            cardsHtml += `<div class="team-card ${isCurrent?'current':''}">
                <div class="team-stars">${stelle}</div>
                <div class="team-name">${t.nome}</div>
                <div class="team-stats">
                    <div class="team-stat"><div class="ts-label">${_t('ts_ovr')}</div><div class="ts-val">${teamOvr}</div></div>
                    <div class="team-stat"><div class="ts-label">${_t('ts_salary')}</div><div class="ts-val ts-salary">${salaryMult} <span class="salary-label">${salaryLabel}</span></div></div>
                    <div class="team-stat"><div class="ts-label">${_t('ts_pop')}</div><div class="ts-val">${t.popolarita}</div></div>
                    <div class="team-stat"><div class="ts-label">${_t('transfer_ovr_req')}</div><div class="ts-val">${minOvrScontato}${agScontoPerc>0?` <small style="color:var(--green)">(-${agScontoPerc}%)</small>`:''}</div></div>
                </div>
                ${isCurrent
                    ? `<div style="text-align:center;color:var(--green);font-weight:700;padding:10px">${_t('transfer_current_team')}</div>`
                    : `<button class="btn-transfer" ${canTransfer?'':'disabled'}
                        onclick="doTransfer(${t.id},'${t.nome.replace(/'/g,"\\'")}')">
                        ${canTransfer ? _t('transfer_btn_go') : `🔒 OVR ${minOvrScontato} ${_t('transfer_ovr_req').replace('🎯 ','')}`}
                      </button>`
                }
            </div>`;
        });
        cardsHtml += '</div>';
    }

    el.innerHTML = `
        <div style="padding:0 0 16px 0">
            <div class="nazione-tabs">${nazHtml}</div>
            <div class="lega-subtabs">${legaHtml}</div>
        </div>
        ${agScontoPerc > 0 ? `<div style="background:rgba(0,200,100,0.1);border:1px solid var(--green);border-radius:8px;padding:8px 14px;margin-bottom:14px;font-size:0.82rem;color:var(--green)">${_t('transfer_agent_bonus').replace('{0}', agScontoPerc)}</div>` : ''}
        ${cardsHtml}`;
}

async function selectTrNaz(nazId) {
    _trNaz = nazId;
    _trLiv = 1;
    const [teams, p, leghe] = await Promise.all([
        api('player.php', { action: 'teams' }, 'GET'),
        api('player.php', { action: 'get', career_id: currentCareerId }, 'GET'),
        api('player.php', { action: 'leghe' }, 'GET')
    ]);
    if (!p.error && Array.isArray(teams) && Array.isArray(leghe)) {
        currentPlayer = p;
        renderTransferUI(teams, p, leghe);
    }
}

async function selectTrLiv(liv) {
    _trLiv = liv;
    const [teams, p, leghe] = await Promise.all([
        api('player.php', { action: 'teams' }, 'GET'),
        api('player.php', { action: 'get', career_id: currentCareerId }, 'GET'),
        api('player.php', { action: 'leghe' }, 'GET')
    ]);
    if (!p.error && Array.isArray(teams) && Array.isArray(leghe)) {
        currentPlayer = p;
        renderTransferUI(teams, p, leghe);
    }
}

async function doTransfer(teamId, teamName) {
    if (!confirm(_t('transfer_confirm').replace('{0}', teamName))) return;
    const res = await api('game.php', { action: 'change_team', team_id: teamId }, 'POST');
    if (res.error) { toast(res.error, 'error'); return; }
    if (window.GS_Particles) GS_Particles.effects.transferWhoosh();
    toast(_t('transfer_toast').replace('{0}', teamName), 'gold');
    _trNaz = null; _trLiv = null;
    await loadPlayer();
    loadTransfer();
    renderDashboard();
}

// ── STRUTTURE ──
async function loadStrutture() {
    const [strutture, player] = await Promise.all([
        api('player.php', { action: 'strutture' }, 'GET'),
        api('player.php', { action: 'get', career_id: currentCareerId }, 'GET')
    ]);
    if (!player || player.error) return;
    currentPlayer = player;
    const el = document.getElementById('strutture-container');
    if (!el) return;
    el.innerHTML = `
        <div class="info-cards" style="margin-bottom:20px">
            <div class="info-card"><div class="val">${formatMoney(player.soldi)}</div><div class="lbl">${{it:'Soldi Disponibili',en:'Available Budget',de:'Verfügbares Budget',es:'Presupuesto Disponible'}[currentLang]||'Soldi Disponibili'}</div></div>
            <div class="info-card"><div class="val">${getStrutturaName(player.struttura_livello)}</div><div class="lbl">${_t('struttura_current')}</div></div>
        </div>`;
    strutture.forEach(s => {
        const owned     = player.struttura_livello >= s.livello;
        const isNext    = player.struttura_livello == s.livello - 1;
        const canAfford = player.soldi >= s.costo;

        // Nomi e descrizioni localizzati (DB è in italiano)
        const nomiEN = {
            1:'Basic Pitch', 2:'Equipped Changing Room', 3:'Gym & Field',
            4:'Sports Centre', 5:'High-Tech Centre', 6:'Elite Centre', 7:'Personal Academy'
        };
        const nomiDE = {
            1:'Einfacher Platz', 2:'Ausgestattete Umkleidekabine', 3:'Fitnessstudio & Feld',
            4:'Sportzentrum', 5:'High-Tech-Zentrum', 6:'Elite-Zentrum', 7:'Persönliche Akademie'
        };
        const nomiES = {
            1:'Campo Básico', 2:'Vestuario Equipado', 3:'Gimnasio y Campo',
            4:'Centro Deportivo', 5:'Centro de Alta Tecnología', 6:'Centro de Élite', 7:'Academia Personal'
        };
        const descrEN = {
            1:'+1 training bonus', 2:'+1 growth, -2% injuries',
            3:'+2 growth, -5% injuries', 4:'+10% growth, -8% injuries',
            5:'+20% growth, -10% injuries', 6:'Medical staff, +28% growth, -15% injuries',
            7:'+35% growth, -20% injuries'
        };
        const descrDE = {
            1:'+1 Trainingsbonus', 2:'+1 Wachstum, -2% Verletzungen',
            3:'+2 Wachstum, -5% Verletzungen', 4:'+10% Wachstum, -8% Verletzungen',
            5:'+20% Wachstum, -10% Verletzungen', 6:'Med. Personal, +28% Wachstum, -15% Verletzungen',
            7:'+35% Wachstum, -20% Verletzungen'
        };
        const descrES = {
            1:'+1 bono entrenamiento', 2:'+1 crecimiento, -2% lesiones',
            3:'+2 crecimiento, -5% lesiones', 4:'+10% crecimiento, -8% lesiones',
            5:'+20% crecimiento, -10% lesiones', 6:'Personal médico, +28% crecimiento, -15% lesiones',
            7:'+35% crecimiento, -20% lesiones'
        };
        const displayNome  = {en:nomiEN[s.livello]||s.nome,de:nomiDE[s.livello]||nomiEN[s.livello]||s.nome,es:nomiES[s.livello]||nomiEN[s.livello]||s.nome,it:s.nome}[currentLang]||s.nome;
        const displayDescr = {en:descrEN[s.livello]||s.descrizione,de:descrDE[s.livello]||descrEN[s.livello]||s.descrizione,es:descrES[s.livello]||descrEN[s.livello]||s.descrizione,it:s.descrizione}[currentLang]||s.descrizione;

        const div = document.createElement('div');
        div.className = `struttura-card ${owned ? 'owned' : isNext ? 'next' : ''}`;
        div.innerHTML = `
            <div class="struttura-level">${s.livello}</div>
            <div>
                <div class="struttura-name">${displayNome}</div>
                <div class="struttura-bonuses">
                    ${parseInt(s.bonus_allenamento)   ? `<span class="struttura-bonus">+${s.bonus_allenamento} ${_t('strutture_bonus_training')}</span>` : ''}
                    ${parseInt(s.bonus_crescita)      ? `<span class="struttura-bonus">+${s.bonus_crescita}% ${_t('strutture_bonus_growth')}</span>` : ''}
                    ${parseInt(s.riduzione_infortuni) ? `<span class="struttura-bonus">-${s.riduzione_infortuni}% ${_t('strutture_bonus_injury')}</span>` : ''}
                </div>
            </div>
            <div class="struttura-cost">
                <div class="cost-val">${formatMoney(s.costo)}</div>
                <div class="cost-lbl">${{it:'Costo',en:'Cost',de:'Kosten',es:'Coste'}[currentLang]||'Costo'}</div>
                ${owned
                    ? `<div class="owned-badge" style="margin-top:8px">✅ ${{it:'Posseduto',en:'Owned',de:'Vorhanden',es:'Poseído'}[currentLang]||'Posseduto'}</div>`
                    : `<button class="btn-buy" ${(!isNext||!canAfford)?'disabled':''} onclick="buyStruttura(${s.livello})">
                        ${!isNext ? _t('struttura_locked') : !canAfford ? _t('struttura_no_funds') : _t('struttura_buy')}
                      </button>`
                }
            </div>`;
        el.appendChild(div);
    });
}

async function buyStruttura(livello) {
    const res = await api('game.php', { action: 'buy_struttura', livello });
    if (res.error) { toast(res.error, 'error'); return; }
    if (window.GS_Particles) {
        const btn = document.getElementById(`struttura-buy-${livello}`);
        GS_Particles.effects.sparkle(btn, 20);
    }
    if (window.GS_Achievements) GS_Achievements.checkFromPlayer(currentPlayer);
    toast(res.msg, 'gold');
    await loadPlayer();
    loadStrutture();
}

// ── OBIETTIVI ──
async function loadDashboardObiettivi() {
    const res = await api('extra.php', { action: 'obiettivi' }, 'GET');
    const el  = document.getElementById('dashboard-obiettivi');
    if (!el || !res || res.error || !res.length) return;
    const tot = res.length, completati = res.filter(o => o.completato == 1).length;
    let html = `<div class="obiettivi-box">
        <div class="obiettivi-header"><span>${_t('obj_header')}</span><span class="ob-counter">${completati}/${tot} ${_t('obj_completed')}</span></div>
        <div class="obiettivi-list">`;
    res.forEach(ob => {
        const pct  = Math.min(100, Math.round((ob.progresso / ob.target) * 100));
        const done = ob.completato == 1;
        html += `<div class="obiettivo-row ${done ? 'ob-done' : ''}">
            <div class="ob-info">
                <span class="ob-desc">${done ? '✅' : '🎯'} ${(()=>{
                    const tKey = 'obj_'+ob.tipo;
                    const tpl = _t(tKey);
                    return (tpl && tpl !== tKey) ? tpl.replace('{0}', ob.target) : ob.descrizione;
                })()}</span>
                <span class="ob-premio">+€${parseInt(ob.premio_soldi).toLocaleString()} · +${ob.premio_morale} ${_t('obj_morale_prize')}</span>
            </div>
            <div class="ob-progress-wrap">
                <div class="ob-progress-bar" style="transform:scaleX(${pct/100})"></div>
                <span class="ob-pct">${ob.progresso}/${ob.target}</span>
            </div>
        </div>`;
    });
    html += '</div></div>';
    el.innerHTML = html;
}

// ── NOTIZIE DASHBOARD ──
async function loadDashboardNotizie() {
    const res = await api('extra.php', { action: 'notizie' }, 'GET');
    if (!res || res.error) return;
    const unread = res.unread || 0;
    const badge  = document.getElementById('dash-news-unread');
    if (badge) {
        badge.textContent = unread > 0 ? unread : '';
        badge.style.display = unread > 0 ? 'inline' : 'none';
    }
    const el = document.getElementById('dash-notizie-lista');
    if (!el) return;
    if (!res.notizie || !res.notizie.length) {
        el.innerHTML = `<p style="color:var(--text-dim);font-size:0.82rem;padding:8px 0">${_t('dash_no_news')}</p>`;
        return;
    }
    _rawNewsData = res.notizie;

    const tipoIcon = { positivo:'🟢', negativo:'🔴', mercato:'💼', agente:'🤝', obiettivo:'🎯', info:'📋' };
    const notizie = await _translateNewsItems(res.notizie.slice(0, 5), currentLang);

    el.innerHTML = notizie.map(n => `
        <div class="dash-news-item ${n.letto == 0 ? 'dash-news-unread' : ''} news-${n.tipo}">
            <div class="dash-news-top">
                <span>${tipoIcon[n.tipo]||'📋'} <strong>${n.titolo}</strong></span>
                <span class="dash-news-data">${getMeseName(n.mese)} A${n.anno}</span>
            </div>
            <div class="dash-news-testo">${n.testo}</div>
        </div>`).join('');
    api('extra.php', { action: 'leggi' }, 'GET');
}

// ── NOTIZIE PAGE ──
async function loadNotizie() {
    const res = await api('extra.php', { action: 'notizie' }, 'GET');
    const el  = document.getElementById('notizie-lista');
    api('extra.php', { action: 'leggi' }, 'GET');
    const btn = document.getElementById('nav-notizie');
    if (btn) btn.innerHTML = _t('nav_notizie');
    if (!res || res.error || !res.notizie?.length) {
        el.innerHTML = `<p style="color:var(--text-dim);padding:20px">${_t('dash_no_news')}</p>`;
        return;
    }

    _rawNewsData = res.notizie;

    const tipoIcon = { positivo:'🟢', negativo:'🔴', mercato:'💼', agente:'🤝', obiettivo:'🎯', info:'📋' };
    const notizie = await _translateNewsItems(res.notizie, currentLang);

    el.innerHTML = notizie.map(n => `
        <div class="news-card ${n.letto == 0 ? 'news-unread' : ''} news-${n.tipo}">
            <div class="news-header">
                <span class="news-icon">${tipoIcon[n.tipo]||'📋'}</span>
                <span class="news-titolo">${n.titolo}</span>
                <span class="news-data">${getMeseName(n.mese)} ${_t('career_year_label')} ${n.anno}</span>
            </div>
            <div class="news-testo">${n.testo}</div>
        </div>`).join('');
}

// ========================
// CALENDARIO TAB
async function loadCalendarioTab() {
    if (!window.GS_SeasonPlanner || !currentPlayer) return;
    const [calData, logData] = await Promise.all([
        api('player.php', { action: 'calendario', career_id: currentCareerId }, 'GET'),
        api('player.php', { action: 'log', career_id: currentCareerId }, 'GET'),
    ]);

    // Render season calendar
    const calContainer = document.getElementById('sc-calendar-container');
    if (calContainer && calData && !calData.error) {
        GS_SeasonPlanner.renderSeasonCalendar(calContainer, calData, currentPlayer);
    }

    // Render projection
    const projContainer = document.getElementById('sc-projection-container');
    if (projContainer && logData && !logData.error) {
        const thisYearLog = (Array.isArray(logData) ? logData : []).filter(l =>
            l.anno == (currentPlayer?.anno_corrente ?? 0) && l.avv && l.avv !== '__riepilogo'
        );
        const stats = {
            gol:    thisYearLog.reduce((a, l) => a + parseInt(l.gol || 0), 0),
            assist: thisYearLog.reduce((a, l) => a + parseInt(l.assist || 0), 0),
            voto:   thisYearLog.length ? thisYearLog.reduce((a, l) => a + parseFloat(l.voto || 6), 0) : 0,
        };
        const proj = GS_SeasonPlanner.projectSeasonStats(stats, currentPlayer?.mese_corrente, currentPlayer?.overall);
        if (proj) GS_SeasonPlanner.renderProjection(projContainer, proj);
    }

    // Render heatmap
    const hmContainer = document.getElementById('sc-heatmap-container');
    if (hmContainer && Array.isArray(logData)) {
        GS_SeasonPlanner.renderHeatmap(hmContainer, logData);
    }
}

// AGENTE
// ========================
async function loadAgente() {
    let res, player;
    try {
        [res, player] = await Promise.all([
            api('agente.php', { action: 'get' }, 'GET'),
            api('player.php', { action: 'get', career_id: currentCareerId }, 'GET')
        ]);
    } catch(e) { console.error('Errore caricamento agente:', e); return; }

    const cur = document.getElementById('agente-current');
    const lst = document.getElementById('agente-lista');
    if (!cur || !lst) return;
    if (!res || res.error) {
        lst.innerHTML = `<p style="color:#ff6b6b">${_t('api_error_label')}${res?.error || _t('api_resp_invalid')}</p>`;
        return;
    }

    const livello = parseInt(res.livello) || 0;
    const agenti  = res.agenti || {};
    const entries = Object.entries(agenti);
    if (!entries.length) { lst.innerHTML = `<p style="color:var(--text-dim)">${_t('no_agent')}</p>`; return; }

    const myPop      = parseInt(player?.popolarita)           || 0;
    const mySoldi    = parseFloat(player?.soldi)               || 0;
    const myOverall  = parseInt(player?.overall)               || 60;
    const myMoltStip = parseFloat(player?.moltiplicatore_stipendio) || 1.0;

    if (livello > 0 && agenti[livello]) {
        const info = agenti[livello];
        cur.innerHTML = `
            <div class="agente-attuale">
                <div class="agente-avatar">🤝</div>
                <div>
                    <div class="agente-nome">${res.nome || info.nome}</div>
                    <div class="agente-livello">${_t('ag_level')} ${livello}/5</div>
                    <div class="agente-bonus">
                        <span class="ag-bonus-item">💰 +${Math.round(parseFloat(info.bonus_stipendio)*100)}% ${_t('ag_salary_bonus')}</span>
                        <span class="ag-bonus-item">📉 -${info.bonus_ovr_sconto}% ${_t('ag_ovr_bonus')}</span>
                    </div>
                    <div class="agente-bonus-mensile">
                        📊 ${_t('ag_monthly_est')}: <strong>+€${formatMoney(Math.round((player?.overall||60) * (player?.moltiplicatore_stipendio||100) * 100 * parseFloat(info.bonus_stipendio)))}</strong>
                        <span style="color:var(--text-dim);font-size:0.75rem"> ${_t('ag_ovr_note')}</span>
                    </div>
                </div>
            </div>`;
    } else {
        cur.innerHTML = `<div class="agente-vuoto">${_t('agent_empty')}</div>`;
    }

    let html = `<h3 style="margin-bottom:16px;color:var(--gold)">${_t('agent_choose')}</h3><div class="agenti-grid">`;
    entries.forEach(([lvStr, info]) => {
        const lv = parseInt(lvStr);
        const isOwned = livello >= lv;
        const isNext  = livello === lv - 1;
        const popOk   = myPop >= parseInt(info.pop_richiesta || 0);
        let costoReale = parseInt(info.costo);
        if (isNext && livello > 0 && agenti[livello]) {
            costoReale = parseInt(agenti[livello].costo_up) || parseInt(info.costo);
        }
        const soldiOk = mySoldi >= costoReale;
        const canHire = isNext && popOk && soldiOk;
        let lockMsg = '';
        if (!isOwned && !isNext) lockMsg = `🔒 ${_t('ag_req_prev')}${lv-1}`;
        else if (!popOk)         lockMsg = `👥 ${_t('ag_req_pop')} ${info.pop_richiesta} (${myPop})`;
        else if (!soldiOk)       lockMsg = `💸 ${_t('ag_req_money')} €${(costoReale-mySoldi).toLocaleString('it')}`;
        const btnLabel = livello > 0 && isNext
            ? `${_t('ag_upgrade_btn')} — €${costoReale.toLocaleString('it')}`
            : `${_t('ag_hire_btn')} — €${costoReale.toLocaleString('it')}`;
        html += `
        <div class="agente-card ${isOwned?'owned':''} ${isNext&&popOk&&!isOwned?'next':''}">
            <div class="agente-card-header">
                <span class="ag-livello-badge">Lv.${lv}</span>
                <span class="ag-nome">${info.nome}</span>
                ${isOwned ? `<span class="ag-owned">${_t('ag_owned')}</span>` : ''}
            </div>
            <div class="ag-stats">
                ${parseFloat(info.bonus_stipendio) ? `<span>💰 +${Math.round(parseFloat(info.bonus_stipendio)*100)}% ${_t('ag_salary_bonus')}</span>` : ''}
                ${parseInt(info.bonus_ovr_sconto)  ? `<span>📉 -${info.bonus_ovr_sconto}% ${_t('ag_ovr_bonus')}</span>` : ''}
            </div>
            <div class="ag-bonus-est" style="font-size:0.78rem;color:var(--text-dim);margin-top:4px">
                📊 ~+€${formatMoney(Math.round((myOverall) * (myMoltStip) * 100 * parseFloat(info.bonus_stipendio)))} /${{it:'mese',en:'month',de:'Monat',es:'mes'}[currentLang]||'mese'}
            </div>
            <div class="ag-requisiti">
                <span class="${popOk?'req-ok':'req-no'}">👥 ${parseInt(info.pop_richiesta)>0?_t('ag_req_pop')+' '+info.pop_richiesta:_t('ag_pop_free')}</span>
                <span class="${soldiOk||isOwned?'req-ok':'req-no'}">💰 €${costoReale.toLocaleString('it')}</span>
            </div>
            ${isOwned
                ? `<div class="ag-badge-ok">${_t('agent_active_badge')}</div>`
                : canHire
                    ? `<button class="btn-primary ag-hire-btn" onclick="assumiAgente(${lv})">${btnLabel}</button>`
                    : `<button class="btn-primary ag-hire-btn" disabled style="opacity:0.45;cursor:not-allowed">${lockMsg}</button>`
            }
        </div>`;
    });
    html += '</div>';
    lst.innerHTML = html;
}

async function assumiAgente(livello) {
    const res = await api('agente.php', { action: 'assumi', livello }, 'POST');
    if (res.error) { toast(res.error, 'error'); return; }
    toast(res.msg, 'gold');
    await loadPlayer();
    loadAgente();
    renderDashboard();
}

// ── CLASSIFICA ──
let selectedClassLegaId = null;
let currentClassTab = 'lega';

async function loadClassifica() {
    const [leghe, player] = await Promise.all([
        api('player.php', { action: 'leghe' }, 'GET'),
        api('player.php', { action: 'get', career_id: currentCareerId }, 'GET')
    ]);
    if (player && !player.error) {
        if (!selectedClassLegaId && player.lega_id) selectedClassLegaId = player.lega_id;
    }
    const filterEl = document.getElementById('classifica-lega-filters');
    if (!Array.isArray(leghe)) { if (filterEl) filterEl.innerHTML = ''; return; }
    const nazioniMap = {};
    leghe.forEach(l => {
        if (!nazioniMap[l.nazione_id]) nazioniMap[l.nazione_id] = { nome: l.nazione_nome, bandiera: l.bandiera, leghe: [] };
        nazioniMap[l.nazione_id].leghe.push(l);
    });
    let filterHtml = '';
    Object.values(nazioniMap).forEach(n => {
        n.leghe.forEach(l => {
            const isActive  = selectedClassLegaId == l.id;
            const isCurrent = player?.lega_id == l.id;
            filterHtml += `<button class="lega-filter-btn ${isActive?'active':''} ${isCurrent?'current-lega':''}" onclick="selectClassLega(${l.id})">${n.bandiera} ${l.nome}${isCurrent?' ★':''}</button>`;
        });
    });
    filterEl.innerHTML = filterHtml;
    if (player && !player.error) {
        if (selectedClassLegaId) await renderClassificaTable(selectedClassLegaId, player);
        if (currentClassTab === 'champions') await renderChampions(player);
    }
}

async function selectClassLega(legaId) { selectedClassLegaId = legaId; await loadClassifica(); }

async function renderClassificaTable(legaId, player) {
    const wrap = document.getElementById('classifica-table-wrap');
    wrap.innerHTML = `<p class="loading">${_t('loading')}</p>`;
    const data = await api('classifica.php', { action: 'get', lega_id: legaId, anno: player.anno_corrente }, 'GET');
    if (!data || data.error || !data.length) {
        wrap.innerHTML = `<p style="color:var(--text-dim);padding:20px">${_t('no_matches')}</p>`;
        return;
    }
    let html = `<table class="season-table classifica-table">
        <thead><tr>
            <th>#</th><th style="text-align:left">${{it:'Squadra',en:'Team',de:'Team',es:'Equipo'}[currentLang]||'Squadra'}</th><th title="Overall">OVR</th>
            <th title="${{it:'Partite Giocate',en:'Played',de:'Gespielt',es:'Jugados'}[currentLang]||'Partite Giocate'}">PG</th><th title="${{it:'Vittorie',en:'Won',de:'Siege',es:'Victorias'}[currentLang]||'Vittorie'}">V</th>
            <th title="${{it:'Pareggi',en:'Drawn',de:'Unentsch.',es:'Empates'}[currentLang]||'Pareggi'}">P</th><th title="${currentLang==='en'?'Lost':'Sconfitte'}">S</th>
            <th title="${{it:'Gol Fatti',en:'Goals For',de:'Tore',es:'Goles a Favor'}[currentLang]||'Gol Fatti'}">GF</th><th title="${{it:'Gol Subiti',en:'Goals Against',de:'Gegentore',es:'Goles en Contra'}[currentLang]||'Gol Subiti'}">GS</th>
            <th title="${{it:'Differenza Reti',en:'Goal Difference',de:'Tordifferenz',es:'Diferencia de Goles'}[currentLang]||'Differenza Reti'}">DR</th><th title="${{it:'Punti',en:'Points',de:'Punkte',es:'Puntos'}[currentLang]||'Punti'}">Pts</th>
        </tr></thead><tbody>`;
    data.forEach((row, i) => {
        const isMyTeam = row.team_id == player.team_id;
        const pos = i + 1;
        let posClass = '';
        if (pos === 1) posClass = 'class-pos-1';
        else if (pos <= 3) posClass = 'class-pos-top3';
        else if (pos <= 4) posClass = 'class-pos-top4';
        else if (pos >= data.length - 2) posClass = 'class-pos-retro';
        const dr = row.gol_fatti - row.gol_subiti;
        const drStr = dr > 0 ? '+' + dr : dr;
        html += `<tr class="${isMyTeam?'my-team-row':''} ${posClass}">
            <td class="pos-cell"><span class="pos-badge ${posClass}">${pos}</span></td>
            <td class="team-name-cell"><span class="team-name-cl">${row.team_nome}</span><span class="team-stars-sm">${'⭐'.repeat(parseInt(row.stelle))}</span>${isMyTeam?'<span class="my-team-badge">TU</span>':''}</td>
            <td><span class="ovr-badge">${row.ovr}</span></td>
            <td>${row.partite_giocate}</td><td>${row.vittorie}</td><td>${row.pareggi}</td><td>${row.sconfitte}</td>
            <td>${row.gol_fatti}</td><td>${row.gol_subiti}</td><td>${drStr}</td>
            <td><strong>${row.punti}</strong></td>
        </tr>`;
    });
    html += `</tbody></table>
        <div class="classifica-legenda">
            <span class="leg-item class-pos-1">${_t('classifica_legend_champion')}</span>
            <span class="leg-item class-pos-top3">${_t('classifica_legend_top3')}</span>
            <span class="leg-item class-pos-top4">${_t('classifica_legend_top4')}</span>
            <span class="leg-item class-pos-retro">${_t('classifica_legend_retro')}</span>
        </div>`;
    wrap.innerHTML = html;
}

async function renderChampions(player) {
    const wrap = document.getElementById('champions-wrap');
    if (!wrap) return;
    wrap.innerHTML = `<p class="loading">${_t('loading')}</p>`;

    const data = await api('classifica.php', { action: 'champions', anno: player.anno_corrente }, 'GET');
    if (!data || data.error || (!Object.keys(data.gironi || {}).length && !data.bracket?.length)) {
        wrap.innerHTML = `<p style="color:var(--text-dim);padding:20px">${_t('champions_not_started_full')}</p>`;
        return;
    }

    const gironi     = data.gironi || {};
    const gruppiKeys = Object.keys(gironi).sort();
    const bracket    = data.bracket || [];
    // Il giocatore potrebbe non essere in Champions — mostriamo comunque tutto
    const myId       = player?.team_id;
    let html = '';

    // ── MENU GRUPPI ──────────────────────────────────────────────────────────
    if (gruppiKeys.length) {
        html += `<div class="champ-group-nav">`;
        html += `<button class="champ-group-nav-btn active" onclick="_champShowAll(this)">${{it:'Tutti i Gruppi',en:'All Groups',de:'Alle Gruppen',es:'Todos los grupos'}[currentLang]||'Tutti i Gruppi'}</button>`;
        gruppiKeys.forEach(g => {
            html += `<button class="champ-group-nav-btn" onclick="_champShowGroup(this,'${g}')">Gr. ${g}</button>`;
        });
        html += `</div>`;
    }

    // ── GIRONI ───────────────────────────────────────────────────────────────
    if (gruppiKeys.length) {
        html += `<div class="zone-label" style="margin:20px 0 14px">📋 ${{it:'Fase a Gironi',en:'Group Stage',de:'Gruppenphase',es:'Fase de Grupos'}[currentLang]||'Fase a Gironi'}</div>`;
        html += `<div class="champ-groups-grid" id="champ-groups-grid">`;
        gruppiKeys.forEach(g => {
            const teams = gironi[g];
            html += `<div class="champ-group-card" data-gruppo="${g}">
                <div class="champ-group-header">
                    <span class="champ-group-letter">${g}</span>
                    <span class="champ-group-head-label">${{it:'Gruppo',en:'Group',de:'Gruppe',es:'Grupo'}[currentLang]||'Gruppo'}</span>
                </div>
                <table class="champ-group-table">
                    <thead><tr>
                        <th style="text-align:left">${{it:'Squadra',en:'Team',de:'Team',es:'Equipo'}[currentLang]||'Squadra'}</th>
                        <th title="${{it:'Giocate',en:'Played',de:'Gespielt',es:'Jugados'}[currentLang]||'Giocate'}">PG</th><th title="${{it:'Vinte',en:'Won',de:'Siege',es:'Ganados'}[currentLang]||'Vinte'}">V</th><th title="${currentLang==='en'?'Drawn':'Paregg.'}">P</th><th title="${{it:'Perse',en:'Lost',de:'Nieder.',es:'Perdidos'}[currentLang]||'Perse'}">S</th>
                        <th title="${{it:'Gol Fatti',en:'Goals For',de:'Tore',es:'Goles a Favor'}[currentLang]||'Gol Fatti'}">GF</th><th title="${{it:'Gol Subiti',en:'Goals Against',de:'Gegentore',es:'Goles en Contra'}[currentLang]||'Gol Subiti'}">GS</th><th title="${currentLang==='en'?'Goal Diff.':'Diff. Reti'}">DR</th><th title="${{it:'Punti',en:'Points',de:'Punkte',es:'Puntos'}[currentLang]||'Punti'}">Pt</th>
                    </tr></thead><tbody>`;
            teams.forEach((t, i) => {
                const isMe = t.team_id == myId;
                const pos  = parseInt(t.posizione_gruppo) || (i + 1);
                const qualClass = pos === 1 ? 'champ-g-primo'
                                : pos === 2 ? 'champ-g-secondo'
                                : pos === 3 ? 'champ-g-terzo'
                                : t.eliminato ? 'champ-g-elim' : '';
                const flag = _buildFlag(t.nazione_nome || '');
                const dr   = (t.gol_fatti_gruppo || 0) - (t.gol_subiti_gruppo || 0);
                const drStr = dr > 0 ? `+${dr}` : `${dr}`;
                html += `<tr class="${qualClass} ${isMe ? 'champ-g-me' : ''}">
                    <td><span class="champ-team-name">${flag ? flag + '\u00a0' : ''}${t.team_nome}</span>${isMe ? ' <span class="my-team-badge">TU</span>' : ''}</td>
                    <td>${t.partite_gruppo ?? 0}</td>
                    <td>${t.vittorie_gruppo ?? 0}</td><td>${t.pareggi_gruppo ?? 0}</td><td>${t.sconfitte_gruppo ?? 0}</td>
                    <td>${t.gol_fatti_gruppo ?? 0}</td><td>${t.gol_subiti_gruppo ?? 0}</td>
                    <td class="champ-dr ${dr > 0 ? 'dr-pos' : dr < 0 ? 'dr-neg' : ''}">${drStr}</td>
                    <td><strong>${t.punti_gruppo ?? 0}</strong></td>
                </tr>`;
            });
            html += `</tbody></table>
                <div class="champ-group-legend">
                    <span class="champ-leg champ-g-primo">${{it:'→ Ottavi',en:'→ Round of 16',de:'→ Achtelfinale',es:'→ Octavos'}[currentLang]||'→ Ottavi'}</span>
                    <span class="champ-leg champ-g-secondo">${{it:'→ Playoff 2ª',en:'→ Playoff 2nd',de:'→ Playoff 2.',es:'→ Playoff 2º'}[currentLang]||'→ Playoff 2ª'}</span>
                    <span class="champ-leg champ-g-terzo">${{it:'→ Playoff 3ª',en:'→ Playoff 3rd',de:'→ Playoff 3.',es:'→ Playoff 3º'}[currentLang]||'→ Playoff 3ª'}</span>
                </div></div>`;
        });
        html += `</div>`;
    }

    // ── BRACKET ───────────────────────────────────────────────────────────────
    if (bracket.length) {
        html += `<div class="zone-label" style="margin:28px 0 14px">⚔️ ${{it:'Fase a Eliminazione Diretta',en:'Knockout Stage',de:'K.O.-Runde',es:'Fase Eliminatoria'}[currentLang]||'Fase a Eliminazione Diretta'}</div>`;
        html += _renderBracket(bracket, player);
    }

    wrap.innerHTML = html;

    // ── ANIMAZIONI ENTRATA ────────────────────────────────────────────────────
    requestAnimationFrame(() => {
        // Gironi: stagger righe
        let rowDelay = 30;
        wrap.querySelectorAll('.champ-group-table tbody tr').forEach(tr => {
            setTimeout(() => tr.classList.add('champ-row-visible'), rowDelay);
            rowDelay += 35;
        });

        // Bracket: colonne da sx con stagger
        wrap.querySelectorAll('.bk-col').forEach((col, i) => {
            col.style.opacity = '0';
            col.style.transform = 'translateX(-16px)';
            setTimeout(() => {
                col.style.transition = 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.22,1,0.36,1)';
                col.style.opacity = '1';
                col.style.transform = 'translateX(0)';
            }, 200 + i * 90);
        });

        // Champion box: già coperto dallo stagger della colonna che la contiene
    });
}

function _champShowAll(btn) {
    document.querySelectorAll('.champ-group-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.champ-group-card').forEach(c => c.style.display = '');
    const grid = document.getElementById('champ-groups-grid');
    if (grid) grid.style.gridTemplateColumns = 'repeat(2,1fr)';
}

function _champShowGroup(btn, gruppo) {
    document.querySelectorAll('.champ-group-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.champ-group-card').forEach(c => {
        c.style.display = c.dataset.gruppo === gruppo ? '' : 'none';
    });
    const grid = document.getElementById('champ-groups-grid');
    if (grid) grid.style.gridTemplateColumns = '1fr';
}

function _renderBracket(bracket, player) {
    if (!bracket || !bracket.length)
        return `<p style="color:var(--text-dim);padding:20px;text-align:center">${_t('bracket_no_data_full')}</p>`;

    // Rinomina fasi: ottavi→Ottavi, quarti→Semifinali, semifinale→Finale, finale→Finale
    // (le label visualizzate, le chiavi DB restano invariate)
    const PHASE_LABELS = {
        it: { playoff:'Playoff', ottavi:'Ottavi di Finale', quarti:'Semifinali', semifinale:'Finale', finale:'Finale', vincitore:'Campione' },
        en: { playoff:'Playoff', ottavi:'Round of 16',     quarti:'Semi-finals', semifinale:'Final',  finale:'Final',  vincitore:'Champion' },
    };
    const lang   = (typeof localStorage !== 'undefined' && localStorage.getItem('gs_lang')) || 'it';
    const LABELS = PHASE_LABELS[lang] || PHASE_LABELS.it;
    const ICONS  = { playoff:'⚡', ottavi:'🔵', quarti:'⚔️', semifinale:'🏆', finale:'🏆', vincitore:'🏆' };

    const RANK = { playoff:0, playoff_3:0, ottavi:1, quarti:2, semifinale:3, finale:4, vincitore:5 };
    const phaseRank = t => RANK[t.fase] ?? -1;
    const isElim    = t => t && (t.eliminato == 1 || t.eliminato === '1');
    const isWon     = t => t && t.fase === 'vincitore' && !isElim(t);
    const allWhoReached = r => bracket.filter(t => phaseRank(t) >= r);

    const myId = player?.team_id;
    const flag = t => _buildFlag(t?.nazione_nome || '');

    // ── Riga squadra ──────────────────────────────────────────────────────────
    const teamRow = (t, winner, lostHere) => {
        if (!t) return `<div class="bk-team bk-tbd"><span class="bk-flag"></span><span class="bk-name">${_t('bracket_tbd')}</span></div>`;
        const safeWinner = winner && !lostHere;
        const me    = t.team_id == myId;
        const champ = isWon(t);
        let cls = 'bk-team';
        if (champ)         cls += ' bk-champ-team';
        else if (me)       cls += ' bk-me';
        else if (lostHere) cls += ' bk-out';
        if (safeWinner)    cls += ' bk-winner';
        return `<div class="${cls}">
            <span class="bk-flag">${flag(t)}</span>
            <span class="bk-name">${t.team_nome}${me ? '<span class="bk-you-badge">TU</span>' : ''}</span>
            <span class="bk-right">
                <span class="bk-ovr">${t.ovr}</span>
                ${lostHere          ? '<span class="bk-elim-x">✕</span>' : ''}
                ${champ             ? '<span class="bk-trophy-ico">🏆</span>' : ''}
                ${safeWinner && !champ ? '<span class="bk-adv">›</span>' : ''}
            </span>
        </div>`;
    };

    // ── Match card ────────────────────────────────────────────────────────────
    const matchCard = (a, b, matchPhaseRank) => {
        const rankA = a ? phaseRank(a) : -1, rankB = b ? phaseRank(b) : -1;
        const aElim = !!(a && isElim(a)), bElim = !!(b && isElim(b));
        let aWon = false, bWon = false;
        if      (rankA > rankB)   { aWon = true; }
        else if (rankB > rankA)   { bWon = true; }
        else if (aElim && !bElim) { bWon = true; }
        else if (bElim && !aElim) { aWon = true; }
        else if (aElim && bElim && rankA === matchPhaseRank && rankB === matchPhaseRank) {
            const ovrA = parseInt(a?.ovr || 0), ovrB = parseInt(b?.ovr || 0);
            if      (ovrA > ovrB) aWon = true;
            else if (ovrB > ovrA) bWon = true;
        }
        if (aWon && bWon) bWon = false;
        const aLost = aElim && bWon && rankA <= matchPhaseRank;
        const bLost = bElim && aWon && rankB <= matchPhaseRank;
        return `<div class="bk-match">
            ${teamRow(a, aWon, aLost)}
            <div class="bk-div"></div>
            ${teamRow(b, bWon, bLost)}
        </div>`;
    };

    const pairUp    = arr => { const p=[]; for(let i=0;i<arr.length;i+=2) p.push([arr[i],arr[i+1]||null]); return p; };
    const byGrp     = (arr, g) => arr.find(t => t.gruppo === g) || null;
    const winnerOf  = (a, b) => {
        if (!a) return b; if (!b) return a;
        const rA=phaseRank(a), rB=phaseRank(b);
        if (rA>rB) return a; if (rB>rA) return b;
        if (isElim(a)&&!isElim(b)) return b;
        if (isElim(b)&&!isElim(a)) return a;
        return null;
    };

    // ── Raccogli partecipanti ─────────────────────────────────────────────────
    const po2all  = bracket.filter(t => parseInt(t.posizione_gruppo) === 2);
    const po3all  = bracket.filter(t => parseInt(t.posizione_gruppo) === 3);
    const primiAll = {};
    bracket.filter(t => parseInt(t.posizione_gruppo) === 1).forEach(t => { primiAll[t.gruppo] = t; });
    const ottAll     = allWhoReached(RANK.ottavi);
    const po_winners = ottAll.filter(t => [2,3].includes(parseInt(t.posizione_gruppo)));

    const findPoWinner = (g2, p2, g3, p3) =>
        po_winners.find(t => t.gruppo === g2 && parseInt(t.posizione_gruppo) === p2) ||
        po_winners.find(t => t.gruppo === g3 && parseInt(t.posizione_gruppo) === p3) || null;

    const quaAll = allWhoReached(RANK.quarti);
    const semAll = allWhoReached(RANK.semifinale);
    const finAll = allWhoReached(RANK.finale);
    const vicAll = bracket.filter(t => t.fase === 'vincitore' && !isElim(t));

    // ── Costruisci fasi ───────────────────────────────────────────────────────
    const phases = [];

    const poPairs = [
        [byGrp(po2all,'A'), byGrp(po3all,'C')],
        [byGrp(po2all,'B'), byGrp(po3all,'D')],
        [byGrp(po2all,'C'), byGrp(po3all,'A')],
        [byGrp(po2all,'D'), byGrp(po3all,'B')],
    ].filter(([a,b]) => a || b);
    if (poPairs.length)
        phases.push({ key:'playoff', pairs:poPairs, rank:0 });

    const ottPairs = [
        [primiAll['A'], findPoWinner('B',2,'D',3)],
        [primiAll['B'], findPoWinner('A',2,'C',3)],
        [primiAll['C'], findPoWinner('D',2,'B',3)],
        [primiAll['D'], findPoWinner('C',2,'A',3)],
    ];
    const ottPairsDisplay = ottPairs.filter(([a,b]) => a || b);
    if (ottPairsDisplay.length)
        phases.push({ key:'ottavi', pairs:ottPairsDisplay, rank:1 });

    const w = ottPairs.map(([a,b]) => winnerOf(a,b));
    const quaPairs = [[w[0]||null,w[2]||null],[w[1]||null,w[3]||null]].filter(([a,b])=>a||b);
    const semPairs = quaPairs.length
        ? [[winnerOf(quaPairs[0]?.[0],quaPairs[0]?.[1]), winnerOf(quaPairs[1]?.[0],quaPairs[1]?.[1])]].filter(([a,b])=>a||b)
        : pairUp(semAll);
    const quaFinal = quaPairs.length ? quaPairs : pairUp(quaAll);
    const semFinal = semPairs.length ? semPairs : pairUp(semAll);
    const finFinal = semPairs.length ? semPairs : (pairUp(finAll).length ? pairUp(finAll) : []);

    if (quaFinal.length) phases.push({ key:'quarti',    pairs:quaFinal, rank:2 });
    if (semFinal.length) phases.push({ key:'semifinale', pairs:semFinal, rank:3 });
    else if (finFinal.length || vicAll.length)
        phases.push({ key:'finale', pairs:finFinal, vincitore:vicAll[0]||null, rank:4 });

    // Aggiungi campione se non già incluso nell'ultima fase
    const lastPhase = phases[phases.length-1];
    if (lastPhase && !lastPhase.vincitore && vicAll.length)
        lastPhase.vincitore = vicAll[0];

    if (!phases.length)
        return `<p style="color:var(--text-dim);padding:20px;text-align:center">${_t('bracket_no_data_full')}</p>`;

    // ── Render ────────────────────────────────────────────────────────────────
    // Fase attualmente in corso: la più avanzata tra le squadre non eliminate
    const activeFaseRank = bracket
        .filter(t => !isElim(t) && t.fase !== 'vincitore' && t.fase !== 'gironi')
        .reduce((max, t) => Math.max(max, phaseRank(t)), -1);

    const cols = phases.map((phase, phIdx) => {
        const isLast    = phIdx === phases.length - 1;
        const isActive  = phase.rank === activeFaseRank;
        const label     = LABELS[phase.key] || phase.key;
        const icon      = ICONS[phase.key]  || '📌';
        const matches   = phase.pairs.map(([a,b]) => matchCard(a, b, phase.rank)).join('');

        let champHtml = '';
        if (phase.vincitore) {
            const v  = phase.vincitore;
            const me = v.team_id == myId;
            champHtml = `<div class="bk-champion">
                <div class="bk-champion-trophy">🏆</div>
                <div class="bk-champion-label">${LABELS.vincitore}</div>
                <div class="bk-champion-name ${me ? 'bk-champ-me' : ''}">${flag(v)}\u00a0${v.team_nome}${me ? '<span class="bk-you-badge">TU</span>' : ''}</div>
                <div class="bk-champion-ovr">OVR ${v.ovr}</div>
            </div>`;
        }

        const connector = !isLast
            ? `<div class="bk-connector"><div class="bk-connector-arrow ${isActive ? 'bk-connector-active' : ''}">›</div></div>`
            : '';

        return `<div class="bk-col">
            <div class="bk-col-head">
                <span class="bk-col-icon">${icon}</span>
                <div>
                    <div class="bk-col-label ${isActive ? 'bk-label-active' : ''}">${label}</div>
                </div>
            </div>
            <div class="bk-col-body">${matches}${champHtml}</div>
        </div>${connector}`;
    }).join('');

    // Legend
    const legendHtml = `<div class="bk-legend">
        <div class="bk-leg-item"><span class="bk-leg-dot bk-leg-green"></span>${{it:'Avanzato',en:'Advanced',de:'Weitergekommen',es:'Avanzado'}[lang]||'Avanzato'}</div>
        <div class="bk-leg-item"><span class="bk-leg-dot bk-leg-gold"></span>${{it:'Campione / TU',en:'Champion / You',de:'Champion / DU',es:'Campeón / TÚ'}[lang]||'Campione / TU'}</div>
        <div class="bk-leg-item"><span class="bk-leg-dot bk-leg-red"></span>${{it:'Eliminato',en:'Eliminated',de:'Ausgeschieden',es:'Eliminado'}[lang]||'Eliminato'}</div>
        <div class="bk-leg-item"><span class="bk-leg-dot bk-leg-dim"></span>${{it:'Da disputare',en:'To be played',de:'Noch zu spielen',es:'Por disputar'}[lang]||'Da disputare'}</div>
    </div>`;

    return `<div class="bk-wrap"><div class="bk-bracket">${cols}</div>${legendHtml}</div>`;
}


function switchClassTab(tab) {
    // Handle calendario tab
    if (tab === 'calendario' && window.GS_SeasonPlanner) {
        document.querySelectorAll('[id^="class-tab-"]').forEach(el => el.style.display = 'none');
        const calTab = document.getElementById('class-tab-calendario');
        if (calTab) { calTab.style.display = 'block'; }
        document.querySelectorAll('.class-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.class-tab').forEach(b => {
            b.classList.toggle('active', b.getAttribute('onclick')?.includes("'calendario'"));
        });
        loadCalendarioTab();
        return;
    }
    currentClassTab = tab;
    document.querySelectorAll('.class-tab').forEach(b => {
        b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${tab}'`));
    });
    document.getElementById('class-tab-lega').style.display      = tab === 'lega'      ? 'block' : 'none';
    document.getElementById('class-tab-champions').style.display = tab === 'champions' ? 'block' : 'none';
    if (tab === 'champions') {
        api('player.php', { action:'get', career_id:currentCareerId }, 'GET').then(p => { if (p && !p.error) renderChampions(p); });
    }
}

// Mappa nazione → codice ISO per costruire flag emoji via Regional Indicator characters
// (più affidabili delle emoji dirette su Windows)
const _nazioneFlag = {
    'Italia': 'IT', 'Francia': 'FR', 'Inghilterra': 'GB',
    'Spagna': 'ES', 'Germania': 'DE'
};
function _buildFlag(nomeNazione) {
    const code = _nazioneFlag[nomeNazione] || null;
    if (!code) return '';
    // Regional Indicator A = 0x1F1E6, offset by char code - 65
    return String.fromCodePoint(0x1F1E6 + (code.charCodeAt(0) - 65)) +
           String.fromCodePoint(0x1F1E6 + (code.charCodeAt(1) - 65));
}
function formatMoney(n) {
    n = parseFloat(n);
    if (n >= 1000000) return '€' + (n/1000000).toFixed(1) + 'M';
    if (n >= 1000)    return '€' + (n/1000).toFixed(0) + 'K';
    return '€' + Math.floor(n);
}

function getMeseName(m, full) {
    if (full) return _t('month_full_' + m) || _t('month_' + m) || '?';
    return _t('month_' + m) || '?';
}

function getStrutturaName(lvl) {
    const idx = parseInt(lvl);
    if (idx <= 0 || isNaN(idx)) return {it:'Nessuna',en:'None',de:'Keine',es:'Ninguna'}[currentLang]||'Nessuna';
    const nomiIT = {1:'Campetto Base',2:'Spogliatoio Attrezzato',3:'Palestra e Campo',4:'Centro Sportivo',5:'Centro High-Tech',6:"Centro d'Elite",7:'Academy Personale'};
    const nomiEN = {1:'Basic Pitch',2:'Equipped Changing Room',3:'Gym & Field',4:'Sports Centre',5:'High-Tech Centre',6:'Elite Centre',7:'Personal Academy'};
    const nomiDE = {1:'Einfacher Platz',2:'Ausgestattete Umkleidekabine',3:'Fitnessstudio & Feld',4:'Sportzentrum',5:'High-Tech-Zentrum',6:'Elite-Zentrum',7:'Persönliche Akademie'};
    const nomiES = {1:'Campo Básico',2:'Vestuario Equipado',3:'Gimnasio y Campo',4:'Centro Deportivo',5:'Centro de Alta Tecnología',6:'Centro de Élite',7:'Academia Personal'};
    return ({en:nomiEN[idx]||'Unknown',de:nomiDE?.[idx]||nomiEN[idx]||'Unbekannt',es:nomiES?.[idx]||nomiEN[idx]||'Desconocida',it:nomiIT[idx]||'Sconosciuta'})[currentLang]||nomiIT[idx]||'Sconosciuta';
}

function toast(msg, type = '') {
    if (window.GS_UI) { GS_UI.toast(msg, type || 'info'); return; }
    // Fallback if GS_UI not yet loaded
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// ── SKILL TREE ──
const ST_MILESTONES = [40,50,60,70,75,80,85,90,95,100,105,110,115,120,125];

const SKILL_TREES = {
    dribbling: {
        label_it:'Dribbling', label_en:'Dribbling', label_de:'Dribbling', label_es:'Regate', icon:'🏃', color:'#f39c12',
        skills: [
            { id:'elastico',        icon:'🌀', tier:1, cost:1, maxLv:3, boostStat:'dribbling', boostPerLv:[2,4,7],
              name_it:'Elastico', name_en:'Elastic', name_de:'Elastik', name_es:'Elástico', requires:null,
              desc_it:'Aumenta il dribbling base. Lv3: sblocca doppio passo.', desc_en:'Increases base dribbling. Lv3: unlocks step-over.', desc_de:'Verbessert Basis-Dribbling. Lv3: schaltet Steptrick frei.', desc_es:'Aumenta el regate base. Nv3: desbloquea el pasito.' },
            { id:'dribbler',        icon:'⚡', tier:2, cost:2, maxLv:3, boostStat:'dribbling', boostPerLv:[4,7,12],
              name_it:'Dribbler Nato', name_en:'Natural Dribbler', name_de:'Natürlicher Dribblist', name_es:'Regateador Nato', requires:'elastico',
              desc_it:'Bonus dribbling in 1v1.', desc_en:'Dribbling bonus in 1v1.', desc_de:'Dribbling-Bonus im 1-gegen-1.', desc_es:'Bono de regate en duelos 1v1.' },
            { id:'finta_speciale',  icon:'🎩', tier:3, cost:3, maxLv:2, boostStat:'dribbling', boostPerLv:[8,15],
              name_it:'Finta Speciale', name_en:'Special Feint', name_de:'Spezialtäuschung', name_es:'Finta Especial', requires:'dribbler',
              desc_it:'Finta imprevedibile.', desc_en:'Unpredictable feint.', desc_de:'Unberechenbare Täuschbewegung.', desc_es:'Finta imprevisible.' },
            { id:'visione',         icon:'👁️', tier:2, cost:2, maxLv:3, boostStat:'mentalita', boostPerLv:[3,5,8],
              name_it:'Visione di Gioco', name_en:'Game Vision', name_de:'Spielübersicht', name_es:'Visión de Juego', requires:'elastico',
              desc_it:'Migliora la mentalità.', desc_en:'Improves mental stats.', desc_de:'Verbessert Mentalitätswerte.', desc_es:'Mejora los atributos mentales.' },
            { id:'controllo_palla', icon:'⚽', tier:3, cost:3, maxLv:2, boostStat:'dribbling', boostPerLv:[6,11],
              name_it:'Controllo Palla', name_en:'Ball Control', name_de:'Ballkontrolle', name_es:'Control de Balón', requires:'visione',
              desc_it:'Massimo controllo sotto pressione.', desc_en:'Maximum control under pressure.', desc_de:'Maximale Kontrolle unter Druck.', desc_es:'Control máximo bajo presión.' },
        ]
    },
    tiro: {
        label_it:'Tiro', label_en:'Shooting', label_de:'Schuss', label_es:'Disparo', icon:'🎯', color:'#e74c3c',
        skills: [
            { id:'precisione',  icon:'🎯', tier:1, cost:1, maxLv:3, boostStat:'tiro', boostPerLv:[2,4,7],
              name_it:'Precisione', name_en:'Precision', name_de:'Präzision', name_es:'Precisión', requires:null,
              desc_it:'Migliora la precisione dei tiri.', desc_en:'Improves shooting precision.', desc_de:'Verbessert die Schussgenauigkeit.', desc_es:'Mejora la precisión de los disparos.' },
            { id:'tiro_potente',icon:'💥', tier:2, cost:2, maxLv:3, boostStat:'tiro', boostPerLv:[4,8,13],
              name_it:'Tiro Potente', name_en:'Power Shot', name_de:'Kraftschuss', name_es:'Disparo Potente', requires:'precisione',
              desc_it:'Aumenta la potenza del tiro.', desc_en:'Increases shot power.', desc_de:'Erhöht die Schusskraft.', desc_es:'Aumenta la potencia del disparo.' },
            { id:'tiro_giro',   icon:'🌪️', tier:3, cost:3, maxLv:2, boostStat:'tiro', boostPerLv:[7,14],
              name_it:'Tiro a Giro', name_en:'Curved Shot', name_de:'Bogenball', name_es:'Disparo Curvo', requires:'tiro_potente',
              desc_it:'Padroneggi la curva del pallone.', desc_en:'Master the ball curve.', desc_de:'Meistere den Bogenball.', desc_es:'Domina la curva del balón.' },
            { id:'freddezza',   icon:'🧊', tier:2, cost:2, maxLv:3, boostStat:'mentalita', boostPerLv:[3,6,9],
              name_it:'Freddezza', name_en:'Composure', name_de:'Kaltblütigkeit', name_es:'Sangre Fría', requires:'precisione',
              desc_it:'Sotto pressione non sbagli.', desc_en:"You don't miss under pressure.", desc_de:'Unter Druck triffst du immer.', desc_es:'Bajo presión no fallas.' },
            { id:'gol_rabona',  icon:'🦅', tier:3, cost:3, maxLv:1, boostStat:'tiro', boostPerLv:[12],
              name_it:'Gol di Rabona', name_en:'Rabona Goal', name_de:'Rabona-Tor', name_es:'Gol de Rabona', requires:'freddezza',
              desc_it:'Abilità leggendaria.', desc_en:'Legendary skill.', desc_de:'Legendäre Fähigkeit.', desc_es:'Habilidad legendaria.' },
        ]
    },
    velocita: {
        label_it:'Velocità', label_en:'Speed', label_de:'Geschwindigkeit', label_es:'Velocidad', icon:'⚡', color:'#3498db',
        skills: [
            { id:'scatto',           icon:'💨', tier:1, cost:1, maxLv:3, boostStat:'velocita', boostPerLv:[2,4,7],
              name_it:'Scatto', name_en:'Sprint', name_de:'Sprint', name_es:'Arranque', requires:null,
              desc_it:"Migliora l'accelerazione.", desc_en:'Improves acceleration.', desc_de:'Verbessert die Beschleunigung.', desc_es:'Mejora la aceleración.' },
            { id:'velocista',        icon:'🏅', tier:2, cost:2, maxLv:3, boostStat:'velocita', boostPerLv:[4,7,12],
              name_it:'Velocista', name_en:'Sprinter', name_de:'Sprinter', name_es:'Velocista', requires:'scatto',
              desc_it:'Velocità di punta incrementata.', desc_en:'Top speed increased.', desc_de:'Höchstgeschwindigkeit erhöht.', desc_es:'Velocidad máxima aumentada.' },
            { id:'turbo',            icon:'🚀', tier:3, cost:3, maxLv:2, boostStat:'velocita', boostPerLv:[8,16],
              name_it:'Turbo', name_en:'Turbo', name_de:'Turbo', name_es:'Turbo', requires:'velocista',
              desc_it:'Burst di velocità sovrumano.', desc_en:'Superhuman speed burst.', desc_de:'Übermenschlicher Geschwindigkeitsschub.', desc_es:'Explosión de velocidad sobrehumana.' },
            { id:'resistenza',       icon:'🔋', tier:2, cost:2, maxLv:3, boostStat:'fisico',   boostPerLv:[3,5,8],
              name_it:'Resistenza', name_en:'Stamina', name_de:'Ausdauer', name_es:'Resistencia', requires:'scatto',
              desc_it:'Mantieni la velocità per tutta la partita.', desc_en:'Maintain speed for the whole match.', desc_de:'Behalte die Geschwindigkeit über das gesamte Spiel.', desc_es:'Mantén la velocidad durante todo el partido.' },
            { id:'dribbling_veloce', icon:'🌩️', tier:3, cost:3, maxLv:2, boostStat:'dribbling', boostPerLv:[5,10],
              name_it:'Dribbling Veloce', name_en:'Speed Dribble', name_de:'Schnell-Dribbling', name_es:'Regate Veloz', requires:'resistenza',
              desc_it:'Combina velocità e dribbling.', desc_en:'Combine speed and dribbling.', desc_de:'Kombination aus Geschwindigkeit und Dribbling.', desc_es:'Combina velocidad y regate.' },
        ]
    },
    fisico: {
        label_it:'Fisico', label_en:'Physical', label_de:'Körper', label_es:'Físico', icon:'💪', color:'#27ae60',
        skills: [
            { id:'forza',       icon:'🏋️', tier:1, cost:1, maxLv:3, boostStat:'fisico', boostPerLv:[2,4,7],
              name_it:'Forza', name_en:'Strength', name_de:'Kraft', name_es:'Fuerza', requires:null,
              desc_it:'Aumenta la forza fisica.', desc_en:'Increases physical strength.', desc_de:'Erhöht die körperliche Kraft.', desc_es:'Aumenta la fuerza física.' },
            { id:'colpo_testa', icon:'⚽', tier:2, cost:2, maxLv:3, boostStat:'fisico', boostPerLv:[4,7,12],
              name_it:'Colpo di Testa', name_en:'Header', name_de:'Kopfball', name_es:'Cabezazo', requires:'forza',
              desc_it:'Dominante sui cross.', desc_en:'Dominant on crosses.', desc_de:'Dominant bei Flanken.', desc_es:'Dominante en los centros.' },
            { id:'muro',        icon:'🧱', tier:3, cost:3, maxLv:2, boostStat:'fisico', boostPerLv:[8,15],
              name_it:'Muro', name_en:'Wall', name_de:'Mauer', name_es:'Muro', requires:'colpo_testa',
              desc_it:'Impossibile spostarlo.', desc_en:"Impossible to move.", desc_de:'Nicht wegzubewegen.', desc_es:'Imposible de desplazar.' },
            { id:'recupero',    icon:'❤️', tier:2, cost:2, maxLv:3, boostStat:'fisico', boostPerLv:[3,5,8],
              name_it:'Recupero Rapido', name_en:'Fast Recovery', name_de:'Schnelle Erholung', name_es:'Recuperación Rápida', requires:'forza',
              desc_it:'Recuperi più in fretta.', desc_en:'You recover faster.', desc_de:'Du erholtst dich schneller.', desc_es:'Te recuperas más rápido.' },
            { id:'stamina',     icon:'🔥', tier:3, cost:3, maxLv:2, boostStat:'fisico', boostPerLv:[6,12],
              name_it:'Stamina', name_en:'Stamina', name_de:'Kondition', name_es:'Stamina', requires:'recupero',
              desc_it:"Sei ancora al 100% al 90°.", desc_en:"Still at 100% at the 90th minute.", desc_de:"Noch bei 100 % in der 90. Minute.", desc_es:"Todavía al 100 % en el minuto 90." },
        ]
    },
    mentalita: {
        label_it:'Mentalità', label_en:'Mental', label_de:'Mentalität', label_es:'Mentalidad', icon:'🧠', color:'#9b59b6',
        skills: [
            { id:'concentrazione', icon:'🎯', tier:1, cost:1, maxLv:3, boostStat:'mentalita', boostPerLv:[2,4,7],
              name_it:'Concentrazione', name_en:'Focus', name_de:'Konzentration', name_es:'Concentración', requires:null,
              desc_it:'Mantieni il focus.', desc_en:'Maintain your focus.', desc_de:'Behalte den Fokus.', desc_es:'Mantén la concentración.' },
            { id:'leadership',     icon:'👑', tier:2, cost:2, maxLv:3, boostStat:'mentalita', boostPerLv:[4,7,12],
              name_it:'Leadership', name_en:'Leadership', name_de:'Führungsqualität', name_es:'Liderazgo', requires:'concentrazione',
              desc_it:'Trascini la squadra.', desc_en:'You drive the team forward.', desc_de:'Du reißt das Team mit.', desc_es:'Arrastras al equipo.' },
            { id:'campione',       icon:'🏆', tier:3, cost:3, maxLv:2, boostStat:'mentalita', boostPerLv:[8,16],
              name_it:'Mentalità Campione', name_en:'Champion Mindset', name_de:'Siegermentalität', name_es:'Mentalidad Campeón', requires:'leadership',
              desc_it:'Nei momenti decisivi sei il migliore.', desc_en:'Best when it matters most.', desc_de:'Im entscheidenden Moment der Beste.', desc_es:'El mejor en los momentos decisivos.' },
            { id:'carisma',        icon:'🌟', tier:2, cost:2, maxLv:3, boostStat:'mentalita', boostPerLv:[3,5,8],
              name_it:'Carisma', name_en:'Charisma', name_de:'Charisma', name_es:'Carisma', requires:'concentrazione',
              desc_it:'La tua personalità convince tutti.', desc_en:'Your personality convinces everyone.', desc_de:'Deine Persönlichkeit überzeugt alle.', desc_es:'Tu personalidad convence a todos.' },
            { id:'istinto',        icon:'👁️', tier:3, cost:3, maxLv:2, boostStat:'tiro',      boostPerLv:[5,10],
              name_it:'Istinto del Goleador', name_en:"Striker's Instinct", name_de:'Torjäger-Instinkt', name_es:'Instinto Goleador', requires:'carisma',
              desc_it:'Sei sempre nel posto giusto.', desc_en:'Always in the right place.', desc_de:'Immer zur richtigen Zeit am richtigen Ort.', desc_es:'Siempre en el lugar correcto.' },
        ]
    }
}

let stState = { points: 0, unlocked: {} };

function stGetSaveKey() { return `gs_skilltree_${currentCareerId}`; }

function stLoad() {
    const raw = localStorage.getItem(stGetSaveKey());
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            const migrated = {};
            Object.entries(parsed.unlocked || {}).forEach(([id, val]) => {
                migrated[id] = typeof val === 'number' ? { level: val, applied: 0 } : val;
            });
            stState = { points: parsed.points || 0, unlocked: migrated };
        } catch(e) { stState = { points: 0, unlocked: {} }; }
    } else {
        stState = { points: 0, unlocked: {} };
    }
}

function stSave() { localStorage.setItem(stGetSaveKey(), JSON.stringify(stState)); }

async function stSyncBoosts() {
    for (const [skillId, entry] of Object.entries(stState.unlocked)) {
        const curLv     = typeof entry === 'number' ? entry : (entry.level   || 0);
        const appliedLv = typeof entry === 'number' ? 0     : (entry.applied || 0);
        // Salta se già sincronizzato con il server a questo livello
        if (curLv <= 0 || appliedLv >= curLv) continue;
        let sk = null;
        for (const tree of Object.values(SKILL_TREES)) {
            sk = tree.skills.find(s => s.id === skillId);
            if (sk) break;
        }
        if (!sk) continue;
        const totalBoost = sk.boostPerLv[curLv - 1] || 0;
        if (totalBoost <= 0) continue;
        try {
            const res = await api('game.php', {
                action: 'apply_skill_boost', skill_id: skillId,
                stat: sk.boostStat, total_boost: totalBoost, level: curLv
            }, 'POST');
            if (res && res.success && currentPlayer) {
                currentPlayer[sk.boostStat] = res.new_val;
                currentPlayer.overall       = res.new_overall;
                if (res.piede_forte)   currentPlayer.piede_forte   = res.piede_forte;
                if (res.piede_debole)  currentPlayer.piede_debole  = res.piede_debole;
                if (res.livello_skill) currentPlayer.livello_skill = res.livello_skill;
                stState.unlocked[skillId] = { level: curLv, applied: curLv };
                stSave();
            }
        } catch(e) { console.warn('stSyncBoosts error', skillId, e); }
    }
}

function stComputeEarnedPoints(player) {
    let earned = 0;
    ['dribbling','tiro','velocita','fisico','mentalita'].forEach(s => {
        const val = parseInt(player[s]) || 0;
        ST_MILESTONES.forEach(m => { if (val >= m) earned++; });
    });
    return earned;
}

function stComputeSpentPoints() {
    let spent = 0;
    Object.entries(stState.unlocked).forEach(([id, entry]) => {
        const lv = typeof entry === 'number' ? entry : (entry?.level || 0);
        for (const tree of Object.values(SKILL_TREES)) {
            const sk = tree.skills.find(s => s.id === id);
            if (sk) { for (let i=0;i<lv;i++) spent += sk.cost; break; }
        }
    });
    return spent;
}

let stActiveTab = 'dribbling';

async function loadSkillTree() {
    if (!currentPlayer) {
        const p = await api('player.php',{action:'get',career_id:currentCareerId},'GET');
        if (p && !p.error) currentPlayer = p;
        else { console.warn('loadSkillTree: failed to load player', p); return; }
    }
    stLoad();

    // Riconcilia lo stato locale con il DB: segna come già applicati i boost già presenti sul server
    const dbBoosts = await api('game.php', { action: 'get_skill_boosts' }, 'GET');
    if (dbBoosts && dbBoosts.boosts) {
        Object.entries(dbBoosts.boosts).forEach(([skillId, info]) => {
            const localEntry = stState.unlocked[skillId];
            const localLv = localEntry ? (typeof localEntry === 'number' ? localEntry : localEntry.level || 0) : 0;
            const dbLv = info.level || 0;
            // Se il DB ha un livello >= quello locale, considera applicato
            if (dbLv >= localLv && localLv > 0) {
                stState.unlocked[skillId] = { level: localLv, applied: localLv };
            }
        });
        stSave();
    }

    await stSyncBoosts();

    const earned = stComputeEarnedPoints(currentPlayer);
    const spent  = stComputeSpentPoints();
    stState.points = earned - spent;

    const banner = document.getElementById('st-points-banner');
    const label  = document.getElementById('st-points-label');
    if (label) {
        const _pts = stState.points;
        const _ptLabel = {
            it: `${_pts} punt${_pts===1?'o':'i'} abilità disponibil${_pts===1?'e':'i'}`,
            en: `${_pts} skill point${_pts === 1 ? '' : 's'} available`,
            de: `${_pts} Fähigkeitspoint${_pts === 1 ? '' : 's'} verfügbar`,
            es: `${_pts} punto${_pts === 1 ? '' : 's'} de habilidad disponible${_pts === 1 ? '' : 's'}`,
        };
        label.textContent = _ptLabel[currentLang] || _ptLabel.it;
        if (banner) banner.className = 'st-points-banner' + (stState.points > 0 ? ' has-points' : '');
    }

    const pf = parseInt(currentPlayer.piede_forte || 3);
    const pd = parseInt(currentPlayer.piede_debole || 2);
    const ls = parseInt(currentPlayer.livello_skill || 2);
    const pfLato = currentPlayer.piede_forte_lato  === 'sx' ? _t('foot_sx') : _t('foot_dx');
    const pdLato = currentPlayer.piede_debole_lato === 'sx' ? _t('foot_sx') : _t('foot_dx');
    const pfV = document.getElementById('st-piede-forte-val');
    const pdV = document.getElementById('st-piede-debole-val');
    const lsV = document.getElementById('st-livello-skill-val');
    if (pfV) pfV.innerHTML = `${'⭐'.repeat(pf)}${'☆'.repeat(5-pf)} <span style="color:var(--text-dim);font-size:0.8rem">${pfLato}</span>`;
    if (pdV) pdV.innerHTML = `${'⭐'.repeat(pd)}${'☆'.repeat(5-pd)} <span style="color:var(--text-dim);font-size:0.8rem">${pdLato}</span>`;
    if (lsV) lsV.textContent = '⭐'.repeat(ls) + '☆'.repeat(5-ls) + ` (${ls}/5)`;

    const tabsEl = document.getElementById('st-tabs');
    if (tabsEl) {
        tabsEl.innerHTML = Object.entries(SKILL_TREES).map(([key, tree]) => {
            const statVal = parseInt(currentPlayer[key]) || 0;
            return `<button class="st-tab ${stActiveTab===key?'active':''}"
                onclick="stSwitchTab('${key}')" data-tree-key="${key}" style="--tree-color:${tree.color}">
                <span class="st-tab-icon">${tree.icon}</span>
                <span class="st-tab-name">${({en:tree.label_en,de:tree.label_de||tree.label_en,es:tree.label_es||tree.label_en,it:tree.label_it}[currentLang]||tree.label_it)}</span>
                <span class="st-tab-val">${statVal}</span>
            </button>`;
        }).join('');
    }
    stRenderTree(stActiveTab);
}

function stSwitchTab(key) {
    stActiveTab = key;
    document.querySelectorAll('.st-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.treeKey === key)
    );
    stRenderTree(key);
}

function stRenderTree(key) {
    const tree    = SKILL_TREES[key];
    const statVal = parseInt(currentPlayer[key]) || 0;
    const content = document.getElementById('st-content');
    if (!content) return;

    const milestoneHtml = `
    <div class="st-milestone-wrap">
        <div class="st-milestone-header">
            <span style="color:${tree.color}">${tree.icon} ${({en:tree.label_en,de:tree.label_de||tree.label_en,es:tree.label_es||tree.label_en,it:tree.label_it}[currentLang]||tree.label_it)}</span>
            <span class="st-stat-value">${statVal} / 125</span>
        </div>
        <div class="st-milestone-bar-bg">
            <div class="st-milestone-bar-fill" style="transform:scaleX(${(Math.min(100,(statVal/125)*100)/100).toFixed(4)});background:${tree.color}"></div>
            ${ST_MILESTONES.map(m => {
                const pct = (m/125)*100;
                const reached = statVal >= m;
                return `<div class="st-milestone-marker ${reached?'reached':''}" style="left:${pct.toFixed(1)}%">
                    <div class="st-milestone-dot" style="${reached?`background:${tree.color}`:''}"></div>
                    <div class="st-milestone-label">${m}</div>
                </div>`;
            }).join('')}
        </div>
        <div class="st-milestone-hint">${{it:'15 milestone (40→125) · ogni soglia = 1 punto abilità',en:'15 milestones (40→125) · each threshold = 1 skill point',de:'15 Meilensteine (40→125) · jede Schwelle = 1 Fähigkeitspunkt',es:'15 hitos (40→125) · cada umbral = 1 punto de habilidad'}[currentLang]||'15 milestone (40→125) · ogni soglia = 1 punto abilità'}</div>
    </div>`;

    const tiers = {};
    tree.skills.forEach(sk => { if (!tiers[sk.tier]) tiers[sk.tier]=[]; tiers[sk.tier].push(sk); });
    const tierNames = { 1:'Livello Base', 2:'Specialista', 3:'Elite' };

    const skillsHtml = Object.entries(tiers).map(([tier, skills]) => {
        const skHtml = skills.map(sk => {
            const entryData  = stState.unlocked[sk.id];
            const unlockedLv = typeof entryData==='number' ? entryData : (entryData?.level||0);
            const isMaxed    = unlockedLv >= sk.maxLv;
            const reqEntry   = sk.requires ? stState.unlocked[sk.requires] : null;
            const reqLv      = sk.requires ? (typeof reqEntry==='number' ? reqEntry : (reqEntry?.level||0)) : 1;
            const canUnlock  = reqLv > 0 && !isMaxed && stState.points >= sk.cost;
            const isLocked   = reqLv === 0;
            const boostNow   = unlockedLv > 0 ? sk.boostPerLv[unlockedLv-1] : 0;
            const boostNext  = !isMaxed ? sk.boostPerLv[unlockedLv] : null;
            const statLabel  = { tiro:'Tiro',velocita:'Velocità',dribbling:'Dribbling',fisico:'Fisico',mentalita:'Mentalità' }[sk.boostStat]||sk.boostStat;
            const pips = Array.from({length:sk.maxLv},(_,i)=>
                `<div class="st-pip ${i<unlockedLv?'filled':''}" style="${i<unlockedLv?`background:${tree.color}`:''}"></div>`
            ).join('');
            return `<div class="st-node ${isLocked?'locked':''} ${isMaxed?'maxed':''} ${unlockedLv>0&&!isMaxed?'partial':''}" data-skill-id="${sk.id}" style="--tree-color:${tree.color}">
                <div class="st-node-icon">${sk.icon}</div>
                <div class="st-node-body">
                    <div class="st-node-name">${({en:sk.name_en,de:sk.name_de||sk.name_en,es:sk.name_es||sk.name_en,it:sk.name_it}[currentLang]||sk.name_it)}</div>
                    <div class="st-node-desc">${({en:sk.desc_en,de:sk.desc_de||sk.desc_en,es:sk.desc_es||sk.desc_en,it:sk.desc_it}[currentLang]||sk.desc_it)}</div>
                    <div class="st-node-boost">
                        ${unlockedLv>0?`<span class="st-boost-active">+${boostNow} ${statLabel}</span>`:''}
                        ${boostNext!==null?`<span class="st-boost-next">${unlockedLv>0?'→':''} +${boostNext} ${statLabel} al prossimo lv</span>`:''}
                    </div>
                    <div class="st-node-pips">${pips}</div>
                </div>
                <div class="st-node-actions">
                    ${isLocked
                        ? `<div class="st-lock-badge">🔒 Richiede: ${tree.skills.find(s=>s.id===sk.requires)?.name||sk.requires}</div>`
                        : isMaxed
                            ? `<div class="st-maxed-badge">✨ MAX</div>`
                            : `<button class="st-upgrade-btn ${canUnlock?'':'disabled'}" onclick="stUpgrade('${key}','${sk.id}')" ${canUnlock?'':'disabled'}>
                                <span class="st-cost">💎 ${sk.cost}</span>
                                ${unlockedLv===0?'Sblocca':'Potenzia'}
                               </button>`
                    }
                </div>
            </div>`;
        }).join('');
        return `<div class="st-tier">
            <div class="st-tier-label">
                <span class="st-tier-badge" style="background:${tree.color}22;color:${tree.color};border-color:${tree.color}44">Tier ${tier} — ${tierNames[tier]}</span>
            </div>
            <div class="st-tier-nodes">${skHtml}</div>
        </div>`;
    }).join('');

    content.innerHTML = milestoneHtml + `<div class="st-skills-wrap">${skillsHtml}</div>`;
}

async function stUpgrade(treeKey, skillId) {
    if (!currentPlayer) return;
    const tree = SKILL_TREES[treeKey];
    const sk   = tree.skills.find(s => s.id === skillId);
    if (!sk) return;

    const entry  = stState.unlocked[skillId];
    const curLv  = typeof entry==='number' ? entry : (entry?.level||0);
    const reqEntry = sk.requires ? stState.unlocked[sk.requires] : null;
    const reqLv  = sk.requires ? (typeof reqEntry==='number' ? reqEntry : (reqEntry?.level||0)) : 1;
    const available = stComputeEarnedPoints(currentPlayer) - stComputeSpentPoints();

    if (reqLv === 0)         { toast(_t('prereq_unlock'), 'error'); return; }
    if (curLv >= sk.maxLv)   { toast(_t('skill_maxed'), ''); return; }
    if (available < sk.cost) { toast({it:`Servono ${sk.cost} punti (hai ${available})`,en:`Need ${sk.cost} points (you have ${available})`,de:`Benötige ${sk.cost} Punkte (du hast ${available})`,es:`Necesitas ${sk.cost} puntos (tienes ${available})`}[currentLang]||`Servono ${sk.cost} punti (hai ${available})`, 'error'); return; }

    const newLv      = curLv + 1;
    const totalBoost = sk.boostPerLv[newLv-1] || 0;
    const statLabels = { tiro:'Tiro',velocita:'Velocita',dribbling:'Dribbling',fisico:'Fisico',mentalita:'Mentalita' };

    if (window.GS_Particles) {
        const btn = document.querySelector(`[data-skill-id='${skillId}']`);
        GS_Particles.effects.levelUpBurst(btn?.getBoundingClientRect()?.left + 40, btn?.getBoundingClientRect()?.top + 40);
    }
    if (window.GS_Achievements) {
        const totalSkills = Object.keys(stState.unlocked).length;
        GS_Achievements.checkSkillUnlocked(totalSkills);
    }
    stState.unlocked[skillId] = { level: newLv, applied: newLv };
    stSave();

    try {
        const res = await api('game.php', {
            action: 'apply_skill_boost', skill_id: skillId,
            stat: sk.boostStat, total_boost: totalBoost, level: newLv
        }, 'POST');
        if (res && res.success) {
            if (currentPlayer) {
                currentPlayer[sk.boostStat] = res.new_val;
                currentPlayer.overall       = res.new_overall;
                if (res.piede_forte)   currentPlayer.piede_forte   = res.piede_forte;
                if (res.piede_debole)  currentPlayer.piede_debole  = res.piede_debole;
                if (res.livello_skill) currentPlayer.livello_skill = res.livello_skill;
            }
            const delta = res.delta || 0;
            toast(`✨ ${({en:sk.name_en,de:sk.name_de||sk.name_en,es:sk.name_es||sk.name_en,it:sk.name_it}[currentLang]||sk.name_it)} Lv${newLv}! ${delta>0?`+${delta} ${statLabels[sk.boostStat]} aggiunto!`:'Già applicato.'}`, 'success');
            // Leggi posizione bottone PRIMA che loadSkillTree() ricostruisca il DOM
            const btn = document.querySelector(`button[onclick="stUpgrade('${treeKey}','${skillId}')"]`);
            const btnColor = tree.color;
            if (btn) {
                // getBoundingClientRect ora, mentre il nodo esiste ancora
                const rect = btn.getBoundingClientRect();
                _skillParticleBurst(btn, btnColor, rect);
            }
        } else {
            toast(_t('api_error_label') + (res?.error || _t('error_unknown')), 'error');
            stState.unlocked[skillId] = { level: curLv, applied: curLv };
            stSave();
        }
    } catch(e) {
        toast(_t('conn_error_short'), 'error');
        stState.unlocked[skillId] = { level: curLv, applied: curLv };
        stSave();
    }
    loadSkillTree();
}
