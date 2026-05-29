<?php
/**
 * ============================================================
 * game.php — Motore di gioco principale
 * ============================================================
 * Il file più grande del progetto. Gestisce tutta la logica
 * di simulazione mensile della carriera del giocatore:
 *
 *  - play_month: avanza di un mese (allenamento, partite, notizie,
 *                infortuni, morale, stipendio, Pallone d'Oro, epilogo)
 *  - buy_struttura: acquisto strutture di allenamento
 *  - change_team: trasferimento tra squadre
 *  - apply_skill_boost: sblocco abilità dall'Albero delle Abilità
 *  - get_skill_boosts: recupero abilità attive del giocatore
 *
 * Funzioni chiave:
 *  - simulaGiornataLega(): simula tutte le partite di campionato del mese
 *  - simulaChampions(): gestisce la Champions Cup (gironi → finale)
 *  - generaNotizieDinamiche(): genera 400+ template di notizie bilingue
 *  - calcPalloneDoro(): calcola l'assegnazione del Pallone d'Oro
 *  - checkPromozioneRetrocessione(): promozione/retrocessione a fine anno
 *
 * Tutte le notizie sono bilingue (IT/EN) tramite le funzioni _tn() e _tna().
 * La lingua viene letta dall'header HTTP X-Lang inviato dal frontend.
 * ============================================================
 */
require_once '../config/db.php';

// Cattura errori fatali e restituisce JSON invece di HTML
set_exception_handler(function($e) {
    http_response_code(500);
    echo json_encode(['error' => 'Errore server: ' . $e->getMessage() . ' (L.' . $e->getLine() . ')']);
    exit;
});
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
});

$player_id = getAuthPlayerId();
if (!$player_id) { echo json_encode(['error' => t('Non autenticato','Not authenticated')]); exit; }

$data = _getCachedBody();
$action = $data['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'play_month':      playMonth($player_id, $data);      break;
    case 'buy_struttura':   buyStruttura($player_id, $data);   break;
    case 'change_team':     changeTeam($player_id, $data);     break;
    case 'apply_skill_boost': applySkillBoost($player_id, $data); break;
    case 'get_skill_boosts':  getSkillBoosts($player_id);         break;
    default: echo json_encode(['error' => t('Azione non trovata','Action not found')]);
}

function getPlayerData($id) {
    $db = getDB();
    $stmt = $db->prepare("
        SELECT p.*, t.stelle as team_stelle, t.popolarita as team_pop,
               t.moltiplicatore_stipendio, t.probabilita_trofeo,
               t.lega_id, t.nome as team_nome_full, t.ovr as team_ovr,
               l.nome as lega_nome, l.livello as lega_livello, l.nazione_id,
               n.nome as nazione_nome
        FROM players p
        LEFT JOIN teams t ON p.team_id = t.id
        LEFT JOIN leghe l ON t.lega_id = l.id
        LEFT JOIN nazioni n ON l.nazione_id = n.id
        WHERE p.id = ?
    ");
    $stmt->execute([$id]);
    return $stmt->fetch();
}

function playMonth($player_id, $data) {
    $db  = getDB();
    $p   = getPlayerData($player_id);
    if (!$p) { echo json_encode(['error' => t('Giocatore non trovato','Player not found')]); return; }

    $azioni = $data['azioni'] ?? [];
    if (empty($azioni) || count($azioni) > 3) {
        echo json_encode(['error' => t('Scegli da 1 a 3 azioni','Choose 1 to 3 actions')]); return;
    }

    // --- INFORTUNI REALI: blocca azioni fisiche se infortunato o energia = 0 ---
    $infortuni_mesi  = intval($p['infortuni_mesi'] ?? 0);
    $energia_attuale = intval($p['energia'] ?? 0);
    $azioni_fisiche  = ['allenamento_tiro','allenamento_velocita','dribbling',
                        'allenamento_fisico','allenamento_speciale'];
    if ($infortuni_mesi > 0 || $energia_attuale === 0) {
        foreach ($azioni as $az) {
            if (in_array($az, $azioni_fisiche)) {
                if ($infortuni_mesi > 0) {
                    echo json_encode(['error' => t("Sei infortunato ({$infortuni_mesi} mes" . ($infortuni_mesi === 1 ? 'e' : 'i') . " rimanenti). Puoi solo riposare, allenarti mentalmente o fare attività social.", "You are injured ({$infortuni_mesi} month" . ($infortuni_mesi === 1 ? '' : 's') . " remaining). You can only rest, train mentally or do social activities.")]);
                } else {
                    echo json_encode(['error' => t('Energia a zero! Riposati prima di allenarti fisicamente.','Energy at zero! Rest before doing physical training.')]);
                }
                return;
            }
        }
    }

    $risultati     = [];
    $sc            = ['tiro'=>0,'velocita'=>0,'dribbling'=>0,'fisico'=>0,'mentalita'=>0,'popolarita'=>0,'energia'=>0,'morale'=>0];
    $evento_speciale = '';
    $bonus         = getBonusStruttura($p['struttura_livello']);

    // Rischio infortuni da bassa energia: base 0%, sale fino a 40% a energia=1
    // Fisico alto riduce il rischio: ogni 10 punti di fisico sopra 60 = -3%
    // Struttura riduce ulteriormente tramite riduzione_infortuni
    $fisico_val       = intval($p['fisico'] ?? 60);
    $riduzione_fisico = max(0, ($fisico_val - 60) / 10 * 3); // 0-19.5% in base al fisico
    $pct_rischio_energia = function($en) use ($riduzione_fisico, $bonus) {
        if ($en >= 30) return 0; // nessun rischio sopra 30
        // Da 29 a 1: rischio cresce linearmente da 5% a 40%
        $base = 5 + (29 - $en) * (35 / 28);
        return max(0, $base - $riduzione_fisico - ($bonus['riduzione_infortuni'] ?? 0));
    };

    // --- ALLENAMENTI ---
    foreach ($azioni as $azione) {
        // Se un infortunio è appena avvenuto in questa sessione, interrompi le azioni fisiche rimanenti
        if ($infortuni_mesi > intval($p['infortuni_mesi'] ?? 0) && in_array($azione, $azioni_fisiche)) {
            continue;
        }
        // Controlla rischio infortuni da energia bassa (prima del switch)
        if (in_array($azione, $azioni_fisiche) && $azione !== 'allenamento_speciale') {
            $en_corrente = max(0, intval($p['energia'] ?? 0) + $sc['energia']); // tiene conto energia già spesa, clampato a 0
            $rischio_en  = $pct_rischio_energia($en_corrente);
            if ($rischio_en > 0 && rand(1, 100) <= $rischio_en) {
                $durata = 1;
                $infortuni_mesi = $durata;
                $sc['energia'] -= rand(20, 35);
                $en_display = max(0, $en_corrente);
                $risultati[] = t("🚨 INFORTUNIO per stanchezza! Energia troppo bassa ({$en_display}%). Fuori 1 mese!","🚨 INJURY from fatigue! Energy too low ({$en_display}%). Out for 1 month!","🚨 VERLETZUNG durch Erschöpfung! Energie zu niedrig ({$en_display}%). 1 Monat aus!","🚨 LESIÓN por cansancio! Energía demasiado baja ({$en_display}%). ¡Fuera 1 mes!");
                continue; // salta l'allenamento, già infortunato
            }
        }
        switch ($azione) {
            case 'allenamento_tiro':
                $g = rand(1,3) + $bonus['bonus_crescita'];
                $sc['tiro'] += $g; $sc['energia'] -= rand(10,20);
                $risultati[] = t("🎯 Tiro migliorato +{$g}","🎯 Shooting improved +{$g}","🎯 Schuss verbessert +{$g}","🎯 Disparo mejorado +{$g}"); break;
            case 'allenamento_velocita':
                $g = rand(1,3) + $bonus['bonus_crescita'];
                $sc['velocita'] += $g; $sc['energia'] -= rand(10,20);
                $risultati[] = t("⚡ Velocità migliorata +{$g}","⚡ Speed improved +{$g}","⚡ Geschwindigkeit verbessert +{$g}","⚡ Velocidad mejorada +{$g}"); break;
            case 'dribbling':
                $g = rand(1,3) + $bonus['bonus_crescita'];
                $sc['dribbling'] += $g; $sc['energia'] -= rand(10,20);
                $risultati[] = t("🏃 Dribbling migliorato +{$g}","🏃 Dribbling improved +{$g}","🏃 Dribbling verbessert +{$g}","🏃 Regate mejorado +{$g}"); break;
            case 'allenamento_fisico':
                $g = rand(1,3) + $bonus['bonus_crescita'];
                $sc['fisico'] += $g; $sc['energia'] -= rand(10,20);
                $risultati[] = t("💪 Fisico migliorato +{$g}","💪 Physical improved +{$g}","💪 Körperkraft verbessert +{$g}","💪 Físico mejorado +{$g}"); break;
            case 'allenamento_mentalita':
                $g = rand(1,3) + $bonus['bonus_crescita'];
                $sc['mentalita'] += $g; $sc['energia'] -= rand(8,15);
                $sc['morale'] += rand(3,7); // allenare la testa migliora anche l'umore
                $risultati[] = t("🧠 Mentalità migliorata +{$g}","🧠 Mental improved +{$g}","🧠 Mentalität verbessert +{$g}","🧠 Mentalidad mejorada +{$g}"); break;
            case 'riposo':
                $r = rand(20,40);
                $sc['energia'] += $r; $sc['morale'] += rand(5,10);
                $risultati[] = t("😴 Riposo: +{$r} energia","😴 Rest: +{$r} energy","😴 Ruhe: +{$r} Energie","😴 Descanso: +{$r} energía"); break;
            case 'social':
                $pop = rand(2,8) + intval($p['team_stelle'] ?? 1);
                $sc['popolarita'] += $pop; $sc['morale'] += rand(3,8);
                $risultati[] = t("📱 Social: +{$pop} popolarità","📱 Social: +{$pop} popularity","📱 Social: +{$pop} Popularität","📱 Social: +{$pop} popularidad"); break;
            case 'allenamento_speciale':
                $rischio = rand(1,100) - $bonus['riduzione_infortuni'];
                if ($rischio > 75) {
                    $sc['energia'] -= rand(40,60);
                    $durata_infortunio = rand(1,2);
                    $infortuni_mesi = $durata_infortunio; // verrà salvato sotto
                    $risultati[] = t(
                        "🚨 INFORTUNIO! Sarai fuori per {$durata_infortunio} " . ($durata_infortunio === 1 ? "mese" : "mesi") . "!",
                        "🚨 INJURY! Out for {$durata_infortunio} month" . ($durata_infortunio === 1 ? "" : "s") . "!",
                        "🚨 VERLETZUNG! Du fehlst {$durata_infortunio} Monat" . ($durata_infortunio === 1 ? "" : "e") . "!",
                        "🚨 ¡LESIÓN! Fuera {$durata_infortunio} " . ($durata_infortunio === 1 ? "mes" : "meses") . "!"
                    );
                } else {
                    $g    = rand(3,6) + $bonus['bonus_crescita'];
                    $keys = ['tiro','velocita','dribbling','fisico','mentalita'];
                    $k    = $keys[rand(0,4)];
                    $sc[$k] += $g;
                    $statLabel = [
                        'tiro'      => t('Tiro','Shooting','Schuss','Disparo'),
                        'velocita'  => t('Velocità','Speed','Geschwindigkeit','Velocidad'),
                        'dribbling' => t('Dribbling','Dribbling','Dribbling','Regate'),
                        'fisico'    => t('Fisico','Physical','Körper','Físico'),
                        'mentalita' => t('Mentalità','Mental','Mentalität','Mentalidad'),
                    ][$k] ?? ucfirst($k);
                    $risultati[] = t("🔥 Allenamento speciale: +{$g} {$statLabel}","🔥 Special training: +{$g} {$statLabel}","🔥 Spezialtraining: +{$g} {$statLabel}","🔥 Entrenamiento especial: +{$g} {$statLabel}");
                }
                break;
        }
    }

    // --- AGENTE BONUS ---
    $agent_bonus = getAgentBonus($db, $player_id);

    // --- SIMULAZIONE GIORNATA DI LEGA (con partite del giocatore) ---
    $player_skills = getPlayerSkills($db, $player_id);
    $lega_result = simulaGiornataLega($db, $p, $player_skills);
    $lega_msgs = $lega_result['msgs'] ?? [];

    // Usa il match "principale" (primo match del giocatore) per stipendio/morale/popolarità
    $match = $lega_result['match_principale'] ?? simulateMatch($p, $player_skills);
    $risultati[]    = "⚽ ".$match['desc'];
    $sc['popolarita'] += $match['pop_gain'];
    $sc['morale']     += $match['morale'];
    // lega_msgs inviati separatamente nel JSON

    // --- NOTIZIE DINAMICHE ---
    generaNotizieDinamiche($db, $player_id, $p, $match, $lega_result, $player_skills);

    // --- CHAMPIONS CUP (se qualificata) ---
    $champions_result = simulaChampions($db, $p);
    if ($champions_result) $risultati[] = $champions_result;

    // --- EVENTO CASUALE (10%) ---
    if (rand(1,100) <= 10) {
        $events = [
            [t('Crisi di forma improvvisa!','Sudden form crisis!','Plötzliche Formkrise!','¡Crisis de forma repentina!'),             'morale',    -15],
            [t('Sponsor importante ti contatta!','Important sponsor contacts you!','Wichtiger Sponsor kontaktiert dich!','¡Un patrocinador importante te contacta!'), 'popolarita', 10],
            [t('Il mister ti loda in conferenza stampa!','The coach praises you in the press conference!','Der Trainer lobt dich auf der Pressekonferenz!','¡El entrenador te elogia en la rueda de prensa!'), 'morale', 20],
            [t('Rivalità con un altro attaccante!','Rivalry with another striker!','Rivalität mit einem anderen Stürmer!','¡Rivalidad con otro delantero!'), 'morale', -5],
            [t('Offerta da un top club!','Offer from a top club!','Angebot von einem Topklub!','¡Oferta de un club top!'), 'morale', 15],
        ];
        $ev = $events[array_rand($events)];
        $evento_speciale = $ev[0];
        $sc[$ev[1]] += $ev[2];
        $risultati[] = t("🎲 EVENTO: ","🎲 EVENT: ","🎲 EREIGNIS: ","🎲 EVENTO: ").$ev[0];
    }

    // Sponsor academy
    if ($p['struttura_livello'] >= 7) {
        $sp = rand(5000,20000);
        $match['stipendio'] += $sp;
        $risultati[] = t("🤝 Sponsor Academy: +€","🤝 Academy Sponsor: +€","🤝 Academy-Sponsor: +€","🤝 Patrocinador Academia: +€").number_format($sp);
    }

    // --- CALCOLA NUOVE STATS ---
    $ns = [
        'tiro'       => min(125,max(1,$p['tiro']      +$sc['tiro'])),
        'velocita'   => min(125,max(1,$p['velocita']  +$sc['velocita'])),
        'dribbling'  => min(125,max(1,$p['dribbling'] +$sc['dribbling'])),
        'fisico'     => min(125,max(1,$p['fisico']    +$sc['fisico'])),
        'mentalita'  => min(125,max(1,$p['mentalita'] +$sc['mentalita'])),
        'popolarita' => min(100,max(0,$p['popolarita']+$sc['popolarita'])),
        'energia'    => min(100,max(0,$p['energia']  +$sc['energia'])),
        'morale'     => min(100,max(0,$p['morale']   +$sc['morale'])),
    ];
    if ($p['age'] >= 32) {
        $decay = ($p['age']-31)*0.3;
        $ns['velocita'] = max(1,$ns['velocita']-$decay);
        $ns['fisico']   = max(1,$ns['fisico']  -$decay);
    }

    $new_overall = intval(($ns['tiro']+$ns['velocita']+$ns['dribbling']+$ns['fisico']+$ns['mentalita'])/5); // max 125
    $bonus_soldi   = $lega_result['bonus_soldi'] ?? 0;
    $stipendio_agente = round($match['stipendio'] * ($agent_bonus['bonus_stipendio'] ?? 0));
    $new_soldi = $p['soldi'] + $match['stipendio'] + $bonus_soldi + $stipendio_agente;
    if ($stipendio_agente > 0) {
        $risultati[] = t("🤝 Bonus agente: +€","🤝 Agent bonus: +€","🤝 Agentenbonus: +€","🤝 Bono de agente: +€").number_format($stipendio_agente);
    }
    $new_gol     = $p['gol_carriera']    + $match['gol'];
    $new_assist  = $p['assist_carriera'] + $match['assist'];
    $new_trofei  = $p['trofei']          + ($lega_result['trofeo'] ?? 0);

    // Guard: correggi mese fuori stagione (7-8 = luglio/agosto, non dovrebbero esistere)
    $mese_corrente_safe = $p['mese_corrente'];
    if ($mese_corrente_safe === 7 || $mese_corrente_safe === 8) $mese_corrente_safe = 9;

    $new_mese  = $mese_corrente_safe + 1;
    $new_anno  = $p['anno_corrente'];
    $new_age   = $p['age'];
    $new_infortuni    = intval($p['infortuni_mesi'] ?? 0); // inizializzazione sicura — verrà sovrascritta dai blocchi sotto
    $pallone_result   = null;
    $promozione_msg   = null;
    $champ_finale     = ['messaggi' => [], 'soldi' => 0, 'trofei' => 0, 'champions_win' => false];

    // Wraparound dicembre → gennaio
    if ($new_mese > 12) $new_mese = 1;

    // --- FINE STAGIONE: giugno (6) → settembre (9) nuova stagione ---
    // La stagione va da settembre a giugno. Dopo giugno si avanza anno e si salta a settembre.
    if ($mese_corrente_safe == 6) {
        $new_mese = 9; // inizio nuova stagione
        $new_anno++; $new_age++;

        // Idempotency guard: skip year-end rewards if already processed for this anno
        $year_already_processed = $db->prepare("SELECT id FROM stagioni WHERE player_id=? AND anno=?");
        $year_already_processed->execute([$player_id, $p['anno_corrente']]);
        $anno_gia_chiuso = (bool)$year_already_processed->fetch();

        if (!$anno_gia_chiuso) {
            // Pallone d'Oro
            $pallone_result = calcPalloneDoro($db, $player_id, $p, $new_overall, $new_gol, $new_assist);
            $risultati[] = t("📅 Nuova stagione! Età: {$new_age}","📅 New season! Age: {$new_age}","📅 Neue Saison! Alter: {$new_age}","📅 ¡Nueva temporada! Edad: {$new_age}");
            if ($pallone_result) $risultati[] = $pallone_result['msg'];

            // Premi di fine anno (campionato)
            $premi = calcPremiCampionato($db, $p, $player_id);
            foreach ($premi['messaggi'] as $m) $risultati[] = $m;
            $new_soldi  += $premi['soldi'];
            $new_trofei += $premi['trofei'];

            // Champions Cup finale
            $champ_finale = concludiChampions($db, $p, $player_id);
            foreach ($champ_finale['messaggi'] as $m) $risultati[] = $m;
            $new_soldi  += $champ_finale['soldi'];
            $new_trofei += $champ_finale['trofei'];
        } else {
            // Anno già processato: skip premi, solo avanza stagione
            $risultati[] = t("📅 Nuova stagione! Età: {$new_age}","📅 New season! Age: {$new_age}","📅 Neue Saison! Alter: {$new_age}","📅 ¡Nueva temporada! Edad: {$new_age}");
            $champ_finale = ['messaggi'=>[],'soldi'=>0,'trofei'=>0,'champions_win'=>false];
        }

        // Promozione / Retrocessione
        $promo = checkPromozioneRetrocessione($db, $player_id, $p, $new_overall);
        if ($promo) {
            $promozione_msg = $promo['msg'];
            $risultati[]    = $promo['msg'];
            if (!empty($promo['new_team_id'])) {
                $db->prepare("UPDATE players SET team_id=? WHERE id=?")->execute([$promo['new_team_id'],$player_id]);
            }
        }

        // Reset energia e morale per la nuova stagione (settembre)
        if (isset($ns['energia']) && $ns['energia'] < 70) {
            $ns['energia'] = min(100, $ns['energia'] + 30); // parziale recupero
        }
        if (isset($ns['morale']) && $ns['morale'] < 60) {
            $ns['morale'] = min(100, $ns['morale'] + 20); // boost di inizio stagione
        }
        // Reset infortuni a inizio nuova stagione (guarigione estiva)
        $new_infortuni = 0;

        // Reset uso trasferimento per nuova stagione
        $db->prepare("UPDATE players SET trasferimento_anno=0 WHERE id=?")->execute([$player_id]);
        // Reset flag Champions Cup premio per nuova stagione
        $db->prepare("UPDATE players SET champions_premio_pagato=0 WHERE id=?")->execute([$player_id]);
        // Genera il calendario per la lega corretta (potrebbe essere cambiata dopo promozione/retrocessione)
        $new_team_row = $db->prepare("SELECT t.lega_id FROM players p JOIN teams t ON p.team_id=t.id WHERE p.id=?");
        $new_team_row->execute([$player_id]);
        $new_lega_row = $new_team_row->fetch();
        $lega_for_calendar = $new_lega_row ? intval($new_lega_row['lega_id']) : intval($p['lega_id']);
        generaCalendario($db, $lega_for_calendar, $new_anno);
    }

    // Gestione infortuni: decrementa se era già infortunato, mantieni se appena avvenuto
    // Se è inizio nuova stagione, $new_infortuni è già stato azzerato nel blocco year-end
    if ($new_mese !== 9) { // non sovrascrivere il reset estivo
        $prev_infortuni = intval($p['infortuni_mesi'] ?? 0);
        if ($prev_infortuni > 0 && $infortuni_mesi === $prev_infortuni) {
            // Nessun nuovo infortunio questo mese → decrementa di 1
            $new_infortuni = max(0, $prev_infortuni - 1);
            if ($new_infortuni === 0) $risultati[] = t("✅ Recupero completato! Sei di nuovo in piena forma.","✅ Recovery complete! You are back to full fitness.","✅ Genesung abgeschlossen! Du bist wieder in Topform.","✅ ¡Recuperación completa! Estás de vuelta al 100%.");
        } elseif ($infortuni_mesi > $prev_infortuni) {
            // Nuovo infortunio (o più grave) → prendi il valore più alto
            $new_infortuni = $infortuni_mesi;
        } else {
            $new_infortuni = 0;
        }
    }

    // Salva una riga per ogni partita giocata nel mese
    $stmt_log = $db->prepare("INSERT INTO log_mensile (player_id,anno,mese,azione,risultato,gol,assist,voto,evento_speciale,avv,esito) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
    foreach ($lega_msgs as $lm) {
        $stmt_log->execute([
            $player_id,
            $p['anno_corrente'],
            $p['mese_corrente'],
            implode(',', $azioni),
            '', // risultato allenamenti solo nel riepilogo
            intval($lm['player_gol']   ?? 0),
            intval($lm['player_assist'] ?? 0),
            floatval($lm['player_voto'] ?? 6.0),
            '', // evento speciale solo nel riepilogo
            strval($lm['avv'] ?? ''),
            strval($lm['esito'] ?? ''),
        ]);
    }
    // Riga riepilogo mensile (allenamenti + eventi, gol=0 così non altera le best query)
    if (empty($lega_msgs)) {
        // Nessuna partita (es. mese di pausa): salva comunque un record con i dati del match simulato
        $stmt_log->execute([$player_id,$p['anno_corrente'],$p['mese_corrente'],implode(',',$azioni),implode("\n",$risultati),$match['gol'],$match['assist'],$match['voto'],$evento_speciale,'','']);
    } else {
        // Salva riepilogo allenamenti/eventi separato (non conta nelle best-match query grazie ad avv='__riepilogo')
        $stmt_log->execute([$player_id,$p['anno_corrente'],$p['mese_corrente'],implode(',',$azioni),implode("\n",$risultati),0,0,0.0,$evento_speciale,'__riepilogo','']);
    }

    // Aggiorna giocatore
    $db->prepare("UPDATE players SET tiro=?,velocita=?,dribbling=?,fisico=?,mentalita=?,popolarita=?,energia=?,morale=?,overall=?,soldi=?,gol_carriera=?,assist_carriera=?,trofei=?,mese_corrente=?,anno_corrente=?,age=?,infortuni_mesi=? WHERE id=?")
       ->execute([$ns['tiro'],$ns['velocita'],$ns['dribbling'],$ns['fisico'],$ns['mentalita'],$ns['popolarita'],$ns['energia'],$ns['morale'],$new_overall,$new_soldi,$new_gol,$new_assist,$new_trofei,$new_mese,$new_anno,$new_age,$new_infortuni,$player_id]);

    $fine_carriera = false;
    if ($new_age >= 38) {
        $fine_carriera = true;
        $risultati[] = t("🏁 FINE CARRIERA! ","🏁 CAREER OVER! ","🏁 KARRIEREENDE! ","🏁 ¡FIN DE CARRERA! ").calcEpilogo($db,$player_id);
    }

    echo json_encode([
        'success'       => true,
        'risultati'     => $risultati,
        'match'         => $match,
        'lega_msgs'     => $lega_msgs,
        'pallone_doro'  => $pallone_result,
        'promozione'    => $promozione_msg,
        'fine_carriera' => $fine_carriera,
        'nuovo_anno'    => ($new_anno !== $p['anno_corrente']),
        'infortuni_mesi'=> $new_infortuni,
        'champions_win' => $champ_finale['champions_win'] ?? false,
    ]);
}

// NOTIZIE PARTITA AVANZATE — Libreria completa di 200+ template
// Contiene: notizie di gol con stile, notizie tattiche, 
// notizie meteorologiche, notizie arbitrali, notizie del mister

function getAdvancedMatchNews($nome, $team, $avv, $pgol, $passist, $pvoto, $esito, $giornata, $gf, $gs, $casa, $skills = []) {
    $items = [];
    $scarto = abs($gf - $gs);
    $isHome = $casa === _tn('in casa','at home','zu Hause','en casa');

    // ── 1. Skill-based goal news ──────────────────────────────────────────────
    if ($pgol >= 1) {
        if (isset($skills['tiro_potente']))
            $items[] = [_tn("💥 Potenza devastante","💥 Devastating power"), _tn("{$nome} fa tremare la traversa con un destro che sfonda la rete. 'Non ho pensato — ho solo calciato con tutto quello che avevo'. Voto {$pvoto}.","{$nome} rattles the crossbar with a right-foot thunderbolt that tears the net apart. 'I didn't think — I just hit it with everything I had'. Rating {$pvoto}."), "positivo"];
        if (isset($skills['tiro_giro']))
            $items[] = [_tn("🌀 Magia con l'esterno","🌀 Outside-of-the-boot magic"), _tn("Nemmeno una palla ferma può battere {$nome}: tiro a giro all'incrocio dei pali contro {$avv}. Una firma d'autore. Voto {$pvoto}.","Not even a set-piece can stop {$nome}: a curling strike into the top corner against {$avv}. A trademark finish. Rating {$pvoto}."), "positivo"];
        if (isset($skills['tiro_rabona']))
            $items[] = [_tn("🎭 RABONA IN PARTITA!","🎭 RABONA IN THE MATCH!"), _tn("Clamoroso: {$nome} segna con la rabona contro {$avv}! Immagini già virali sui social. Una prodezza che resterà nella storia. Voto {$pvoto}.","Incredible: {$nome} scores with a rabona against {$avv}! Already going viral. A moment of brilliance that will go down in history. Rating {$pvoto}."), "positivo"];
        if (isset($skills['colpo_testa']))
            $items[] = [_tn("👑 Re dell'aria","👑 King of the air"), _tn("{$nome} non ha rivali in elevazione: colpo di testa imperioso contro {$avv}, il portiere immobile. 'Quel cross era perfetto, ho fatto il mio lavoro.' Voto {$pvoto}.","{$nome} has no rivals in the air: a commanding header against {$avv}, the keeper rooted to the spot. 'The cross was perfect, I just did my job.' Rating {$pvoto}."), "positivo"];
        if (isset($skills['turbo']))
            $items[] = [_tn("⚡ Velocità della luce","⚡ Speed of light"), _tn("Passo di gamba, accelerazione bruciante, gol in contropiede: {$nome} lascia i difensori avversari nell'impossibilità di reagire. Voto {$pvoto}.","One step, explosive acceleration, counter-attack goal: {$nome} leaves the defenders with no chance to respond. Rating {$pvoto}."), "positivo"];
        if (isset($skills['freddezza']))
            $items[] = [_tn("🧊 Sangue freddo assoluto","🧊 Ice-cold composure"), _tn("Solo davanti al portiere, {$nome} aspetta, aspetta ancora... poi calcia col piede che vuole. Freddezza soprannaturale contro {$avv}. Voto {$pvoto}.","One-on-one with the keeper, {$nome} waits, waits some more... then picks his spot. Supernatural composure against {$avv}. Rating {$pvoto}."), "positivo"];
        if (isset($skills['istinto']))
            $items[] = [_tn("🎯 Istinto puro","🎯 Pure instinct"), _tn("Non si spiega, si ammira: {$nome} era già in posizione prima che il cross arrivasse. Istinto da goleador puro contro {$avv}. Voto {$pvoto}.","There's no explaining it — only admiring it: {$nome} was already in position before the cross arrived. Pure striker's instinct against {$avv}. Rating {$pvoto}."), "positivo"];
    }

    // ── 2. Tactical news ──────────────────────────────────────────────────────
    if ($pvoto >= 7.0) {
        $tattiche = [
            [_tn("🧩 Lettura tattica perfetta","🧩 Perfect tactical reading"), _tn("L'analista tattico della trasmissione: '{$nome} ha interpretato alla perfezione i movimenti senza palla. Ogni corsa era finalizzata.' Voto {$pvoto}.","The broadcast's tactical analyst: '{$nome} read every off-ball movement to perfection. Every run had a purpose.' Rating {$pvoto}."), "positivo"],
            [_tn("🗺️ Il mediano che non c'era","🗺️ The midfielder who was everywhere"), _tn("{$nome} ha coperto spazi enormi senza che i compagni se ne rendessero conto. Voto {$pvoto} che non racconta tutto.","{$nome} covered enormous areas without team-mates even noticing. A rating of {$pvoto} that doesn't tell the full story."), "positivo"],
            [_tn("📐 Precisione geometrica","📐 Geometric precision"), _tn("Ogni movimento di {$nome} sembrava calcolato al millimetro. Il mister in panchina: 'Ha eseguito il piano di gioco alla perfezione.' Voto {$pvoto}.","Every movement by {$nome} looked calculated to the millimetre. The coach on the bench: 'He executed the game plan to perfection.' Rating {$pvoto}."), "positivo"],
            [_tn("🔄 Polmone inesauribile","🔄 Inexhaustible engine"), _tn("{$nome} ha percorso 12.4 km, terzo nella squadra per chilometraggio. La corsa non tradisce mai. Voto {$pvoto}.","{$nome} covered 12.4 km, third in the team for distance run. Hard work never lies. Rating {$pvoto}."), "positivo"],
        ];
        $items[] = $tattiche[array_rand($tattiche)];
    }

    // ── 3. Weather/pitch conditions ───────────────────────────────────────────
    $meteo = [
        [_tn("🌧️ Pioggia battente","🌧️ Heavy rain"), _tn("La pioggia non ferma {$nome}: condizioni difficili, eppure la sua performance contro {$avv} è stata di alto livello. Voto {$pvoto}.","The rain doesn't stop {$nome}: tough conditions, yet his performance against {$avv} was top class. Rating {$pvoto}."), "info"],
        [_tn("☀️ Sole e belle giocate","☀️ Sun and fine football"), _tn("Una giornata perfetta per il calcio: {$nome} ha sfruttato le condizioni ottimali per esprimersi al meglio contro {$avv}. Voto {$pvoto}.","A perfect day for football: {$nome} made the most of the ideal conditions to express himself against {$avv}. Rating {$pvoto}."), "info"],
        [_tn("💨 Vento fastidioso","💨 Annoying wind"), _tn("Con il vento che rendeva difficile il gioco aereo, {$nome} ha saputo adattarsi magnificamente. Voto {$pvoto}.","With the wind making aerial play difficult, {$nome} adapted magnificently. Rating {$pvoto}."), "info"],
        [_tn("❄️ Freddo polare","❄️ Freezing cold"), _tn("Temperature rigide, ma {$nome} è rimasto concentrato per tutti i 90 minuti contro {$avv}. Voto {$pvoto}.","Bitter temperatures, but {$nome} remained focused for all 90 minutes against {$avv}. Rating {$pvoto}."), "info"],
        [_tn("🌫️ Nebbia fitta","🌫️ Thick fog"), _tn("Serata nebbiosa allo stadio — eppure {$nome} ha trovato il modo di brillare contro {$avv}. Voto {$pvoto}.","A foggy evening at the stadium — yet {$nome} found a way to shine against {$avv}. Rating {$pvoto}."), "info"],
    ];
    if (rand(1, 100) <= 30) $items[] = $meteo[array_rand($meteo)];

    // ── 4. Referee news ───────────────────────────────────────────────────────
    if (rand(1, 100) <= 25) {
        $arbitro = [
            [_tn("🟨 Giallo contestato","🟨 Disputed yellow card"), _tn("Ammonizione contestata per {$nome}: 'Non ho toccato nessuno' — le sue parole a fine partita. Decisione che ha fatto discutere.","Disputed booking for {$nome}: 'I didn't touch anyone' — his words at full time. A decision that sparked debate."), "negativo"],
            [_tn("📺 VAR protagonista","📺 VAR takes centre stage"), _tn("Il VAR entra in scena durante {$team}-{$avv}: due minuti di attesa, poi la decisione che cambia la partita. {$nome} resta freddo.","VAR intervenes during {$team}-{$avv}: two minutes of waiting, then the decision that changes the match. {$nome} stays calm."), "info"],
            [_tn("🟥 Rosso all'avversario","🟥 Opposition red card"), _tn("L'avversario diretto di {$nome} viene espulso: vantaggio numerico che il {$team} sfrutta nel finale.","{$nome}'s direct opponent is sent off: a numerical advantage that {$team} exploit in the closing stages."), "positivo"],
            [_tn("⚖️ Arbitro contestato","⚖️ Referee under fire"), _tn("Fischio finale contestato da entrambe le squadre — ma i dati statistici danno ragione a {$nome}: dominante per 90 minuti.","The final whistle contested by both sides — but the stats back {$nome}: dominant for 90 minutes."), "info"],
        ];
        $items[] = $arbitro[array_rand($arbitro)];
    }

    // ── 5. Coach news ─────────────────────────────────────────────────────────
    $mister = [
        [_tn("🎙️ Il mister in conferenza","🎙️ Coach speaks out"), _tn("'Siamo soddisfatti. {$nome} ha fatto quello che gli chiedevo e anche di più.' — parole del tecnico nel post-partita contro {$avv}.","'We're satisfied. {$nome} did what I asked of him and more.' — the coach's words after the match against {$avv}."), "positivo"],
        [_tn("📋 Piano gara rispettato","📋 Game plan executed"), _tn("Il tecnico del {$team} elogia la squadra: 'Abbiamo eseguito il piano alla perfezione. E {$nome} è stato fondamentale nell'interpretarlo.' Voto {$pvoto}.","The {$team} coach praises the squad: 'We executed the plan to perfection. And {$nome} was key to interpreting it.' Rating {$pvoto}."), "positivo"],
        [_tn("🔄 Cambio tattico vincente","🔄 Winning tactical switch"), _tn("Il mister cambia il modulo al 60°: {$nome} si trova nuove libertà e ne approfitta subito. La flessibilità paga. Voto {$pvoto}.","The coach changes shape at 60 minutes: {$nome} finds new freedom and takes advantage immediately. Flexibility pays. Rating {$pvoto}."), "positivo"],
        [_tn("🤔 Mister insoddisfatto","🤔 Coach not satisfied"), _tn("'Potevamo fare di più' — il tecnico non nasconde l'insoddisfazione nonostante il {$gf}-{$gs}. {$nome} sa che deve fare meglio.","'We could have done more' — the coach makes no secret of his dissatisfaction despite the {$gf}-{$gs}. {$nome} knows he must improve."), "info"],
    ];
    $items[] = $mister[array_rand($mister)];

    // ── 6. League context news ────────────────────────────────────────────────
    if ($giornata > 0) {
        $contesto = [
            [_tn("📊 Classifica marcatori","📊 Top scorers chart"), _tn("Dopo la G{$giornata}, {$nome} si conferma tra i primi cinque marcatori della lega con i suoi gol in stagione. La classifica dice tutto.","After GW{$giornata}, {$nome} confirms his place among the top five scorers in the league this season. The table says it all."), "positivo"],
            [_tn("🏟️ Giornata {$giornata}","🏟️ Gameweek {$giornata}"), _tn("Alla G{$giornata} di campionato, {$team} e {$avv} danno vita a un confronto che entra nella storia della stagione. {$nome} è ancora protagonista.","In GW{$giornata} of the season, {$team} and {$avv} produce a contest that will go down in the season's history. {$nome} is the star again."), "info"],
            [_tn("📈 Rendimento costante","📈 Consistent performance"), _tn("La G{$giornata} conferma la continuità di rendimento di {$nome}: terza prestazione di alta qualità di fila. I numeri non mentono.","GW{$giornata} confirms {$nome}'s consistency: a third high-quality performance in a row. The numbers don't lie."), "positivo"],
        ];
        if (rand(1, 100) <= 40) $items[] = $contesto[array_rand($contesto)];
    }

    // ── 7. Season phase news ──────────────────────────────────────────────────
    if ($giornata >= 30) {
        $items[] = [_tn("🏁 Rush finale","🏁 Final push"), _tn("Siamo nelle ultime giornate — ogni punto vale doppio. {$nome} lo sa e alza ulteriormente il livello. Voto {$pvoto}.","We're in the final stretch — every point counts double. {$nome} knows it and raises his level even further. Rating {$pvoto}."), "positivo"];
    } elseif ($giornata <= 5) {
        $items[] = [_tn("🌱 Avvio di stagione","🌱 Season opener"), _tn("Le prime giornate sono fondamentali per impostare la rotta. {$nome} parte subito con ambizioni alte. Voto {$pvoto}.","The opening gameweeks are crucial for setting the tone. {$nome} starts immediately with high ambitions. Rating {$pvoto}."), "info"];
    }

    // ── 8. Match-specific news ────────────────────────────────────────────────
    if ($scarto >= 4 && $esito === 'V')
        $items[] = [_tn("💪 Goleada storica!","💪 Historic thrashing!"), _tn("Un {$gf}-{$gs} da incorniciare: {$team} travolge {$avv} con una prestazione da manuale. {$nome} tra i più brillanti. Voto {$pvoto}.","A framing-worthy {$gf}-{$gs}: {$team} overwhelms {$avv} with a textbook display. {$nome} among the brightest. Rating {$pvoto}."), "positivo"];
    if ($scarto === 0 && $pgol >= 1)
        $items[] = [_tn("🤝 Segna ma non basta","🤝 Goal not enough"), _tn("La firma di {$nome} non è sufficiente per i tre punti: {$gf}-{$gs} finale. 'Sono soddisfatto del gol, meno del risultato.' Voto {$pvoto}.","The {$nome} stamp is not enough for three points: {$gf}-{$gs} at the end. 'I'm happy with the goal, less so with the result.' Rating {$pvoto}."), "info"];
    if ($esito === 'S' && $pgol >= 2)
        $items[] = [_tn("😔 Doppietta vana","😔 Brace in vain"), _tn("{$nome} segna due reti ma {$team} cede ancora: {$gf}-{$gs} il finale. 'Ho fatto la mia parte, il resto della squadra dovrà fare di più.' Voto {$pvoto}.","{$nome} scores twice but {$team} slip up again: {$gf}-{$gs} the final score. 'I did my part, the rest of the squad will need to do more.' Rating {$pvoto}."), "negativo"];
    if ($isHome && $esito === 'V')
        $items[] = [_tn("🏟️ Imbattibile in casa","🏟️ Unstoppable at home"), _tn("{$team} vince ancora tra le mura amiche contro {$avv}: {$gf}-{$gs}. {$nome} si nutre dell'energia del proprio pubblico. Voto {$pvoto}.","{$team} win again at home against {$avv}: {$gf}-{$gs}. {$nome} feeds off the energy of his own fans. Rating {$pvoto}."), "positivo"];
    if (!$isHome && $esito === 'V')
        $items[] = [_tn("✈️ Magia in trasferta","✈️ Away day magic"), _tn("Vincere in casa avversaria non è da tutti: {$team} lo fa contro {$avv} ({$gf}-{$gs}). {$nome} trascina la squadra lontano dalle mura amiche. Voto {$pvoto}.","Winning away from home is no easy feat: {$team} do it against {$avv} ({$gf}-{$gs}). {$nome} drags the team to victory on the road. Rating {$pvoto}."), "positivo"];

    if (!empty($items)) {
        shuffle($items);
        return array_slice($items, 0, 2);
    }
    return [];
}

// NOTIZIE ESTESE — Pool supplementare di notizie dinamiche
// Chiamata da generaNotizieDinamiche per varietà aggiuntiva
function getExtraNewsPool($nome, $team, $avv, $pgol, $passist, $pvoto, $esito, $overall, $pop, $stelle, $anno, $mese) {
    $pool = [];
    $gf_label = $pgol > 0
        ? "{$pgol} " . _tn('gol','goals','Tore','goles')
        : ($passist > 0 ? "{$passist} assist" : _tn('una prestazione solida','a solid performance','eine solide Leistung','una actuación sólida'));

    // Rating-based news
    if ($pvoto >= 9.0) {
        $pool[] = [_tn("⭐ Prestazione da 10","⭐ Perfect 10 performance"), _tn("Partita stellare di {$nome} contro {$avv}: voto {$pvoto} che fa riflettere. Quando è in questa forma, è semplicemente inarrestabile.","Stellar match by {$nome} against {$avv}: rating {$pvoto}. When he's in this form, he's simply unstoppable."), "positivo"];
        $pool[] = [_tn("🌟 MVP indiscusso","🌟 Undisputed MVP"), _tn("{$nome} eletto MVP della partita dai tifosi e dalla stampa dopo il {$pvoto} contro {$avv}. 'Una delle migliori performance che ricordi', scrive il quotidiano sportivo.","{$nome} voted match MVP by fans and press after the {$pvoto} rating against {$avv}. 'One of the best performances I can remember', writes the sports paper."), "positivo"];
        $pool[] = [_tn("🎖️ Voto da campione","🎖️ Champion's rating"), _tn("Nemmeno i critici più severi possono dire nulla sul {$pvoto} di {$nome} contro {$avv}. Una prestazione enciclopedica.","Even the harshest critics have nothing to say about {$nome}'s {$pvoto} against {$avv}. An encyclopaedic performance."), "positivo"];
    } elseif ($pvoto >= 8.0) {
        $pool[] = [_tn("👏 Ottima partita","👏 Great game"), _tn("{$nome} chiude la partita contro {$avv} con un {$pvoto} che fa felice il mister. Contributo prezioso alla causa.","{$nome} wraps up the match against {$avv} with a {$pvoto} that pleases the coach. A valuable contribution to the cause."), "positivo"];
        $pool[] = [_tn("📈 In crescita","📈 Growing stronger"), _tn("Ancora un {$pvoto} per {$nome} contro {$avv}. La continuità è il segreto dei grandi campioni, e lui lo sa bene.","Another {$pvoto} for {$nome} against {$avv}. Consistency is the secret of great champions, and he knows it well."), "positivo"];
    } elseif ($pvoto <= 5.0) {
        $pool[] = [_tn("📉 Giornata no","📉 Off day"), _tn("{$nome} delude contro {$avv}: voto {$pvoto}. Il mister chiede più concentrazione. 'Sa benissimo cosa deve fare', le parole dello staff.","{$nome} disappoints against {$avv}: rating {$pvoto}. The coach demands more focus. 'He knows exactly what he needs to do', says the staff."), "negativo"];
        $pool[] = [_tn("😤 Il momento difficile","😤 A tough spell"), _tn("Capita a tutti: {$nome} ha voto {$pvoto} contro {$avv}. L'importante è la reazione. I campioni si distinguono proprio in questi momenti.","It happens to everyone: {$nome} rated {$pvoto} against {$avv}. The key is the reaction. Champions show their true colours in these moments."), "negativo"];
    }

    // Goal-scoring news
    if ($pgol >= 4) {
        $pool[] = [_tn("🏆 POKER DI GOL!","🏆 FOUR-GOAL HAUL!"), _tn("Storico: {$nome} segna 4 reti contro {$avv}. Un risultato che entra nella storia del club e che farà parlare per settimane.","Historic: {$nome} scores 4 goals against {$avv}. A result that enters the club's history books and will be talked about for weeks."), "positivo"];
        $pool[] = [_tn("🎰 Quattro gol, un mito","🎰 Four goals, a legend"), _tn("Quattro volte a segno: {$nome} contro {$avv} ha mostrato al mondo intero perché è tra i più forti. I social impazziscono.","Four times on target: {$nome} against {$avv} showed the world exactly why he's among the best. Social media goes wild."), "positivo"];
    }
    if ($pgol >= 2 && $passist >= 1) {
        $pool[] = [_tn("🔥 Hat-trick con assist","🔥 Goals and assist"), _tn("Doppietta più assist: {$nome} ha risolto la partita contro {$avv} praticamente da solo. Voto {$pvoto}. Dominante.","Brace plus assist: {$nome} single-handedly decided the match against {$avv}. Rating {$pvoto}. Dominant."), "positivo"];
    }

    // Popularity news
    if ($pop >= 80) {
        $pool[] = [_tn("🌍 Icona planetaria","🌍 Global icon"), _tn("L'agenzia di marketing GlobalSport certifica: {$nome} è il terzo calciatore più cercato sul web questa settimana. Numeri da rockstar.","Marketing agency GlobalSport confirms: {$nome} is the third most searched footballer on the web this week. Rockstar numbers."), "positivo"];
        $pool[] = [_tn("📺 In prima serata","📺 Prime time"), _tn("Il talk show di punta della televisione nazionale ha dedicato un'intera puntata a {$nome}. 'Il calciatore del decennio', il titolo dell'episodio.","The national TV's flagship talk show dedicated an entire episode to {$nome}. 'The footballer of the decade', the episode title."), "positivo"];
        $pool[] = [_tn("💎 Brand ambassador","💎 Brand ambassador"), _tn("Un marchio di lusso svizzero ha siglato un accordo con {$nome}. Il giocatore: 'Scelgo solo partner che condividono i miei valori'.","A Swiss luxury brand has signed a deal with {$nome}. The player: 'I only choose partners who share my values'."), "info"];
    } elseif ($pop >= 60) {
        $pool[] = [_tn("📣 La fama cresce","📣 Fame grows"), _tn("I follower di {$nome} sui social hanno superato il milione: un traguardo che attira sponsor e visibilità internazionale.","{$nome}'s social media followers have passed one million: a milestone that attracts sponsors and international visibility."), "positivo"];
        $pool[] = [_tn("🗞️ Sul giornale nazionale","🗞️ National front page"), _tn("Prima pagina per {$nome} sul più importante quotidiano sportivo del paese. 'Il futuro del calcio italiano è qui'.","Front page for {$nome} in the country's leading sports newspaper. 'The future of football is here'."), "positivo"];
    } elseif ($pop <= 20) {
        $pool[] = [_tn("🔭 Sotto i riflettori","🔭 Under the spotlight"), _tn("Ancora poca visibilità per {$nome}, ma chi lavora bene viene sempre notato. Il consiglio dello staff: 'Continua così, i risultati arriveranno'.","Still limited visibility for {$nome}, but hard work always gets noticed. Staff advice: 'Keep it up, the results will come'."), "info"];
    }

    // Career year news
    if ($anno <= 2) {
        $pool[] = [_tn("🌱 Il giovane leone","🌱 The young lion"), _tn("La stampa lo definisce 'la rivelazione della stagione': {$nome} sta bruciando le tappe con una maturità sorprendente per la sua età.","The press calls him 'the revelation of the season': {$nome} is racing ahead with surprising maturity for his age."), "positivo"];
        $pool[] = [_tn("📚 Imparare dal professionismo","📚 Learning from the pros"), _tn("Il capitano del {$team}: '{$nome} è il talento più serio che ho visto arrivare in questa squadra. Ha fame di imparare e di vincere'.","The {$team} captain: '{$nome} is the most serious talent I've seen arrive at this club. He's hungry to learn and to win'."), "positivo"];
    } elseif ($anno >= 8) {
        $pool[] = [_tn("🎖️ La saggezza del veterano","🎖️ Veteran wisdom"), _tn("Dopo anni di carriera, {$nome} sa come affrontare i momenti critici. 'L'esperienza vale più di qualsiasi tattica', parola sua.","After years in the game, {$nome} knows how to handle critical moments. 'Experience is worth more than any tactic', his own words."), "info"];
        $pool[] = [_tn("🕰️ Ancora affamato","🕰️ Still hungry"), _tn("Nonostante i traguardi raggiunti, {$nome} conserva intatta la voglia di vincere. 'Non ho ancora detto tutto quello che so fare'.","Despite all he has achieved, {$nome} keeps his hunger to win intact. 'I haven't yet shown everything I can do'."), "positivo"];
    }

    // Club prestige news
    if ($stelle >= 5) {
        $pool[] = [_tn("🏟️ Il peso della maglia","🏟️ The weight of the shirt"), _tn("Indossare questa maglia è una responsabilità enorme. {$nome} lo sa: 'Ogni partita è una finale. I tifosi meritano il massimo'.","Wearing this shirt is an enormous responsibility. {$nome} knows it: 'Every match is a final. The fans deserve the best'."), "info"];
        $pool[] = [_tn("💼 Il club ti vuole","💼 The club wants you"), _tn("Il direttore sportivo in conferenza: 'Non parliamo di mercato. {$nome} è intoccabile. Punto.'","The sporting director in conference: 'We're not discussing the market. {$nome} is untouchable. Full stop.'"), "positivo"];
    } elseif ($stelle <= 2) {
        $pool[] = [_tn("🚀 Il locomotore della squadra","🚀 The team's engine"), _tn("In un team che non brilla, {$nome} è la luce nel buio. I compagni: 'Senza di lui saremmo già in zona retrocessione'.","In a team that struggles, {$nome} is the light in the dark. Team-mates: 'Without him we'd already be in the relegation zone'."), "positivo"];
        $pool[] = [_tn("⭐ Troppo grande per questa lega?","⭐ Too big for this league?"), _tn("I numeri parlano chiaro: {$nome} è il giocatore più influente della lega. Quanto ancora resterà a questo livello?","The numbers speak clearly: {$nome} is the most influential player in the league. How much longer will he stay at this level?"), "info"];
    }

    // Monthly seasonal news
    switch ($mese) {
        case 9:
            $pool[] = [_tn("🍂 Si apre la stagione","🍂 The season begins"), _tn("Primo mese di campionato per {$nome} e {$team}: le aspettative sono alte, il gruppo è carico. 'Quest'anno o mai più', la parola d'ordine.","First month of the season for {$nome} and {$team}: expectations are high, the squad is fired up. 'This year or never', the battle cry."), "info"];
            $pool[] = [_tn("📋 Obiettivi dichiarati","📋 Stated goals"), _tn("In conferenza stampa di inizio stagione, {$nome}: 'Voglio segnare almeno 20 gol. È il mio obiettivo minimo'. L'asticella è alta.","At the pre-season press conference, {$nome}: 'I want to score at least 20 goals. That's my minimum target'. The bar is set high."), "info"];
            break;
        case 12:
            $pool[] = [_tn("🎄 Il regalo di Natale","🎄 The Christmas gift"), _tn("Un gol o una bella vittoria prima delle festività: il miglior regalo che {$nome} potesse fare ai tifosi del {$team}.","A goal or a fine win before the holidays: the best gift {$nome} could give to {$team}'s fans."), "positivo"];
            $pgol_bilancio = $pgol > 5 ? _tn("Soddisfatto dei gol","Happy with my goals") : _tn("Devo fare di più nel girone di ritorno","I need to do more in the second half of the season");
            $pool[] = [_tn("🏁 Bilancio di metà stagione","🏁 Half-season review"), _tn("A dicembre {$nome} fa i conti: '{$pgol_bilancio}'. Il mister è d'accordo.","In December {$nome} takes stock: '{$pgol_bilancio}'. The coach agrees."), "info"];
            break;
        case 1:
            $pool[] = [_tn("🌟 Buon anno!","🌟 Happy New Year!"), _tn("Nuovo anno, nuovi obiettivi per {$nome}. 'Quest'anno sarà l'anno della svolta definitiva', scrive sui social con una foto dall'allenamento.","New year, new goals for {$nome}. 'This year will be the year of the definitive turning point', he writes on social media with a training photo."), "positivo"];
            $pool[] = [_tn("❄️ Calcio d'inverno","❄️ Winter football"), _tn("Il freddo non ferma {$nome}: presente e puntuale agli allenamenti mentre fuori nevica. 'Il campione non conosce la stagione', dice il mister.","The cold doesn't stop {$nome}: present and punctual at training while it snows outside. 'A champion doesn't know the season', says the coach."), "info"];
            break;
        case 5:
            $pool[] = [_tn("🌸 Finale di stagione","🌸 End of season run-in"), _tn("Il campionato entra nel vivo del rush finale. {$nome} è pronto: 'Ho conservato energie per questo momento. Adesso arriva il bello'.","The league enters the final stretch. {$nome} is ready: 'I've saved energy for this moment. Now comes the good part'."), "positivo"];
            $pool[] = [_tn("⏱️ Conto alla rovescia","⏱️ Countdown"), _tn("Mancano poche giornate alla fine. {$nome}: 'Non abbassiamo la guardia. Ogni punto può essere decisivo per la classifica finale'.","Just a few matchdays left. {$nome}: 'We can't drop our guard. Every point could be decisive for the final table'."), "info"];
            break;
        case 6:
            $pool[] = [_tn("🏁 Fine stagione","🏁 Season over"), _tn("La stagione si chiude per {$nome} e {$team}. 'È stato un viaggio incredibile. Adesso ci godiamo le vacanze e poi si riparte più forti di prima'.","The season ends for {$nome} and {$team}. 'It's been an incredible journey. Now we enjoy the holidays and then come back stronger."), "info"];
            $pool[] = [_tn("☀️ Arrivederci al prossimo anno","☀️ See you next season"), _tn("Stagione finita: {$nome} saluta i tifosi con un post commovente. 'Grazie per avermi sostenuto anche nei momenti difficili. Ci vediamo a settembre'.","Season done: {$nome} says farewell to fans with a moving post. 'Thank you for supporting me even in the difficult moments. See you in September'."), "positivo"];
            break;
    }

    // Elite overall news
    if ($overall >= 90) {
        $pool[] = [_tn("🔝 Il confronto con i grandi","🔝 Compared to the greats"), _tn("La rivista France Football paragona lo stile di gioco di {$nome} a quello dei più grandi della storia. Un accostamento che fa sognare i tifosi.","France Football magazine compares {$nome}'s style of play to that of the all-time greats. A comparison that makes fans dream."), "positivo"];
        $pool[] = [_tn("🏅 Tra i 10 migliori del mondo","🏅 Top 10 in the world"), _tn("Il sondaggio annuale di WorldFootball.net piazza {$nome} tra i dieci migliori giocatori del pianeta. 'Devo continuare a spingere', la sua risposta.","WorldFootball.net's annual survey places {$nome} among the ten best players on the planet. 'I have to keep pushing', his response."), "positivo"];
    } elseif ($overall >= 80) {
        $pool[] = [_tn("📊 Top 50 europeo","📊 European top 50"), _tn("Secondo le statistiche avanzate di un portale specializzato, {$nome} è tra i top 50 giocatori d'Europa per rendimento. La progressione è costante.","According to advanced stats from a specialist website, {$nome} is among the top 50 players in Europe by performance. The progression is constant."), "positivo"];
    }

    // Character news (always relevant)
    $carattere = [
        [_tn("🤺 Mentalità da guerriero","🤺 Warrior mentality"), _tn("Contro {$avv}, con il risultato in bilico, {$nome} ha preso per mano la squadra. 'Non mollare mai è il mio mantra', le sue parole post-partita.","Against {$avv}, with the result on a knife-edge, {$nome} took the team by the hand. 'Never give up is my mantra', his post-match words."), "positivo"],
        [_tn("🎯 La firma del campione","🎯 The champion's signature"), _tn("Ogni gol di {$nome} ha qualcosa di speciale: c'è sempre qualità nella scelta del tiro, dell'assist, del momento. Non è fortuna. È classe.","Every {$nome} goal has something special: there's always quality in the choice of shot, assist, timing. It's not luck. It's class."), "positivo"],
        [_tn("🧩 Il giocatore totale","🧩 The complete player"), _tn("Difende, attacca, organizza: {$nome} è il calciatore completo che ogni allenatore sogna di avere in rosa. Il {$team} lo sa bene.","Defends, attacks, organises: {$nome} is the complete player every coach dreams of having in the squad. {$team} know it well."), "info"],
        [_tn("🏋️ Il lavoro non mente","🏋️ Hard work never lies"), _tn("Cinquanta cross analizzati, duecento tiri rielaborati: il lavoro di {$nome} in allenamento riflette la sua prestazione in partita. Professionale al 100%.","Fifty crosses analysed, two hundred shots reworked: {$nome}'s training work reflects his match performance. 100% professional."), "info"],
        [_tn("🌊 Nel flusso della partita","🌊 In the flow of the game"), _tn("Ci sono giorni in cui {$nome} sembra connesso con il pallone a un livello superiore. Oggi contro {$avv} era uno di quei giorni.","There are days when {$nome} seems connected to the ball on a higher level. Today against {$avv} was one of those days."), "positivo"],
        [_tn("🎭 Il calciatore e l'artista","🎭 The footballer and the artist"), _tn("Chi vede giocare {$nome} capisce che il calcio non è solo sport: è espressione, creatività, istinto. Un artista con gli scarpini ai piedi.","Watching {$nome} play, you understand that football is not just sport: it's expression, creativity, instinct. An artist wearing boots."), "positivo"],
        [_tn("🧭 Orientamento tattico","🧭 Tactical awareness"), _tn("Il mister spiega: 'Ho chiesto a {$nome} di spostarsi più a sinistra. Ha eseguito perfettamente. Ha una comprensione tattica superiore alla media'.","The coach explains: 'I asked {$nome} to move wider left. He executed it perfectly. His tactical understanding is above average'."), "info"],
        [_tn("⚡ Reazione immediata","⚡ Immediate reaction"), _tn("Dopo una partita deludente, {$nome} era il primo ad arrivare il mattino dopo. 'I campioni non nascondono le sconfitte, le usano come carburante'.","After a disappointing match, {$nome} was the first to arrive the next morning. 'Champions don't hide defeats, they use them as fuel'."), "positivo"],
        [_tn("🔬 Analisi del rendimento","🔬 Performance analysis"), _tn("Il software di analisi avanzata del club evidenzia: {$nome} crea 2.8 occasioni da gol a partita. Terzo in Europa per questa statistica.","The club's advanced analysis software highlights: {$nome} creates 2.8 goal chances per match. Third in Europe for this statistic."), "info"],
        [_tn("💪 Forza mentale","💪 Mental strength"), _tn("Tre sconfitte di fila non hanno scalfito la determinazione di {$nome}. 'Ho vissuto momenti più difficili. Ne sono sempre uscito più forte'.","Three defeats in a row have not dented {$nome}'s determination. 'I've been through harder times. I've always come out stronger."), "positivo"],
    ];
    $pool = array_merge($pool, $carattere);

    shuffle($pool);
    return array_slice($pool, 0, 3);
}

// CALENDARIO: genera andata+ritorno per una lega (34 giornate per 18 squadre)
// Distribuisce le giornate nei 10 mesi di stagione (set→giu)
function generaCalendario($db, $lega_id, $anno) {
    // Già generato?
    $chk = $db->prepare("SELECT COUNT(*) as n FROM calendario WHERE lega_id=? AND anno=?");
    $chk->execute([$lega_id, $anno]);
    if ($chk->fetch()['n'] > 0) return;

    $stmt = $db->prepare("SELECT id FROM teams WHERE lega_id=?");
    $stmt->execute([$lega_id]);
    $teams = array_column($stmt->fetchAll(), 'id');
    $n = count($teams);
    if ($n < 2) return;

    // Round-robin algorithm (circle method)
    // Se n è dispari aggiungi un "bye"
    if ($n % 2 !== 0) $teams[] = null;
    $total = count($teams);
    $rounds = $total - 1;
    $matches_per_round = $total / 2;

    $giornate = []; // array of [home_id, away_id]
    $fixed = $teams[0];
    $rotating = array_slice($teams, 1);

    for ($r = 0; $r < $rounds; $r++) {
        $home = $fixed;
        $away = $rotating[0];
        if ($home !== null && $away !== null) $giornate[] = [$home, $away];
        for ($i = 1; $i < $matches_per_round; $i++) {
            $h = $rotating[$i];
            $a = $rotating[$total - 2 - $i];
            if ($h !== null && $a !== null) $giornate[] = [$h, $a];
        }
        $rotating = array_merge(array_slice($rotating, -1), array_slice($rotating, 0, -1));
    }

    // Duplica per ritorno (invertendo home/away)
    $andata  = $giornate;
    $ritorno = array_map(fn($m) => [$m[1], $m[0]], $giornate);
    $tutti   = array_merge($andata, $ritorno); // 34 giornate totali per 18 squadre

    // Distribuzione nei mesi: stagione set(9) ott(10) nov(11) dic(12) gen(1) feb(2) mar(3) apr(4) mag(5) giu(6)
    $mesi_stagione = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]; // 10 mesi
    $numMesi       = count($mesi_stagione);

    // $tutti contiene TUTTE le partite appiattite. Ogni "giornata" ha $matches_per_round partite.
    // Ricostruiamo le giornate raggruppate per turno.
    $turni = []; // $turni[turno_idx] = array di match
    $turno_size = max(1, $matches_per_round); // partite per giornata (min 1 to avoid division by zero)
    foreach ($tutti as $idx => $match) {
        $turno_idx = (int)floor($idx / $turno_size);
        $turni[$turno_idx][] = $match;
    }
    $totTurni = count($turni); // es. 34 turni per 18 squadre

    // Distribuzione equa: $perMese turni per mese, ultimi mesi prendono il resto
    $perMese = (int)floor($totTurni / $numMesi);
    $resto   = $totTurni % $numMesi;

    $ins = $db->prepare("INSERT IGNORE INTO calendario (lega_id,anno,giornata,mese,home_id,away_id) VALUES(?,?,?,?,?,?)");
    $giornataNum = 1;
    $turnoIdx    = 0;
    for ($mi = 0; $mi < $numMesi; $mi++) {
        $mese        = $mesi_stagione[$mi];
        $turniMese   = $perMese + ($mi < $resto ? 1 : 0);
        for ($t = 0; $t < $turniMese; $t++) {
            if (!isset($turni[$turnoIdx])) break;
            foreach ($turni[$turnoIdx] as $match) {
                $ins->execute([$lega_id, $anno, $giornataNum, $mese, $match[0], $match[1]]);
            }
            $giornataNum++;
            $turnoIdx++;
        }
    }
}

// SIMULA LE PARTITE DEL MESE per la lega del giocatore
// Returns la partita del giocatore e aggiorna la classifica
function simulaGiornataLega($db, $p, $player_skills = []) {
    $team_id  = $p['team_id'];
    $lega_id  = $p['lega_id'];
    $anno     = $p['anno_corrente'];
    $mese     = $p['mese_corrente'];
    $team_ovr = intval($p['team_ovr'] ?? 65);
    $match_principale = null;

    // Genera calendario se non esiste
    generaCalendario($db, $lega_id, $anno);

    // Sanity check: se il mese corrente non ha partite non giocate ma ce ne sono rimaste,
    // probabilmente il calendario era malformato (vecchio bug). Rigenera e redistribuisci.
    $chkMese = $db->prepare("SELECT COUNT(*) as n FROM calendario WHERE lega_id=? AND anno=? AND mese=? AND giocata=0");
    $chkMese->execute([$lega_id, $anno, $mese]);
    $partiteMeseCount = intval($chkMese->fetch()['n']);
    $chkTot = $db->prepare("SELECT COUNT(*) as n FROM calendario WHERE lega_id=? AND anno=? AND giocata=0");
    $chkTot->execute([$lega_id, $anno]);
    $partiteRimanenti = intval($chkTot->fetch()['n']);

    if ($partiteMeseCount === 0 && $partiteRimanenti > 0) {
        // Calendario malformato: elimina e rigenera. Azzera anche la classifica
        // per evitare punti/gol orfani legati alle partite cancellate.
        $db->prepare("DELETE FROM calendario WHERE lega_id=? AND anno=?")->execute([$lega_id, $anno]);
        $db->prepare("DELETE FROM classifica WHERE lega_id=? AND anno=?")->execute([$lega_id, $anno]);
        generaCalendario($db, $lega_id, $anno);
    }

    // Assicura record classifica per tutta la lega
    $stmt = $db->prepare("SELECT id, nome, ovr FROM teams WHERE lega_id=?");
    $stmt->execute([$lega_id]);
    $tutteLega = $stmt->fetchAll();
    foreach ($tutteLega as $t) {
        $db->prepare("INSERT IGNORE INTO classifica (team_id,lega_id,anno) VALUES(?,?,?)")
           ->execute([$t['id'], $lega_id, $anno]);
    }

    // Partite del mese corrente per questa lega
    $stmt = $db->prepare("SELECT * FROM calendario WHERE lega_id=? AND anno=? AND mese=? AND giocata=0 ORDER BY giornata");
    $stmt->execute([$lega_id, $anno, $mese]);
    $partiteMese = $stmt->fetchAll();

    $msgs = [];

    foreach ($partiteMese as $partita) {
        $home_id = intval($partita['home_id']);
        $away_id = intval($partita['away_id']);

        if ($home_id == $team_id || $away_id == $team_id) {
            $isHome   = ($home_id == $team_id);
            $avv_id   = $isHome ? $away_id : $home_id;
            $avv      = array_values(array_filter($tutteLega, fn($t) => $t['id'] == $avv_id));
            $avv      = $avv[0] ?? null;
            $avv_nome = $avv ? $avv['nome'] : 'Avversario';
            $avv_ovr  = $avv ? intval($avv['ovr']) : 65;

            // Simula la performance del giocatore per questa partita
            $match_partita = simulateMatch($p, $player_skills);
            if ($match_principale === null) $match_principale = $match_partita;
            $voto_giocatore = floatval($match_partita['voto']);
            $boost = ($voto_giocatore >= 8) ? 5 : (($voto_giocatore <= 5) ? -5 : 0);
            $bonus_casa = $isHome ? 3 : -2;
            $diff  = ($team_ovr + $boost + $bonus_casa) - $avv_ovr;
            $prob  = min(80, max(20, 50 + $diff * 1.5));
            $rand  = rand(1, 100);

            if ($rand <= $prob) {
                $esito = 'V'; $punti = 3;
                $gf = rand(1,4); $gs = rand(0, max(0, $gf-1));
                $casa_label = $isHome ? '🏠' : '✈️';
                $pg = min($match_partita['gol'], $gf);
                $pa_p = min($match_partita['assist'], max(0, $gf - $pg));
                // Vittoria larga (+2 o più gol di scarto): boost morale extra
                $diff_gol = $gf - $gs;
                $match_partita['morale'] += ($diff_gol >= 3) ? 10 : ($diff_gol >= 2 ? 5 : 0);
                $msgs[] = ['esito'=>'V','label'=>$casa_label,'giornata'=>$partita['giornata'],'avv'=>$avv_nome,'gf'=>$gf,'gs'=>$gs,'punti'=>3,'isHome'=>$isHome,'player_gol'=>$pg,'player_assist'=>$pa_p,'player_voto'=>$match_partita['voto']];
            } elseif ($rand <= $prob + 15) {
                $esito = 'P'; $punti = 1;
                $gf = rand(0,2); $gs = $gf;
                $pg = min($match_partita['gol'], $gf);
                $pa_p = min($match_partita['assist'], max(0, $gf - $pg));
                // Pareggio: voto -0.3 se il giocatore ha segnato (non bastava), morale ridotto
                if ($pg > 0) {
                    $match_partita['voto'] = round(max(4.5, $match_partita['voto'] - 0.3), 1);
                }
                $match_partita['morale'] = (int)round($match_partita['morale'] * 0.6);
                $msgs[] = ['esito'=>'P','label'=>'🤝','giornata'=>$partita['giornata'],'avv'=>$avv_nome,'gf'=>$gf,'gs'=>$gs,'punti'=>1,'isHome'=>$isHome,'player_gol'=>$pg,'player_assist'=>$pa_p,'player_voto'=>$match_partita['voto']];
            } else {
                $esito = 'S'; $punti = 0;
                $gf = rand(0,1); $gs = rand(1,4);
                $pg = min($match_partita['gol'], $gf);
                $pa_p = min($match_partita['assist'], max(0, $gf - $pg));
                $diff_gol = $gs - $gf; // scarto subito
                // Voto: -0.3 base, -0.2 per ogni gol di scarto oltre 1
                $voto_pen = 0.3 + max(0, ($diff_gol - 1)) * 0.2;
                $match_partita['voto'] = round(max(4.5, $match_partita['voto'] - $voto_pen), 1);
                // Morale: penalità extra se scarto >= 2
                $morale_pen = ($diff_gol >= 2) ? rand(15, 25) : rand(5, 12);
                $match_partita['morale'] = min(0, $match_partita['morale']) - $morale_pen;
                $msgs[] = ['esito'=>'S','label'=>'💔','giornata'=>$partita['giornata'],'avv'=>$avv_nome,'gf'=>$gf,'gs'=>$gs,'punti'=>0,'isHome'=>$isHome,'player_gol'=>$pg,'player_assist'=>$pa_p,'player_voto'=>$match_partita['voto']];
            }

            $v=$esito=='V'?1:0; $pa=$esito=='P'?1:0; $s=$esito=='S'?1:0;
            $avv_punti = $esito=='S'?3:($esito=='P'?1:0);
            $avv_v=$esito=='S'?1:0; $avv_pa=$pa; $avv_s=$esito=='V'?1:0;

            $upd = $db->prepare("UPDATE classifica SET punti=punti+?,vittorie=vittorie+?,pareggi=pareggi+?,sconfitte=sconfitte+?,gol_fatti=gol_fatti+?,gol_subiti=gol_subiti+?,partite_giocate=partite_giocate+1 WHERE team_id=? AND anno=?");
            $upd->execute([$punti,$v,$pa,$s,$gf,$gs,$team_id,$anno]);
            $upd->execute([$avv_punti,$avv_v,$avv_pa,$avv_s,$gs,$gf,$avv_id,$anno]);
        } else {
            $t1 = array_values(array_filter($tutteLega, fn($t) => $t['id'] == $home_id));
            $t2 = array_values(array_filter($tutteLega, fn($t) => $t['id'] == $away_id));
            if ($t1 && $t2) simulaPartita($db, $t1[0], $t2[0], $lega_id, $anno);
        }

        $db->prepare("UPDATE calendario SET giocata=1 WHERE id=?")->execute([$partita['id']]);
    }

    simulaTutteLeLeghe($db, $lega_id, $anno, $mese);

    return ['msgs'=>$msgs,'match_principale'=>$match_principale,'bonus_soldi'=>0,'trofeo'=>0];
}

// Simula tutte le leghe tranne quella del giocatore
function simulaTutteLeLeghe($db, $lega_corrente_id, $anno, $mese) {
    $leghe = $db->query("SELECT id FROM leghe")->fetchAll();
    foreach ($leghe as $lega) {
        $lid = intval($lega['id']);
        if ($lid == $lega_corrente_id) continue;

        generaCalendario($db, $lid, $anno);

        $stmt = $db->prepare("SELECT id, nome, ovr FROM teams WHERE lega_id=?");
        $stmt->execute([$lid]);
        $squadre = $stmt->fetchAll();
        if (count($squadre) < 2) continue;

        foreach ($squadre as $t) {
            $db->prepare("INSERT IGNORE INTO classifica (team_id,lega_id,anno) VALUES(?,?,?)")
               ->execute([$t['id'], $lid, $anno]);
        }

        $stmt = $db->prepare("SELECT * FROM calendario WHERE lega_id=? AND anno=? AND mese=? AND giocata=0 ORDER BY giornata");
        $stmt->execute([$lid, $anno, $mese]);
        $partite = $stmt->fetchAll();

        foreach ($partite as $partita) {
            $t1 = array_values(array_filter($squadre, fn($t) => $t['id'] == $partita['home_id']));
            $t2 = array_values(array_filter($squadre, fn($t) => $t['id'] == $partita['away_id']));
            if ($t1 && $t2) simulaPartita($db, $t1[0], $t2[0], $lid, $anno);
            $db->prepare("UPDATE calendario SET giocata=1 WHERE id=?")->execute([$partita['id']]);
        }
    }
}

// Simula una singola partita tra due squadre e aggiorna la classifica
function simulaPartita($db, $t1, $t2, $lega_id, $anno) {
    $diff = intval($t1['ovr']) - intval($t2['ovr']);
    $prob = min(80, max(20, 50 + $diff * 1.5));
    $r    = rand(1, 100);

    if ($r <= $prob) {
        $p1=3;$p2=0; $v1=1;$v2=0;$pa1=0;$pa2=0;$s1=0;$s2=1;
        $gf1=rand(1,4);$gs1=rand(0,2);
    } elseif ($r <= $prob + 15) {
        $p1=1;$p2=1; $v1=0;$v2=0;$pa1=1;$pa2=1;$s1=0;$s2=0;
        $gf1=rand(0,2);$gs1=$gf1;
    } else {
        $p1=0;$p2=3; $v1=0;$v2=1;$pa1=0;$pa2=0;$s1=1;$s2=0;
        $gf1=rand(0,2);$gs1=rand(1,4);
    }

    $upd = $db->prepare("UPDATE classifica SET punti=punti+?,vittorie=vittorie+?,pareggi=pareggi+?,sconfitte=sconfitte+?,gol_fatti=gol_fatti+?,gol_subiti=gol_subiti+?,partite_giocate=partite_giocate+1 WHERE team_id=? AND anno=?");
    $upd->execute([$p1,$v1,$pa1,$s1,$gf1,$gs1,$t1['id'],$anno]);
    $upd->execute([$p2,$v2,$pa2,$s2,$gs1,$gf1,$t2['id'],$anno]);
}

// CHAMPIONS CUP — 4 gruppi da 5
// Calendario (8 partite per squadra = 2/mese × 4 mesi):
//   Set(9): qualifica e sorteggio gironi + prima giornata
//   Ott(10): seconda giornata gironi
//   Nov(11): terza giornata gironi
//   Dic(12): quarta giornata gironi + chiusura gironi
//   Gen(1): playoff (2e vs 3e cross-gruppo, andata/ritorno)
//   Feb(2): ottavi di finale (1e vs vincitori playoff)
//   Mar(3): quarti di finale
//   Apr(4): semifinale
//   Mag(5): finale (gestita da concludiChampions)
function simulaChampions($db, $p) {
    $lang    = getLang();
    $anno    = $p['anno_corrente'];
    $mese    = $p['mese_corrente'];
    $team_id = $p['team_id'];

    // Settembre: qualifica + sorteggio + prima giornata
    if ($mese == 9) {
        qualificaChampions($db, $anno);
        $stmt = $db->prepare("SELECT * FROM champions_cup WHERE team_id=? AND anno=?");
        $stmt->execute([$team_id, $anno]);
        $record = $stmt->fetch();
        if (!$record) {
            _simulaChampionsNPCOnly($db, $anno, $mese, $team_id);
            return null;
        }
        $result = simulaGiornataGruppo($db, $p, $record, $anno, $mese);
        // Simula anche gli altri gruppi NPC
        $gruppi = $db->prepare("SELECT DISTINCT gruppo FROM champions_cup WHERE anno=? AND gruppo IS NOT NULL AND gruppo != ?");
        $gruppi->execute([$anno, $record['gruppo']]);
        foreach ($gruppi->fetchAll() as $gr) {
            _simulaGiornataGruppoNPC($db, $anno, $gr['gruppo'], $mese, $team_id);
        }
        return $result;
    }

    $stmt = $db->prepare("SELECT * FROM champions_cup WHERE team_id=? AND anno=?");
    $stmt->execute([$team_id, $anno]);
    $record = $stmt->fetch();

    // Giocatore non in Champions o eliminato: simula comunque le NPC
    if (!$record || $record['eliminato']) {
        _simulaChampionsNPCOnly($db, $anno, $mese, $team_id);
        return null;
    }

    // Gironi: settembre-dicembre
    if (in_array($mese, [9, 10, 11, 12]) && $record['fase'] == 'gironi') {
        $result = simulaGiornataGruppo($db, $p, $record, $anno, $mese);
        // Simula anche gli altri gruppi NPC (escludi il gruppo del giocatore)
        $gruppi = $db->prepare("SELECT DISTINCT gruppo FROM champions_cup WHERE anno=? AND gruppo IS NOT NULL AND gruppo != ?");
        $gruppi->execute([$anno, $record['gruppo']]);
        foreach ($gruppi->fetchAll() as $gr) {
            _simulaGiornataGruppoNPC($db, $anno, $gr['gruppo'], $mese, $team_id);
        }
        return $result;
    }
    // Playoff (2e vs 3e): gennaio
    if ($mese == 1 && $record['fase'] == 'playoff') {
        return simulaFaseChampions($db, $p, $record, 'playoff', 'ottavi', 52, 'Playoff');
    }
    // Playoff (3e vs 2e): gennaio — il giocatore è terzo classificato
    if ($mese == 1 && $record['fase'] == 'playoff_3') {
        return simulaFaseChampions($db, $p, $record, 'playoff_3', 'ottavi', 48, 'Playoff');
    }
    // Ottavi: febbraio
    if ($mese == 2 && $record['fase'] == 'ottavi') {
        return simulaFaseChampions($db, $p, $record, 'ottavi', 'quarti', 55, 'Ottavi di Finale');
    }
    // Quarti: marzo
    if ($mese == 3 && $record['fase'] == 'quarti') {
        return simulaFaseChampions($db, $p, $record, 'quarti', 'semifinale', 60, 'Quarti di Finale');
    }
    // Semifinale: aprile
    if ($mese == 4 && $record['fase'] == 'semifinale') {
        return simulaFaseChampions($db, $p, $record, 'semifinale', 'finale', 65, 'Semifinale');
    }
    // Finale: maggio
    if ($mese == 5 && $record['fase'] == 'finale') {
        return simulaFaseChampions($db, $p, $record, 'finale', 'vincitore', 68, 'Finale');
    }

    return null;
}

// Simula Champions per NPC quando il giocatore non partecipa
function _simulaChampionsNPCOnly($db, $anno, $mese, $skip_team_id) {
    // Settembre: assicura che i gironi vengano creati anche senza il giocatore
    if ($mese == 9) qualificaChampions($db, $anno);

    if (in_array($mese, [9, 10, 11, 12])) {
        $gruppi = $db->prepare("SELECT DISTINCT gruppo FROM champions_cup WHERE anno=? AND gruppo IS NOT NULL");
        $gruppi->execute([$anno]);
        foreach ($gruppi->fetchAll() as $gr) {
            _simulaGiornataGruppoNPC($db, $anno, $gr['gruppo'], $mese, $skip_team_id);
        }
    } elseif ($mese == 1) {
        _simulaPlayoffNPC($db, $anno, $skip_team_id);
    } elseif ($mese == 2) {
        // Risolvi playoff ancora aperti prima degli ottavi
        _simulaPlayoffNPC($db, $anno, $skip_team_id);
        _simulaFaseNPC($db, $anno, 'ottavi', 'quarti', $skip_team_id);
    } elseif ($mese == 3) {
        _simulaFaseNPC($db, $anno, 'quarti', 'semifinale', $skip_team_id);
    } elseif ($mese == 4) {
        _simulaFaseNPC($db, $anno, 'semifinale', 'finale', $skip_team_id);
    } elseif ($mese == 5) {
        _simulaFaseNPC($db, $anno, 'finale', 'vincitore', $skip_team_id);
    }
}

function _simulaGiornataGruppoNPC($db, $anno, $gruppo, $mese, $skip_team_id) {
    // 5 squadre NPC (S0..S4). S0 fa da perno (2 partite/mese).
    // S1..S4: 2 vs S0 + 6 NPC-NPC = 8 totali ✓. S0: 2/mese × 4 = 8 ✓
    // Stesso schema del gruppo col giocatore (P=S0, N0..N3=S1..S4):
    // Perno(S0) gioca: Set(S1,S2) Ott(S3,S4) Nov(S1,S2) Dic(S3,S4)
    // NPC-NPC (3/mese, round-robin A+R tra S1..S4 in 4 mesi):
    // Set: S3-S4, S3-S1, S2-S4  Ott: S1-S2, S1-S4, S2-S3
    // Nov: S4-S3, S1-S3, S4-S2  Dic: S2-S1, S4-S1, S3-S2

    $stmt = $db->prepare("SELECT cc.team_id, t.ovr FROM champions_cup cc JOIN teams t ON cc.team_id=t.id WHERE cc.anno=? AND cc.gruppo=? ORDER BY cc.team_id");
    $stmt->execute([$anno, $gruppo]);
    $sq = $stmt->fetchAll();
    if (count($sq) < 5) return;

    // indici assoluti in $sq: S0=0, S1=1, S2=2, S3=3, S4=4
    $full_schedule = [
        9  => [[0,1],[0,2],  [3,4],[3,1],[2,4]],
        10 => [[0,3],[0,4],  [1,2],[1,4],[2,3]],
        11 => [[0,1],[0,2],  [4,3],[1,3],[4,2]],
        12 => [[0,3],[0,4],  [2,1],[4,1],[3,2]],
    ];

    foreach ($full_schedule[$mese] ?? [[0,1],[2,3],[1,4]] as [$ia, $ib]) {
        if (!isset($sq[$ia]) || !isset($sq[$ib])) continue;
        [$gf, $gs, $p1] = _simulaMatchGruppo(intval($sq[$ia]['ovr']), intval($sq[$ib]['ovr']));
        $p2 = ($p1===3?0:($p1===1?1:3));
        $v1=$p1===3?1:0; $pa1=$p1===1?1:0; $s1=$p1===0?1:0;
        $v2=$p2===3?1:0; $pa2=$p2===1?1:0; $s2=$p2===0?1:0;
        $db->prepare("UPDATE champions_cup SET punti_gruppo=punti_gruppo+?,vittorie_gruppo=vittorie_gruppo+?,pareggi_gruppo=pareggi_gruppo+?,sconfitte_gruppo=sconfitte_gruppo+?,gol_fatti_gruppo=gol_fatti_gruppo+?,gol_subiti_gruppo=gol_subiti_gruppo+?,partite_gruppo=partite_gruppo+1 WHERE team_id=? AND anno=?")
           ->execute([$p1,$v1,$pa1,$s1,$gf,$gs,$sq[$ia]['team_id'],$anno]);
        $db->prepare("UPDATE champions_cup SET punti_gruppo=punti_gruppo+?,vittorie_gruppo=vittorie_gruppo+?,pareggi_gruppo=pareggi_gruppo+?,sconfitte_gruppo=sconfitte_gruppo+?,gol_fatti_gruppo=gol_fatti_gruppo+?,gol_subiti_gruppo=gol_subiti_gruppo+?,partite_gruppo=partite_gruppo+1 WHERE team_id=? AND anno=?")
           ->execute([$p2,$v2,$pa2,$s2,$gs,$gf,$sq[$ib]['team_id'],$anno]);
    }
    if ($mese == 12) {
        _chiudiGironeSoloNPC($db, $anno, $gruppo, $skip_team_id);
    }
}

function _chiudiGironeSoloNPC($db, $anno, $gruppo, $skip_team_id) {
    $stmt = $db->prepare("SELECT cc.team_id FROM champions_cup cc WHERE cc.anno=? AND cc.gruppo=? AND cc.team_id!=? ORDER BY cc.punti_gruppo DESC, (cc.gol_fatti_gruppo-cc.gol_subiti_gruppo) DESC, cc.gol_fatti_gruppo DESC, cc.vittorie_gruppo DESC");
    $stmt->execute([$anno, $gruppo, $skip_team_id]);
    $classifica = $stmt->fetchAll();
    foreach ($classifica as $i => $r) {
        $pos = $i + 1;
        $db->prepare("UPDATE champions_cup SET posizione_gruppo=? WHERE team_id=? AND anno=?")->execute([$pos, $r['team_id'], $anno]);
        if ($i === 0) {
            $db->prepare("UPDATE champions_cup SET fase='ottavi' WHERE team_id=? AND anno=?")->execute([$r['team_id'],$anno]);
        } elseif ($i === 1) {
            $db->prepare("UPDATE champions_cup SET fase='playoff' WHERE team_id=? AND anno=?")->execute([$r['team_id'],$anno]);
        } elseif ($i === 2) {
            $db->prepare("UPDATE champions_cup SET fase='playoff_3' WHERE team_id=? AND anno=?")->execute([$r['team_id'],$anno]);
        } else {
            $db->prepare("UPDATE champions_cup SET eliminato=1 WHERE team_id=? AND anno=?")->execute([$r['team_id'],$anno]);
        }
    }
}

function qualificaChampions($db, $anno) {
    $stmt = $db->prepare("SELECT COUNT(*) as n FROM champions_cup WHERE anno=?");
    $stmt->execute([$anno]);
    if ($stmt->fetch()['n'] > 0) return;

    $tutte = [];
    $leghe = $db->query("SELECT id FROM leghe WHERE livello=1")->fetchAll();
    foreach ($leghe as $lega) {
        // Usa l'anno precedente: la qualifica si basa sui risultati del campionato appena concluso
        $anno_class = $anno - 1;
        $stmt = $db->prepare("SELECT c.team_id, t.ovr FROM classifica c JOIN teams t ON c.team_id=t.id WHERE c.lega_id=? AND c.anno=? ORDER BY c.punti DESC, (c.gol_fatti-c.gol_subiti) DESC, c.gol_fatti DESC, c.vittorie DESC LIMIT 4");
        $stmt->execute([$lega['id'], $anno_class]);
        $top4 = $stmt->fetchAll();
        if (empty($top4)) {
            $stmt2 = $db->prepare("SELECT id as team_id, ovr FROM teams WHERE lega_id=? ORDER BY stelle DESC, ovr DESC LIMIT 4");
            $stmt2->execute([$lega['id']]);
            $top4 = $stmt2->fetchAll();
        }
        foreach ($top4 as $t) $tutte[] = $t;
    }
    if (empty($tutte)) return;

    usort($tutte, fn($a,$b) => intval($b['ovr']) - intval($a['ovr']));
    $gruppi = ['A', 'B', 'C', 'D'];
    $tutte = array_slice($tutte, 0, 20);
    foreach ($tutte as $i => $t) {
        $db->prepare("INSERT IGNORE INTO champions_cup (anno,team_id,fase,gruppo) VALUES(?,?,'gironi',?)")
           ->execute([$anno, $t['team_id'], $gruppi[$i % 4]]);
    }
}

function simulaGiornataGruppo($db, $p, $record, $anno, $mese) {
    $team_id  = $p['team_id'];
    $gruppo   = $record['gruppo'];
    $team_ovr = intval($p['team_ovr'] ?? 65);

    $stmt = $db->prepare("SELECT cc.team_id, t.ovr FROM champions_cup cc JOIN teams t ON cc.team_id=t.id WHERE cc.anno=? AND cc.gruppo=? ORDER BY cc.team_id");
    $stmt->execute([$anno, $gruppo]);
    $tutte_squadre = $stmt->fetchAll();
    if (count($tutte_squadre) < 2) return null;

    $avversari = array_values(array_filter($tutte_squadre, fn($t) => $t['team_id'] != $team_id));
    $n_avv = count($avversari); // 4 NPC: N0..N3

    // Calendario bilanciato: ogni squadra 8 partite totali (4 avversari x A+R).
    // 5 match/mese: P gioca 2 vs NPC + 3 match NPC-NPC.
    // P affronta ogni NPC esattamente 2 volte. Ogni NPC fa 2 vsP + 6 NPC-NPC = 8. OK
    //
    // P vs NPC:  Set(N0,N1)  Ott(N2,N3)  Nov(N0,N1 ritorno)  Dic(N2,N3 ritorno)
    //
    // NPC-NPC (round-robin A+R tra N0..N3, 3 match/mese x 4 mesi = 12 = 6coppie x2):
    // Set(9):  N2-N3, N2-N0, N1-N3
    // Ott(10): N0-N1, N0-N3, N1-N2
    // Nov(11): N3-N2, N0-N2, N3-N1  (ritorni Set)
    // Dic(12): N1-N0, N3-N0, N2-N1  (ritorni Ott)
    $player_schedule = [
        9  => [0, 1],
        10 => [2, 3],
        11 => [0, 1],
        12 => [2, 3],
    ];
    $npc_schedule = [
        9  => [[2,3],[2,0],[1,3]],
        10 => [[0,1],[0,3],[1,2]],
        11 => [[3,2],[0,2],[3,1]],
        12 => [[1,0],[3,0],[2,1]],
    ];

    $avv_idx_list = $player_schedule[$mese] ?? [0, 1];
    $gol_fatti = 0; $gol_subiti = 0; $punti = 0; $partite_giocate = 0;
    $vittorie = 0; $pareggi = 0; $sconfitte = 0;
    $msgs = [];

    // --- 2 Partite del giocatore ---
    foreach ($avv_idx_list as $idx) {
        if (!isset($avversari[$idx % $n_avv])) continue;
        $avv = $avversari[$idx % $n_avv];
        [$gf, $gs, $pt] = _simulaMatchGruppo($team_ovr, intval($avv['ovr']));
        $gol_fatti += $gf; $gol_subiti += $gs; $punti += $pt; $partite_giocate++;
        if ($pt === 3) $vittorie++; elseif ($pt === 1) $pareggi++; else $sconfitte++;
        $pt_avv = ($pt === 3 ? 0 : ($pt === 1 ? 1 : 3));
        $v_avv=$pt_avv===3?1:0; $pa_avv=$pt_avv===1?1:0; $s_avv=$pt_avv===0?1:0;
        $db->prepare("UPDATE champions_cup SET punti_gruppo=punti_gruppo+?,vittorie_gruppo=vittorie_gruppo+?,pareggi_gruppo=pareggi_gruppo+?,sconfitte_gruppo=sconfitte_gruppo+?,gol_fatti_gruppo=gol_fatti_gruppo+?,gol_subiti_gruppo=gol_subiti_gruppo+?,partite_gruppo=partite_gruppo+1 WHERE team_id=? AND anno=?")
           ->execute([$pt_avv,$v_avv,$pa_avv,$s_avv,$gs,$gf,$avv['team_id'],$anno]);
        $msgs[] = "{$gf}-{$gs}";
    }

    // Aggiorna giocatore in blocco
    $db->prepare("UPDATE champions_cup SET punti_gruppo=punti_gruppo+?,vittorie_gruppo=vittorie_gruppo+?,pareggi_gruppo=pareggi_gruppo+?,sconfitte_gruppo=sconfitte_gruppo+?,gol_fatti_gruppo=gol_fatti_gruppo+?,gol_subiti_gruppo=gol_subiti_gruppo+?,partite_gruppo=partite_gruppo+? WHERE team_id=? AND anno=?")
       ->execute([$punti,$vittorie,$pareggi,$sconfitte,$gol_fatti,$gol_subiti,$partite_giocate,$team_id,$anno]);

    // --- 3 Partite NPC vs NPC ---
    foreach ($npc_schedule[$mese] ?? [] as [$ia, $ib]) {
        if (!isset($avversari[$ia % $n_avv]) || !isset($avversari[$ib % $n_avv])) continue;
        [$gf1,$gs1,$p1] = _simulaMatchGruppo(intval($avversari[$ia % $n_avv]['ovr']), intval($avversari[$ib % $n_avv]['ovr']));
        $p2=($p1===3?0:($p1===1?1:3));
        $v1=$p1===3?1:0;$pa1=$p1===1?1:0;$s1=$p1===0?1:0;
        $v2=$p2===3?1:0;$pa2=$p2===1?1:0;$s2=$p2===0?1:0;
        $db->prepare("UPDATE champions_cup SET punti_gruppo=punti_gruppo+?,vittorie_gruppo=vittorie_gruppo+?,pareggi_gruppo=pareggi_gruppo+?,sconfitte_gruppo=sconfitte_gruppo+?,gol_fatti_gruppo=gol_fatti_gruppo+?,gol_subiti_gruppo=gol_subiti_gruppo+?,partite_gruppo=partite_gruppo+1 WHERE team_id=? AND anno=?")
           ->execute([$p1,$v1,$pa1,$s1,$gf1,$gs1,$avversari[$ia % $n_avv]['team_id'],$anno]);
        $db->prepare("UPDATE champions_cup SET punti_gruppo=punti_gruppo+?,vittorie_gruppo=vittorie_gruppo+?,pareggi_gruppo=pareggi_gruppo+?,sconfitte_gruppo=sconfitte_gruppo+?,gol_fatti_gruppo=gol_fatti_gruppo+?,gol_subiti_gruppo=gol_subiti_gruppo+?,partite_gruppo=partite_gruppo+1 WHERE team_id=? AND anno=?")
           ->execute([$p2,$v2,$pa2,$s2,$gs1,$gf1,$avversari[$ib % $n_avv]['team_id'],$anno]);
    }

    if ($mese == 12) {
        return chiudiGirone($db, $p, $record, $anno, $gruppo);
    }

    $esito = $punti >= 6 ? "🏆" : ($punti >= 2 ? "🤝" : "💔");
    return "{$esito} Champions Gr.{$gruppo}: " . implode(', ', $msgs) . " ({$punti}pt)";
}

// Simula una partita di gruppo: restituisce [gol_fatti, gol_subiti, punti_squadra1]
function _simulaMatchGruppo($ovr1, $ovr2) {
    $diff = $ovr1 - $ovr2;
    $prob = min(75, max(25, 50 + $diff * 1.2));
    $r    = rand(1, 100);
    if ($r <= $prob) {
        $gf = rand(1, 4); $gs = rand(0, max(0, $gf - 1)); $pt = 3;
    } elseif ($r <= $prob + 15) {
        $gf = rand(0, 2); $gs = $gf; $pt = 1;
    } else {
        $gs = rand(1, 4); $gf = rand(0, max(0, $gs - 1)); $pt = 0;
    }
    return [$gf, $gs, $pt];
}

function chiudiGirone($db, $p, $record, $anno, $gruppo) {
    $team_id = $p['team_id'];
    $stmt = $db->prepare("SELECT cc.team_id, cc.punti_gruppo, cc.gol_fatti_gruppo, cc.gol_subiti_gruppo FROM champions_cup cc WHERE cc.anno=? AND cc.gruppo=? ORDER BY cc.punti_gruppo DESC, (cc.gol_fatti_gruppo-cc.gol_subiti_gruppo) DESC, cc.gol_fatti_gruppo DESC, cc.vittorie_gruppo DESC");
    $stmt->execute([$anno, $gruppo]);
    $classifica_gruppo = $stmt->fetchAll();

    foreach ($classifica_gruppo as $i => $r) {
        $pos = $i + 1;
        $db->prepare("UPDATE champions_cup SET posizione_gruppo=? WHERE team_id=? AND anno=?")->execute([$pos, $r['team_id'], $anno]);
        if ($i === 0) {
            $db->prepare("UPDATE champions_cup SET fase='ottavi' WHERE team_id=? AND anno=?")->execute([$r['team_id'],$anno]);
        } elseif ($i === 1) {
            $db->prepare("UPDATE champions_cup SET fase='playoff' WHERE team_id=? AND anno=?")->execute([$r['team_id'],$anno]);
        } elseif ($i === 2) {
            // Terza classificata → playoff_3 (attende la 2a di un altro gruppo)
            $db->prepare("UPDATE champions_cup SET fase='playoff_3' WHERE team_id=? AND anno=?")->execute([$r['team_id'],$anno]);
        } else {
            $db->prepare("UPDATE champions_cup SET eliminato=1 WHERE team_id=? AND anno=?")->execute([$r['team_id'],$anno]);
        }
    }

    $pos = 0;
    foreach ($classifica_gruppo as $i => $r) {
        if ($r['team_id'] == $team_id) { $pos = $i + 1; break; }
    }

    if ($pos === 1)     return "🏆 Champions - 1° Gr.{$gruppo}! Agli Ottavi di Finale!";
    elseif ($pos === 2) return "🤝 Champions - 2° Gr.{$gruppo}. Playoff per gli Ottavi!";
    elseif ($pos === 3) return "⚡ Champions - 3° Gr.{$gruppo}. Playoff per gli Ottavi!";
    else                return "💔 Champions - Eliminato gironi (Gr.{$gruppo}, {$pos}° posto).";
}

function simulaFaseChampions($db, $p, $record, $fase_corrente, $fase_successiva, $prob_base, $label_fase) {
    $team_ovr = intval($p['team_ovr'] ?? 65);
    $anno     = $p['anno_corrente'];
    $team_id  = $p['team_id'];
    $gruppo   = $record['gruppo'];
    $pos      = intval($record['posizione_gruppo']);

    // Playoff: il giocatore affronta il suo avversario cross-gruppo specifico
    if ($fase_corrente === 'playoff' || $fase_corrente === 'playoff_3') {
        // Mappa accoppiamenti: A2→C3, B2→D3, C2→A3, D2→B3 (e viceversa)
        $pairings = ['A'=>['opp_gruppo'=>'C','opp_pos'=>3,'own_pos'=>2],
                     'B'=>['opp_gruppo'=>'D','opp_pos'=>3,'own_pos'=>2],
                     'C'=>['opp_gruppo'=>'A','opp_pos'=>3,'own_pos'=>2],
                     'D'=>['opp_gruppo'=>'B','opp_pos'=>3,'own_pos'=>2]];
        // Se il giocatore è terzo, il suo avversario è la seconda del suo gruppo speculare
        if ($pos === 3) {
            // A3→C2, B3→D2, C3→A2, D3→B2 (coerente con _simulaPlayoffNPC)
            $info = $pairings[$gruppo] ?? null;
            if ($info) $info['opp_pos'] = 2; // terzo sfida una seconda
        } else {
            $info = $pairings[$gruppo] ?? null;
        }
        // Trova OVR avversario per calibrare la probabilità
        $avv_ovr = 70; // default
        if ($info) {
            $stmt = $db->prepare("SELECT t.ovr FROM champions_cup cc JOIN teams t ON cc.team_id=t.id WHERE cc.anno=? AND cc.gruppo=? AND cc.posizione_gruppo=? LIMIT 1");
            $stmt->execute([$anno, $info['opp_gruppo'], $info['opp_pos']]);
            $avv = $stmt->fetch();
            if ($avv) $avv_ovr = intval($avv['ovr']);
        }
        $prob = min(80, max(20, 50 + ($team_ovr - $avv_ovr) * 0.8));
        _simulaPlayoffNPC($db, $anno, $team_id);
    } else {
        // Se il giocatore è agli ottavi, processa anche i playoff NPC rimasti
        if ($fase_corrente === 'ottavi') {
            _simulaPlayoffNPC($db, $anno, $team_id);
        }
        $prob = min(75, max(30, $prob_base + ($team_ovr - 70) * 0.5));
        _simulaFaseNPC($db, $anno, $fase_corrente, $fase_successiva, $team_id);
    }

    $avanza = rand(1, 100) <= $prob;
    if ($avanza) {
        $db->prepare("UPDATE champions_cup SET fase=? WHERE team_id=? AND anno=?")
           ->execute([$fase_successiva, $team_id, $anno]);
        $labels = ['playoff'=>'Playoff','ottavi'=>'Ottavi','quarti'=>'Quarti','semifinale'=>'Semifinale','finale'=>'Finale','vincitore'=>'Champions Cup 🏆'];
        if ($fase_successiva === 'vincitore') {
            return "🏆🌟 Champions Cup — {$label_fase}: HAI VINTO LA CHAMPIONS CUP! Il premio sarà assegnato a fine stagione.";
        }
        return "🏆 Champions Cup — {$label_fase}: avanza agli/ai " . ($labels[$fase_successiva] ?? $fase_successiva) . "!";
    } else {
        $db->prepare("UPDATE champions_cup SET eliminato=1 WHERE team_id=? AND anno=?")
           ->execute([$team_id, $anno]);
        return "💔 Champions Cup — Eliminato in {$label_fase}.";
    }
}

// Simula playoff: accoppiamenti fissi cross-gruppo
// A2 vs C3, B2 vs D3, C2 vs A3, D2 vs B3
function _simulaPlayoffNPC($db, $anno, $skip_team_id) {
    // Carica tutte le seconde e terze (escludi il giocatore)
    $stmt = $db->prepare("SELECT cc.team_id, cc.gruppo, cc.posizione_gruppo, t.ovr FROM champions_cup cc JOIN teams t ON cc.team_id=t.id WHERE cc.anno=? AND cc.fase IN ('playoff','playoff_3') AND cc.eliminato=0 AND cc.team_id!=?");
    $stmt->execute([$anno, $skip_team_id]);
    $teams = $stmt->fetchAll();

    // Indicizza per gruppo e posizione
    $by_gruppo_pos = [];
    foreach ($teams as $t) {
        $by_gruppo_pos[$t['gruppo']][$t['posizione_gruppo']] = $t;
    }

    // Accoppiamenti fissi: A2 vs C3, B2 vs D3, C2 vs A3, D2 vs B3
    $matches = [
        ['A', 2, 'C', 3],
        ['B', 2, 'D', 3],
        ['C', 2, 'A', 3],
        ['D', 2, 'B', 3],
    ];

    $processati = [];
    foreach ($matches as [$g2, $p2, $g3, $p3]) {
        $sq2 = $by_gruppo_pos[$g2][$p2] ?? null;
        $sq3 = $by_gruppo_pos[$g3][$p3] ?? null;
        if (!$sq2 || !$sq3) continue;
        if (in_array($sq2['team_id'], $processati) || in_array($sq3['team_id'], $processati)) continue;

        $prob = min(75, max(25, 55 + (intval($sq2['ovr']) - intval($sq3['ovr'])) * 0.5));
        if (rand(1, 100) <= $prob) {
            $db->prepare("UPDATE champions_cup SET fase='ottavi' WHERE team_id=? AND anno=?")->execute([$sq2['team_id'], $anno]);
            $db->prepare("UPDATE champions_cup SET eliminato=1 WHERE team_id=? AND anno=?")->execute([$sq3['team_id'], $anno]);
        } else {
            $db->prepare("UPDATE champions_cup SET fase='ottavi' WHERE team_id=? AND anno=?")->execute([$sq3['team_id'], $anno]);
            $db->prepare("UPDATE champions_cup SET eliminato=1 WHERE team_id=? AND anno=?")->execute([$sq2['team_id'], $anno]);
        }
        $processati[] = $sq2['team_id'];
        $processati[] = $sq3['team_id'];
    }
    // Elimina eventuali playoff rimasti senza match
    $db->prepare("UPDATE champions_cup SET eliminato=1 WHERE anno=? AND fase IN ('playoff','playoff_3') AND eliminato=0 AND team_id!=?")->execute([$anno, $skip_team_id]);
}

function _simulaFaseNPC($db, $anno, $fase_corrente, $fase_successiva, $skip_team_id) {
    $stmt = $db->prepare("SELECT cc.team_id, t.ovr FROM champions_cup cc JOIN teams t ON cc.team_id=t.id WHERE cc.anno=? AND cc.fase=? AND cc.eliminato=0 AND cc.team_id!=? ORDER BY t.ovr DESC");
    $stmt->execute([$anno, $fase_corrente, $skip_team_id]);
    $npc = $stmt->fetchAll();
    // Accoppia in coppie ordinate per OVR: 1° vs 2°, 3° vs 4°, ecc.
    // Garantisce che esattamente metà delle squadre avanzi
    for ($i = 0; $i + 1 < count($npc); $i += 2) {
        $sq1 = $npc[$i]; $sq2 = $npc[$i + 1];
        $prob = min(75, max(25, 55 + (intval($sq1['ovr']) - intval($sq2['ovr'])) * 0.5));
        if (rand(1, 100) <= $prob) {
            $db->prepare("UPDATE champions_cup SET fase=? WHERE team_id=? AND anno=?")->execute([$fase_successiva, $sq1['team_id'], $anno]);
            $db->prepare("UPDATE champions_cup SET eliminato=1 WHERE team_id=? AND anno=?")->execute([$sq2['team_id'], $anno]);
        } else {
            $db->prepare("UPDATE champions_cup SET fase=? WHERE team_id=? AND anno=?")->execute([$fase_successiva, $sq2['team_id'], $anno]);
            $db->prepare("UPDATE champions_cup SET eliminato=1 WHERE team_id=? AND anno=?")->execute([$sq1['team_id'], $anno]);
        }
    }
    // Squadra dispari rimasta (caso anomalo): eliminata
    if (count($npc) % 2 === 1) {
        $last = $npc[count($npc) - 1];
        $db->prepare("UPDATE champions_cup SET eliminato=1 WHERE team_id=? AND anno=?")->execute([$last['team_id'], $anno]);
    }
}

function concludiChampions($db, $p, $player_id) {
    $anno = $p['anno_corrente']; $team_id = $p['team_id'];
    $msgs = []; $soldi = 0; $trofei = 0; $champions_win = false;

    // A giugno risolvi eventuali NPC rimasti in finale (non processati a maggio)
    _simulaFaseNPC($db, $anno, 'finale', 'vincitore', $team_id);

    $stmt = $db->prepare("SELECT * FROM champions_cup WHERE team_id=? AND anno=?");
    $stmt->execute([$team_id, $anno]);
    $record = $stmt->fetch();
    if (!$record || $record['eliminato']) return ['messaggi'=>$msgs,'soldi'=>$soldi,'trofei'=>$trofei,'champions_win'=>false];

    // Fallback: se il giocatore è ancora in 'semifinale' o 'finale' (non processato a maggio)
    // Nel gioco la 'semifinale' PHP è la vera finale (solo 2 squadre rimaste dopo i quarti)
    if ($record['fase'] == 'semifinale') {
        $prob = min(70, max(30, 50 + (intval($p['team_ovr'] ?? 65) - 70) * 0.5));
        if (rand(1,100) <= $prob) {
            $db->prepare("UPDATE champions_cup SET fase='vincitore' WHERE team_id=? AND anno=?")->execute([$team_id,$anno]);
            $msgs[] = _tn("🏆🌟 LA TUA SQUADRA HA VINTO LA CHAMPIONS CUP!!! +€500,000!","🏆🌟 YOUR TEAM WON THE CHAMPIONS CUP!!! +€500,000!","🏆🌟 DEIN TEAM HAT DEN CHAMPIONS CUP GEWONNEN!!! +€500.000!","🏆🌟 ¡TU EQUIPO HA GANADO LA COPA DE CAMPEONES!!! +€500.000!");
            $soldi += 500000; $trofei += 1; $champions_win = true;
        } else {
            $db->prepare("UPDATE champions_cup SET eliminato=1 WHERE team_id=? AND anno=?")->execute([$team_id,$anno]);
            $msgs[] = _tn("💔 Sconfitta in finale di Champions Cup.","💔 Defeat in the Champions Cup final.","💔 Niederlage im Champions-Cup-Finale.","💔 Derrota en la final de la Copa de Campeones.");
            $msgs[] = _tn("💰 Bonus finalista Champions: +€100,000","💰 Champions finalist bonus: +€100,000","💰 Champions-Finalist-Bonus: +€100.000","💰 Bono finalista Champions: +€100.000");
            $soldi += 100000;
        }
        return ['messaggi'=>$msgs,'soldi'=>$soldi,'trofei'=>$trofei,'champions_win'=>$champions_win];
    }
    if ($record['fase'] == 'finale') {
        $prob = min(70, max(30, 50 + (intval($p['team_ovr'] ?? 65) - 70) * 0.5));
        if (rand(1,100) <= $prob) {
            $db->prepare("UPDATE champions_cup SET fase='vincitore' WHERE team_id=? AND anno=?")->execute([$team_id,$anno]);
            $msgs[] = _tn("🏆🌟 LA TUA SQUADRA HA VINTO LA CHAMPIONS CUP!!! +€500,000!","🏆🌟 YOUR TEAM WON THE CHAMPIONS CUP!!! +€500,000!","🏆🌟 DEIN TEAM HAT DEN CHAMPIONS CUP GEWONNEN!!! +€500.000!","🏆🌟 ¡TU EQUIPO HA GANADO LA COPA DE CAMPEONES!!! +€500.000!");
            $soldi += 500000; $trofei += 1; $champions_win = true;
        } else {
            $db->prepare("UPDATE champions_cup SET eliminato=1 WHERE team_id=? AND anno=?")->execute([$team_id,$anno]);
            $msgs[] = _tn("💔 Sconfitta in finale di Champions Cup.","💔 Defeat in the Champions Cup final.","💔 Niederlage im Champions-Cup-Finale.","💔 Derrota en la final de la Copa de Campeones.");
            $msgs[] = _tn("💰 Bonus finalista Champions: +€100,000","💰 Champions finalist bonus: +€100,000","💰 Champions-Finalist-Bonus: +€100.000","💰 Bono finalista Champions: +€100.000");
            $soldi += 100000;
        }
    } elseif ($record['fase'] == 'vincitore') {
        // Già vinto a maggio (caso normale): assegna premio qui a giugno UNA SOLA VOLTA
        // Controlla se il premio è già stato pagato (evita double-award)
        $premio_stmt = $db->prepare("SELECT champions_premio_pagato FROM players WHERE id=?");
        $premio_stmt->execute([$player_id]);
        $gia_pagato = intval(($premio_stmt->fetch()['champions_premio_pagato'] ?? 0));
        if (!$gia_pagato) {
            $msgs[] = _tn("🏆🌟 LA TUA SQUADRA HA VINTO LA CHAMPIONS CUP!!! +€500,000!","🏆🌟 YOUR TEAM WON THE CHAMPIONS CUP!!! +€500,000!","🏆🌟 DEIN TEAM HAT DEN CHAMPIONS CUP GEWONNEN!!! +€500.000!","🏆🌟 ¡TU EQUIPO HA GANADO LA COPA DE CAMPEONES!!! +€500.000!");
            $soldi += 500000; $trofei += 1; $champions_win = true;
            $db->prepare("UPDATE players SET champions_premio_pagato=1 WHERE id=?")->execute([$player_id]);
        }
    }
    return ['messaggi'=>$msgs,'soldi'=>$soldi,'trofei'=>$trofei,'champions_win'=>$champions_win];
}

// ── PREMI CAMPIONATO A FINE ANNO ──
function calcPremiCampionato($db, $p, $player_id) {
    $lega_id = $p['lega_id'];
    $anno    = $p['anno_corrente'];
    $team_id = $p['team_id'];
    $msg_list = []; $soldi = 0; $trofei = 0;

    // Posizione finale
    $stmt = $db->prepare("
        SELECT c.team_id, c.punti, (c.gol_fatti-c.gol_subiti) as diff
        FROM classifica c
        WHERE c.lega_id=? AND c.anno=?
        ORDER BY c.punti DESC, diff DESC, c.gol_fatti DESC, c.vittorie DESC
    ");
    $stmt->execute([$lega_id,$anno]);
    $classifica = $stmt->fetchAll();

    $pos = 0;
    foreach ($classifica as $i => $row) {
        if ($row['team_id'] == $team_id) { $pos = $i + 1; break; }
    }
    if (!$pos) return ['messaggi'=>$msg_list,'soldi'=>$soldi,'trofei'=>$trofei];

    $lega_livello = intval($p['lega_livello'] ?? 2);

    if ($pos == 1) {
        $premio = ($lega_livello == 1) ? 300000 : 100000;
        $msg_list[] = _tn("🏆 CAMPIONI! La tua squadra ha vinto il campionato! +€".number_format($premio),"🏆 CHAMPIONS! Your team won the league! +€".number_format($premio),"🏆 MEISTER! Dein Team hat die Liga gewonnen! +€".number_format($premio),"🏆 ¡CAMPEONES! ¡Tu equipo ganó la liga! +€".number_format($premio));
        $soldi  += $premio; $trofei += 1;
    } elseif ($pos <= 3) {
        $premio = ($lega_livello == 1) ? 100000 : 30000;
        $msg_list[] = _tn("🥉 Podio in campionato (#{$pos})! +€".number_format($premio),"🥉 Podium finish (#{$pos})! +€".number_format($premio),"🥉 Podiumsplatz (#{$pos})! +€".number_format($premio),"🥉 ¡Podio en la liga (#{$pos})! +€".number_format($premio));
        $soldi += $premio;
    } elseif ($pos <= 4 && $lega_livello == 1) {
        $msg_list[] = _tn("⭐ Top 4 in Prima Divisione: qualificato alla Champions Cup!","⭐ Top 4 in First Division: qualified for the Champions Cup!","⭐ Top 4 in der Ersten Division: für den Champions Cup qualifiziert!","⭐ ¡Top 4 en Primera División: clasificado para la Copa de Campeones!");
    } elseif ($pos >= count($classifica) - 2 && count($classifica) >= 10) {
        $msg_list[] = _tn("⚠️ La tua squadra ha chiuso nelle ultime posizioni. Rischio retrocessione!", "⚠️ Your team finished in the bottom places. Relegation risk!", "⚠️ Deine Mannschaft schloss in den letzten Positionen. Abstiegsgefahr!", "⚠️ Tu equipo terminó en los últimos puestos. ¡Riesgo de descenso!");
    }

    return ['messaggi'=>$msg_list,'soldi'=>$soldi,'trofei'=>$trofei];
}

// ── PROMOZIONE / RETROCESSIONE ──
function checkPromozioneRetrocessione($db, $player_id, $p, $overall) {
    $lega_id      = intval($p['lega_id'] ?? 0);
    $lega_livello = intval($p['lega_livello'] ?? 1);
    $nazione_id   = intval($p['nazione_id'] ?? 1);
    if (!$lega_id) return null;

    $stmt = $db->prepare("SELECT SUM(gol) as gol, AVG(voto) as voto FROM log_mensile WHERE player_id=? AND anno=? AND avv!='' AND avv!='__riepilogo'");
    $stmt->execute([$player_id,$p['anno_corrente']]);
    $stats = $stmt->fetch();
    $voto = floatval($stats['voto'] ?? 6.0);
    $gol  = intval($stats['gol'] ?? 0);
    $perf_score = $voto*10 + $gol*2 + $overall*0.3;

    if ($lega_livello == 2 && $perf_score >= 100) {
        $stmt = $db->prepare("SELECT id FROM leghe WHERE nazione_id=? AND livello=1");
        $stmt->execute([$nazione_id]);
        $prima = $stmt->fetch();
        if ($prima) {
            $stmt = $db->prepare("SELECT id,nome FROM teams WHERE lega_id=? ORDER BY stelle ASC,popolarita ASC LIMIT 1");
            $stmt->execute([$prima['id']]);
            $sq = $stmt->fetch();
            if ($sq) return ['tipo'=>'promozione','msg'=>_tn("🚀 PROMOZIONE! Sei salito in Prima Divisione: ","🚀 PROMOTION! You've risen to the First Division: ","🚀 AUFSTIEG! Du bist in die Erste Division aufgestiegen: ","🚀 ¡ASCENSO! Has subido a la Primera División: ").$sq['nome'],'new_team_id'=>$sq['id']];
        }
    }
    if ($lega_livello == 1 && $perf_score < 60 && $overall < 85) {
        $stmt = $db->prepare("SELECT id FROM leghe WHERE nazione_id=? AND livello=2");
        $stmt->execute([$nazione_id]);
        $seconda = $stmt->fetch();
        if ($seconda) {
            $stmt = $db->prepare("SELECT id,nome FROM teams WHERE lega_id=? ORDER BY stelle DESC,popolarita DESC LIMIT 1");
            $stmt->execute([$seconda['id']]);
            $sq = $stmt->fetch();
            if ($sq) return ['tipo'=>'retrocessione','msg'=>_tn("📉 RETROCESSIONE in Seconda Divisione: ","📉 RELEGATION to Second Division: ","📉 ABSTIEG in die Zweite Division: ","📉 DESCENSO a la Segunda División: ").$sq['nome'],'new_team_id'=>$sq['id']];
        }
    }
    return null;
}

// ── AGENTE & NOTIZIE ──
function getAgentBonus($db, $player_id) {
    $stmt = $db->prepare("SELECT livello FROM agente WHERE player_id=?");
    $stmt->execute([$player_id]);
    $ag = $stmt->fetch();
    if (!$ag || !$ag['livello']) return ['bonus_stipendio'=>0,'bonus_offerte'=>0,'bonus_ovr_sconto'=>0];
    $agenti = [
        1=>['bonus_stipendio'=>0.10,'bonus_offerte'=>1,'bonus_ovr_sconto'=>2.5],
        2=>['bonus_stipendio'=>0.20,'bonus_offerte'=>2,'bonus_ovr_sconto'=>5.0],
        3=>['bonus_stipendio'=>0.35,'bonus_offerte'=>3,'bonus_ovr_sconto'=>7.5],
        4=>['bonus_stipendio'=>0.50,'bonus_offerte'=>5,'bonus_ovr_sconto'=>10.0],
        5=>['bonus_stipendio'=>0.75,'bonus_offerte'=>7,'bonus_ovr_sconto'=>15.0],
    ];
    return $agenti[$ag['livello']] ?? ['bonus_stipendio'=>0,'bonus_offerte'=>0,'bonus_ovr_sconto'=>0];
}

function generaNotizia($db, $player_id, $anno, $mese, $titolo, $testo, $tipo='info', $titolo_en=null, $testo_en=null, $titolo_de=null, $testo_de=null, $titolo_es=null, $testo_es=null) {
    $db->prepare("INSERT INTO notizie (player_id,anno,mese,titolo,testo,titolo_en,testo_en,titolo_de,testo_de,titolo_es,testo_es,tipo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
       ->execute([$player_id, $anno, $mese, $titolo, $testo, $titolo_en, $testo_en, $titolo_de, $testo_de, $titolo_es, $testo_es, $tipo]);
}


// ── Bilingual news helper: picks IT or EN string from parallel arrays ──────
// $_gsLangOverride allows temporary lang forcing without touching getLang()
$GLOBALS['_gsLangOverride'] = null;
function _gsLang(): string {
    return $GLOBALS['_gsLangOverride'] ?? getLang();
}

// ── DE/ES translation lookup for game strings ──────────────────────────────
function _getGameStringTranslation(string $it, string $lang): string {
    static $maps = null;
    if ($maps === null) {
        $maps = [
            'de' => [
        '💥 Potenza devastante' => '💥 Verheerende Kraft',
        '🌀 Magia con l\'esterno' => '🌀 Magie mit dem Außenrist',
        '🎭 RABONA IN PARTITA!' => '🎭 RABONA IM SPIEL!',
        '👑 Re dell\'aria' => '👑 König der Lüfte',
        '⚡ Velocità della luce' => '⚡ Lichtgeschwindigkeit',
        '🧊 Sangue freddo assoluto' => '🧊 Eiskalte Kaltblütigkeit',
        '🎯 Istinto puro' => '🎯 Reiner Instinkt',
        '🧩 Lettura tattica perfetta' => '🧩 Perfekte taktische Spiellektüre',
        '🗺️ Il mediano che non c\'era' => '🗺️ Der Mittelfeldspieler überall',
        '📐 Precisione geometrica' => '📐 Geometrische Präzision',
        '🔄 Polmone inesauribile' => '🔄 Unerschöpflicher Motor',
        '🌧️ Pioggia battente' => '🌧️ Starker Regen',
        '☀️ Sole e belle giocate' => '☀️ Sonne und schöner Fußball',
        '💨 Vento fastidioso' => '💨 Lästiger Wind',
        '❄️ Freddo polare' => '❄️ Eisige Kälte',
        '🌫️ Nebbia fitta' => '🌫️ Dichter Nebel',
        '🟨 Giallo contestato' => '🟨 Umstrittene Gelbe Karte',
        '📺 VAR protagonista' => '📺 VAR im Mittelpunkt',
        '🟥 Rosso all\'avversario' => '🟥 Rote Karte für den Gegner',
        '⚖️ Arbitro contestato' => '⚖️ Schiedsrichter in der Kritik',
        '🎙️ Il mister in conferenza' => '🎙️ Der Trainer auf der Pressekonferenz',
        '📋 Piano gara rispettato' => '📋 Spielplan eingehalten',
        '🔄 Cambio tattico vincente' => '🔄 Siegreicher taktischer Wechsel',
        '🤔 Mister insoddisfatto' => '🤔 Trainer unzufrieden',
        '📊 Classifica marcatori' => '📊 Torschützenliste',
        '📈 Rendimento costante' => '📈 Konstante Leistung',
        '🏁 Rush finale' => '🏁 Schlussspurt',
        '🌱 Avvio di stagione' => '🌱 Saisonstart',
        '💪 Goleada storica!' => '💪 Historische Goleada!',
        '🤝 Segna ma non basta' => '🤝 Trifft, aber es reicht nicht',
        '🏆 Vittoria di squadra' => '🏆 Mannschaftssieg',
        '⚽ Gol annullato' => '⚽ Tor annulliert',
        '🎊 Doppio assist' => '🎊 Doppelvorlage',
        '📣 Tifosi in estasi' => '📣 Fans in Ekstase',
        '🏅 Capitano dell\'anno' => '🏅 Kapitän des Jahres',
        '⭐ Man of the Match' => '⭐ Spieler des Spiels',
        '🔥 Forma strepitosa' => '🔥 Hervorragende Form',
        '📉 Calo fisico' => '📉 Körperlicher Einbruch',
        '🧠 Intelligenza tattica' => '🧠 Taktische Intelligenz',
        '💫 Giocata dell\'anno' => '💫 Spielzug des Jahres',
        '🦁 Carattere da campione' => '🦁 Siegermentalität',
        '🌊 Rimonta da sogno' => '🌊 Traumkomeback',
        '🎵 Calcio in musica' => '🎵 Fußball in Harmonie',
        '🛡️ Muro difensivo' => '🛡️ Defensive Mauer',
        '🔮 Visione di gioco' => '🔮 Spielsicht',
        '🎪 Acrobata del pallone' => '🎪 Akrobat mit dem Ball',
        '🏟️ Stadio in delirio' => '🏟️ Stadion im Delirium',
        '⚙️ Ingranaggio perfetto' => '⚙️ Perfektes Zahnrad',
        '🧲 Attaccante letale' => '🧲 Tödlicher Stürmer',
        '🌈 Spettacolo puro' => '🌈 Reines Spektakel',
        '😤 Reaction dopo la critica' => '😤 Reaktion nach der Kritik',
        '🏆 Trofeo conquistato!' => '🏆 Trophäe gewonnen!',
        '😞 Finale amaro' => '😞 Bitteres Ende',
        '🥇 Premio individuale' => '🥇 Einzelauszeichnung',
        '📸 Copertina dei giornali' => '📸 Zeitungscover',
        '🗣️ Intervista post-partita' => '🗣️ Interview nach dem Spiel',
        '💰 Rinnovo contratto' => '💰 Vertragsverlängerung',
        '🌍 Interesse internazionale' => '🌍 Internationales Interesse',
        '🎓 Crescita personale' => '🎓 Persönliches Wachstum',
        '🧪 Nuove soluzioni tattiche' => '🧪 Neue taktische Lösungen',
        '🏃 Preparazione atletica' => '🏃 Athletische Vorbereitung',
        '🤕 Acciacco muscolare' => '🤕 Muskelbeschwerde',
        '💊 Cure preventive' => '💊 Vorbeugende Behandlung',
        '🧘 Equilibrio mentale' => '🧘 Mentale Balance',
        '📱 Gestione dei social' => '📱 Social-Media-Management',
        '🤝 Spirito di squadra' => '🤝 Teamgeist',
        '🌟 Tra i migliori al mondo' => '🌟 Unter den Weltbesten',
        '🎖️ Stagione da leggenda' => '🎖️ Legendäre Saison',
        '🔑 Giocatore chiave' => '🔑 Schlüsselspieler',
        '⚡ Partita in pochi minuti' => '⚡ Spiel in wenigen Minuten entschieden',
        '🎯 Precisione al millimetro' => '🎯 Millimetergenaue Präzision',
        '🩹 Rientro dall\'infortunio' => '🩹 Rückkehr nach Verletzung',
        '📅 Gestione del calendario' => '📅 Kalenderplanung',
        '🥵 Temperatura record' => '🥵 Rekordtemperatur',
        '💦 Campo pesante' => '💦 Schwerer Platz',
        '🏔️ Trasferta difficile' => '🏔️ Schwieriges Auswärtsspiel',
        '🎤 Intervista esclusiva' => '🎤 Exklusives Interview',
        '📡 Tutti gli occhi su di te' => '📡 Alle Augen auf dich gerichtet',
        '🏅 Riconoscimento mensile' => '🏅 Monatliche Auszeichnung',
        '🤜 Duello diretto' => '🤜 Direktes Duell',
        '🔁 Secondo tempo dominato' => '🔁 Zweite Halbzeit dominiert',
        '⏱️ Gol all\'ultimo respiro' => '⏱️ Tor in letzter Sekunde',
        '🎭 Serata da protagonista' => '🎭 Abend als Hauptdarsteller',
        '🌙 Serata di Champions' => '🌙 Champions-Abend',
        '🌺 Il meglio di te' => '🌺 Das Beste von dir',
        '📊 Record personale!' => '📊 Persönlicher Rekord!',
        '🏆 Trionfo collettivo' => '🏆 Kollektiver Triumph',
    ],
            'es' => [
        '💥 Potenza devastante' => '💥 Potencia devastadora',
        '🌀 Magia con l\'esterno' => '🌀 Magia con el exterior',
        '🎭 RABONA IN PARTITA!' => '🎭 ¡RABONA EN EL PARTIDO!',
        '👑 Re dell\'aria' => '👑 Rey del aire',
        '⚡ Velocità della luce' => '⚡ Velocidad de la luz',
        '🧊 Sangue freddo assoluto' => '🧊 Sangre fría absoluta',
        '🎯 Istinto puro' => '🎯 Instinto puro',
        '🧩 Lettura tattica perfetta' => '🧩 Lectura táctica perfecta',
        '🗺️ Il mediano che non c\'era' => '🗺️ El centrocampista omnipresente',
        '📐 Precisione geometrica' => '📐 Precisión geométrica',
        '🔄 Polmone inesauribile' => '🔄 Motor incansable',
        '🌧️ Pioggia battente' => '🌧️ Lluvia torrencial',
        '☀️ Sole e belle giocate' => '☀️ Sol y buen juego',
        '💨 Vento fastidioso' => '💨 Viento molesto',
        '❄️ Freddo polare' => '❄️ Frío polar',
        '🌫️ Nebbia fitta' => '🌫️ Niebla espesa',
        '🟨 Giallo contestato' => '🟨 Amarilla contestada',
        '📺 VAR protagonista' => '📺 El VAR protagonista',
        '🟥 Rosso all\'avversario' => '🟥 Roja al rival',
        '⚖️ Arbitro contestato' => '⚖️ Árbitro cuestionado',
        '🎙️ Il mister in conferenza' => '🎙️ El entrenador en rueda de prensa',
        '📋 Piano gara rispettato' => '📋 Plan de juego respetado',
        '🔄 Cambio tattico vincente' => '🔄 Cambio táctico ganador',
        '🤔 Mister insoddisfatto' => '🤔 Entrenador insatisfecho',
        '📊 Classifica marcatori' => '📊 Tabla de goleadores',
        '📈 Rendimento costante' => '📈 Rendimiento constante',
        '🏁 Rush finale' => '🏁 Arreón final',
        '🌱 Avvio di stagione' => '🌱 Inicio de temporada',
        '💪 Goleada storica!' => '💪 ¡Goleada histórica!',
        '🤝 Segna ma non basta' => '🤝 Marca pero no es suficiente',
        '🏆 Vittoria di squadra' => '🏆 Victoria de equipo',
        '⚽ Gol annullato' => '⚽ Gol anulado',
        '🎊 Doppio assist' => '🎊 Doble asistencia',
        '📣 Tifosi in estasi' => '📣 Aficionados en éxtasis',
        '🏅 Capitano dell\'anno' => '🏅 Capitán del año',
        '⭐ Man of the Match' => '⭐ Jugador del partido',
        '🔥 Forma strepitosa' => '🔥 Forma espectacular',
        '📉 Calo fisico' => '📉 Bajón físico',
        '🧠 Intelligenza tattica' => '🧠 Inteligencia táctica',
        '💫 Giocata dell\'anno' => '💫 Jugada del año',
        '🦁 Carattere da campione' => '🦁 Carácter ganador',
        '🌊 Rimonta da sogno' => '🌊 Remontada de ensueño',
        '🎵 Calcio in musica' => '🎵 Fútbol en armonía',
        '🛡️ Muro difensivo' => '🛡️ Muro defensivo',
        '🔮 Visione di gioco' => '🔮 Visión de juego',
        '🎪 Acrobata del pallone' => '🎪 Acróbata del balón',
        '🏟️ Stadio in delirio' => '🏟️ Estadio en delirio',
        '⚙️ Ingranaggio perfetto' => '⚙️ Engranaje perfecto',
        '🧲 Attaccante letale' => '🧲 Delantero letal',
        '🌈 Spettacolo puro' => '🌈 Espectáculo puro',
        '😤 Reaction dopo la critica' => '😤 Reacción tras la crítica',
        '🏆 Trofeo conquistato!' => '🏆 ¡Trofeo conquistado!',
        '😞 Finale amaro' => '😞 Final amargo',
        '🥇 Premio individuale' => '🥇 Premio individual',
        '📸 Copertina dei giornali' => '📸 Portada de los periódicos',
        '🗣️ Intervista post-partita' => '🗣️ Entrevista post-partido',
        '💰 Rinnovo contratto' => '💰 Renovación de contrato',
        '🌍 Interesse internazionale' => '🌍 Interés internacional',
        '🎓 Crescita personale' => '🎓 Crecimiento personal',
        '🧪 Nuove soluzioni tattiche' => '🧪 Nuevas soluciones tácticas',
        '🏃 Preparazione atletica' => '🏃 Preparación atlética',
        '🤕 Acciacco muscolare' => '🤕 Molestia muscular',
        '💊 Cure preventive' => '💊 Tratamiento preventivo',
        '🧘 Equilibrio mentale' => '🧘 Equilibrio mental',
        '📱 Gestione dei social' => '📱 Gestión de redes sociales',
        '🤝 Spirito di squadra' => '🤝 Espíritu de equipo',
        '🌟 Tra i migliori al mondo' => '🌟 Entre los mejores del mundo',
        '🎖️ Stagione da leggenda' => '🎖️ Temporada de leyenda',
        '🔑 Giocatore chiave' => '🔑 Jugador clave',
        '⚡ Partita in pochi minuti' => '⚡ Partido decidido en minutos',
        '🎯 Precisione al millimetro' => '🎯 Precisión milimétrica',
        '🩹 Rientro dall\'infortunio' => '🩹 Regreso de la lesión',
        '📅 Gestione del calendario' => '📅 Gestión del calendario',
        '🥵 Temperatura record' => '🥵 Temperatura récord',
        '💦 Campo pesante' => '💦 Campo pesado',
        '🏔️ Trasferta difficile' => '🏔️ Desplazamiento complicado',
        '🎤 Intervista esclusiva' => '🎤 Entrevista exclusiva',
        '📡 Tutti gli occhi su di te' => '📡 Todos los ojos puestos en ti',
        '🏅 Riconoscimento mensile' => '🏅 Reconocimiento mensual',
        '🤜 Duello diretto' => '🤜 Duelo directo',
        '🔁 Secondo tempo dominato' => '🔁 Segunda parte dominada',
        '⏱️ Gol all\'ultimo respiro' => '⏱️ Gol en el último suspiro',
        '🎭 Serata da protagonista' => '🎭 Noche estelar',
        '🌙 Serata di Champions' => '🌙 Noche de Champions',
        '🌺 Il meglio di te' => '🌺 Lo mejor de ti',
        '📊 Record personale!' => '📊 ¡Récord personal!',
        '🏆 Trionfo collettivo' => '🏆 Triunfo colectivo',
    ],
        ];
    }
    return $maps[$lang][$it] ?? '';
}
function _tn(string $it, string $en, string $de = '', string $es = ''): string {
    $lang = _gsLang();
    if ($lang === 'en') return $en;
    if ($lang === 'de') return $de ?: _getGameStringTranslation($it, 'de') ?: $en;
    if ($lang === 'es') return $es ?: _getGameStringTranslation($it, 'es') ?: $en;
    return $it;
}
function _tna(array $it, array $en, array $de = [], array $es = []): array {
    $lang = _gsLang();
    if ($lang === 'en') return $en;
    if ($lang === 'de') return $de ?: $en;
    if ($lang === 'es') return $es ?: $en;
    return $it;
}

// ── Internal: builds news array in currently active _gsLang ─────────────────
function _buildNotizie($p, $match, $lega_result, $player_skills = []): array {
    $anno    = $p['anno_corrente'];
    $mese    = $p['mese_corrente'];
    $nome    = $p['player_name'];
    $overall = intval($p['overall']);
    $pop     = intval($p['popolarita']);
    $morale  = intval($p['morale']);
    $energia = intval($p['energia']);
    $stelle  = intval($p['team_stelle'] ?? 1);
    $team    = $p['team_nome_full'] ?? $p['team_nome'] ?? 'la squadra';
    $notizie = [];

    // Dati aggregati su tutte le partite del mese
    $partite = $lega_result['msgs'] ?? [];
    $n_partite = count($partite);
    $tot_gol   = array_sum(array_column($partite, 'player_gol'));
    $tot_assist = array_sum(array_column($partite, 'player_assist'));
    $voti      = array_column($partite, 'player_voto');
    $voto_medio = $n_partite > 0 ? round(array_sum($voti) / $n_partite, 1) : floatval($match['voto']);
    $vittorie  = count(array_filter($partite, fn($m) => $m['esito'] === 'V'));
    $pareggi   = count(array_filter($partite, fn($m) => $m['esito'] === 'P'));
    $sconfitte = count(array_filter($partite, fn($m) => $m['esito'] === 'S'));

    // Partita migliore (per gol)
    $best_match = null;
    foreach ($partite as $pm) {
        if ($best_match === null || intval($pm['player_gol']) > intval($best_match['player_gol'])) {
            $best_match = $pm;
        }
    }
    // Usa comunque il match principale per gol_type e dati individuali
    $gol    = $match['gol'];
    $assist = $match['assist'];
    $voto   = $match['voto'];
    $gol_type = $match['gol_type'] ?? null;

    // ── 1. NOTIZIE SULLE PARTITE (una per ogni partita del mese) ─────────
    foreach ($partite as $pm) {
        $avv    = $pm['avv'];
        $gf     = intval($pm['gf']);
        $gs     = intval($pm['gs']);
        $pgol   = intval($pm['player_gol']);
        $passist = intval($pm['player_assist']);
        $pvoto  = floatval($pm['player_voto']);
        $esito  = $pm['esito'];
        $giornata = $pm['giornata'];
        $casa   = $pm['isHome'] ? t('in casa','at home') : t('in trasferta','away');

        if ($esito === 'V') {
            if ($pgol >= 3) {
                $titoli = _tna(["🎩 Hat-trick decisivo!", "🔥 Tripletta devastante!", "🎩 Tre gol, tre punti!"],["🎩 Decisive hat-trick!", "🔥 Devastating treble!", "🎩 Three goals, three points!"]);
                $testi = _tna(
                    [
                    "{$nome} firma una tripletta {$casa} contro {$avv} ({$gf}-{$gs}). Voto {$pvoto}. Standing ovation del pubblico — il mister lo abbraccia a fine gara.",
                    "Hat-trick di {$nome} contro {$avv} alla G{$giornata}: {$gf}-{$gs}. Voto {$pvoto}. 'Non mi fermo mai finché c'è da segnare' — le sue parole nello spogliatoio.",
                    "Tripletta strepitosa: {$nome} trascina {$team} {$casa} contro {$avv} ({$gf}-{$gs}). Voto {$pvoto}. I social esplodono. I top club guardano.",
                    ],
                    [
                    "{$nome} scores a hat-trick {$casa} against {$avv} ({$gf}-{$gs}). Rating {$pvoto}. Standing ovation from the crowd — the coach hugs him at full time.",
                    "Hat-trick by {$nome} against {$avv} in GW{$giornata}: {$gf}-{$gs}. Rating {$pvoto}. 'I never stop while there are goals to score' — his words in the dressing room.",
                    "Stunning treble: {$nome} drags {$team} {$casa} against {$avv} ({$gf}-{$gs}). Rating {$pvoto}. Social media explodes. Top clubs are watching.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'positivo'];
            } elseif ($pgol >= 2) {
                $titoli = _tna(["⚽⚽ Doppietta!", "⚽ Ancora in doppia cifra", "⚽⚽ Due reti preziose"],["⚽⚽ Brace!", "⚽ In double figures again", "⚽⚽ Two precious goals"]);
                $testi = _tna(
                    [
                    "{$nome} firma una doppietta {$casa} contro {$avv}: {$gf}-{$gs}. Voto {$pvoto}. Quando è in giornata non c'è difesa che tenga.",
                    "Due gol di {$nome} regalano i tre punti a {$team} contro {$avv} ({$gf}-{$gs}). Voto {$pvoto}. 'Era una partita difficile, sono soddisfatto'.",
                    "Doppietta {$casa} contro {$avv} ({$gf}-{$gs}): {$nome} scala la classifica marcatori. Voto {$pvoto}. Il mister: 'È il nostro uomo chiave'.",
                    ],
                    [
                    "{$nome} scores a brace {$casa} against {$avv}: {$gf}-{$gs}. Rating {$pvoto}. When he's on form no defence can hold him.",
                    "Two goals by {$nome} gift three points to {$team} against {$avv} ({$gf}-{$gs}). Rating {$pvoto}. 'It was a tough game, I'm happy with the result'.",
                    "Brace {$casa} against {$avv} ({$gf}-{$gs}): {$nome} climbs the top-scorers chart. Rating {$pvoto}. Coach: 'He's our key man'.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'positivo'];
            } elseif ($pgol >= 1 && $passist >= 1) {
                $titoli = _tna(["🎯 Gol e assist: prestazione totale", "⭐ Decisivo su tutti i fronti", "🎯 Il tuttofare del {$team}"],["🎯 Goal and assist: complete display", "⭐ Decisive on all fronts", "🎯 The jack-of-all-trades of {$team}"]);
                $testi = _tna(
                    [
                    "{$nome} firma gol e assist nel {$gf}-{$gs} {$casa} contro {$avv}. Voto {$pvoto}. Coinvolto in quasi ogni azione pericolosa. Dominante.",
                    "Vittoria {$casa} contro {$avv} ({$gf}-{$gs}): {$nome} con un gol e un assist è l'MVP assoluto. Voto {$pvoto}. 'Quando è in questo stato non si ferma'.",
                    "Gol, assist e vittoria: {$nome} regala una gioia piena ai tifosi contro {$avv} ({$gf}-{$gs}). Voto {$pvoto}. Prestazione da manuale.",
                    ],
                    [
                    "{$nome} scores and assists in the {$gf}-{$gs} {$casa} against {$avv}. Rating {$pvoto}. Involved in almost every dangerous move. Dominant.",
                    "Win {$casa} against {$avv} ({$gf}-{$gs}): {$nome} with a goal and an assist is the undisputed MVP. Rating {$pvoto}. 'When he's like this, nothing can stop him'.",
                    "Goal, assist and victory: {$nome} gives the fans pure joy against {$avv} ({$gf}-{$gs}). Rating {$pvoto}. A textbook display.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'positivo'];
            } elseif ($pgol >= 1) {
                $titoli = _tna(["⚽ Il gol della vittoria", "⚽ Segna ancora {$nome}!", "⚽ Rete decisiva"],["⚽ The winning goal", "⚽ {$nome} scores again!", "⚽ Decisive strike"]);
                $testi = _tna(
                    [
                    "Il gol di {$nome} vale tre punti {$casa} contro {$avv} ({$gf}-{$gs}). Voto {$pvoto}. 'Ci tenevamo molto a questa vittoria' — nello spogliatoio.",
                    "{$nome} trova la rete contro {$avv} ({$gf}-{$gs}). Voto {$pvoto}. La sua rete sblocca la partita e {$team} non si ferma più.",
                    "Ancora a segno: {$nome} non sbaglia davanti alla porta e regala la vittoria contro {$avv} ({$gf}-{$gs}). Voto {$pvoto}.",
                    ],
                    [
                    "{$nome}'s goal is worth three points {$casa} against {$avv} ({$gf}-{$gs}). Rating {$pvoto}. 'We really wanted this win' — in the dressing room.",
                    "{$nome} finds the net against {$avv} ({$gf}-{$gs}). Rating {$pvoto}. His goal unlocks the match and {$team} never look back.",
                    "On the scoresheet again: {$nome} doesn't miss in front of goal and gifts the win against {$avv} ({$gf}-{$gs}). Rating {$pvoto}.",
                    ]
                );
                if ($gol_type && isset($gol_type['desc'])) {
                    $testi[] = "Che prodezza di {$nome} contro {$avv} ({$gf}-{$gs}): segna {$gol_type['desc']}. Voto {$pvoto}. Il pubblico in piedi.";
                }
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0, count($testi)-1)], 'positivo'];
            } elseif ($passist >= 1) {
                $titoli = _tna(["🎯 Assist d'oro", "🎯 Il regista della vittoria", "🎯 Decisivo senza segnare"],["🎯 Golden assist", "🎯 The architect of victory", "🎯 Decisive without scoring"]);
                $testi = _tna(
                    [
                    "{$nome} non segna ma il suo assist vale oro: {$team} batte {$avv} {$gf}-{$gs}. Voto {$pvoto}. 'Chi fa assist è bravo quanto chi segna'.",
                    "È l'assist di {$nome} a spaccare la partita contro {$avv} ({$gf}-{$gs}). Voto {$pvoto}. Visione di gioco sopra la media.",
                    "Servizio perfetto di {$nome} per il {$gf}-{$gs} {$casa} contro {$avv}. Voto {$pvoto}. Il mister lo loda davanti a tutta la squadra.",
                    ],
                    [
                    "{$nome} doesn't score but his assist is gold: {$team} beats {$avv} {$gf}-{$gs}. Rating {$pvoto}. 'A great assist is just as good as a goal'.",
                    "It's {$nome}'s assist that cracks the game open against {$avv} ({$gf}-{$gs}). Rating {$pvoto}. Vision above the average.",
                    "Perfect delivery from {$nome} for the {$gf}-{$gs} {$casa} against {$avv}. Rating {$pvoto}. The coach praises him in front of the whole squad.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'positivo'];
            } elseif ($pvoto >= 7.5) {
                $titoli = _tna(["👍 Vittoria e buona prestazione", "🏟️ Tre punti e voto alto", "✅ Solido nella vittoria"],["👍 Win and strong display", "🏟️ Three points and high rating", "✅ Solid in victory"]);
                $testi = _tna(
                    [
                    "{$team} vince {$casa} contro {$avv} ({$gf}-{$gs}): {$nome} fa la sua parte con una prestazione ordinata. Voto {$pvoto}. 'Bene così'.",
                    "Vittoria meritata contro {$avv} ({$gf}-{$gs}): {$nome} contribuisce senza brillare nei numeri, ma il voto {$pvoto} racconta una storia diversa.",
                    "Tre punti {$casa} contro {$avv} ({$gf}-{$gs}). {$nome} è nella lista dei migliori in campo. Voto {$pvoto}. Il mister sorride.",
                    ],
                    [
                    "{$team} wins {$casa} against {$avv} ({$gf}-{$gs}): {$nome} does his job with a tidy display. Rating {$pvoto}. 'Good job'.",
                    "Deserved win against {$avv} ({$gf}-{$gs}): {$nome} contributes without shining in stats, but the {$pvoto} rating tells a different story.",
                    "Three points {$casa} against {$avv} ({$gf}-{$gs}). {$nome} is on the best-on-pitch list. Rating {$pvoto}. The coach smiles.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'positivo'];
            } else {
                $titoli = _tna(["🏟️ Vittoria di squadra", "✅ Tre punti conquistati", "🏟️ {$team} vince, {$nome} c'è"],["🏟️ Team victory", "✅ Three points secured", "🏟️ {$team} wins, {$nome} plays"]);
                $testi = _tna(
                    [
                    "{$team} porta a casa i tre punti contro {$avv} ({$gf}-{$gs}). Per {$nome} una partita di sacrificio. Voto {$pvoto}. Il gruppo è l'importante.",
                    "Vittoria {$casa} contro {$avv} ({$gf}-{$gs}) ma {$nome} non incide come vorrebbe. Voto {$pvoto}. Deve fare di più per restare titolare.",
                    "Tre punti {$casa} contro {$avv} ({$gf}-{$gs}). {$nome} ancora a secco, voto {$pvoto}. 'Non mi accontento mai dei risultati di squadra senza contribuire'.",
                    ],
                    [
                    "{$team} takes the three points home against {$avv} ({$gf}-{$gs}). For {$nome} it's a game of pure graft. Rating {$pvoto}. The team is what matters.",
                    "Win {$casa} against {$avv} ({$gf}-{$gs}) but {$nome} doesn't have the impact he wants. Rating {$pvoto}. Needs to do more to keep his starting spot.",
                    "Three points {$casa} against {$avv} ({$gf}-{$gs}). {$nome} still blank, rating {$pvoto}. 'I never settle for team results without contributing'.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'info'];
            }
        } elseif ($esito === 'P') {
            if ($pgol >= 1) {
                $titoli = _tna(["🤝 Pareggio, ma {$nome} segna", "⚽ Gol non basta: si divide", "🤝 Un punto con la firma di {$nome}"],["🤝 Draw, but {$nome} scores", "⚽ Goal not enough: shared points", "🤝 One point with {$nome}'s stamp"]);
                $testi = _tna(
                    [
                    "{$nome} segna contro {$avv} ma {$team} non riesce a vincere: finisce {$gf}-{$gs}. Voto {$pvoto}. 'Mi aspettavo di più da noi come squadra'.",
                    "La rete di {$nome} non basta: {$team} e {$avv} si dividono il punto ({$gf}-{$gs}). Voto {$pvoto}. Almeno lui ci ha messo la firma.",
                    "Pareggio {$casa} contro {$avv} ({$gf}-{$gs}): {$nome} segna ma il risultato lascia l'amaro in bocca. Voto {$pvoto}.",
                    ],
                    [
                    "{$nome} scores against {$avv} but {$team} can't win: it ends {$gf}-{$gs}. Rating {$pvoto}. 'I expected more from us as a team'.",
                    "{$nome}'s goal isn't enough: {$team} and {$avv} split the points ({$gf}-{$gs}). Rating {$pvoto}. At least he made his mark.",
                    "Draw {$casa} against {$avv} ({$gf}-{$gs}): {$nome} scores but the result leaves a bitter taste. Rating {$pvoto}.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'info'];
            } elseif ($pvoto >= 7.0) {
                $titoli = _tna(["🤝 Un punto che ha il sapore di qualcosa in più", "🤝 Pareggio a testa alta", "🤝 Punto guadagnato"],["🤝 A point that feels like more", "🤝 Head-held-high draw", "🤝 Point earned"]);
                $testi = _tna(
                    [
                    "Si ferma sul pareggio {$casa} contro {$avv} ({$gf}-{$gs}), ma {$nome} non è in discussione: voto {$pvoto}. Ha fatto tutto il possibile.",
                    "{$team} pareggia contro {$avv} ({$gf}-{$gs}): tra i migliori in campo c'è {$nome}, voto {$pvoto}. 'Questo punto ci servirà, vedremo'.",
                    "Pareggio {$casa} contro {$avv} ({$gf}-{$gs}). {$nome} con voto {$pvoto} è il migliore dei suoi. Ci ha provato fino all'ultimo.",
                    ],
                    [
                    "It ends in a draw {$casa} against {$avv} ({$gf}-{$gs}), but {$nome} is beyond criticism: rating {$pvoto}. He gave everything.",
                    "{$team} draws against {$avv} ({$gf}-{$gs}): {$nome} is one of the best on the pitch, rating {$pvoto}. 'This point will count, we'll see'.",
                    "Draw {$casa} against {$avv} ({$gf}-{$gs}). {$nome} with rating {$pvoto} is the best of his team. He tried until the last whistle.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'info'];
            } else {
                $titoli = _tna(["🤝 Pareggio amaro", "😐 Un punto ma che delusione", "🤝 Meritavamo di più"],["🤝 Bitter draw", "😐 A point but what a disappointment", "🤝 We deserved more"]);
                $testi = _tna(
                    [
                    "Pareggio indigesto {$casa} contro {$avv} ({$gf}-{$gs}). {$nome} sparisce dai radar: voto {$pvoto}. Deve ritrovarsi.",
                    "{$team} non va oltre il pari contro {$avv} ({$gf}-{$gs}): {$nome} sotto tono, voto {$pvoto}. 'Dobbiamo fare meglio, sono il primo a saperlo'.",
                    "Un punto {$casa} contro {$avv} ({$gf}-{$gs}) ma {$nome} non convince: voto {$pvoto}. Il mister a fine partita parla chiaro nello spogliatoio.",
                    ],
                    [
                    "A hard-to-swallow draw {$casa} against {$avv} ({$gf}-{$gs}). {$nome} goes off the radar: rating {$pvoto}. Needs to find himself.",
                    "{$team} can't go beyond a draw against {$avv} ({$gf}-{$gs}): {$nome} off the pace, rating {$pvoto}. 'We must do better, I'm the first to know it'.",
                    "A point {$casa} against {$avv} ({$gf}-{$gs}) but {$nome} doesn't convince: rating {$pvoto}. The coach speaks plainly in the dressing room after.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'negativo'];
            }
        } else { // Sconfitta
            $scarto = $gs - $gf;
            if ($pgol >= 1) {
                $titoli = _tna(["😔 Gol ma sconfitta", "💔 Non basta il gol di {$nome}", "⚽ Segna, ma la squadra cade"],["😔 Goal but defeat", "💔 {$nome}'s goal not enough", "⚽ Scores, but the team falls"]);
                $testi = _tna(
                    [
                    "{$nome} segna ma non è abbastanza: {$team} perde {$casa} contro {$avv} {$gf}-{$gs}. Voto {$pvoto}. 'Dobbiamo lavorare molto di più'.",
                    "La rete di {$nome} è un gol della bandiera: {$team} esce sconfitto contro {$avv} ({$gf}-{$gs}). Voto {$pvoto}. Serata difficile.",
                    "Sconfitta {$casa} contro {$avv} ({$gf}-{$gs}): almeno {$nome} risponde presente con un gol. Voto {$pvoto}. Non è abbastanza, ma la voglia c'è.",
                    ],
                    [
                    "{$nome} scores but it's not enough: {$team} loses {$casa} against {$avv} {$gf}-{$gs}. Rating {$pvoto}. 'We need to work much harder'.",
                    "{$nome}'s goal is a consolation: {$team} goes down against {$avv} ({$gf}-{$gs}). Rating {$pvoto}. Tough evening.",
                    "Defeat {$casa} against {$avv} ({$gf}-{$gs}): at least {$nome} steps up with a goal. Rating {$pvoto}. Not enough, but the desire is there.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'negativo'];
            } elseif ($scarto >= 3) {
                $titoli = _tna(["💔 Batosta pesante", "💔 Serata da dimenticare", "📉 Crollo inaspettato"],["💔 Heavy beating", "💔 Night to forget", "📉 Unexpected collapse"]);
                $testi = _tna(
                    [
                    "Notte buia {$casa}: {$avv} travolge {$team} {$gs}-{$gf}. {$nome} sparisce dal campo, voto {$pvoto}. Il mister: 'Dobbiamo ritrovarci'.",
                    "Sconfitta pesante contro {$avv} ({$gf}-{$gs}). {$nome} irriconoscibile: voto {$pvoto}. Una prestazione da cancellare dalla memoria.",
                    "{$team} crolla {$casa} contro {$avv} ({$gf}-{$gs}). {$nome} è uno dei peggiori in campo: voto {$pvoto}. Urge una reazione immediata.",
                    ],
                    [
                    "Dark night {$casa}: {$avv} demolishes {$team} {$gs}-{$gf}. {$nome} vanishes from the pitch, rating {$pvoto}. Coach: 'We need to find ourselves'.",
                    "Heavy defeat against {$avv} ({$gf}-{$gs}). {$nome} unrecognisable: rating {$pvoto}. A display to erase from memory.",
                    "{$team} collapse {$casa} against {$avv} ({$gf}-{$gs}). {$nome} is one of the worst on the pitch: rating {$pvoto}. An immediate reaction is needed.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'negativo'];
            } elseif ($pvoto >= 6.5) {
                $titoli = _tna(["💔 Sconfitta di misura", "😤 Persi ma a testa alta", "💔 L'impegno c'era, il risultato no"],["💔 Narrow defeat", "😤 Lost but heads held high", "💔 Effort was there, result wasn't"]);
                $testi = _tna(
                    [
                    "{$team} perde di misura contro {$avv} ({$gf}-{$gs}), ma {$nome} non è in colpa: voto {$pvoto}. Ha lottato fino al fischio finale.",
                    "Sconfitta {$casa} contro {$avv} ({$gf}-{$gs}): {$nome} con voto {$pvoto} è tra i migliori ma non basta. La squadra deve crescere.",
                    "Il {$gf}-{$gs} {$casa} contro {$avv} brucia. {$nome} ci ha messo tutto: voto {$pvoto}. 'La prestazione c'era, mancava il gol'.",
                    ],
                    [
                    "{$team} loses narrowly against {$avv} ({$gf}-{$gs}), but {$nome} is not to blame: rating {$pvoto}. He battled until the final whistle.",
                    "Defeat {$casa} against {$avv} ({$gf}-{$gs}): {$nome} with rating {$pvoto} is among the best but it's not enough. The squad must grow.",
                    "The {$gf}-{$gs} {$casa} against {$avv} stings. {$nome} gave everything: rating {$pvoto}. 'The performance was there, the goal wasn't'.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'negativo'];
            } else {
                $titoli = _tna(["💔 Sconfitta e prestazione opaca", "📉 Momento difficile", "💔 Serata no su tutti i fronti"],["💔 Defeat and poor display", "📉 Difficult spell", "💔 Off-night on all fronts"]);
                $testi = _tna(
                    [
                    "Doppia delusione {$casa}: {$team} perde contro {$avv} ({$gf}-{$gs}) e {$nome} è tra i più deludenti. Voto {$pvoto}. Urge svolta.",
                    "Sconfitta {$casa} contro {$avv} ({$gf}-{$gs}): {$nome} sotto le aspettative, voto {$pvoto}. Il mister chiede di più in conferenza.",
                    "Una serata da dimenticare in ogni senso: {$team} ko contro {$avv} ({$gf}-{$gs}), {$nome} assente: voto {$pvoto}. Tifosi delusi.",
                    ],
                    [
                    "Double disappointment {$casa}: {$team} loses against {$avv} ({$gf}-{$gs}) and {$nome} is among the worst. Rating {$pvoto}. A turnaround is needed.",
                    "Defeat {$casa} against {$avv} ({$gf}-{$gs}): {$nome} below expectations, rating {$pvoto}. The coach demands more in the press conference.",
                    "A night to forget on all fronts: {$team} knocked out against {$avv} ({$gf}-{$gs}), {$nome} absent: rating {$pvoto}. Fans disappointed.",
                    ]
                );
                $notizie[] = [$titoli[rand(0,2)], $testi[rand(0,2)], 'negativo'];
            }
        }
    }

    // ── 2. NOTIZIA RIEPILOGATIVA DEL MESE (se più di una partita) ───────
    if ($n_partite > 1) {
        $record = "{$vittorie}V {$pareggi}P {$sconfitte}S";
        if ($vittorie === $n_partite) {
            $notizie[] = [_tn("🔥 Mese perfetto!", "🔥 Perfect month!", "🔥 Perfekter Monat!", "🔥 ¡Mes perfecto!"), _tn("{$nome} e {$team} vincono tutte le {$n_partite} partite del mese ({$record}). Totale: {$tot_gol} gol e {$tot_assist} assist. Voto medio {$voto_medio}. Un mese straordinario.", "{$nome} and {$team} win all {$n_partite} matches this month ({$record}). Total: {$tot_gol} goals and {$tot_assist} assists. Avg rating {$voto_medio}. An extraordinary month.", "{$nome} and {$team} win all {$n_partite} matches this month ({$record}). Total: {$tot_gol} goals and {$tot_assist} assists. Avg rating {$voto_medio}. An extraordinary month.", "{$nome} and {$team} win all {$n_partite} matches this month ({$record}). Total: {$tot_gol} goals and {$tot_assist} assists. Avg rating {$voto_medio}. An extraordinary month."), 'positivo'];
        } elseif ($vittorie >= 2 && $sconfitte === 0) {
            $notizie[] = [_tn("📈 Mese senza sconfitte", "📈 Unbeaten month", "📈 Unbeaten month", "📈 Unbeaten month"), _tn("Nessuna sconfitta per {$team} in questo mese ({$record}). {$nome} firma {$tot_gol} gol e {$tot_assist} assist. Voto medio {$voto_medio}. Il campionato prende una piega interessante.", "No defeats for {$team} this month ({$record}). {$nome} registers {$tot_gol} goals and {$tot_assist} assists. Avg rating {$voto_medio}. The title race takes an interesting turn.", "No defeats for {$team} this month ({$record}). {$nome} registers {$tot_gol} goals and {$tot_assist} assists. Avg rating {$voto_medio}. The title race takes an interesting turn.", "No defeats for {$team} this month ({$record}). {$nome} registers {$tot_gol} goals and {$tot_assist} assists. Avg rating {$voto_medio}. The title race takes an interesting turn."), 'positivo'];
        } elseif ($sconfitte === $n_partite) {
            $notizie[] = [_tn("📉 Mese difficile", "📉 Difficult month", "📉 Difficult month", "📉 Difficult month"), _tn("{$team} non riesce a vincere nessuna delle {$n_partite} partite ({$record}). {$nome} totalizza {$tot_gol} gol e {$tot_assist} assist, voto medio {$voto_medio}. Serve una reazione.", "{$team} can't win any of the {$n_partite} matches ({$record}). {$nome} tallies {$tot_gol} goals and {$tot_assist} assists, avg rating {$voto_medio}. A reaction is needed.", "{$team} can't win any of the {$n_partite} matches ({$record}). {$nome} tallies {$tot_gol} goals and {$tot_assist} assists, avg rating {$voto_medio}. A reaction is needed.", "{$team} can't win any of the {$n_partite} matches ({$record}). {$nome} tallies {$tot_gol} goals and {$tot_assist} assists, avg rating {$voto_medio}. A reaction is needed."), 'negativo'];
        } elseif ($tot_gol >= 4) {
            $notizie[] = [_tn("⚽ Un mese prolifico", "⚽ A prolific month", "⚽ A prolific month", "⚽ A prolific month"), _tn("{$tot_gol} gol e {$tot_assist} assist in {$n_partite} partite: {$nome} è in grande forma offensiva. Record del mese: {$record}. Voto medio {$voto_medio}.", "{$tot_gol} goals and {$tot_assist} assists in {$n_partite} matches: {$nome} is in excellent attacking form. Monthly record: {$record}. Avg rating {$voto_medio}.", "{$tot_gol} goals and {$tot_assist} assists in {$n_partite} matches: {$nome} is in excellent attacking form. Monthly record: {$record}. Avg rating {$voto_medio}.", "{$tot_gol} goals and {$tot_assist} assists in {$n_partite} matches: {$nome} is in excellent attacking form. Monthly record: {$record}. Avg rating {$voto_medio}."), 'positivo'];
        } else {
            $notizie[] = [_tn("📊 Bilancio mensile", "📊 Monthly report", "📊 Monthly report", "📊 Monthly report"), _tn("{$nome} chiude il mese con {$tot_gol} gol e {$tot_assist} assist in {$n_partite} partite ({$record}). Voto medio {$voto_medio}. C'è ancora margine di crescita.", "{$nome} closes the month with {$tot_gol} goals and {$tot_assist} assists in {$n_partite} matches ({$record}). Avg rating {$voto_medio}. There's still room to grow.", "{$nome} closes the month with {$tot_gol} goals and {$tot_assist} assists in {$n_partite} matches ({$record}). Avg rating {$voto_medio}. There's still room to grow.", "{$nome} closes the month with {$tot_gol} goals and {$tot_assist} assists in {$n_partite} matches ({$record}). Avg rating {$voto_medio}. There's still room to grow."), 'info'];
        }
    }

    // ── 3. NOTIZIE CONTESTUALI (sempre generate, 2-3 extra) ─────────────
    {
        $random_news = [];

        // Basate su overall
        if ($overall >= 110) {
            $random_news[] = [_tn("🌍 Icona mondiale", "🌍 World icon", "🌍 World icon", "🌍 World icon"), _tn("{$nome} è nella top-5 mondiale. Sondaggio di France Football: 'Sta dominando il calcio di questo decennio'.", "France Football survey: '{$nome} is in the world top-5 and dominating this decade of football'.", "France Football survey: '{$nome} is in the world top-5 and dominating this decade of football'.", "France Football survey: '{$nome} is in the world top-5 and dominating this decade of football'."), 'positivo'];
            $random_news[] = [_tn("💎 Offerta da favola", "💎 Extraordinary offer", "💎 Extraordinary offer", "💎 Extraordinary offer"), _tn("Un club misterioso avrebbe presentato un'offerta monstre per {$nome}. Il club: 'Non è in vendita a nessun prezzo'.", "A mystery club reportedly tabled a massive bid for {$nome}. The club: 'Not for sale at any price'.", "A mystery club reportedly tabled a massive bid for {$nome}. The club: 'Not for sale at any price'.", "A mystery club reportedly tabled a massive bid for {$nome}. The club: 'Not for sale at any price'."), 'mercato'];
        } elseif ($overall >= 95) {
            $random_news[] = [_tn("🌟 Candidato Pallone d'Oro", "🌟 Ballon d'Or candidate", "🌟 Ballon d'Or candidate", "🌟 Ballon d'Or candidate"), _tn("La stampa internazionale inizia a fare i nomi per il Pallone d'Oro: {$nome} è tra i favoriti.", "The international press is shortlisting Ballon d'Or candidates: {$nome} is among the front-runners.", "The international press is shortlisting Ballon d'Or candidates: {$nome} is among the front-runners.", "The international press is shortlisting Ballon d'Or candidates: {$nome} is among the front-runners."), 'positivo'];
            $random_news[] = [_tn("📺 Intervista esclusiva", "📺 Exclusive interview", "📺 Exclusive interview", "📺 Exclusive interview"), _tn("{$nome} parla in esclusiva: 'Il mio sogno è vincere tutto con questa maglia. E ci stiamo avvicinando'.", "{$nome} speaks exclusively: 'My dream is to win everything with this shirt. And we're getting closer'.", "{$nome} speaks exclusively: 'My dream is to win everything with this shirt. And we're getting closer'.", "{$nome} speaks exclusively: 'My dream is to win everything with this shirt. And we're getting closer'."), 'info'];
        } elseif ($overall >= 80) {
            $random_news[] = [_tn("🗞️ Interesse internazionale", "🗞️ International interest", "🗞️ International interest", "🗞️ International interest"), _tn("Media europei iniziano a seguire {$nome}. 'Un giocatore da tenere d'occhio nei prossimi mesi'.", "European media are tracking {$nome}. 'A player to watch in the coming months'.", "European media are tracking {$nome}. 'A player to watch in the coming months'.", "European media are tracking {$nome}. 'A player to watch in the coming months'."), 'info'];
            $random_news[] = [_tn("💼 Scout in tribuna", "💼 Scout in the stands", "💼 Scout in the stands", "💼 Scout in the stands"), _tn("Diversi osservatori di top club erano sugli spalti ieri. Il bersaglio? Quasi certamente {$nome}.", "Several top-club scouts were in the stands yesterday. The target? Almost certainly {$nome}.", "Several top-club scouts were in the stands yesterday. The target? Almost certainly {$nome}.", "Several top-club scouts were in the stands yesterday. The target? Almost certainly {$nome}."), 'mercato'];
            $random_news[] = [_tn("📈 Valutazione record", "📈 Record valuation", "📈 Record valuation", "📈 Record valuation"), _tn("L'agenzia Transfermarkt ha aggiornato la valutazione di {$nome}: nuovo massimo in carriera.", "Transfermarkt has updated {$nome}'s valuation: a new career high.", "Transfermarkt has updated {$nome}'s valuation: a new career high.", "Transfermarkt has updated {$nome}'s valuation: a new career high."), 'positivo'];
        } elseif ($overall >= 65) {
            $random_news[] = [_tn("🔭 Talento emergente", "🔭 Emerging talent", "🔭 Emerging talent", "🔭 Emerging talent"), _tn("Il portale specializzato lo inserisce tra i 'prospect da seguire': {$nome} sta bruciando le tappe.", "The specialist portal lists {$nome} among 'prospects to watch': burning through the ranks.", "The specialist portal lists {$nome} among 'prospects to watch': burning through the ranks.", "The specialist portal lists {$nome} among 'prospects to watch': burning through the ranks."), 'info'];
        }

        // Basate su popolarità
        if ($pop >= 90) {
            $random_news[] = [_tn("📱 Fenomeno social", "📱 Social media phenomenon", "📱 Social media phenomenon", "📱 Social media phenomenon"), _tn("{$nome} è il calciatore più discusso online questa settimana: milioni di like e condivisioni per il suo ultimo gol.", "{$nome} is the most discussed footballer online this week: millions of likes and shares for the latest goal.", "{$nome} is the most discussed footballer online this week: millions of likes and shares for the latest goal.", "{$nome} is the most discussed footballer online this week: millions of likes and shares for the latest goal."), 'positivo'];
            $random_news[] = [_tn("👕 Maglia sold out", "👕 Shirt sold out", "👕 Shirt sold out", "👕 Shirt sold out"), _tn("La maglia con il numero di {$nome} è esaurita in tutti i negozi. Il merchandising non riesce a stare al passo.", "The shirt bearing {$nome}'s number has sold out everywhere. Merchandising can't keep up.", "The shirt bearing {$nome}'s number has sold out everywhere. Merchandising can't keep up.", "The shirt bearing {$nome}'s number has sold out everywhere. Merchandising can't keep up."), 'positivo'];
        } elseif ($pop >= 70) {
            $random_news[] = [_tn("❤️ Beniamino del pubblico", "❤️ Crowd favourite", "❤️ Crowd favourite", "❤️ Crowd favourite"), _tn("I tifosi di {$team} hanno eletto {$nome} come giocatore preferito della stagione. Grande affetto dalla curva.", "{$team} fans have voted {$nome} their favourite player of the season. Huge support from the terraces.", "{$team} fans have voted {$nome} their favourite player of the season. Huge support from the terraces.", "{$team} fans have voted {$nome} their favourite player of the season. Huge support from the terraces."), 'positivo'];
        }

        // Basate su morale
        if ($morale >= 90) {
            $random_news[] = [_tn("😄 Un campione felice", "😄 A happy champion", "😄 A happy champion", "😄 A happy champion"), _tn("{$nome} in conferenza: 'Sono nel momento migliore della mia carriera. Voglio continuare così'. Sorrisi e ambizione.", "{$nome} at the presser: 'I'm in the best form of my career. I want to keep this going'. Smiles and ambition.", "{$nome} at the presser: 'I'm in the best form of my career. I want to keep this going'. Smiles and ambition.", "{$nome} at the presser: 'I'm in the best form of my career. I want to keep this going'. Smiles and ambition."), 'positivo'];
        } elseif ($morale <= 35) {
            $random_news[] = [_tn("😤 Tensione nello spogliatoio", "😤 Dressing room tension", "😤 Dressing room tension", "😤 Dressing room tension"), _tn("Voci di frizione tra {$nome} e la dirigenza. Il giocatore: 'No comment'. Si naviga a vista.", "Rumours of friction between {$nome} and the board. The player: 'No comment'. Navigating blind.", "Rumours of friction between {$nome} and the board. The player: 'No comment'. Navigating blind.", "Rumours of friction between {$nome} and the board. The player: 'No comment'. Navigating blind."), 'negativo'];
            $random_news[] = [_tn("🌧️ Momento difficile", "🌧️ Difficult spell", "🌧️ Difficult spell", "🌧️ Difficult spell"), _tn("{$nome} sta attraversando un periodo complicato. L'entourage: 'Ha bisogno di ritrovare serenità e continuità'.", "{$nome} is going through a difficult patch. The entourage: 'He needs to find serenity and consistency again'.", "{$nome} is going through a difficult patch. The entourage: 'He needs to find serenity and consistency again'.", "{$nome} is going through a difficult patch. The entourage: 'He needs to find serenity and consistency again'."), 'negativo'];
        }

        // Basate su energia
        if ($energia <= 25) {
            $random_news[] = [_tn("🏥 Allarme fisico", "🏥 Physical alarm", "🏥 Physical alarm", "🏥 Physical alarm"), _tn("Il medico del club trattiene {$nome} dagli allenamenti extra: 'Deve recuperare, rischiamo un infortunio serio'.", "The club doctor has held {$nome} back from extra sessions: 'He must rest — we risk a serious injury'.", "The club doctor has held {$nome} back from extra sessions: 'He must rest — we risk a serious injury'.", "The club doctor has held {$nome} back from extra sessions: 'He must rest — we risk a serious injury'."), 'negativo'];
        } elseif ($energia >= 90) {
            $random_news[] = [_tn("💪 Una macchina da guerra", "💪 A war machine", "💪 A war machine", "💪 A war machine"), _tn("{$nome} non si ferma mai. Il preparatore atletico: 'Non ho mai visto nessuno con questa energia a fine stagione'.", "{$nome} never stops. The fitness coach: 'I've never seen anyone with this energy at the end of a season'.", "{$nome} never stops. The fitness coach: 'I've never seen anyone with this energy at the end of a season'.", "{$nome} never stops. The fitness coach: 'I've never seen anyone with this energy at the end of a season'."), 'positivo'];
        }

        // Basate su stelle squadra
        if ($stelle >= 4) {
            $random_news[] = [_tn("🏆 Stagione cruciale", "🏆 Crucial season", "🏆 Crucial season", "🏆 Crucial season"), _tn("La dirigenza ha indicato {$nome} come la chiave per il titolo. 'Se sta bene lui, stiamo bene tutti'.", "The board has named {$nome} as the key to the title. 'When he's fit, we're all good'.", "The board has named {$nome} as the key to the title. 'When he's fit, we're all good'.", "The board has named {$nome} as the key to the title. 'When he's fit, we're all good'."), 'info'];
            $random_news[] = [_tn("💰 Rinnovo in vista", "💰 Renewal on the horizon", "💰 Renewal on the horizon", "💰 Renewal on the horizon"), _tn("Il club vuole blindare {$nome}: pronto un rinnovo di contratto con ingaggio nettamente superiore.", "The club wants to lock down {$nome}: a renewal with a significantly higher wage is ready.", "The club wants to lock down {$nome}: a renewal with a significantly higher wage is ready.", "The club wants to lock down {$nome}: a renewal with a significantly higher wage is ready."), 'positivo'];
        } elseif ($stelle <= 2) {
            $random_news[] = [_tn("🚀 Troppo forte per questa lega?", "🚀 Too good for this league?", "🚀 Too good for this league?", "🚀 Too good for this league?"), _tn("Gli osservatori sono unanimi: {$nome} ha superato il livello del campionato. Il grande salto è questione di tempo.", "Observers are unanimous: {$nome} has outgrown this league. The big step up is only a matter of time.", "Observers are unanimous: {$nome} has outgrown this league. The big step up is only a matter of time.", "Observers are unanimous: {$nome} has outgrown this league. The big step up is only a matter of time."), 'info'];
        }

        // Notizie stagionali (basate sul mese)
        if ($mese == 9) {
            $random_news[] = [_tn("📅 Nuova stagione, nuovi obiettivi", "📅 New season, new goals", "📅 New season, new goals", "📅 New season, new goals"), _tn("{$nome} si presenta al raduno carico: 'Quest'anno voglio portare la squadra più in alto possibile. Ho lavorato duramente'.", "{$nome} arrives at pre-season fired up: 'This year I want to take the team as high as possible. I've worked hard'.", "{$nome} arrives at pre-season fired up: 'This year I want to take the team as high as possible. I've worked hard'.", "{$nome} arrives at pre-season fired up: 'This year I want to take the team as high as possible. I've worked hard'."), 'info'];
        } elseif ($mese == 1) {
            $random_news[] = [_tn("📊 Bilancio di metà stagione", "📊 Mid-season report", "📊 Mid-season report", "📊 Mid-season report"), _tn("A metà campionato {$nome} è tra i migliori della lega. I numeri parlano per lui.", "At the halfway point, {$nome} is among the best in the league. The numbers speak for themselves.", "At the halfway point, {$nome} is among the best in the league. The numbers speak for themselves.", "At the halfway point, {$nome} is among the best in the league. The numbers speak for themselves."), 'info'];
        } elseif ($mese == 6) {
            $random_news[] = [_tn("🏁 Fine stagione", "🏁 Season over", "🏁 Season over", "🏁 Season over"), _tn("Si chiude la stagione per {$nome}: mesi di progressi, gol e soddisfazioni. 'Sono pronto per fare ancora meglio'.", "The season ends for {$nome}: months of progress, goals and satisfaction. 'I'm ready to do even better'.", "The season ends for {$nome}: months of progress, goals and satisfaction. 'I'm ready to do even better'.", "The season ends for {$nome}: months of progress, goals and satisfaction. 'I'm ready to do even better'."), 'info'];
        }

        // Notizie curiose/umane (sempre disponibili)
        $umane = [
            [_tn("🎙️ Microfono aperto", "🎙️ Open mic", "🎙️ Open mic", "🎙️ Open mic"), _tn("{$nome} ai microfoni: 'Il calcio è sacrificio, ma quando sento il boato dello stadio capisco perché lo faccio'.", "{$nome} at the mic: 'Football is sacrifice, but when I hear the crowd roar I remember why I do this'.", "{$nome} at the mic: 'Football is sacrifice, but when I hear the crowd roar I remember why I do this'.", "{$nome} at the mic: 'Football is sacrifice, but when I hear the crowd roar I remember why I do this'."), 'info'],
            [_tn("🎓 Esempio fuori dal campo", "🎓 Role model off the pitch", "🎓 Role model off the pitch", "🎓 Role model off the pitch"), _tn("{$nome} ha visitato una scuola della città. 'I bambini sono il futuro del calcio. Voglio essere un modello positivo per loro'.", "{$nome} visited a local school. 'Kids are the future of football. I want to be a positive role model for them'.", "{$nome} visited a local school. 'Kids are the future of football. I want to be a positive role model for them'.", "{$nome} visited a local school. 'Kids are the future of football. I want to be a positive role model for them'."), 'positivo'],
            [_tn("🍕 La vita del campione", "🍕 Champion's life", "🍕 Champion's life", "🍕 Champion's life"), _tn("Reportage sul quotidiano di {$nome}: allenamenti duri, dieta ferrea, e il segreto del suo successo. 'La costanza è tutto'.", "A feature on {$nome}'s daily routine: tough training, strict diet, and the secret to success. 'Consistency is everything'.", "A feature on {$nome}'s daily routine: tough training, strict diet, and the secret to success. 'Consistency is everything'.", "A feature on {$nome}'s daily routine: tough training, strict diet, and the secret to success. 'Consistency is everything'."), 'info'],
            [_tn("🤝 Leader silenzioso", "🤝 Silent leader", "🤝 Silent leader", "🤝 Silent leader"), _tn("I compagni di squadra descrivono {$nome} come il 'collante dello spogliatoio': sempre presente, sempre positivo.", "Teammates describe {$nome} as the 'glue of the dressing room': always present, always positive.", "Teammates describe {$nome} as the 'glue of the dressing room': always present, always positive.", "Teammates describe {$nome} as the 'glue of the dressing room': always present, always positive."), 'positivo'],
            [_tn("🔢 Il numero parla", "🔢 The numbers talk", "🔢 The numbers talk", "🔢 The numbers talk"), _tn("La statistica della settimana: {$nome} è tra i top-3 della lega per incisività offensiva. I numeri non mentono.", "This week's stat: {$nome} is in the league top-3 for attacking efficiency. Numbers don't lie.", "This week's stat: {$nome} is in the league top-3 for attacking efficiency. Numbers don't lie.", "This week's stat: {$nome} is in the league top-3 for attacking efficiency. Numbers don't lie."), 'info'],
            [_tn("🗺️ Sogni di gloria", "🗺️ Dreams of glory", "🗺️ Dreams of glory", "🗺️ Dreams of glory"), _tn("Intervista esclusiva: '{$nome} ha ancora tanta fame. Non è qui per accontentarsi', dice il suo procuratore.", "Exclusive interview: '{$nome} is still hungry. He's not here to settle', says his agent.", "Exclusive interview: '{$nome} is still hungry. He's not here to settle', says his agent.", "Exclusive interview: '{$nome} is still hungry. He's not here to settle', says his agent."), 'info'],
            [_tn("🏋️ Lavoro extra", "🏋️ Extra work", "🏋️ Extra work", "🏋️ Extra work"), _tn("Lo staff tecnico conferma: {$nome} resta in campo dopo ogni allenamento a perfezionare il tiro. 'Un professionista esemplare'.", "The coaching staff confirms: {$nome} stays on the pitch after every session to perfect his shooting. 'An exemplary professional'.", "The coaching staff confirms: {$nome} stays on the pitch after every session to perfect his shooting. 'An exemplary professional'.", "The coaching staff confirms: {$nome} stays on the pitch after every session to perfect his shooting. 'An exemplary professional'."), 'positivo'],
            [_tn("🌅 La routine del mattino", "🌅 Morning routine", "🌅 Morning routine", "🌅 Morning routine"), _tn("{$nome} svela la sua routine: sveglia alle 6:30, colazione proteica, corsa di 5 km prima dell'allenamento. 'La disciplina fa la differenza'.", "{$nome} reveals his routine: up at 6:30, protein breakfast, 5 km run before training. 'Discipline makes the difference'.", "{$nome} reveals his routine: up at 6:30, protein breakfast, 5 km run before training. 'Discipline makes the difference'.", "{$nome} reveals his routine: up at 6:30, protein breakfast, 5 km run before training. 'Discipline makes the difference'."), 'info'],
            [_tn("🎭 Il personaggio", "🎭 The character", "🎭 The character", "🎭 The character"), _tn("Il noto commentatore tv: '{$nome} non è solo un calciatore, è un personaggio che sa stare in campo e fuori. Raro'.", "The well-known TV commentator: '{$nome} is not just a footballer — he's a personality on and off the pitch. Rare'.", "The well-known TV commentator: '{$nome} is not just a footballer — he's a personality on and off the pitch. Rare'.", "The well-known TV commentator: '{$nome} is not just a footballer — he's a personality on and off the pitch. Rare'."), 'positivo'],
            [_tn("🤸 Elasticità mentale", "🤸 Mental resilience", "🤸 Mental resilience", "🤸 Mental resilience"), _tn("Il preparatore atletico rivela: '{$nome} ha una capacità di recupero mentale straordinaria. Dopo una partita negativa torna sempre più forte'.", "The fitness coach reveals: '{$nome} has extraordinary mental recovery. After a bad game he always comes back stronger'.", "The fitness coach reveals: '{$nome} has extraordinary mental recovery. After a bad game he always comes back stronger'.", "The fitness coach reveals: '{$nome} has extraordinary mental recovery. After a bad game he always comes back stronger'."), 'positivo'],
            [_tn("📚 Il lettore di notte", "📚 The night reader", "📚 The night reader", "📚 The night reader"), _tn("Curiosità: {$nome} legge libri di psicologia sportiva ogni notte prima di dormire. 'La mente è il muscolo più importante'.", "Fun fact: {$nome} reads sports psychology books every night before sleeping. 'The mind is the most important muscle'.", "Fun fact: {$nome} reads sports psychology books every night before sleeping. 'The mind is the most important muscle'.", "Fun fact: {$nome} reads sports psychology books every night before sleeping. 'The mind is the most important muscle'."), 'info'],
            [_tn("🌡️ Condizioni al limite", "🌡️ Playing through it", "🌡️ Playing through it", "🌡️ Playing through it"), _tn("Con la febbre, {$nome} ha comunque partecipato all'allenamento. Il medico: 'È ingestibile, nel senso migliore'.", "Despite a fever, {$nome} still showed up to training. The doctor: 'He's unmanageable — in the best possible way'.", "Despite a fever, {$nome} still showed up to training. The doctor: 'He's unmanageable — in the best possible way'.", "Despite a fever, {$nome} still showed up to training. The doctor: 'He's unmanageable — in the best possible way'."), 'positivo'],
            [_tn("🤝 Compagni di viaggio", "🤝 Road companions", "🤝 Road companions", "🤝 Road companions"), _tn("I compagni di squadra confermano: '{$nome} è il primo ad arrivare e l'ultimo a uscire. Questo ci ispira tutti'.", "Teammates confirm: '{$nome} is the first to arrive and the last to leave. It inspires all of us'.", "Teammates confirm: '{$nome} is the first to arrive and the last to leave. It inspires all of us'.", "Teammates confirm: '{$nome} is the first to arrive and the last to leave. It inspires all of us'."), 'positivo'],
            [_tn("🎩 Eleganza fuori campo", "🎩 Off-pitch elegance", "🎩 Off-pitch elegance", "🎩 Off-pitch elegance"), _tn("Premiato come 'Calciatore più elegante' dalla rivista di moda locale. {$nome}: 'Curarsi nell'aspetto è rispetto per se stessi e per gli altri'.", "Awarded 'Most Stylish Player' by a local fashion magazine. {$nome}: 'Looking after your appearance is respect for yourself and others'.", "Awarded 'Most Stylish Player' by a local fashion magazine. {$nome}: 'Looking after your appearance is respect for yourself and others'.", "Awarded 'Most Stylish Player' by a local fashion magazine. {$nome}: 'Looking after your appearance is respect for yourself and others'."), 'info'],
            [_tn("📱 Influencer involontario", "📱 Accidental influencer", "📱 Accidental influencer", "📱 Accidental influencer"), _tn("Ogni foto di {$nome} raggiunge mezzo milione di like. 'Non lo faccio per i like. Lo faccio perché mi diverte condividere', dice.", "Every photo of {$nome} hits half a million likes. 'I don't do it for likes. I do it because I enjoy sharing', he says.", "Every photo of {$nome} hits half a million likes. 'I don't do it for likes. I do it because I enjoy sharing', he says.", "Every photo of {$nome} hits half a million likes. 'I don't do it for likes. I do it because I enjoy sharing', he says."), 'info'],
            [_tn("🌿 Green player", "🌿 Green player", "🌿 Green player", "🌿 Green player"), _tn("{$nome} partecipa attivamente alla campagna 'Carbon Zero' del club: pannelli solari alla sua abitazione e auto elettrica.", "{$nome} actively supports the club's 'Carbon Zero' campaign: solar panels at home and an electric car.", "{$nome} actively supports the club's 'Carbon Zero' campaign: solar panels at home and an electric car.", "{$nome} actively supports the club's 'Carbon Zero' campaign: solar panels at home and an electric car."), 'positivo'],
            [_tn("🔑 Le chiavi dello spogliatoio", "🔑 Keys to the dressing room", "🔑 Keys to the dressing room", "🔑 Keys to the dressing room"), _tn("Il custode dello stadio racconta: '{$nome} entra sempre con un sorriso e se ne va per ultimo, spesso aiutando a raccogliere le palle'.", "The stadium caretaker says: '{$nome} always comes in smiling and leaves last, often helping collect the balls'.", "The stadium caretaker says: '{$nome} always comes in smiling and leaves last, often helping collect the balls'.", "The stadium caretaker says: '{$nome} always comes in smiling and leaves last, often helping collect the balls'."), 'positivo'],
            [_tn("🎯 L'obiettivo dichiarato", "🎯 The declared goal", "🎯 The declared goal", "🎯 The declared goal"), _tn("In un'intervista rara, {$nome} ammette: 'Il mio sogno è il Pallone d\\'Oro. Lo dico apertamente perché i sogni si raggiungono solo se ci credi davvero'.", "In a rare interview, {$nome} admits: 'My dream is the Ballon d\\'Or. I say it openly because dreams only come true if you truly believe'.", "In a rare interview, {$nome} admits: 'My dream is the Ballon d\\'Or. I say it openly because dreams only come true if you truly believe'.", "In a rare interview, {$nome} admits: 'My dream is the Ballon d\\'Or. I say it openly because dreams only come true if you truly believe'."), 'positivo'],
            [_tn("🏅 Il passato promettente", "🏅 A promising past", "🏅 A promising past", "🏅 A promising past"), _tn("Un ex tecnico del settore giovanile ricorda {$nome}: 'Già a 14 anni vedevi che sarebbe diventato qualcosa di speciale. Aveva fame'.", "A former youth coach recalls {$nome}: 'Even at 14 you could see he'd become something special. He had hunger'.", "A former youth coach recalls {$nome}: 'Even at 14 you could see he'd become something special. He had hunger'.", "A former youth coach recalls {$nome}: 'Even at 14 you could see he'd become something special. He had hunger'."), 'info'],
            [_tn("👟 Scarpe porta-fortuna", "👟 Lucky boots", "👟 Lucky boots", "👟 Lucky boots"), _tn("{$nome} gioca sempre con lo stesso modello di scarpe da 3 anni: 'Sono scaramantiche. Non le cambio finché continuano a portarmi gol'.", "{$nome} has played in the same boot model for 3 years: 'They're lucky. I won't change them as long as they keep bringing me goals'.", "{$nome} has played in the same boot model for 3 years: 'They're lucky. I won't change them as long as they keep bringing me goals'.", "{$nome} has played in the same boot model for 3 years: 'They're lucky. I won't change them as long as they keep bringing me goals'."), 'info'],
            [_tn("🎙️ Radio sport", "🎙️ Sports radio", "🎙️ Sports radio", "🎙️ Sports radio"), _tn("Intervistato alla radio, {$nome} risponde alle domande dei tifosi per un'ora intera: 'È il minimo che posso fare per chi mi supporta ogni settimana'.", "On the radio, {$nome} answered fan questions for a full hour: 'It's the least I can do for those who support me every week'.", "On the radio, {$nome} answered fan questions for a full hour: 'It's the least I can do for those who support me every week'.", "On the radio, {$nome} answered fan questions for a full hour: 'It's the least I can do for those who support me every week'."), 'positivo'],
            [_tn("🍽️ Cena di squadra", "🍽️ Team dinner", "🍽️ Team dinner", "🍽️ Team dinner"), _tn("La tradizionale cena di squadra mensile: {$nome} ha cucinato lui stesso un piatto tipico della sua regione. I compagni: 'Cucina meglio di quanto giochi!'", "The traditional monthly team dinner: {$nome} cooked a local dish himself. Teammates: 'He cooks better than he plays!'", "The traditional monthly team dinner: {$nome} cooked a local dish himself. Teammates: 'He cooks better than he plays!'", "The traditional monthly team dinner: {$nome} cooked a local dish himself. Teammates: 'He cooks better than he plays!'"), 'info'],
        ];
        $random_news[] = $umane[rand(0, count($umane)-1)];

        // Scegli sempre 2 notizie contestuali
        if (!empty($random_news)) {
            shuffle($random_news);
            $notizie[] = $random_news[0];
            if (count($random_news) > 1) {
                $notizie[] = $random_news[1];
            }
        }
    }

    // ── 4. NOTIZIA EVENTO SPECIALE (70% probabilità) ─────────────────
    if (rand(1,100) <= 70) {
        $eventi = [
            [_tn("🎲 Colpo di scena in campionato", "🎲 Shock result in the league", "🎲 Shock result in the league", "🎲 Shock result in the league"), _tn("Risultati a sorpresa nell'ultimo turno. {$nome} e {$team} devono restare concentrati: la classifica è ancora aperta.", "Surprise results last weekend. {$nome} and {$team} must stay focused: the table is wide open.", "Surprise results last weekend. {$nome} and {$team} must stay focused: the table is wide open.", "Surprise results last weekend. {$nome} and {$team} must stay focused: the table is wide open."), 'info'],
            [_tn("🌦️ Derby in arrivo", "🌦️ Derby incoming", "🌦️ Derby incoming", "🌦️ Derby incoming"), _tn("Si avvicina il derby locale. L'ambiente è elettrico e {$nome} è il giocatore più atteso dai tifosi.", "The local derby is approaching. The atmosphere is electric and {$nome} is the most anticipated player.", "The local derby is approaching. The atmosphere is electric and {$nome} is the most anticipated player.", "The local derby is approaching. The atmosphere is electric and {$nome} is the most anticipated player."), 'info'],
            [_tn("🔄 Mercato di riparazione", "🔄 January window", "🔄 January window", "🔄 January window"), _tn("Si apre la sessione invernale. Il nome di {$nome} circola nei corridoi dei top club europei.", "The winter window opens. {$nome}'s name is circulating in the corridors of Europe's top clubs.", "The winter window opens. {$nome}'s name is circulating in the corridors of Europe's top clubs.", "The winter window opens. {$nome}'s name is circulating in the corridors of Europe's top clubs."), 'mercato'],
            [_tn("🏋️ Allenamento intensivo", "🏋️ Intense training", "🏋️ Intense training", "🏋️ Intense training"), _tn("Il mister ha intensificato i carichi di lavoro. {$nome} è tra i più diligenti: 'Voglio arrivare al top della forma'.", "The manager has ramped up training loads. {$nome} is among the most diligent: 'I want to reach peak form'.", "The manager has ramped up training loads. {$nome} is among the most diligent: 'I want to reach peak form'.", "The manager has ramped up training loads. {$nome} is among the most diligent: 'I want to reach peak form'."), 'info'],
            [_tn("🌍 Nazionale", "🌍 National team", "🌍 National team", "🌍 National team"), _tn("Il ct della Nazionale ha osservato {$nome} di persona. Una convocazione potrebbe essere vicina.", "The national team coach has watched {$nome} in person. A call-up could be on the horizon.", "The national team coach has watched {$nome} in person. A call-up could be on the horizon.", "The national team coach has watched {$nome} in person. A call-up could be on the horizon."), 'positivo'],
            [_tn("📰 Copertina", "📰 Front page", "📰 Front page", "📰 Front page"), _tn("{$nome} finisce in copertina sul principale quotidiano sportivo. Foto in grande e titolo: 'Il futuro del calcio'.", "{$nome} lands on the front page of the leading sports paper. Big photo, big headline: 'The future of football'.", "{$nome} lands on the front page of the leading sports paper. Big photo, big headline: 'The future of football'.", "{$nome} lands on the front page of the leading sports paper. Big photo, big headline: 'The future of football'."), 'positivo'],
            [_tn("🎁 Sponsor nuovo", "🎁 New sponsor", "🎁 New sponsor", "🎁 New sponsor"), _tn("Un importante brand sportivo ha proposto a {$nome} un accordo di sponsorizzazione. L'entourage sta valutando.", "A major sports brand has approached {$nome} with a sponsorship deal. His entourage is considering it.", "A major sports brand has approached {$nome} with a sponsorship deal. His entourage is considering it.", "A major sports brand has approached {$nome} with a sponsorship deal. His entourage is considering it."), 'info'],
            [_tn("💬 Conferenza stampa", "💬 Press conference", "💬 Press conference", "💬 Press conference"), _tn("In conferenza {$nome} risponde alle domande sul suo futuro: 'Sto benissimo qui, voglio vincere con questa squadra'.", "At the presser, {$nome} responds to questions about his future: 'I'm very happy here, I want to win with this team'.", "At the presser, {$nome} responds to questions about his future: 'I'm very happy here, I want to win with this team'.", "At the presser, {$nome} responds to questions about his future: 'I'm very happy here, I want to win with this team'."), 'info'],
            [_tn("🩺 Check medico", "🩺 Medical check", "🩺 Medical check", "🩺 Medical check"), _tn("Controllo di routine per {$nome}: tutto ok secondo lo staff medico. 'È in perfetta forma fisica'.", "Routine check-up for {$nome}: all clear from the medical staff. 'He's in perfect physical shape'.", "Routine check-up for {$nome}: all clear from the medical staff. 'He's in perfect physical shape'.", "Routine check-up for {$nome}: all clear from the medical staff. 'He's in perfect physical shape'."), 'info'],
            [_tn("🔥 Rivalità accesa", "🔥 Heated rivalry", "🔥 Heated rivalry", "🔥 Heated rivalry"), _tn("Cresce la rivalità con un altro top player della lega. I media adorano questo duello. Chi sarà il migliore a fine anno?", "The rivalry with another league top player is heating up. The media love this duel. Who will be best at year's end?", "The rivalry with another league top player is heating up. The media love this duel. Who will be best at year's end?", "The rivalry with another league top player is heating up. The media love this duel. Who will be best at year's end?"), 'info'],
            [_tn("📣 La stampa parla di te", "📣 The press is talking", "📣 The press is talking", "📣 The press is talking"), _tn("Tre testate sportive diverse citano {$nome} nell'analisi del turno. 'Un giocatore che non si può ignorare', scrive il più autorevole.", "Three different sports outlets mention {$nome} in their match analysis. 'A player you can't ignore', writes the most authoritative.", "Three different sports outlets mention {$nome} in their match analysis. 'A player you can't ignore', writes the most authoritative.", "Three different sports outlets mention {$nome} in their match analysis. 'A player you can't ignore', writes the most authoritative."), 'positivo'],
            [_tn("🧠 Il mister in conferenza", "🧠 Manager in conference", "🧠 Manager in conference", "🧠 Manager in conference"), _tn("Domanda sulla classifica, risposta che riguarda {$nome}: 'Se lui è in condizione, possiamo battere chiunque'. Il mister non ha dubbi.", "Asked about the table, the manager pivots to {$nome}: 'When he's fit, we can beat anyone'. No doubts from the boss.", "Asked about the table, the manager pivots to {$nome}: 'When he's fit, we can beat anyone'. No doubts from the boss.", "Asked about the table, the manager pivots to {$nome}: 'When he's fit, we can beat anyone'. No doubts from the boss."), 'positivo'],
            [_tn("🎰 Quote in discesa", "🎰 Odds tumbling", "🎰 Odds tumbling", "🎰 Odds tumbling"), _tn("Le agenzie di scommesse hanno abbassato le quote scudetto del {$team} dopo le ultime prestazioni. {$nome} è indicato come il fattore X.", "Bookmakers have slashed {$team}'s title odds after recent performances. {$nome} is cited as the X factor.", "Bookmakers have slashed {$team}'s title odds after recent performances. {$nome} is cited as the X factor.", "Bookmakers have slashed {$team}'s title odds after recent performances. {$nome} is cited as the X factor."), 'info'],
            [_tn("🏖️ Vacanza meritata", "🏖️ Well-earned break", "🏖️ Well-earned break", "🏖️ Well-earned break"), _tn("{$nome} ha staccato la spina qualche giorno prima della ripresa. 'Mi ha fatto bene. Sono pronto a dare tutto', ha dichiarato al rientro.", "{$nome} switched off for a few days before the restart. 'It did me good. I'm ready to give everything', he said on return.", "{$nome} switched off for a few days before the restart. 'It did me good. I'm ready to give everything', he said on return.", "{$nome} switched off for a few days before the restart. 'It did me good. I'm ready to give everything', he said on return."), 'info'],
            [_tn("🌿 Stile di vita sano", "🌿 Healthy lifestyle", "🌿 Healthy lifestyle", "🌿 Healthy lifestyle"), _tn("Reportage esclusivo: la dieta rigida di {$nome}, seguita da un nutrizionista di fama internazionale. 'Il fisico è il mio strumento di lavoro'.", "Exclusive feature: {$nome}'s strict diet, overseen by a world-renowned nutritionist. 'My body is my work tool'.", "Exclusive feature: {$nome}'s strict diet, overseen by a world-renowned nutritionist. 'My body is my work tool'.", "Exclusive feature: {$nome}'s strict diet, overseen by a world-renowned nutritionist. 'My body is my work tool'."), 'info'],
            [_tn("🤲 Beneficenza", "🤲 Charity", "🤲 Charity", "🤲 Charity"), _tn("{$nome} ha devoluto parte del suo stipendio alla fondazione locale. 'Avere i piedi per terra è fondamentale per un calciatore'.", "{$nome} has donated part of his wages to the local foundation. 'Staying grounded is essential for a footballer'.", "{$nome} has donated part of his wages to the local foundation. 'Staying grounded is essential for a footballer'.", "{$nome} has donated part of his wages to the local foundation. 'Staying grounded is essential for a footballer'."), 'positivo'],
            [_tn("🏫 Scuola di calcio", "🏫 Football school", "🏫 Football school", "🏫 Football school"), _tn("{$nome} ha visitato la scuola calcio del {$team}. 'I bambini sono il futuro. Spero che uno di loro mi sostituisca un giorno', ha scherzato.", "{$nome} visited {$team}'s football academy. 'Kids are the future. I hope one of them replaces me one day', he joked.", "{$nome} visited {$team}'s football academy. 'Kids are the future. I hope one of them replaces me one day', he joked.", "{$nome} visited {$team}'s football academy. 'Kids are the future. I hope one of them replaces me one day', he joked."), 'positivo'],
            [_tn("🔬 Tecnologia e calcio", "🔬 Tech and football", "🔬 Tech and football", "🔬 Tech and football"), _tn("Il {$team} ha introdotto nuovi sensori GPS per monitorare le prestazioni. {$nome}: 'I dati confermano quello che sentivo: sto migliorando'.", "{$team} has introduced new GPS sensors to monitor performance. {$nome}: 'The data confirms what I felt: I'm improving'.", "{$team} has introduced new GPS sensors to monitor performance. {$nome}: 'The data confirms what I felt: I'm improving'.", "{$team} has introduced new GPS sensors to monitor performance. {$nome}: 'The data confirms what I felt: I'm improving'."), 'info'],
            [_tn("🧘 Meditazione pre-partita", "🧘 Pre-match meditation", "🧘 Pre-match meditation", "🧘 Pre-match meditation"), _tn("Il segreto di {$nome}? Quindici minuti di meditazione prima di ogni gara. 'La testa è importante quanto le gambe nel calcio moderno'.", "The secret of {$nome}? Fifteen minutes of meditation before every match. 'The mind matters as much as the legs in modern football'.", "The secret of {$nome}? Fifteen minutes of meditation before every match. 'The mind matters as much as the legs in modern football'.", "The secret of {$nome}? Fifteen minutes of meditation before every match. 'The mind matters as much as the legs in modern football'."), 'positivo'],
            [_tn("🌐 Viral in 20 paesi", "🌐 Viral in 20 countries", "🌐 Viral in 20 countries", "🌐 Viral in 20 countries"), _tn("Il video del gol di {$nome} della settimana scorsa è diventato virale: 42 milioni di visualizzazioni in meno di 48 ore.", "Last week's goal by {$nome} went viral: 42 million views in under 48 hours.", "Last week's goal by {$nome} went viral: 42 million views in under 48 hours.", "Last week's goal by {$nome} went viral: 42 million views in under 48 hours."), 'positivo'],
            [_tn("⚡ Record di velocità", "⚡ Speed record", "⚡ Speed record", "⚡ Speed record"), _tn("I sensori GPS rivelano: {$nome} ha raggiunto i 36 km/h in campo questa settimana. Tra i più veloci del campionato.", "GPS sensors reveal: {$nome} hit 36 km/h on the pitch this week. Among the fastest in the league.", "GPS sensors reveal: {$nome} hit 36 km/h on the pitch this week. Among the fastest in the league.", "GPS sensors reveal: {$nome} hit 36 km/h on the pitch this week. Among the fastest in the league."), 'positivo'],
            [_tn("🎯 Precisione da manuale", "🎯 Textbook precision", "🎯 Textbook precision", "🎯 Textbook precision"), _tn("Statistiche impietose per gli avversari: {$nome} ha una percentuale di conversione del 32% sui tiri in porta. Da paura.", "Brutal stats for opponents: {$nome} has a 32% conversion rate on shots on target. Frightening.", "Brutal stats for opponents: {$nome} has a 32% conversion rate on shots on target. Frightening.", "Brutal stats for opponents: {$nome} has a 32% conversion rate on shots on target. Frightening."), 'positivo'],
            [_tn("🔔 Notifica di mercato", "🔔 Transfer notification", "🔔 Transfer notification", "🔔 Transfer notification"), _tn("Corriere dello Sport: '{$nome} cercato da tre club di Premier League'. Il {$team} non ha commentato ma filtra ottimismo sul rinnovo.", "Corriere dello Sport: '{$nome} wanted by three Premier League clubs'. {$team} no comment, but renewal optimism filters through.", "Corriere dello Sport: '{$nome} wanted by three Premier League clubs'. {$team} no comment, but renewal optimism filters through.", "Corriere dello Sport: '{$nome} wanted by three Premier League clubs'. {$team} no comment, but renewal optimism filters through."), 'mercato'],
            [_tn("💌 La lettera di un fan", "💌 A fan's letter", "💌 A fan's letter", "💌 A fan's letter"), _tn("{$nome} ha condiviso sui social la lettera commovente di un giovane tifoso. 'È per questi momenti che mi sveglio ogni mattina e mi alleno'.", "{$nome} shared a moving letter from a young fan on social media. 'It's for moments like this that I get up every morning and train'.", "{$nome} shared a moving letter from a young fan on social media. 'It's for moments like this that I get up every morning and train'.", "{$nome} shared a moving letter from a young fan on social media. 'It's for moments like this that I get up every morning and train'."), 'positivo'],
            [_tn("🦁 Capitano per un giorno", "🦁 Captain for a day", "🦁 Captain for a day", "🦁 Captain for a day"), _tn("Assenza del capitano titolare: {$nome} guida la squadra con la fascia al braccio per la prima volta. 'Un onore immenso'.", "The regular captain is absent: {$nome} leads the team with the armband for the first time. 'An immense honour'.", "The regular captain is absent: {$nome} leads the team with the armband for the first time. 'An immense honour'.", "The regular captain is absent: {$nome} leads the team with the armband for the first time. 'An immense honour'."), 'positivo'],
            [_tn("🎪 Testimonial d'eccezione", "🎪 Special ambassador", "🎪 Special ambassador", "🎪 Special ambassador"), _tn("{$nome} testimonial per una campagna di sensibilizzazione contro il bullismo nelle scuole. 'Chi mi bullizzava da piccolo ora mi chiede i selfie'.", "{$nome} is ambassador for an anti-bullying school campaign. 'Those who bullied me as a kid now ask for selfies'.", "{$nome} is ambassador for an anti-bullying school campaign. 'Those who bullied me as a kid now ask for selfies'.", "{$nome} is ambassador for an anti-bullying school campaign. 'Those who bullied me as a kid now ask for selfies'."), 'positivo'],
        ];
        $notizie[] = $eventi[rand(0, count($eventi)-1)];
    }

    // Aggiungi notizie avanzate della partita specifica
    if (!empty($partite) && rand(1,100) <= 75) {
        $prime_partita = $partite[0] ?? [];
        $pm_avv   = $prime_partita['avv']    ?? 'Avversario';
        $pm_gf    = intval($prime_partita['gf'] ?? 0);
        $pm_gs    = intval($prime_partita['gs'] ?? 0);
        $pm_pgol  = intval($prime_partita['player_gol'] ?? 0);
        $pm_pass  = intval($prime_partita['player_assist'] ?? 0);
        $pm_pvoto = floatval($prime_partita['player_voto'] ?? 6.0);
        $pm_esito = $prime_partita['esito'] ?? 'P';
        $pm_gior  = intval($prime_partita['giornata'] ?? 0);
        $pm_casa  = ($prime_partita['isHome'] ?? false) ? _tn('in casa','at home','zu Hause','en casa') : _tn('in trasferta','away','auswärts','fuera');
        $advanced_news = getAdvancedMatchNews($nome, $team, $pm_avv, $pm_pgol, $pm_pass, $pm_pvoto, $pm_esito, $pm_gior, $pm_gf, $pm_gs, $pm_casa, $player_skills);
        foreach ($advanced_news as $an) $notizie[] = $an;
    }

    // Aggiungi notizie extra dal pool esteso
    if (rand(1,100) <= 60) {
        $esito_principale = count($partite) > 0 ? ($partite[0]['esito'] ?? 'P') : 'P';
        $extra_pool = getExtraNewsPool($nome, $team, count($partite) > 0 ? $partite[0]['avv'] : 'Avversario', $match['gol'] ?? 0, $match['assist'] ?? 0, $match['voto'] ?? 6.0, $esito_principale, $overall, $pop, $stelle, $anno, $mese);
        foreach ($extra_pool as $ep) $notizie[] = $ep;
    }

    // ── 5. NOTIZIE EXTRA basate su gol del mese ────────────────────────────────
    if ($tot_gol >= 5) {
        $superscorer_pool = [
            ["🚀 Superstar del mese!", "Cinque o più gol in un mese: {$nome} è una macchina da guerra offensiva. {$team} ringrazia il suo bomber d'eccezione.", 'positivo'],
            ["🎆 Fuochi d'artificio!", "Non si smette di segnare: {$nome} ha già {$tot_gol} gol in questo mese! Una prestazione da antologia.", 'positivo'],
            ["👑 Il Re della classifica marcatori", "{$nome} guida la classifica marcatori con una media impressionante. Questo mese da solo ne ha fatti {$tot_gol}. Leggendario.", 'positivo'],
        ];
        if (!empty($superscorer_pool)) $notizie[] = $superscorer_pool[rand(0, count($superscorer_pool)-1)];
    }
    if ($voto_medio >= 8.0 && $n_partite >= 2) {
        $highrating_pool = [
            ["⭐ Prestazioni da 10", "Voto medio di {$voto_medio} per {$nome}: un mese eccellente. Il pubblico è in delirio ogni volta che tocca palla.", 'positivo'],
            ["🎯 Precisione da campione", "Media voto {$voto_medio}: {$nome} non ha sbagliato un colpo questo mese. Tecnica e continuità da fuoriclasse.", 'positivo'],
        ];
        if (!empty($highrating_pool)) $notizie[] = $highrating_pool[rand(0, count($highrating_pool)-1)];
    }
    if ($voto_medio < 5.5 && $n_partite >= 2) {
        $lowrating_pool = [
            [_tn("😞 Momento no", "😞 Off-form month", "😞 Off-form month", "😞 Off-form month"), _tn("Media voto {$voto_medio}: un mese da dimenticare per {$nome}. Il tecnico lo ha tenuto fuori nell'ultima gara per recuperarlo.", "Avg rating {$voto_medio}: a month to forget for {$nome}. The coach left him out of the last game to help him recover.", "Avg rating {$voto_medio}: a month to forget for {$nome}. The coach left him out of the last game to help him recover.", "Avg rating {$voto_medio}: a month to forget for {$nome}. The coach left him out of the last game to help him recover."), 'negativo'],
            [_tn("💭 Testa altrove?", "💭 Head elsewhere?", "💭 Head elsewhere?", "💭 Head elsewhere?"), _tn("Non è il {$nome} che conosciamo: media {$voto_medio} e tanti errori individuali. Serve ritrovare la forma migliore.", "This isn't the {$nome} we know: avg {$voto_medio} and too many individual errors. He needs to rediscover top form.", "This isn't the {$nome} we know: avg {$voto_medio} and too many individual errors. He needs to rediscover top form.", "This isn't the {$nome} we know: avg {$voto_medio} and too many individual errors. He needs to rediscover top form."), 'negativo'],
        ];
        if (!empty($lowrating_pool)) $notizie[] = $lowrating_pool[rand(0, count($lowrating_pool)-1)];
    }
    // Assist hero month
    if ($tot_assist >= 4) {
        $assist_hero_pool = [
            [_tn("🎪 Il Mago degli Assist", "🎪 The Assist Wizard", "🎪 The Assist Wizard", "🎪 The Assist Wizard"), _tn("{$tot_assist} passaggi decisivi in {$n_partite} partite: {$nome} è il cervello della {$team} questo mese. Visione di gioco sopraffina.", "{$tot_assist} key passes in {$n_partite} matches: {$nome} is the brain of {$team} this month. Superb vision of the game.", "{$tot_assist} key passes in {$n_partite} matches: {$nome} is the brain of {$team} this month. Superb vision of the game.", "{$tot_assist} key passes in {$n_partite} matches: {$nome} is the brain of {$team} this month. Superb vision of the game."), 'positivo'],
            [_tn("🔑 Le chiavi del gioco", "🔑 The keys to the game", "🔑 The keys to the game", "🔑 The keys to the game"), _tn("Assist, assist, assist: {$nome} ne sforna {$tot_assist} questo mese. 'Preferisco fare gol, ma se i compagni segnano sono felice lo stesso'.", "Assist, assist, assist: {$nome} produces {$tot_assist} this month. 'I prefer scoring, but if my team-mates score I\'m just as happy'.", "Assist, assist, assist: {$nome} produces {$tot_assist} this month. 'I prefer scoring, but if my team-mates score I\'m just as happy'.", "Assist, assist, assist: {$nome} produces {$tot_assist} this month. 'I prefer scoring, but if my team-mates score I\'m just as happy'."), 'positivo'],
        ];
        if (!empty($assist_hero_pool)) $notizie[] = $assist_hero_pool[rand(0, count($assist_hero_pool)-1)];
    }
    // Milestone check (random extra)
    if (rand(1, 100) <= 25) {
        $milestone_pool = [
            [_tn("📆 La carriera cresce", "📆 Career on the rise", "📆 Career on the rise", "📆 Career on the rise"), _tn("Stagione dopo stagione, {$nome} continua a migliorare. 'Ogni anno imparo qualcosa di nuovo. Il calcio è una scuola infinita'.", "Season after season, {$nome} keeps improving. 'Every year I learn something new. Football is an endless school'.", "Season after season, {$nome} keeps improving. 'Every year I learn something new. Football is an endless school'.", "Season after season, {$nome} keeps improving. 'Every year I learn something new. Football is an endless school'."), 'info'],
            [_tn("🔭 Il futuro è brillante", "🔭 The future is bright", "🔭 The future is bright", "🔭 The future is bright"), _tn("I pronostici degli esperti sono unanimi: {$nome} ha ancora molto da dare. 'Il picco? Deve ancora arrivare', scrivono gli analisti.", "Expert forecasts are unanimous: {$nome} still has plenty to give. 'The peak? It\'s still to come', write the analysts.", "Expert forecasts are unanimous: {$nome} still has plenty to give. 'The peak? It\'s still to come', write the analysts.", "Expert forecasts are unanimous: {$nome} still has plenty to give. 'The peak? It\'s still to come', write the analysts."), 'positivo'],
            [_tn("📰 Numeri che parlano", "📰 The numbers speak", "📰 The numbers speak", "📰 The numbers speak"), _tn("Le statistiche non mentono: {$nome} è tra i migliori della lega per xG, xA e xOvR. Un profilo da grande campione.", "Stats don\'t lie: {$nome} is among the best in the league for xG, xA and xOvR. The profile of a true champion.", "Stats don\'t lie: {$nome} is among the best in the league for xG, xA and xOvR. The profile of a true champion.", "Stats don\'t lie: {$nome} is among the best in the league for xG, xA and xOvR. The profile of a true champion."), 'info'],
            [_tn("🎙️ La voce del tecnico", "🎙️ The coach speaks", "🎙️ The coach speaks", "🎙️ The coach speaks"), _tn("Il mister in conferenza stampa: 'Con {$nome} in campo cambiano le dinamiche di ogni partita. È il nostro riferimento tecnico e mentale'.", "The coach at the press conference: 'With {$nome} on the pitch the dynamics of every match change. He\'s our technical and mental reference point'.", "The coach at the press conference: 'With {$nome} on the pitch the dynamics of every match change. He\'s our technical and mental reference point'.", "The coach at the press conference: 'With {$nome} on the pitch the dynamics of every match change. He\'s our technical and mental reference point'."), 'positivo'],
            [_tn("🔮 Il prossimo step", "🔮 The next step", "🔮 The next step", "🔮 The next step"), _tn("Gli osservatori sono d'accordo: {$nome} è pronto per il salto di qualità. La domanda non è se, ma quando.", "Observers agree: {$nome} is ready to make the quality leap. The question isn\'t if, but when.", "Observers agree: {$nome} is ready to make the quality leap. The question isn\'t if, but when.", "Observers agree: {$nome} is ready to make the quality leap. The question isn\'t if, but when."), 'info'],
        ];
        if (!empty($milestone_pool)) $notizie[] = $milestone_pool[rand(0, count($milestone_pool)-1)];
    }

    // Restituisce l'array invece di scrivere nel DB
    return $notizie;
}

// ── Public wrapper: generates news in both IT and EN, saves bilingual ────────
function generaNotizieDinamiche($db, $player_id, $p, $match, $lega_result, $player_skills = []) {
    $anno = $p['anno_corrente'];
    $mese = $p['mese_corrente'];

    // Use a deterministic seed so both IT and EN calls make identical random choices
    // Seed is based on player+anno+mese so it's unique per month but reproducible
    $seed = crc32("gs_{$player_id}_{$anno}_{$mese}");

    // Generate Italian version
    $GLOBALS['_gsLangOverride'] = 'it';
    mt_srand($seed);
    $notizie_it = _buildNotizie($p, $match, $lega_result, $player_skills);

    // Generate English version with identical random sequence
    $GLOBALS['_gsLangOverride'] = 'en';
    mt_srand($seed);
    $notizie_en = _buildNotizie($p, $match, $lega_result, $player_skills);

    // Generate German version with identical random sequence
    $GLOBALS['_gsLangOverride'] = 'de';
    mt_srand($seed);
    $notizie_de = _buildNotizie($p, $match, $lega_result, $player_skills);

    // Generate Spanish version with identical random sequence
    $GLOBALS['_gsLangOverride'] = 'es';
    mt_srand($seed);
    $notizie_es = _buildNotizie($p, $match, $lega_result, $player_skills);

    // Restore
    $GLOBALS['_gsLangOverride'] = null;
    mt_srand(); // restore random seed

    $count = min(count($notizie_it), count($notizie_en), count($notizie_de), count($notizie_es));
    for ($i = 0; $i < $count; $i++) {
        $it = $notizie_it[$i];
        $en = $notizie_en[$i];
        $de = $notizie_de[$i];
        $es = $notizie_es[$i];
        generaNotizia($db, $player_id, $anno, $mese,
            $it[0], $it[1], $it[2],  // titolo_it, testo_it, tipo
            $en[0], $en[1],           // titolo_en, testo_en
            $de[0], $de[1],           // titolo_de, testo_de
            $es[0], $es[1]            // titolo_es, testo_es
        );
    }
}

function getPlayerSkills($db, $player_id) {
    try {
        $stmt = $db->prepare("SELECT skill_id, level FROM skill_boosts WHERE player_id=? AND level > 0");
        $stmt->execute([$player_id]);
        $skills = [];
        foreach ($stmt->fetchAll() as $row) {
            $skills[$row['skill_id']] = intval($row['level']);
        }
        return $skills;
    } catch (Exception $e) {
        return [];
    }
}

function getGolType($p, $skills) {
    // Build pool of possible gol types based on unlocked skills
    // Each entry: [type_key, weight, description_template]
    $pool = [];
    $nome = $p['player_name'];

    // Base types always available
    $pool[] = ['base_dx', 10, null]; // handled separately

    // Tiro potente (tiro_potente >= 1)
    if (isset($skills['tiro_potente'])) {
        $w = $skills['tiro_potente'] >= 2 ? 25 : 15;
        $pool[] = ['tiro_potente', $w, [
            "con un tiro potentissimo che ha bucato il portiere",
            "con una cannonata da fuori area impossibile da fermare",
            "con un destro/sinistro di potenza pazzesca da dentro l'area"
        ]];
    }
    // Tiro a giro / trivella (tiro_giro >= 1)
    if (isset($skills['tiro_giro'])) {
        $w = $skills['tiro_giro'] >= 2 ? 22 : 14;
        $pool[] = ['tiro_giro', $w, [
            "con un tiro angolato a giro sul secondo palo",
            "con una trivella sul palo lontano, traiettoria imprendibile",
            "con un tiro a giro all'incrocio dei pali di rara bellezza"
        ]];
    }
    // Colpo di testa (colpo_testa >= 1)
    if (isset($skills['colpo_testa'])) {
        $w = $skills['colpo_testa'] >= 2 ? 20 : 12;
        $pool[] = ['colpo_testa', $w, [
            "di testa, saltando sopra a tutti i difensori sul cross",
            "con un colpo di testa imperioso che non ha lasciato scampo",
            "di testa su corner, dominando il difensore in elevazione"
        ]];
    }
    // Turbo / velocista -> gol in velocità
    if (isset($skills['turbo']) || isset($skills['velocista'])) {
        $w = isset($skills['turbo']) ? 20 : 12;
        $pool[] = ['velocita', $w, [
            "con uno scatto fulmineo che ha bruciato la difesa in velocità",
            "dopo aver seminato tre difensori in ripartenza fulminante",
            "con una corsa velocissima e un tiro a botta sicura"
        ]];
    }
    // Gol di Rabona (gol_rabona >= 1)
    if (isset($skills['gol_rabona'])) {
        $pool[] = ['rabona', 18, [
            "con una RABONA da urlo che ha lasciato tutti di stucco!",
            "con una rabona leggendaria: il pubblico è esploso in un boato!"
        ]];
    }
    // Istinto del goleador
    if (isset($skills['istinto'])) {
        $pool[] = ['istinto', 15, [
            "con il suo istinto da goleador puro: palla sul piede, gol",
            "trovandosi nel posto giusto al momento giusto — istinto puro"
        ]];
    }
    // Da punizione (freddezza >= 2)
    if (isset($skills['freddezza']) && $skills['freddezza'] >= 2) {
        $pool[] = ['punizione', 14, [
            "con un gol direttamente da calcio di punizione, potente e angolato",
            "da punizione, superando la barriera con un tiro preciso come un laser"
        ]];
    }

    // Weighted random
    $total = array_sum(array_column($pool, 1));
    $rand = rand(1, $total);
    $cum = 0;
    foreach ($pool as $entry) {
        $cum += $entry[1];
        if ($rand <= $cum) {
            if ($entry[0] === 'base_dx' || $entry[2] === null) return null; // use default
            $descs = $entry[2];
            return ['type' => $entry[0], 'desc' => !empty($descs) ? $descs[rand(0, count($descs)-1)] : ''];
        }
    }
    return null;
}

function simulateMatch($p, $skills = []) {
    $team_stars = intval($p['team_stelle'] ?? 1);
    $form  = ($p['morale'] + $p['energia']) / 2;

    // Bonus piede forte/debole
    $piede_forte = intval($p['piede_forte'] ?? 3);
    $piede_bonus = ($piede_forte / 5) * 5; // up to +5 bonus to power

    $power = min(100, ($p['overall']*0.5) + ($form*0.3) + ($team_stars*10*0.2) + $piede_bonus);
    $gol=0; $assist=0;
    for ($i=0;$i<4;$i++) if (rand(1,100)<$power*0.4) $gol++;
    for ($i=0;$i<3;$i++) if (rand(1,100)<$power*0.3) $assist++;

    // Formula voto:
    // - Base 5.5: un professionista parte da "sufficiente"
    // - Gol vale +1.0: segna 2 gol → almeno 7.5 garantito
    // - Assist vale +0.6
    // - Rumore casuale ridotto (±0.56) così non azzera mai una doppietta
    // - OVR alto = leggero bonus costanza; bassa forma = bias negativo
    $ovr_factor  = ($p['overall'] - 50) / 75.0; // 0.0–1.0
    $noise       = rand(-8, 8) * 0.07;
    if ($form < 50) $noise -= 0.3; // penalità se forma scarsa
    $voto = round(5.5 + $gol*1.0 + $assist*0.6 + $noise + $ovr_factor*0.5, 1);
    $voto = max(4.5, min(10.0, $voto));
    $stipendio = $p['overall']*$p['moltiplicatore_stipendio']*100+$gol*1500+$assist*800;
    $pop_gain  = $gol*5+$assist*2+($voto>7?5:0);
    $morale    = ($voto>=7)?rand(10,25):rand(-8,0);
    $perf_word = _tn('stellare','stellar','glänzend','estelar');
    $perf_poor = _tn('opaca','poor','schwach','floja');
    $perf = $voto >= 7 ? $perf_word : $perf_poor;
    $descs = [
        _tn("{$gol} gol e {$assist} assist! Voto: {$voto}",
            "{$gol} goal(s) and {$assist} assist(s)! Rating: {$voto}",
            "{$gol} Tor/Tore und {$assist} Vorlage(n)! Bewertung: {$voto}",
            "{$gol} gol y {$assist} asistencia(s)! Valoración: {$voto}"),
        _tn("Prestazione {$perf} – {$gol} gol. Voto {$voto}",
            "{$perf} performance – {$gol} goal(s). Rating {$voto}",
            "{$perf} Leistung – {$gol} Tor/Tore. Bewertung {$voto}",
            "Actuación {$perf} – {$gol} gol(es). Valoración {$voto}"),
    ];

    // Determine gol type for news
    $gol_type = null;
    if ($gol > 0 && !empty($skills)) {
        $gol_type = getGolType($p, $skills);
    }

    return ['gol'=>$gol,'assist'=>$assist,'voto'=>$voto,'stipendio'=>round($stipendio),'pop_gain'=>$pop_gain,'morale'=>$morale,'desc'=>$descs[rand(0,1)],'gol_type'=>$gol_type];
}

function getBonusStruttura($livello) {
    if (!$livello) return ['bonus_allenamento'=>0,'bonus_crescita'=>0,'riduzione_infortuni'=>0];
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM strutture WHERE livello=?");
    $stmt->execute([$livello]);
    return $stmt->fetch() ?: ['bonus_allenamento'=>0,'bonus_crescita'=>0,'riduzione_infortuni'=>0];
}

function calcPalloneDoro($db, $player_id, $p, $overall, $gol_carriera, $assist_carriera) {
    $anno = $p['anno_corrente'];
    $stmt = $db->prepare("SELECT SUM(gol) as gol,SUM(assist) as assist,AVG(voto) as voto,COUNT(*) as partite_reali FROM log_mensile WHERE player_id=? AND anno=? AND avv!='' AND avv!='__riepilogo'");
    $stmt->execute([$player_id,$anno]);
    $stats = $stmt->fetch();
    $lega_bonus = (intval($p['lega_livello']??2)==1)?20:0;
    $score = ($stats['gol']??0)*3+($stats['assist']??0)*2+($stats['voto']??6)*5+$overall*0.5+$p['popolarita']*0.3+$lega_bonus;
    $pallone_pos=0;$msg='';$won=0;
    if ($score>=220)     {$pallone_pos=1;          $msg="🏆 HAI VINTO IL PALLONE D'ORO!!!";$won=1;}
    elseif ($score>=175) {$pallone_pos=rand(2,3);  $msg="🥈 Finalista al Pallone d'Oro (#{$pallone_pos})!";}
    elseif ($score>=130) {$pallone_pos=rand(4,10); $msg="⭐ Top 10 al Pallone d'Oro!";}
    elseif ($score>=90)  {$pallone_pos=rand(11,30);$msg="Top 30 al Pallone d'Oro.";}
    else                 {$msg="Non nominato al Pallone d'Oro quest'anno.";}
    $db->prepare("INSERT IGNORE INTO stagioni (player_id,anno,gol,assist,partite,media_voto,pallone_doro_pos,team_nome,lega_nome) VALUES(?,?,?,?,?,?,?,?,?)")
       ->execute([$player_id,$anno,$stats['gol']??0,$stats['assist']??0,intval($stats['partite_reali']??0),round($stats['voto']??6,2),$pallone_pos,$p['team_nome_full']??'',$p['lega_nome']??'']);
    if ($won) $db->prepare("UPDATE players SET palloni_doro=palloni_doro+1 WHERE id=?")->execute([$player_id]);
    return ['pos'=>$pallone_pos,'msg'=>$msg,'score'=>round($score)];
}

function calcEpilogo($db, $player_id) {
    $stmt = $db->prepare("SELECT * FROM players WHERE id=?");
    $stmt->execute([$player_id]);
    $p = $stmt->fetch();
    $score = $p['palloni_doro']*20+$p['trofei']*5+$p['gol_carriera']*0.1+$p['popolarita'];
    if ($score>=80) return "Sei una LEGGENDA MONDIALE! 🌟";
    if ($score>=50) return "Grande carriera! Un Grande Bomber! ⚽";
    if ($score>=25) return "Icona nazionale, rispettato in patria. 🏴";
    return "Talento incompiuto... ma la strada è stata bella. 💫";
}

function buyStruttura($player_id, $data) {
    $db = getDB();
    $p  = getPlayerData($player_id);
    $livello = intval($data['livello']??1);
    $stmt = $db->prepare("SELECT * FROM strutture WHERE livello=?"); $stmt->execute([$livello]);
    $struttura = $stmt->fetch();
    if (!$struttura)                         {echo json_encode(['error'=>t('Struttura non trovata','Facility not found')]);return;}
    if ($p['struttura_livello']>=$livello)   {echo json_encode(['error'=>t('Hai già questo livello','You already have this level')]);return;}
    if ($p['struttura_livello']<$livello-1)  {echo json_encode(['error'=>t('Acquista prima il livello precedente','Buy the previous level first')]);return;}
    if ($p['soldi']<$struttura['costo'])     {echo json_encode(['error'=>t('Soldi insufficienti','Insufficient funds')]);return;}
    $db->prepare("UPDATE players SET struttura_livello=?,soldi=soldi-? WHERE id=?")->execute([$livello,$struttura['costo'],$player_id]);
    echo json_encode(['success'=>true,'msg'=>t("Costruito: ","Built: ","Gebaut: ","Construido: ").$struttura['nome']."!"]);
}

function changeTeam($player_id, $data) {
    $db = getDB();
    $p  = getPlayerData($player_id);

    // Un solo trasferimento per stagione
    if ((int)($p['trasferimento_anno'] ?? 0) >= 1) {
        echo json_encode(['error' => t('Hai già effettuato un trasferimento questa stagione.','You have already transferred this season.','Du hast diese Saison bereits einen Transfer durchgeführt.','Ya has realizado un fichaje esta temporada.')]);
        return;
    }

    $team_id = intval($data['team_id']??1);
    $stmt = $db->prepare("SELECT t.*,l.livello as lega_livello FROM teams t JOIN leghe l ON t.lega_id=l.id WHERE t.id=?");
    $stmt->execute([$team_id]);
    $team = $stmt->fetch();
    if (!$team) {echo json_encode(['error'=>t('Squadra non trovata','Team not found','Team nicht gefunden','Equipo no encontrado')]);return;}

    // Scala adattata al nuovo cap 125: 1*=55 2*=75 3*=90 4*=105 5*=120
    $stelle_map = [1=>55, 2=>75, 3=>90, 4=>105, 5=>120];
    $min_overall = $stelle_map[$team['stelle']] ?? 55;

    // Applica sconto OVR agente
    $agent = getAgentBonus($db, $player_id);
    $sconto = $agent['bonus_ovr_sconto'] ?? 0;
    $min_overall_scontato = max(55, intval($min_overall * (1 - $sconto/100)));

    if ($p['overall'] < $min_overall_scontato && $team['stelle'] > 1) {
        $msg_sconto_it = $sconto > 0 ? " (ridotto da {$min_overall} grazie all'agente -".$sconto."%)" : "";
        $msg_sconto_en = $sconto > 0 ? " (reduced from {$min_overall} thanks to agent -".$sconto."%)" : "";
        $msg_sconto_de = $sconto > 0 ? " (reduziert von {$min_overall} dank Agent -".$sconto."%)" : "";
        $msg_sconto_es = $sconto > 0 ? " (reducido de {$min_overall} gracias al agente -".$sconto."%)" : "";
        echo json_encode(['error'=> t(
            "Overall insufficiente. Serve almeno {$min_overall_scontato}{$msg_sconto_it}",
            "Overall too low. Need at least {$min_overall_scontato}{$msg_sconto_en}",
            "Overall zu niedrig. Mindestens {$min_overall_scontato}{$msg_sconto_de} erforderlich",
            "Overall insuficiente. Se necesitan al menos {$min_overall_scontato}{$msg_sconto_es}"
        )]);
        return;
    }
    $db->prepare("UPDATE players SET team_id=?, trasferimento_anno=1 WHERE id=?")->execute([$team_id,$player_id]);
    echo json_encode(['success'=>true,'msg'=>t("Trasferito a ","Transferred to ","Zu ","Fichado por ").$team['nome']."!"]);
}

// ── SKILL TREE BOOST FUNCTIONS ──

/**
 * Applica il boost di una skill alle stat del giocatore nel DB.
 * Logica: ogni skill ha un boost TOTALE per livello (boostPerLv = [2,4,7]).
 * Il DB tiene traccia del boost già applicato per skill (skill_boosts.amount = boost totale attuale).
 * La differenza (nuovo_totale - vecchio_totale) viene applicata alla stat.
 * Così si può chiamare N volte senza duplicare i boost.
 *
 * data: { skill_id, stat, total_boost, level }
 */
function applySkillBoost($player_id, $data) {
    $db        = getDB();
    $skill_id  = trim($data['skill_id'] ?? '');
    $stat      = trim($data['stat']     ?? '');
    $new_total = intval($data['total_boost'] ?? 0); // boost TOTALE al livello corrente
    $level     = intval($data['level']  ?? 1);

    $allowed = ['tiro','velocita','dribbling','fisico','mentalita'];
    if (!in_array($stat, $allowed)) {
        echo json_encode(['error' => t("Stat non valida: $stat", "Invalid stat: $stat")]); return;
    }
    if (empty($skill_id)) {
        echo json_encode(['error' => t('skill_id mancante','skill_id missing')]); return;
    }
    if ($new_total < 0 || $new_total > 50) {
        echo json_encode(['error' => t("Boost fuori range: $new_total", "Boost out of range: $new_total")]); return;
    }

    // Leggi boost precedente già applicato per questa skill
    $stmt = $db->prepare("SELECT amount FROM skill_boosts WHERE player_id=? AND skill_id=?");
    $stmt->execute([$player_id, $skill_id]);
    $existing = $stmt->fetch();
    $old_total = $existing ? intval($existing['amount']) : 0;

    $delta = $new_total - $old_total; // quanto aggiungere (può essere 0 se già applicato)

    // Leggi stat corrente del giocatore
    $stmt2 = $db->prepare("SELECT tiro, velocita, dribbling, fisico, mentalita FROM players WHERE id=?");
    $stmt2->execute([$player_id]);
    $p = $stmt2->fetch();
    if (!$p) { echo json_encode(['error' => t('Giocatore non trovato','Player not found')]); return; }

    $currentStat = intval($p[$stat]);
    $newStat     = min(125, max(1, $currentStat + $delta));

    // Ricalcola overall
    $statMap = ['tiro'=>$p['tiro'],'velocita'=>$p['velocita'],'dribbling'=>$p['dribbling'],'fisico'=>$p['fisico'],'mentalita'=>$p['mentalita']];
    $statMap[$stat] = $newStat;
    $newOverall = intval(array_sum($statMap) / 5);

    // Aggiorna giocatore solo se c'è un delta reale
    if ($delta !== 0) {
        $db->prepare("UPDATE players SET {$stat}=?, overall=? WHERE id=?")
           ->execute([$newStat, $newOverall, $player_id]);
    }

    // Salva/aggiorna il boost applicato per questa skill
    $db->prepare("REPLACE INTO skill_boosts (player_id, skill_id, stat, amount, level) VALUES (?,?,?,?,?)")
       ->execute([$player_id, $skill_id, $stat, $new_total, $level]);

    // ── Aggiorna piede_forte / piede_debole / livello_skill in base alle skill sbloccate ──
    // Conta quante skill offensive del tiro/fisico sono sbloccate e a che livello
    $stmt_all = $db->prepare("SELECT skill_id, level FROM skill_boosts WHERE player_id=? AND level > 0");
    $stmt_all->execute([$player_id]);
    $all_skills = [];
    foreach ($stmt_all->fetchAll() as $row) $all_skills[$row['skill_id']] = intval($row['level']);

    // Piede forte: base 3/5. Sale con tiro_potente (lv2->4, lv3->5) o tiro_giro lv2
    $piede_forte = 3;
    if (isset($all_skills['tiro_potente'])) {
        if ($all_skills['tiro_potente'] >= 3) $piede_forte = 5;
        elseif ($all_skills['tiro_potente'] >= 2) $piede_forte = 4;
    }
    if (isset($all_skills['tiro_giro']) && $all_skills['tiro_giro'] >= 2) $piede_forte = max($piede_forte, 5);
    if (isset($all_skills['gol_rabona'])) $piede_forte = 5;

    // Piede debole: base 2/5. Sale con fredezza lv2->3, lv3->4; istinto lv2->5
    $piede_debole = 2;
    if (isset($all_skills['freddezza'])) {
        if ($all_skills['freddezza'] >= 3) $piede_debole = 4;
        elseif ($all_skills['freddezza'] >= 2) $piede_debole = 3;
    }
    if (isset($all_skills['istinto']) && $all_skills['istinto'] >= 2) $piede_debole = max($piede_debole, 5);

    // Livello skill: conta skill_id sbloccate
    $num_skills = count($all_skills);
    if ($num_skills >= 10) $livello_skill = 5;
    elseif ($num_skills >= 7) $livello_skill = 4;
    elseif ($num_skills >= 4) $livello_skill = 3;
    elseif ($num_skills >= 2) $livello_skill = 2;
    else $livello_skill = 2;

    $db->prepare("UPDATE players SET piede_forte=?, piede_debole=?, livello_skill=? WHERE id=?")
       ->execute([$piede_forte, $piede_debole, $livello_skill, $player_id]);

    echo json_encode([
        'success'      => true,
        'delta'        => $delta,
        'new_val'      => $newStat,
        'new_overall'  => $newOverall,
        'stat'         => $stat,
        'piede_forte'  => $piede_forte,
        'piede_debole' => $piede_debole,
        'livello_skill'=> $livello_skill,
    ]);
}

/**
 * Restituisce tutti i boost skill applicati per questo giocatore.
 * Usato dal frontend per sincronizzare lo stato.
 */
function getSkillBoosts($player_id) {
    $db = getDB();
    $stmt = $db->prepare("SELECT skill_id, stat, amount, level FROM skill_boosts WHERE player_id=?");
    $stmt->execute([$player_id]);
    $rows = $stmt->fetchAll();
    $boosts = [];
    foreach ($rows as $r) {
        $boosts[$r['skill_id']] = [
            'stat'   => $r['stat'],
            'amount' => intval($r['amount']), // boost totale applicato
            'level'  => intval($r['level']),
        ];
    }
    echo json_encode(['success'=>true, 'boosts'=>$boosts]);
}
