/**
 * ============================================================
 * achievements.js — Sistema badge e obiettivi sbloccabili
 * ============================================================
 * Gestisce oltre 40 achievement sbloccabili durante la carriera,
 * salvati in localStorage per persistenza locale.
 *
 * CATEGORIE DI ACHIEVEMENT:
 *  - milestones: traguardi fondamentali (primo gol, prima vittoria...)
 *  - scoring: gol segnati (10, 50, 100, 200, 500)
 *  - assists: assist forniti
 *  - overall: livelli di overall raggiunti
 *  - trophies: trofei vinti (campionato, Champions)
 *  - pallone_doro: Palloni d'Oro conquistati
 *  - special: achievement segreti e situazionali
 *
 * API pubblica:
 *  - init(careerId): inizializza per una carriera specifica
 *  - check(stats): verifica e sblocca nuovi achievement
 *  - getUnlocked(): lista degli achievement sbloccati
 *  - render(containerId): disegna la griglia dei badge
 *
 * Esposto come oggetto globale GS_Achievements.
 * ============================================================
 */

const GS_Achievements = (() => {
    const STORAGE_KEY = 'gs_achievements_v1';
    let unlocked = {};
    let careerId = null;

    // ── Achievement definitions ───────────────────────────────────────────────
    const ACHIEVEMENTS = [
        // ── First steps ──────────────────────────────────────────────────────
        { id: 'first_goal',       icon: '⚽', name: 'Prima Rete',          name_en: 'First Goal', name_de: 'Erstes Tor', name_es: 'Primer Gol',         desc: 'Segna il tuo primo gol in carriera.',                    desc_en: 'Score your first career goal.', desc_de: 'Erziele dein erstes Karrieretor.', desc_es: 'Marca tu primer gol en carrera.',                      category: 'milestones', secret: false },
        { id: 'first_assist',     icon: '🎯', name: 'Primo Assist',         name_en: 'First Assist', name_de: 'Erste Vorlage', name_es: 'Primera Asistencia',       desc: 'Fornisci il tuo primo assist.',                          desc_en: 'Register your first assist.', desc_de: 'Gib deine erste Vorlage.', desc_es: 'Da tu primera asistencia.',                        category: 'milestones', secret: false },
        { id: 'first_win',        icon: '🏆', name: 'Prima Vittoria',       name_en: 'First Win', name_de: 'Erster Sieg', name_es: 'Primera Victoria',          desc: 'Vinci la tua prima partita.',                            desc_en: 'Win your first match.', desc_de: 'Gewinne dein erstes Spiel.', desc_es: 'Gana tu primer partido.',                              category: 'milestones', secret: false },
        { id: 'first_season',     icon: '📅', name: 'Una Stagione',         name_en: 'One Season', name_de: 'Eine Saison', name_es: 'Una Temporada',         desc: 'Completa la tua prima stagione.',                        desc_en: 'Complete your first season.', desc_de: 'Beende deine erste Saison.', desc_es: 'Completa tu primera temporada.',                        category: 'milestones', secret: false },

        // ── Scoring ───────────────────────────────────────────────────────────
        { id: 'goals_10',         icon: '🔟', name: 'Bomber',               name_en: 'Bomber', name_de: 'Torjäger', name_es: 'Goleador',             desc: 'Segna 10 gol in carriera.',                              desc_en: 'Score 10 career goals.', desc_de: 'Erziele 10 Karrieretore.', desc_es: 'Marca 10 goles en carrera.',                             category: 'scoring',    secret: false },
        { id: 'goals_50',         icon: '💥', name: 'Cecchino',             name_en: 'Sniper', name_de: 'Scharfschütze', name_es: 'Francotirador',             desc: 'Segna 50 gol in carriera.',                              desc_en: 'Score 50 career goals.', desc_de: 'Erziele 50 Karrieretore.', desc_es: 'Marca 50 goles en carrera.',                             category: 'scoring',    secret: false },
        { id: 'goals_100',        icon: '💯', name: '100 Reti',             name_en: '100 Goals', name_de: '100 Tore', name_es: '100 Goles',          desc: 'Segna 100 gol in carriera.',                             desc_en: 'Score 100 career goals.', desc_de: 'Erziele 100 Karrieretore.', desc_es: 'Marca 100 goles en carrera.',                            category: 'scoring',    secret: false },
        { id: 'goals_200',        icon: '👑', name: 'Re del Gol',           name_en: 'Goal King', name_de: 'Tor-König', name_es: 'Rey del Gol',          desc: 'Segna 200 gol in carriera.',                             desc_en: 'Score 200 career goals.', desc_de: 'Erziele 200 Karrieretore.', desc_es: 'Marca 200 goles en carrera.',                            category: 'scoring',    secret: false },
        { id: 'hattrick',         icon: '🎩', name: 'Hat-trick',            name_en: 'Hat-trick', name_de: 'Hattrick', name_es: 'Hat-trick',          desc: 'Segna 3+ gol in un singolo mese.',                       desc_en: 'Score 3+ goals in a single month.', desc_de: 'Erziele 3+ Tore in einem Monat.', desc_es: 'Marca 3+ goles en un mes.',                  category: 'scoring',    secret: false },
        { id: 'assists_50',       icon: '🔑', name: 'Il Creatore',          name_en: 'The Creator', name_de: 'Der Spielmacher', name_es: 'El Creador',        desc: 'Fornisci 50 assist in carriera.',                        desc_en: 'Provide 50 career assists.', desc_de: 'Gib 50 Karrierevorlagen.', desc_es: 'Da 50 asistencias en carrera.',                         category: 'scoring',    secret: false },

        // ── Overall progression ───────────────────────────────────────────────
        { id: 'ovr_70',           icon: '📈', name: 'Talento',              name_en: 'Talent', name_de: 'Talent', name_es: 'Talento',             desc: 'Raggiungi Overall 70.',                                  desc_en: 'Reach Overall 70.', desc_de: 'Erreiche Overall 70.', desc_es: 'Alcanza Overall 70.',                                  category: 'growth',     secret: false },
        { id: 'ovr_80',           icon: '⭐', name: 'Stella',               name_en: 'Star', name_de: 'Star', name_es: 'Estrella',               desc: 'Raggiungi Overall 80.',                                  desc_en: 'Reach Overall 80.', desc_de: 'Erreiche Overall 80.', desc_es: 'Alcanza Overall 80.',                                  category: 'growth',     secret: false },
        { id: 'ovr_90',           icon: '🌟', name: 'Campione',             name_en: 'Champion', name_de: 'Meister', name_es: 'Campeón',           desc: 'Raggiungi Overall 90.',                                  desc_en: 'Reach Overall 90.', desc_de: 'Erreiche Overall 90.', desc_es: 'Alcanza Overall 90.',                                  category: 'growth',     secret: false },
        { id: 'ovr_100',          icon: '💎', name: 'Élite',                name_en: 'Elite', name_de: 'Elite', name_es: 'Élite',              desc: 'Raggiungi Overall 100.',                                 desc_en: 'Reach Overall 100.', desc_de: 'Erreiche Overall 100.', desc_es: 'Alcanza Overall 100.',                                 category: 'growth',     secret: false },
        { id: 'ovr_115',          icon: '🔱', name: 'Leggenda',             name_en: 'Legend', name_de: 'Legende', name_es: 'Leyenda',             desc: 'Raggiungi Overall 115.',                                 desc_en: 'Reach Overall 115.', desc_de: 'Erreiche Overall 115.', desc_es: 'Alcanza Overall 115.',                                 category: 'growth',     secret: false },

        // ── Trophies ──────────────────────────────────────────────────────────
        { id: 'first_trophy',     icon: '🥇', name: 'Il Primo',             name_en: 'The First', name_de: 'Der Erste', name_es: 'El Primero',          desc: 'Vinci il tuo primo trofeo.',                             desc_en: 'Win your first trophy.', desc_de: 'Gewinne deinen ersten Pokal.', desc_es: 'Gana tu primer trofeo.',                             category: 'trophies',   secret: false },
        { id: 'trophies_3',       icon: '🏅', name: 'Collezionista',        name_en: 'Collector', name_de: 'Sammler', name_es: 'Coleccionista',          desc: 'Vinci 3 trofei in carriera.',                            desc_en: 'Win 3 career trophies.', desc_de: 'Gewinne 3 Karrierepokale.', desc_es: 'Gana 3 trofeos en carrera.',                             category: 'trophies',   secret: false },
        { id: 'trophies_10',      icon: '🏆', name: 'Il Grande',            name_en: 'The Great', name_de: 'Der Große', name_es: 'El Grande',          desc: 'Vinci 10 trofei in carriera.',                           desc_en: 'Win 10 career trophies.', desc_de: 'Gewinne 10 Karrierepokale.', desc_es: 'Gana 10 trofeos en carrera.',                            category: 'trophies',   secret: false },
        { id: 'pallone_doro',     icon: '🥇', name: "Pallone d'Oro",        name_en: "Ballon d'Or",        desc: "Vinci il Pallone d'Oro.",                                desc_en: "Win the Ballon d'Or.",                               category: 'trophies',   secret: false },
        { id: 'pallone_doro_3',   icon: '🌠', name: 'Triplice Corona',      name_en: 'Triple Crown', name_de: 'Dreifachkrone', name_es: 'Triple Corona',       desc: "Vinci 3 Palloni d'Oro.",                                 desc_en: "Win 3 Ballons d'Or.",                                category: 'trophies',   secret: true  },
        { id: 'champions',        icon: '🏆', name: 'Campioni d\'Europa',   name_en: 'European Champions', name_de: 'Europameister', name_es: 'Campeones de Europa', desc: 'Vinci la Champions Cup.',                                desc_en: 'Win the Champions Cup.', desc_de: 'Gewinne den Champions Cup.', desc_es: 'Gana la Copa de Campeones.',                             category: 'trophies',   secret: false },

        // ── Popularity & career ───────────────────────────────────────────────
        { id: 'pop_50',           icon: '📣', name: 'Famoso',               name_en: 'Famous', name_de: 'Berühmt', name_es: 'Famoso',             desc: 'Raggiungi 50 di popolarità.',                            desc_en: 'Reach 50 popularity.', desc_de: 'Erreiche 50 Popularität.', desc_es: 'Alcanza 50 de popularidad.',                               category: 'career',     secret: false },
        { id: 'pop_90',           icon: '🌍', name: 'Icona Mondiale',       name_en: 'World Icon', name_de: 'Weltikone', name_es: 'Icono Mundial',         desc: 'Raggiungi 90 di popolarità.',                            desc_en: 'Reach 90 popularity.', desc_de: 'Erreiche 90 Popularität.', desc_es: 'Alcanza 90 de popularidad.',                               category: 'career',     secret: false },
        { id: 'rich',             icon: '💰', name: 'Milionario',           name_en: 'Millionaire', name_de: 'Millionär', name_es: 'Millonario',        desc: 'Accumula €1.000.000 in carriera.',                       desc_en: 'Accumulate €1,000,000.', desc_de: 'Sammle €1.000.000.', desc_es: 'Acumula €1.000.000.',                             category: 'career',     secret: false },
        { id: 'rich_10m',         icon: '💎', name: 'Super Ricco',          name_en: 'Super Rich', name_de: 'Superreich', name_es: 'Supermillonario',         desc: 'Accumula €10.000.000 in carriera.',                      desc_en: 'Accumulate €10,000,000.', desc_de: 'Sammle €10.000.000.', desc_es: 'Acumula €10.000.000.',                            category: 'career',     secret: true  },
        { id: 'seasons_5',        icon: '📆', name: 'Veterano',             name_en: 'Veteran', name_de: 'Veteran', name_es: 'Veterano',            desc: 'Gioca 5 stagioni complete.',                             desc_en: 'Play 5 complete seasons.', desc_de: 'Spiele 5 komplette Saisons.', desc_es: 'Juega 5 temporadas completas.',                           category: 'career',     secret: false },
        { id: 'seasons_10',       icon: '🎖️', name: 'Decennio d\'Oro',     name_en: 'Golden Decade', name_de: 'Goldenes Jahrzehnt', name_es: 'Década de Oro',      desc: 'Gioca 10 stagioni complete.',                            desc_en: 'Play 10 complete seasons.', desc_de: 'Spiele 10 komplette Saisons.', desc_es: 'Juega 10 temporadas completas.',                          category: 'career',     secret: false },
        { id: 'promoted',         icon: '🚀', name: 'Promosso!',            name_en: 'Promoted!', name_de: 'Aufgestiegen!', name_es: '¡Ascendido!',          desc: 'Vieni promosso in Prima Divisione.',                     desc_en: 'Get promoted to First Division.', desc_de: 'Steige in die Erste Division auf.', desc_es: 'Asciende a Primera División.',                    category: 'career',     secret: false },
        { id: 'top_club',         icon: '🔝', name: 'Top Club',             name_en: 'Top Club', name_de: 'Top-Klub', name_es: 'Top Club',           desc: 'Firma per una squadra da 5 stelle.',                     desc_en: 'Sign for a 5-star club.', desc_de: 'Unterschreibe bei einem 5-Sterne-Klub.', desc_es: 'Ficha por un club de 5 estrellas.',                            category: 'career',     secret: false },

        // ── Skills ────────────────────────────────────────────────────────────
        { id: 'first_skill',      icon: '✨', name: 'Prima Abilità',        name_en: 'First Skill', name_de: 'Erste Fähigkeit', name_es: 'Primera Habilidad',        desc: 'Sblocca la tua prima skill.',                            desc_en: 'Unlock your first skill.', desc_de: 'Schalte deine erste Skill frei.', desc_es: 'Desbloquea tu primera habilidad.',                           category: 'skills',     secret: false },
        { id: 'skills_5',         icon: '🧠', name: 'Specialista',          name_en: 'Specialist', name_de: 'Spezialist', name_es: 'Especialista',         desc: 'Sblocca 5 abilità.',                                     desc_en: 'Unlock 5 skills.', desc_de: 'Schalte 5 Skills frei.', desc_es: 'Desbloquea 5 habilidades.',                                   category: 'skills',     secret: false },
        { id: 'skills_10',        icon: '⚡', name: 'Maestro',              name_en: 'Master', name_de: 'Meister', name_es: 'Maestro',             desc: 'Sblocca 10 abilità.',                                    desc_en: 'Unlock 10 skills.', desc_de: 'Schalte 10 Skills frei.', desc_es: 'Desbloquea 10 habilidades.',                                  category: 'skills',     secret: false },
        { id: 'max_skill_tree',   icon: '🔱', name: 'Completo',             name_en: 'Complete', name_de: 'Vollständig', name_es: 'Completo',           desc: 'Sblocca tutte le abilità.',                              desc_en: 'Unlock all skills.', desc_de: 'Schalte alle Skills frei.', desc_es: 'Desbloquea todas las habilidades.',                                 category: 'skills',     secret: true  },

        // ── Facilities ────────────────────────────────────────────────────────
        { id: 'first_facility',   icon: '🏗️', name: 'Costruttore',          name_en: 'Builder', name_de: 'Bauherr', name_es: 'Constructor',            desc: 'Costruisci la tua prima struttura.',                     desc_en: 'Build your first facility.', desc_de: 'Baue deine erste Einrichtung.', desc_es: 'Construye tu primera instalación.',                         category: 'facilities', secret: false },
        { id: 'max_facility',     icon: '🏟️', name: 'Academy Personale',    name_en: 'Personal Academy', name_de: 'Persönliche Academy', name_es: 'Academia Personal',   desc: 'Raggiungi il livello massimo di struttura.',             desc_en: 'Reach the maximum facility level.', desc_de: 'Erreiche das maximale Einrichtungslevel.', desc_es: 'Alcanza el nivel máximo de instalación.',                  category: 'facilities', secret: false },

        // ── Agent ─────────────────────────────────────────────────────────────
        { id: 'first_agent',      icon: '🤝', name: 'Ho un Agente!',        name_en: 'I Have an Agent!', name_de: 'Ich habe einen Agenten!', name_es: '¡Tengo un Agente!',   desc: 'Ingaggia il tuo primo agente.',                          desc_en: 'Hire your first agent.', desc_de: 'Engagiere deinen ersten Agenten.', desc_es: 'Contrata a tu primer agente.',                             category: 'career',     secret: false },
        { id: 'top_agent',        icon: '💼', name: 'Super-Agente',         name_en: 'Super-Agent', name_de: 'Super-Agent', name_es: 'Súper-Agente',        desc: 'Ingaggia Giovanni El-Fares (agente livello 5).',          desc_en: 'Hire Giovanni El-Fares (level 5 agent).', desc_de: 'Engagiere Giovanni El-Fares (Agent Lv.5).', desc_es: 'Contrata a Giovanni El-Fares (agente nv.5).',            category: 'career',     secret: true  },

        // ── Secret / Easter Egg ───────────────────────────────────────────────
        { id: 'iron_man',         icon: '🦾', name: 'Uomo di Ferro',        name_en: 'Iron Man', name_de: 'Eisenmann', name_es: 'Hombre de Hierro',           desc: 'Gioca un mese con energia a 1.',                         desc_en: 'Play a month with energy at 1.', desc_de: 'Spiele einen Monat mit Energie 1.', desc_es: 'Juega un mes con energía a 1.',                     category: 'secrets',    secret: true  },
        { id: 'comeback',         icon: '🔄', name: 'Come-back',            name_en: 'Comeback', name_de: 'Comeback', name_es: 'Regreso',           desc: 'Vinci dopo essere retrocesso.',                          desc_en: 'Win after being relegated.', desc_de: 'Gewinne nach dem Abstieg.', desc_es: 'Gana después de descender.',                         category: 'secrets',    secret: true  },
        { id: 'long_career',      icon: '⌛', name: 'Senza Tempo',          name_en: 'Timeless', name_de: 'Zeitlos', name_es: 'Sin Tiempo',           desc: 'Gioca fino a 37 anni.',                                  desc_en: 'Play until age 37.', desc_de: 'Spiele bis zum Alter 37.', desc_es: 'Juega hasta los 37 años.',                                 category: 'secrets',    secret: true  },
        { id: 'high_rating',    icon: '⭐', name: 'Media Leggenda',    name_en: 'Legend Rating',    desc: 'Mantieni media voto sopra 8.',        desc_en: 'Keep avg rating above 8.',         category: 'milestones',secret: false },
        { id: 'seasons_15',     icon: '🏛️', name: 'Carriera Eterna', name_en: 'Eternal Career',   desc: 'Gioca 15 stagioni complete.',         desc_en: 'Play 15 complete seasons.',        category: 'career',   secret: true  },
        { id: 'rich_50m',       icon: '🏦', name: 'Tycoon',           name_en: 'Tycoon',           desc: 'Accumula 50 milioni.',                desc_en: 'Accumulate 50 million.',           category: 'career',   secret: true  },
        { id: 'pop_100',        icon: '🌟', name: 'GOAT',             name_en: 'GOAT',             desc: 'Raggiungi 100 di popolarità.',        desc_en: 'Reach 100 popularity.',            category: 'career',   secret: true  },
        { id: 'five_clubs',     icon: '✈️', name: 'Vagabondo',       name_en: 'Journeyman',       desc: 'Gioca in 5 squadre diverse.',         desc_en: 'Play for 5 different clubs.',      category: 'career',   secret: false },
        { id: 'champions_3',    icon: '🌍', name: "Signore d'Europa", name_en: 'Lord of Europe',   desc: 'Vinci 3 Champions Cup.',              desc_en: 'Win 3 Champions Cups.',            category: 'trophies', secret: true  },
        { id: 'first_division', icon: '🏆', name: 'Campione!',       name_en: 'Champion!',        desc: 'Vinci il campionato di Prima Div.',   desc_en: 'Win the First Division title.',    category: 'trophies', secret: false },
        { id: 'shooter',        icon: '🎯', name: 'Cecchino Preciso', name_en: 'Precise Shooter',  desc: 'Raggiungi 100 di Tiro.',              desc_en: 'Reach 100 Shooting.',              category: 'growth',   secret: false },
        { id: 'speed_demon',    icon: '💨', name: 'Velocissimo',     name_en: 'Speed Demon',      desc: 'Raggiungi 100 di Velocità.',          desc_en: 'Reach 100 Speed.',                 category: 'growth',   secret: false },
        { id: 'dribbler',       icon: '🏃', name: 'Mago Dribbling',  name_en: 'Dribbling Wizard', desc: 'Raggiungi 100 di Dribbling.',         desc_en: 'Reach 100 Dribbling.',             category: 'growth',   secret: false },
        { id: 'physical_beast', icon: '💪', name: 'Bestia Fisica',   name_en: 'Physical Beast',   desc: 'Raggiungi 100 di Fisico.',            desc_en: 'Reach 100 Physical.',              category: 'growth',   secret: false },
        { id: 'mental_giant',   icon: '🧠', name: 'Gigante Mentale', name_en: 'Mental Giant',     desc: 'Raggiungi 100 di Mentalità.',         desc_en: 'Reach 100 Mental.',                category: 'growth',   secret: false },
        { id: 'morale_master',  icon: '😊', name: 'Serenità',       name_en: 'Serenity',         desc: 'Raggiungi 100 di morale.',            desc_en: 'Reach 100 morale.',                category: 'milestones',secret: false },
        { id: 'energy_master',  icon: '⚡', name: 'Energizer',      name_en: 'Energizer',        desc: 'Raggiungi 95+ di energia.',           desc_en: 'Reach 95+ energy.',                category: 'milestones',secret: false },
        { id: 'stat_max',       icon: '🔱', name: 'Maxed Out',      name_en: 'Maxed Out',        desc: 'Porta una statistica a 125.',         desc_en: 'Max a stat to 125.',               category: 'growth',   secret: true  },
        { id: 'all_stats_80',   icon: '📊', name: 'Completo',       name_en: 'All-Rounder',      desc: 'Porta tutte le stat a 80+.',          desc_en: 'Get all stats to 80+.',            category: 'growth',   secret: false },

        // ── Extended achievements ─────────────────────────────────────────────
        { id: 'first_card',       icon: '🃏', name: 'La mia Carta',          name_en: 'My Card',            desc: 'Visualizza la tua carta giocatore.',                     desc_en: 'View your player card.',                             category: 'milestones', secret: false },
        { id: 'perfect_season',   icon: '✨', name: 'Stagione Perfetta',     name_en: 'Perfect Season',     desc: 'Finisci una stagione con media voto 8+.',                desc_en: 'End a season with 8+ average rating.',               category: 'milestones', secret: false },
        { id: 'no_injury_year',   icon: '🛡️', name: 'Indistruttibile',       name_en: 'Indestructible',     desc: 'Completa una stagione senza infortuni.',                 desc_en: 'Complete a full season injury-free.',                category: 'milestones', secret: false },
        { id: 'hat_four',         icon: '🎩✨', name: 'Poker',               name_en: 'Poker',              desc: 'Segna 4+ gol in un mese.',                               desc_en: 'Score 4+ goals in a month.',                         category: 'scoring',    secret: true  },
        { id: 'five_goals_month', icon: '🎯🎯', name: 'Inarrestabile',       name_en: 'Unstoppable',        desc: 'Segna 5+ gol in un mese.',                               desc_en: 'Score 5+ goals in a month.',                         category: 'scoring',    secret: true  },
        { id: 'clean_month',      icon: '😤', name: 'Imbattuto',             name_en: 'Unbeaten',           desc: 'Finisci un mese senza sconfitte.',                       desc_en: 'End a month without a single defeat.',               category: 'milestones', secret: false },
        { id: 'comeback_win',     icon: '🔄', name: 'Rimonta',               name_en: 'Comeback',           desc: 'Vinci una partita da sotto nel punteggio.',              desc_en: 'Win a match after trailing.',                        category: 'secrets',    secret: false },
        { id: 'top_scorer',       icon: '👟', name: 'Capocannoniere',        name_en: 'Top Scorer',         desc: 'Segna 20+ gol in una stagione.',                         desc_en: 'Score 20+ goals in a single season.',                category: 'scoring',    secret: false },
        { id: 'top_assister',     icon: '🎪', name: 'Re degli Assist',       name_en: 'Assist King',        desc: 'Fornisci 15+ assist in una stagione.',                   desc_en: 'Provide 15+ assists in a single season.',            category: 'scoring',    secret: false },
        { id: 'goals_season_30',  icon: '🔥', name: 'Stagione da Fuoco',    name_en: 'On Fire Season',     desc: 'Segna 30+ gol in una stagione.',                         desc_en: 'Score 30+ goals in a single season.',                category: 'scoring',    secret: true  },
        { id: 'six_star_club',    icon: '⭐⭐', name: 'Il Grande Salto',     name_en: 'The Big Leap',       desc: 'Trasferisciti a una squadra top di lega 1.',             desc_en: 'Transfer to a top league 1 club.',                   category: 'career',     secret: false },
        { id: 'all_skills_one_tree', icon: '🌳', name: 'Specialista',       name_en: 'Tree Specialist',    desc: 'Sblocca tutte le abilità di un albero.',                 desc_en: 'Unlock every skill in a single tree.',               category: 'skills',     secret: false },
        { id: 'tutorial_done',    icon: '🎓', name: 'Studente Modello',      name_en: 'Model Student',      desc: 'Completa il tutorial.',                                  desc_en: 'Complete the tutorial.',                             category: 'milestones', secret: false },
        { id: 'sound_on',         icon: '🔊', name: 'Goditi lo Spettacolo', name_en: 'Enjoy the Show',     desc: `Attiva l'audio del gioco.`,                             desc_en: 'Enable the game audio.',                             category: 'milestones', secret: false },
        { id: 'view_timeline',    icon: '📜', name: 'Storico',               name_en: 'Historian',          desc: 'Visualizza la tua timeline di carriera.',                desc_en: 'View your career timeline.',                         category: 'milestones', secret: false },
        { id: 'ten_news',         icon: '📰', name: 'Protagonista',          name_en: 'In the Headlines',   desc: 'Ricevi 10 notizie sulla tua carriera.',                  desc_en: 'Receive 10 career news items.',                      category: 'milestones', secret: false },
        { id: 'popular_50',       icon: '📣', name: 'Star',                  name_en: 'Star',               desc: 'Raggiungi 50 popolarità.',                               desc_en: 'Reach 50 popularity.',                               category: 'career',     secret: false },
        { id: 'five_seasons_same_club', icon: '❤️', name: 'Una Vita Sola',  name_en: 'One Club Player',    desc: 'Rimani nello stesso club per 5 stagioni.',               desc_en: 'Stay at the same club for 5 seasons.',               category: 'career',     secret: true  },
        { id: 'high_morale',      icon: '😄', name: 'Al Settimo Cielo',      name_en: 'On Cloud Nine',      desc: 'Raggiungi 95 di morale.',                                desc_en: 'Reach 95 morale.',                                   category: 'milestones', secret: false },
        { id: 'win_streak_5',     icon: '🔥', name: 'Cinque di Fila',        name_en: 'Five in a Row',      desc: 'Vinci 5 partite consecutive.',                           desc_en: 'Win 5 consecutive matches.',                         category: 'milestones', secret: false },
        { id: 'double_season',    icon: '🎊', name: 'Doppia Gioia',          name_en: 'Double Joy',         desc: 'Vinci campionato e Champions nella stessa stagione.',    desc_en: 'Win league and Champions in the same season.',       category: 'trophies',   secret: true  },
        // ── Extended milestones ────────────────────────────────────────────────
        { id: 'goals_300',      icon: '💥', name: '300 Reti',          name_en: '300 Goals',        desc: 'Segna 300 gol in carriera.',                desc_en: 'Score 300 career goals.',               category: 'scoring',    secret: true  },
        { id: 'goals_500',      icon: '🌋', name: '500 Reti',          name_en: '500 Goals',        desc: 'Segna 500 gol in carriera.',                desc_en: 'Score 500 career goals.',               category: 'scoring',    secret: true  },
        { id: 'assists_100',    icon: '🎩', name: 'Il Grande Maestro', name_en: 'The Grandmaster',  desc: 'Fornisci 100 assist in carriera.',           desc_en: 'Provide 100 career assists.',            category: 'scoring',    secret: true  },
        { id: 'first_hattrick', icon: '🎯', name: 'Hat-trick Storico', name_en: 'Historic Hattrick', desc: 'Segna 3 gol nello stesso mese.',            desc_en: 'Score 3 goals in the same month.',       category: 'scoring',    secret: false },
        { id: 'goals_assists',  icon: '⚡', name: 'Tuttofare',         name_en: 'All-Rounder',      desc: 'Segna e assist nello stesso mese.',          desc_en: 'Score and assist in the same month.',    category: 'scoring',    secret: false },
        // ── Financial milestones ──────────────────────────────────────────────
        { id: 'earn_5m',        icon: '💵', name: 'Benestante',        name_en: 'Well-Off',         desc: 'Guadagna €5 milioni totali.',               desc_en: 'Earn €5 million total.',                category: 'career',     secret: false },
        { id: 'earn_50m',       icon: '🏦', name: 'Miliardario',       name_en: 'Billionaire',      desc: 'Guadagna €50 milioni totali.',              desc_en: 'Earn €50 million total.',               category: 'career',     secret: true  },
        // ── Loyalty badge ─────────────────────────────────────────────────────
        { id: 'loyal_5',        icon: '❤️',  name: 'Fedele',            name_en: 'Loyal',            desc: 'Resta nella stessa squadra per 5 stagioni.', desc_en: 'Stay at the same club for 5 seasons.',  category: 'career',     secret: true  },
        // ── Performance badges ────────────────────────────────────────────────
        { id: 'perfect_month',  icon: '🌟', name: 'Mese Perfetto',     name_en: 'Perfect Month',    desc: 'Vinci tutte le partite di un mese.',        desc_en: 'Win every match in a month.',            category: 'milestones', secret: false },
        { id: 'voto_10',        icon: '💯', name: 'Prestazione Perfetta', name_en: 'Perfect Performance', desc: 'Ottieni voto 10 in una partita.',   desc_en: 'Get a rating of 10 in a match.',         category: 'milestones', secret: true  },
        { id: 'unbeaten',       icon: '🛡️', name: 'Imbattuto',         name_en: 'Unbeaten',         desc: 'Non perdere una singola partita in un mese.', desc_en: 'Go a full month without losing.',       category: 'milestones', secret: false },
        // ── Special career badges ─────────────────────────────────────────────
        { id: 'all_leagues',    icon: '🌍', name: 'Globetrotter',      name_en: 'Globetrotter',     desc: 'Gioca in almeno 3 paesi diversi.',          desc_en: 'Play in at least 3 different countries.', category: 'secrets',   secret: true  },
        { id: 'young_star',     icon: '⭐', name: 'Stella Precoce',    name_en: 'Early Star',       desc: 'Raggiungi Overall 80 prima dei 22 anni.',   desc_en: 'Reach Overall 80 before age 22.',        category: 'secrets',    secret: true  },
        { id: 'old_is_gold',    icon: '👴', name: 'Vino Invecchiato',  name_en: 'Fine Wine',        desc: 'Segna 10 gol dopo i 35 anni.',              desc_en: 'Score 10 goals after age 35.',           category: 'secrets',    secret: true  },
        { id: 'pallone_5',      icon: '👑', name: 'GOAT',              name_en: 'GOAT',             desc: "Vinci 5 Palloni d'Oro.",                    desc_en: "Win 5 Ballon d'Ors.",                    category: 'secrets',    secret: true  },
        { id: 'trophies_20',    icon: '🎖️', name: 'Armadio dei Trofei', name_en: 'Trophy Cabinet',  desc: 'Vinci 20 trofei in carriera.',              desc_en: 'Win 20 career trophies.',                category: 'trophies',   secret: true  },

    ];

    const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

    // ── Storage ───────────────────────────────────────────────────────────────
    function loadUnlocked() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            unlocked = raw ? JSON.parse(raw) : {};
        } catch { unlocked = {}; }
    }

    function saveUnlocked() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
    }

    function setCareer(id) {
        careerId = id;
        loadUnlocked();
    }

    function hasUnlocked(id) {
        return !!unlocked[id];
    }

    // ── Unlock + show toast ───────────────────────────────────────────────────
    function unlock(id) {
        if (hasUnlocked(id)) return false;
        const ach = ACHIEVEMENT_MAP[id];
        if (!ach) return false;

        unlocked[id] = Date.now();
        saveUnlocked();

        // Show achievement notification
        showAchievementToast(ach);

        // Sound + particles
        if (window.GS_Particles) GS_Particles.effects.achievementPop();

        return true;
    }

    let toastQueue = [];
    let toastShowing = false;

    function showAchievementToast(ach) {
        toastQueue.push(ach);
        if (!toastShowing) processToastQueue();
    }

    function processToastQueue() {
        if (!toastQueue.length) { toastShowing = false; return; }
        toastShowing = true;
        const ach = toastQueue.shift();

        const lang = localStorage.getItem('gs_lang') || 'it';
        const name = {en:ach.name_en||ach.name,de:ach.name_de||ach.name_en||ach.name,es:ach.name_es||ach.name_en||ach.name,it:ach.name}[lang]||ach.name;
        const desc = {en:ach.desc_en||ach.desc,de:ach.desc_de||ach.desc_en||ach.desc,es:ach.desc_es||ach.desc_en||ach.desc,it:ach.desc}[lang]||ach.desc;

        const el = document.createElement('div');
        el.className = 'achievement-toast';
        el.innerHTML = `
            <div class="ach-toast-icon">${ach.icon}</div>
            <div class="ach-toast-content">
                <div class="ach-toast-label">${{it:'🏅 Obiettivo Sbloccato!',en:'🏅 Achievement Unlocked!',de:'🏅 Errungenschaft freigeschaltet!',es:'🏅 ¡Logro Desbloqueado!'}[lang] || '🏅 Obiettivo Sbloccato!'}</div>
                <div class="ach-toast-name">${name}</div>
                <div class="ach-toast-desc">${desc}</div>
            </div>
        `;
        document.body.appendChild(el);

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => el.classList.add('show'));
        });

        setTimeout(() => {
            el.classList.remove('show');
            el.classList.add('hide');
            setTimeout(() => {
                el.remove();
                setTimeout(processToastQueue, 200);
            }, 600);
        }, 4000);
    }

    // ── Check from game data ──────────────────────────────────────────────────
    function checkFromPlayer(p) {
        if (!p) return;

        const gol      = parseInt(p.gol_carriera   || 0);
        const assist   = parseInt(p.assist_carriera || 0);
        const ovr      = parseInt(p.overall        || 0);
        const pop      = parseInt(p.popolarita     || 0);
        const soldi    = parseFloat(p.soldi        || 0);
        const trofei   = parseInt(p.trofei         || 0);
        const pd       = parseInt(p.palloni_doro   || 0);
        const age      = parseInt(p.age            || 16);
        const struttura = parseInt(p.struttura_livello || 0);
        const anno     = parseInt(p.anno_corrente  || 1);

        if (gol >= 1)   unlock('first_goal');
        if (gol >= 10)  unlock('goals_10');
        if (gol >= 50)  unlock('goals_50');
        if (gol >= 100) unlock('goals_100');
        if (gol >= 200) unlock('goals_200');

        if (assist >= 1)  unlock('first_assist');
        if (assist >= 50) unlock('assists_50');

        if (ovr >= 70)  unlock('ovr_70');
        if (ovr >= 80)  unlock('ovr_80');
        if (ovr >= 90)  unlock('ovr_90');
        if (ovr >= 100) unlock('ovr_100');
        if (ovr >= 115) unlock('ovr_115');

        if (pop >= 50) unlock('pop_50');
        if (pop >= 90) unlock('pop_90');

        if (soldi >= 1000000)  unlock('rich');
        if (soldi >= 10000000) unlock('rich_10m');

        if (trofei >= 1)  unlock('first_trophy');
        if (trofei >= 3)  unlock('trophies_3');
        if (trofei >= 10) unlock('trophies_10');

        if (pd >= 1) unlock('pallone_doro');
        if (pd >= 3) unlock('pallone_doro_3');

        if (struttura >= 1) unlock('first_facility');
        if (struttura >= 7) unlock('max_facility');

        // New achievement checks
        if (gol >= 300)  unlock('goals_300');
        if (gol >= 500)  unlock('goals_500');
        if (assist >= 100) unlock('assists_100');
        if (pop >= 100)  unlock('pop_100');
        if (soldi >= 50000000) unlock('rich_50m');
        if (anno >= 16)  unlock('seasons_15');
        if (pd >= 5)     unlock('pallone_5');

        // Stat milestones
        if (parseInt(p.tiro      || 0) >= 100) unlock('shooter');
        if (parseInt(p.velocita  || 0) >= 100) unlock('speed_demon');
        if (parseInt(p.dribbling || 0) >= 100) unlock('dribbler');
        if (parseInt(p.fisico    || 0) >= 100) unlock('physical_beast');
        if (parseInt(p.mentalita || 0) >= 100) unlock('mental_giant');
        if (parseInt(p.morale    || 0) >= 100) unlock('morale_master');
        if (parseInt(p.energia   || 0) >= 95)  unlock('energy_master');

        // Max stat (125)
        const stats125 = ['tiro','velocita','dribbling','fisico','mentalita'];
        if (stats125.some(s => parseInt(p[s] || 0) >= 125)) unlock('stat_max');
        // All stats 80+
        if (stats125.every(s => parseInt(p[s] || 0) >= 80)) unlock('all_stats_80');

        if (parseInt(p.team_stelle || 0) >= 5) unlock('top_club');

        if (anno >= 2)  unlock('first_season');
        if (anno >= 6)  unlock('seasons_5');
        if (anno >= 11) unlock('seasons_10');
        if (age >= 37)  unlock('long_career');

        // energy iron man
        if (parseInt(p.energia || 100) <= 1) unlock('iron_man');
    }

    function checkMonthResults(res, p) {
        if (!res) return;

        // Hat-trick: 3+ goals in a month
        if ((res.match?.gol ?? 0) >= 3) unlock('hattrick');

        // First win
        const legaMsgs = res.lega_msgs || [];
        const hadWin = legaMsgs.some(m => m.esito === 'V');
        if (hadWin) unlock('first_win');

        // Champions win
        if (res.champions_win) unlock('champions');

        // Promotion
        if (res.promozione || res.promozione_tipo === 'promozione') unlock('promoted');

        // New season
        if (res.nuovo_anno) {
            checkFromPlayer(p);
        }
    }

    function checkSkillUnlocked(count) {
        if (count >= 1)  unlock('first_skill');
        if (count >= 5)  unlock('skills_5');
        if (count >= 10) unlock('skills_10');
        if (count >= 15) unlock('max_skill_tree'); // 15 skills total in tree
    }

    function checkAgentHired(level) {
        if (level >= 1) unlock('first_agent');
        if (level >= 5) unlock('top_agent');
    }

    // ── Get all achievements for display ──────────────────────────────────────
    function getAll() {
        loadUnlocked();
        return ACHIEVEMENTS.map(a => ({
            ...a,
            isUnlocked: hasUnlocked(a.id),
            unlockedAt: unlocked[a.id] || null,
        })).sort((a, b) => {
            if (a.isUnlocked && !b.isUnlocked) return -1;
            if (!a.isUnlocked && b.isUnlocked) return 1;
            return 0;
        });
    }

    function getUnlockedCount() {
        loadUnlocked();
        return Object.keys(unlocked).length;
    }

    function getTotalCount() { return ACHIEVEMENTS.length; }

    loadUnlocked();

    return {
        setCareer,
        checkFromPlayer, checkMonthResults, checkSkillUnlocked,
        getAll, getUnlockedCount, getTotalCount,
    };
})();

window.GS_Achievements = GS_Achievements;
