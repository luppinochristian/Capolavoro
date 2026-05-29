<?php
/**
 * ============================================================
 * db.php — Configurazione database e funzioni di utilità globali
 * ============================================================
 * Questo file è il cuore del backend: viene incluso da tutti
 * gli altri file PHP tramite require_once.
 *
 * Responsabilità principali:
 *  - getDB(): connessione singleton al database MySQL
 *  - Creazione automatica di tutte le tabelle al primo avvio
 *  - Popolamento iniziale dei dati di gioco
 *  - getAuthPlayerId(): verifica token e restituisce l'ID giocatore
 *  - createAccountToken(): genera token di sessione sicuro
 *  - getLang(): rileva la lingua dalla richiesta HTTP (IT/EN)
 *  - t() / _tn(): helper per stringhe bilingue inline
 *  - sendMail(): invio email tramite mail() di sistema
 *  - _getCachedBody(): decodifica e mette in cache il body JSON
 * ============================================================
 */
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// ── Configurazione MySQL (sovrascrivibile da variabili d'ambiente) ──
define('MYSQL_HOST', getenv('MYSQL_HOST') ?: 'db');
define('MYSQL_PORT', getenv('MYSQL_PORT') ?: '3306');
define('MYSQL_DB',   getenv('MYSQL_DB')   ?: 'golden_striker');
define('MYSQL_USER', getenv('MYSQL_USER') ?: 'gs_user');
define('MYSQL_PASS', getenv('MYSQL_PASS') ?: 'gs_password');

// ── Schema version: incrementare quando si aggiungono migration ──
define('SCHEMA_VERSION', 5);

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . MYSQL_HOST
             . ';port=' . MYSQL_PORT
             . ';dbname=' . MYSQL_DB
             . ';charset=utf8mb4';
        $attempts = 0;
        while (true) {
            try {
                $pdo = new PDO($dsn, MYSQL_USER, MYSQL_PASS, [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
                ]);
                initSchema($pdo);
                break;
            } catch (PDOException $e) {
                $attempts++;
                if ($attempts >= 5) {
                    http_response_code(500);
                    die(json_encode(['error' => 'DB: ' . $e->getMessage()]));
                }
                sleep(2);
            }
        }
    }
    return $pdo;
}

function initSchema($pdo) {
    // ── Tabella versione schema: evita di rieseguire migration ad ogni request ──
    $pdo->exec("CREATE TABLE IF NOT EXISTS schema_version (
        version INT NOT NULL PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $current = (int)($pdo->query("SELECT COALESCE(MAX(version),0) as v FROM schema_version")->fetch()['v'] ?? 0);
    if ($current >= SCHEMA_VERSION) return; // nessuna migration da eseguire

    // ── Creazione tabelle ──────────────────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        account_id INT NOT NULL DEFAULT 0,
        career_name VARCHAR(255) NOT NULL DEFAULT 'Carriera',
        player_name VARCHAR(255) NOT NULL,
        gender VARCHAR(20) DEFAULT 'male',
        nationality VARCHAR(100) DEFAULT 'Italy',
        age INT DEFAULT 16,
        overall INT DEFAULT 65,
        tiro INT DEFAULT 60,
        velocita INT DEFAULT 60,
        dribbling INT DEFAULT 60,
        fisico INT DEFAULT 60,
        mentalita INT DEFAULT 60,
        popolarita INT DEFAULT 10,
        energia INT DEFAULT 100,
        morale INT DEFAULT 75,
        soldi DOUBLE DEFAULT 10000.00,
        gol_carriera INT DEFAULT 0,
        assist_carriera INT DEFAULT 0,
        palloni_doro INT DEFAULT 0,
        trofei INT DEFAULT 0,
        struttura_livello INT DEFAULT 0,
        team_id INT DEFAULT 1,
        mese_corrente INT DEFAULT 9,
        anno_corrente INT DEFAULT 1,
        infortuni_mesi INT DEFAULT 0,
        trasferimento_anno INT DEFAULT 0,
        piede_forte INT DEFAULT 3,
        piede_debole INT DEFAULT 2,
        piede_forte_lato VARCHAR(5) DEFAULT 'dx',
        piede_debole_lato VARCHAR(5) DEFAULT 'sx',
        livello_skill INT DEFAULT 2,
        skin_hair VARCHAR(100) DEFAULT 'short_black',
        skin_color VARCHAR(50) DEFAULT 'medium',
        eye_color VARCHAR(50) DEFAULT 'brown',
        hair_color VARCHAR(20) DEFAULT '#1a1a1a',
        ai_avatar MEDIUMTEXT DEFAULT NULL,
        ai_prompt TEXT DEFAULT NULL,
        champions_premio_pagato INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS nazioni (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        bandiera VARCHAR(20) DEFAULT '🌍'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS leghe (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        nazione_id INT NOT NULL,
        livello INT DEFAULT 1,
        FOREIGN KEY (nazione_id) REFERENCES nazioni(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        stelle INT DEFAULT 1,
        popolarita INT DEFAULT 20,
        budget INT DEFAULT 1000000,
        moltiplicatore_stipendio DOUBLE DEFAULT 1.0,
        obiettivo VARCHAR(100) DEFAULT 'Salvezza',
        probabilita_trofeo INT DEFAULT 5,
        lega_id INT DEFAULT 1,
        ovr INT DEFAULT 60,
        FOREIGN KEY (lega_id) REFERENCES leghe(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS stagioni (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        anno INT NOT NULL,
        gol INT DEFAULT 0,
        assist INT DEFAULT 0,
        partite INT DEFAULT 0,
        media_voto DOUBLE DEFAULT 6.0,
        trofei_vinti INT DEFAULT 0,
        pallone_doro_pos INT DEFAULT 0,
        stipendio_totale DOUBLE DEFAULT 0,
        team_nome VARCHAR(255) DEFAULT '',
        lega_nome VARCHAR(255) DEFAULT '',
        UNIQUE KEY uq_player_anno (player_id, anno),
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS log_mensile (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        anno INT NOT NULL,
        mese INT NOT NULL,
        azione TEXT,
        risultato TEXT,
        gol INT DEFAULT 0,
        assist INT DEFAULT 0,
        voto DOUBLE DEFAULT 6.0,
        evento_speciale TEXT,
        avv VARCHAR(255) DEFAULT '',
        esito VARCHAR(255) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS strutture (
        livello INT PRIMARY KEY,
        nome VARCHAR(255),
        costo INT,
        bonus_allenamento INT DEFAULT 0,
        bonus_crescita INT DEFAULT 0,
        riduzione_infortuni INT DEFAULT 0,
        descrizione TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS calendario (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lega_id INT NOT NULL,
        anno INT NOT NULL,
        giornata INT NOT NULL,
        mese INT NOT NULL,
        home_id INT NOT NULL,
        away_id INT NOT NULL,
        giocata INT DEFAULT 0,
        UNIQUE KEY uq_cal (lega_id, anno, home_id, away_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS classifica (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT NOT NULL,
        lega_id INT NOT NULL,
        anno INT NOT NULL,
        punti INT DEFAULT 0,
        vittorie INT DEFAULT 0,
        pareggi INT DEFAULT 0,
        sconfitte INT DEFAULT 0,
        gol_fatti INT DEFAULT 0,
        gol_subiti INT DEFAULT 0,
        partite_giocate INT DEFAULT 0,
        UNIQUE KEY uq_team_anno (team_id, anno),
        FOREIGN KEY (team_id) REFERENCES teams(id),
        FOREIGN KEY (lega_id) REFERENCES leghe(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS champions_cup (
        id INT AUTO_INCREMENT PRIMARY KEY,
        anno INT NOT NULL,
        team_id INT NOT NULL,
        fase VARCHAR(50) DEFAULT 'gironi',
        eliminato INT DEFAULT 0,
        gruppo VARCHAR(10) DEFAULT NULL,
        posizione_gruppo INT DEFAULT 0,
        punti_gruppo INT DEFAULT 0,
        vittorie_gruppo INT DEFAULT 0,
        pareggi_gruppo INT DEFAULT 0,
        sconfitte_gruppo INT DEFAULT 0,
        gol_fatti_gruppo INT DEFAULT 0,
        gol_subiti_gruppo INT DEFAULT 0,
        partite_gruppo INT DEFAULT 0,
        UNIQUE KEY uq_team_anno (team_id, anno),
        FOREIGN KEY (team_id) REFERENCES teams(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS agente (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL UNIQUE,
        livello INT DEFAULT 0,
        nome VARCHAR(255) DEFAULT '',
        acquistato_anno INT DEFAULT 0,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS notizie (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        anno INT NOT NULL,
        mese INT NOT NULL,
        titolo VARCHAR(500) NOT NULL,
        testo TEXT NOT NULL,
        titolo_en VARCHAR(500) DEFAULT NULL,
        testo_en TEXT DEFAULT NULL,
        titolo_de VARCHAR(500) DEFAULT NULL,
        testo_de TEXT DEFAULT NULL,
        titolo_es VARCHAR(500) DEFAULT NULL,
        testo_es TEXT DEFAULT NULL,
        tipo VARCHAR(50) DEFAULT 'info',
        letto INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS obiettivi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        anno INT NOT NULL,
        tipo VARCHAR(100) NOT NULL,
        descrizione TEXT NOT NULL,
        target INT NOT NULL,
        progresso INT DEFAULT 0,
        completato INT DEFAULT 0,
        premio_soldi INT DEFAULT 0,
        premio_morale INT DEFAULT 0,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS skill_boosts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        skill_id VARCHAR(100) NOT NULL,
        stat VARCHAR(100) NOT NULL,
        amount INT NOT NULL DEFAULT 0,
        level INT NOT NULL DEFAULT 0,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_player_skill (player_id, skill_id),
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS account_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        account_id INT NOT NULL,
        token VARCHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS password_resets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        account_id INT NOT NULL,
        token VARCHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS email_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        code VARCHAR(20) NOT NULL,
        expires_at DATETIME NOT NULL,
        used INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // ── Performance indexes ──────────────────────────────────────────────────
    $indexes = [
        "CREATE INDEX idx_players_account        ON players(account_id)",
        "CREATE INDEX idx_calendario_lega_anno_mese ON calendario(lega_id, anno, mese)",
        "CREATE INDEX idx_calendario_giocata      ON calendario(giocata)",
        "CREATE INDEX idx_champions_team_anno     ON champions_cup(team_id, anno)",
        "CREATE INDEX idx_classifica_lega_anno    ON classifica(lega_id, anno)",
        "CREATE INDEX idx_log_player_anno         ON log_mensile(player_id, anno)",
        "CREATE INDEX idx_notizie_player          ON notizie(player_id)",
        "CREATE INDEX idx_obiettivi_player_anno   ON obiettivi(player_id, anno)",
        "CREATE INDEX idx_stagioni_player         ON stagioni(player_id)",
        "CREATE INDEX idx_tokens_token            ON account_tokens(token)",
    ];
    foreach ($indexes as $sql) {
        try { $pdo->exec($sql); } catch(Exception $e) { /* Indice già esistente */ }
    }

    // ── Dati iniziali ────────────────────────────────────────────────────────
    if ($pdo->query("SELECT COUNT(*) as c FROM nazioni")->fetch()['c'] == 0) seedData($pdo);
    if ($pdo->query("SELECT COUNT(*) as c FROM strutture")->fetch()['c'] == 0) {
        $pdo->exec("INSERT INTO strutture VALUES
            (1,'Campetto Base',50000,1,0,0,'+1 allenamento bonus'),
            (2,'Spogliatoio Attrezzato',110000,1,1,2,'+1 crescita, -2% infortuni'),
            (3,'Palestra e Campo',200000,2,2,5,'+2 crescita, -5% infortuni'),
            (4,'Centro Sportivo',380000,2,10,8,'+10% crescita, -8% infortuni'),
            (5,'Centro High-Tech',600000,3,20,10,'+20% crescita, -10% infortuni'),
            (6,'Centro d''Elite',950000,4,28,15,'Staff medico, +28% crescita, -15% infortuni'),
            (7,'Academy Personale',1500000,5,35,20,'+35% crescita, -20% infortuni')
        ");
    }

    // ── Migration: aggiunge colonne mancanti su DB esistenti ────────────────
    $migrations = [
        "ALTER TABLE players ADD COLUMN piede_forte INT DEFAULT 3",
        "ALTER TABLE players ADD COLUMN piede_debole INT DEFAULT 2",
        "ALTER TABLE players ADD COLUMN livello_skill INT DEFAULT 2",
        "ALTER TABLE players ADD COLUMN piede_forte_lato VARCHAR(5) DEFAULT 'dx'",
        "ALTER TABLE players ADD COLUMN piede_debole_lato VARCHAR(5) DEFAULT 'sx'",
        "ALTER TABLE players ADD COLUMN trasferimento_anno INT DEFAULT 0",
        "ALTER TABLE players ADD COLUMN infortuni_mesi INT DEFAULT 0",
        "ALTER TABLE players ADD COLUMN champions_premio_pagato INT DEFAULT 0",
        "ALTER TABLE players ADD COLUMN tiro INT DEFAULT 50",
        "ALTER TABLE players ADD COLUMN dribbling INT DEFAULT 50",
        "ALTER TABLE players ADD COLUMN mentalita INT DEFAULT 50",
        "ALTER TABLE players ADD COLUMN energia INT DEFAULT 100",
        "ALTER TABLE players ADD COLUMN soldi DOUBLE DEFAULT 10000",
        "ALTER TABLE players ADD COLUMN team_id INT DEFAULT NULL",
        "ALTER TABLE players ADD COLUMN anno_corrente INT DEFAULT 1",
        "ALTER TABLE players ADD COLUMN assist_carriera INT DEFAULT 0",
        "ALTER TABLE players ADD COLUMN trofei INT DEFAULT 0",
        "ALTER TABLE champions_cup ADD COLUMN gruppo VARCHAR(10) DEFAULT NULL",
        "ALTER TABLE champions_cup ADD COLUMN punti_gruppo INT DEFAULT 0",
        "ALTER TABLE champions_cup ADD COLUMN gol_fatti_gruppo INT DEFAULT 0",
        "ALTER TABLE champions_cup ADD COLUMN gol_subiti_gruppo INT DEFAULT 0",
        "ALTER TABLE champions_cup ADD COLUMN partite_gruppo INT DEFAULT 0",
        "ALTER TABLE champions_cup ADD COLUMN vittorie_gruppo INT DEFAULT 0",
        "ALTER TABLE champions_cup ADD COLUMN pareggi_gruppo INT DEFAULT 0",
        "ALTER TABLE champions_cup ADD COLUMN sconfitte_gruppo INT DEFAULT 0",
        "ALTER TABLE champions_cup ADD COLUMN posizione_gruppo INT DEFAULT 0",
        "ALTER TABLE champions_cup ADD COLUMN team_id INT DEFAULT NULL",
        "ALTER TABLE champions_cup ADD COLUMN eliminato INT DEFAULT 0",
        "ALTER TABLE stagioni ADD COLUMN team_nome VARCHAR(255) DEFAULT ''",
        "ALTER TABLE stagioni ADD COLUMN lega_nome VARCHAR(255) DEFAULT ''",
        "ALTER TABLE log_mensile ADD COLUMN avv VARCHAR(255) DEFAULT ''",
        "ALTER TABLE log_mensile ADD COLUMN esito VARCHAR(255) DEFAULT ''",
        "ALTER TABLE notizie ADD COLUMN titolo_en VARCHAR(500) DEFAULT NULL",
        "ALTER TABLE notizie ADD COLUMN testo_en TEXT DEFAULT NULL",
        "ALTER TABLE notizie ADD COLUMN titolo_de VARCHAR(500) DEFAULT NULL",
        "ALTER TABLE notizie ADD COLUMN testo_de TEXT DEFAULT NULL",
        "ALTER TABLE notizie ADD COLUMN titolo_es VARCHAR(500) DEFAULT NULL",
        "ALTER TABLE notizie ADD COLUMN testo_es TEXT DEFAULT NULL",
        "ALTER TABLE players MODIFY COLUMN ai_avatar MEDIUMTEXT DEFAULT NULL",
    ];
    foreach ($migrations as $sql) {
        try { $pdo->exec($sql); } catch(Exception $e) { /* Colonna già esistente */ }
    }

    // ── Aggiorna versione schema ─────────────────────────────────────────────
    $pdo->prepare("INSERT INTO schema_version (version) VALUES (?) ON DUPLICATE KEY UPDATE applied_at=NOW()")
        ->execute([SCHEMA_VERSION]);
}

function seedData($pdo) {
    // ===================== NAZIONI =====================
    $pdo->exec("INSERT INTO nazioni (id,nome,bandiera) VALUES
        (1,'Italia','🇮🇹'),(2,'Francia','🇫🇷'),(3,'Inghilterra','🏴󠁧󠁢󠁥󠁮󠁧󠁿'),
        (4,'Spagna','🇪🇸'),(5,'Germania','🇩🇪')");

    // ===================== LEGHE =====================
    $pdo->exec("INSERT INTO leghe (id,nome,nazione_id,livello) VALUES
        (1,'Seria Alfa',1,1),(2,'Seria Beta',1,2),
        (3,'Ligue Premier',2,1),(4,'Ligue Seconde',2,2),
        (5,'Premier Division',3,1),(6,'Championship League',3,2),
        (7,'La Primera',4,1),(8,'La Segunda',4,2),
        (9,'Bundesliga Pro',5,1),(10,'Bundesliga Zwei',5,2)");

    // ===================== SQUADRE =====================
    $teams = [
        ['Internazionale FC',5,97,200000000,4.8,'Scudetto',90,1,95],
        ['AC Milano',5,96,180000000,4.5,'Scudetto',85,1,93],
        ['Juventus Torino',5,95,170000000,4.4,'Scudetto',83,1,92],
        ['Napoli Calcio',5,90,130000000,4.0,'Scudetto',78,1,90],
        ['AS Roma',4,88,100000000,3.5,'Top 4',65,1,85],
        ['SS Lazia',4,82,80000000,3.2,'Top 4',55,1,83],
        ['Atalantis BC',4,78,70000000,3.0,'Top 6',45,1,81],
        ['Fiorenza FC',4,72,50000000,2.6,'Top 6',35,1,78],
        ['Torino AC',3,65,30000000,2.0,'Top 8',20,1,74],
        ['Bologna FC',3,60,25000000,1.9,'Top 8',15,1,73],
        ['Hellas Verania',3,55,18000000,1.7,'Meta classifica',10,1,71],
        ['Genova CFC',3,52,16000000,1.6,'Meta classifica',8,1,70],
        ['Sampdoriana UC',3,48,14000000,1.5,'Meta classifica',7,1,69],
        ['Udinesia Calcio',3,45,12000000,1.4,'Salvezza',5,1,68],
        ['Cagliari Calcio',3,42,10000000,1.3,'Salvezza',5,1,67],
        ['Leccia US',2,38,8000000,1.2,'Salvezza',3,1,65],
        ['Sassuolia Calcio',2,35,7000000,1.1,'Salvezza',3,1,64],
        ['Emporia FC',2,30,5000000,1.0,'Salvezza',2,1,62],
        ['Monzara AC',2,25,4000000,0.9,'Salvezza',1,1,60],
        ['Frosinonum FC',2,20,3000000,0.8,'Salvezza',1,1,58],
        ['Parmania FC',2,42,4500000,1.0,'Promozione',8,2,65],
        ['Palermia SSD',2,40,4000000,0.9,'Promozione',7,2,64],
        ['Baria FC',2,38,3500000,0.9,'Promozione',6,2,63],
        ['Veneziana FC',2,35,3200000,0.8,'Top 5',5,2,62],
        ['Bresciara Calcio',2,32,3000000,0.8,'Top 5',4,2,61],
        ['Comasco FC',2,30,2800000,0.7,'Meta classifica',3,2,60],
        ['Pisana SC',1,28,2500000,0.7,'Meta classifica',3,2,59],
        ['La Spezia AC',1,26,2300000,0.6,'Meta classifica',2,2,58],
        ['Cremoniana US',1,24,2100000,0.6,'Salvezza',2,2,57],
        ['Catanzarium FC',1,22,1900000,0.5,'Salvezza',1,2,56],
        ['Modenia Calcio',1,20,1700000,0.5,'Salvezza',1,2,55],
        ['Cosenzana Calcio',1,18,1500000,0.5,'Salvezza',1,2,54],
        ['Cittadellum AC',1,16,1400000,0.4,'Salvezza',1,2,53],
        ['Ascolium Piceno',1,15,1300000,0.4,'Salvezza',1,2,53],
        ['Feralpi FC',1,13,1100000,0.4,'Salvezza',1,2,52],
        ['Ternanum Calcio',1,12,1000000,0.3,'Salvezza',1,2,51],
        ['Reggiana FC',1,11,900000,0.3,'Salvezza',1,2,51],
        ['Sudtirolo AC',1,10,800000,0.3,'Salvezza',1,2,50],
        ['Paris St. Germaine',5,96,210000000,4.9,'Titre',92,3,96],
        ['Olympique Marseillan',5,88,120000000,4.0,'Titre',75,3,89],
        ['Olympique Lyonnaise',5,85,110000000,3.8,'Top 3',70,3,87],
        ['AS Monacal',4,82,95000000,3.6,'Top 3',65,3,85],
        ['LOSC Lilloise',4,75,65000000,3.0,'Top 5',50,3,81],
        ['OGC Nicoise',4,70,50000000,2.7,'Top 5',40,3,79],
        ['Racing Club Lensin',4,65,42000000,2.5,'Top 6',30,3,77],
        ['Stade Rennaise',3,60,32000000,2.1,'Top 8',20,3,74],
        ['Montpelliérain HSC',3,55,22000000,1.8,'Top 8',12,3,72],
        ['FC Nantaise',3,52,18000000,1.7,'Meta classifica',8,3,70],
        ['RC Strasbourgean',3,48,15000000,1.5,'Meta classifica',7,3,69],
        ['Toulouse FC',3,44,13000000,1.4,'Meta classifica',5,3,68],
        ['Stade de Reimsia',3,40,11000000,1.3,'Salvezza',4,3,67],
        ['Stade Brestois',2,36,9000000,1.2,'Salvezza',3,3,65],
        ['FC Metzien',2,32,7500000,1.1,'Salvezza',2,3,63],
        ['FC Lorientaise',2,28,6000000,1.0,'Salvezza',2,3,62],
        ['Clermont Pied FC',2,24,4500000,0.9,'Salvezza',1,3,60],
        ['Le Havre Athletic',2,20,3500000,0.8,'Salvezza',1,3,58],
        ['Caennaise FC',2,38,3800000,0.9,'Promozione',7,4,63],
        ['AJ Auxerroise',2,36,3500000,0.8,'Promozione',6,4,62],
        ['Girondins Bordeaulais',2,34,3200000,0.8,'Promozione',5,4,61],
        ['AS Saint-Etien',2,32,3000000,0.7,'Top 5',4,4,60],
        ['ES Troyes AC',2,28,2600000,0.7,'Top 5',3,4,59],
        ['Grenoble Alpes FC',1,24,2200000,0.6,'Meta classifica',2,4,58],
        ['Stade Lavalois',1,21,1900000,0.6,'Meta classifica',2,4,57],
        ['Rodez AF',1,18,1700000,0.5,'Meta classifica',1,4,56],
        ['Amiens SC',1,17,1600000,0.5,'Salvezza',1,4,55],
        ['SCO Angerois',1,16,1500000,0.5,'Salvezza',1,4,54],
        ['USL Dunkerquois',1,15,1400000,0.4,'Salvezza',1,4,54],
        ['Valenciennes FC',1,14,1300000,0.4,'Salvezza',1,4,53],
        ['Pau FC',1,13,1200000,0.4,'Salvezza',1,4,52],
        ['FC Quevillais',1,12,1100000,0.3,'Salvezza',1,4,52],
        ['SC Bastiaise',1,11,1000000,0.3,'Salvezza',1,4,51],
        ['En Avant Guingampais',1,10,900000,0.3,'Salvezza',1,4,51],
        ['AC Ajacciene',1,9,800000,0.3,'Salvezza',1,4,50],
        ['Paris FC',1,8,700000,0.2,'Salvezza',1,4,49],
        ['Manchester Citadel FC',5,98,250000000,5.0,'Title',95,5,97],
        ['Arsenale FC',5,95,200000000,4.6,'Title',88,5,94],
        ['Liverton FC',5,94,195000000,4.5,'Title',86,5,93],
        ['Chelsea Royal FC',5,92,180000000,4.3,'Top 4',80,5,91],
        ['Manchester Utopia FC',5,91,175000000,4.2,'Top 4',78,5,90],
        ['Tottenham Hotspurs FC',4,88,130000000,3.8,'Top 6',65,5,86],
        ['Newcastle Falcons',4,84,110000000,3.5,'Top 6',55,5,84],
        ['Aston Villanova FC',4,78,80000000,3.0,'Top 8',42,5,81],
        ['Brighton & Hovepark',4,72,60000000,2.7,'Top 8',30,5,79],
        ['West Hammersmith Utd',3,68,45000000,2.4,'Top 10',20,5,76],
        ['Brentwood City FC',3,62,35000000,2.1,'Meta classifica',12,5,74],
        ['Fulwich FC',3,58,28000000,1.9,'Meta classifica',9,5,72],
        ['Crystal Paladin FC',3,54,22000000,1.7,'Meta classifica',7,5,71],
        ['Everdale FC',3,50,18000000,1.5,'Salvezza',6,5,69],
        ['Nottingham Forest FC',3,46,15000000,1.4,'Salvezza',5,5,68],
        ['Wolverhampton Wanderers',3,44,13000000,1.3,'Salvezza',4,5,67],
        ['Burncastle FC',2,36,8000000,1.1,'Salvezza',2,5,63],
        ['Sheffield Utd FC',2,34,7000000,1.0,'Salvezza',2,5,62],
        ['Luton Towne FC',2,28,5000000,0.9,'Salvezza',1,5,60],
        ['Bournemere AFC',2,25,4000000,0.8,'Salvezza',1,5,58],
        ['Leeds Utopia FC',2,55,9000000,1.2,'Promozione',10,6,67],
        ['Leicesteria City',2,52,8500000,1.2,'Promozione',9,6,66],
        ['Middlesham FC',2,46,6000000,1.0,'Promozione',7,6,64],
        ['Ipsborough Town',2,42,5500000,1.0,'Top 5',6,6,63],
        ['Southgate City FC',2,40,5000000,0.9,'Top 5',5,6,62],
        ['Watshire FC',2,38,4500000,0.9,'Top 6',4,6,61],
        ['Queen Park Rangers FC',2,35,4000000,0.8,'Meta classifica',3,6,60],
        ['Millgate FC',2,33,3700000,0.8,'Meta classifica',3,6,59],
        ['Bristol Citadel',1,30,3300000,0.7,'Meta classifica',2,6,58],
        ['Swansdale City',1,28,3000000,0.7,'Salvezza',2,6,57],
        ['Stoke Citadel FC',1,26,2700000,0.6,'Salvezza',1,6,56],
        ['Coventria City',1,24,2500000,0.6,'Salvezza',1,6,55],
        ['Hull Citadel FC',1,22,2200000,0.5,'Salvezza',1,6,54],
        ['Sundergate AFC',1,20,2000000,0.5,'Salvezza',1,6,54],
        ['West Bromerwick Albion',1,18,1800000,0.5,'Salvezza',1,6,53],
        ['Preston North End FC',1,16,1600000,0.4,'Salvezza',1,6,52],
        ['Blackdale Rovers',1,14,1400000,0.4,'Salvezza',1,6,51],
        ['Birmingham Citadel',1,12,1200000,0.4,'Salvezza',1,6,51],
        ['Cardiff Citadel FC',1,10,1000000,0.3,'Salvezza',1,6,50],
        ['Plymouth Argyle FC',1,9,900000,0.3,'Salvezza',1,6,49],
        ['Real Madridal FC',5,99,280000000,5.0,'Liga',95,7,98],
        ['FC Barceloma',5,98,260000000,4.9,'Liga',93,7,97],
        ['Atletico Madrileno',5,90,150000000,4.2,'Liga',82,7,90],
        ['Sevilha FC',4,82,90000000,3.5,'Top 4',65,7,85],
        ['Valencia CF',4,78,75000000,3.2,'Top 4',55,7,83],
        ['Real Betania',4,74,60000000,2.9,'Top 6',42,7,80],
        ['Real Sociedad Vascal',4,70,52000000,2.7,'Top 6',35,7,78],
        ['Villareal CF',4,66,45000000,2.5,'Top 8',28,7,76],
        ['Athletic Bilbana',3,62,35000000,2.2,'Top 8',20,7,74],
        ['CA Osasuno',3,56,24000000,1.8,'Meta classifica',12,7,72],
        ['Gironia FC',3,52,20000000,1.7,'Meta classifica',10,7,71],
        ['Celta Vigal',3,48,16000000,1.5,'Meta classifica',7,7,70],
        ['Rayo Vallecana',3,44,13000000,1.4,'Salvezza',5,7,68],
        ['Getafe CF',3,40,11000000,1.3,'Salvezza',4,7,67],
        ['UD Almeriense',2,34,8000000,1.1,'Salvezza',3,7,64],
        ['Cadiz CF',2,30,6500000,1.0,'Salvezza',2,7,62],
        ['Granada CF',2,27,5500000,0.9,'Salvezza',2,7,61],
        ['RCD Mallorquin',2,24,4500000,0.8,'Salvezza',1,7,59],
        ['UD Las Palmeras',2,21,3800000,0.8,'Salvezza',1,7,58],
        ['Deportivo Alavese',2,18,3000000,0.7,'Salvezza',1,7,56],
        ['Elcha CF',2,35,3500000,0.8,'Promozione',6,8,63],
        ['Levantino UD',2,33,3200000,0.8,'Promozione',5,8,62],
        ['Sporting Gijonese',2,31,3000000,0.7,'Promozione',4,8,61],
        ['CD Leganesco',2,28,2700000,0.7,'Top 5',3,8,60],
        ['Real Valladolido',2,26,2500000,0.6,'Top 5',3,8,59],
        ['SD Huescal',1,23,2200000,0.6,'Meta classifica',2,8,58],
        ['CD Tenerifino',1,21,2000000,0.5,'Meta classifica',2,8,57],
        ['CD Mirandisco',1,19,1800000,0.5,'Salvezza',1,8,56],
        ['FC Cartagenio',1,17,1600000,0.5,'Salvezza',1,8,55],
        ['Andorra CF',1,15,1400000,0.4,'Salvezza',1,8,54],
        ['CF Burgalese',1,14,1300000,0.4,'Salvezza',1,8,53],
        ['Racing Santanderino',1,13,1200000,0.4,'Salvezza',1,8,52],
        ['CD Lugal',1,12,1100000,0.3,'Salvezza',1,8,52],
        ['Malagueno CF',1,11,1000000,0.3,'Salvezza',1,8,51],
        ['Albacetino Balompie',1,10,900000,0.3,'Salvezza',1,8,51],
        ['FC Andorreno',1,9,800000,0.3,'Salvezza',1,8,50],
        ['Villareal FC B',1,8,700000,0.2,'Salvezza',1,8,49],
        ['Real Oviedino',1,7,600000,0.2,'Salvezza',1,8,48],
        ['FC Bayernia München',5,97,240000000,4.8,'Meisterschaft',93,9,96],
        ['Borussia Dortmundia',5,92,160000000,4.4,'Meisterschaft',82,9,91],
        ['RB Lipsiense',5,85,120000000,4.0,'Top 4',72,9,88],
        ['Bayer Leverkusenia',4,82,100000000,3.7,'Top 4',65,9,86],
        ['Eintracht Frankfurtia',4,78,75000000,3.2,'Top 6',50,9,82],
        ['VfL Wolfsburgo',4,70,55000000,2.8,'Top 6',35,9,79],
        ['Borussia Gladbacia',4,65,45000000,2.5,'Top 8',25,9,77],
        ['TSG Hoffenheimia',3,58,32000000,2.1,'Top 8',15,9,74],
        ['Union Berlinese',3,55,28000000,1.9,'Meta classifica',10,9,72],
        ['1. FSV Mainzia',3,50,22000000,1.7,'Meta classifica',7,9,71],
        ['SC Freiburgia',3,46,18000000,1.6,'Meta classifica',6,9,70],
        ['VfL Bochumia',3,42,14000000,1.4,'Salvezza',4,9,68],
        ['FC Augsburgia',3,38,11000000,1.3,'Salvezza',3,9,67],
        ['FC Kolnische',3,35,9000000,1.2,'Salvezza',3,9,66],
        ['Hertha BSC Berlin',2,32,7000000,1.0,'Salvezza',2,9,63],
        ['VfB Stuttgartes',3,40,12000000,1.3,'Salvezza',3,9,67],
        ['Werder Brema FC',3,44,15000000,1.5,'Salvezza',4,9,69],
        ['SV Darmstadtia',2,22,4000000,0.8,'Salvezza',1,9,58],
        ['Hamburger SVC',2,55,8000000,1.2,'Aufstieg',9,10,66],
        ['FC Schalkenau 04',2,52,7500000,1.1,'Aufstieg',8,10,65],
        ['Hannover 96 FC',2,46,5500000,1.0,'Aufstieg',6,10,63],
        ['1. FC Kaiserslauternio',2,42,5000000,0.9,'Top 5',5,10,62],
        ['1. FC Nürnbergia',2,38,4500000,0.9,'Top 5',4,10,61],
        ['SC Paderbornia 07',2,32,3800000,0.8,'Meta classifica',3,10,59],
        ['Hansa Rostockia',1,28,3200000,0.7,'Meta classifica',2,10,58],
        ['Eintracht Braunschweig',1,25,2800000,0.7,'Meta classifica',2,10,57],
        ['1. FC Magdeburgio',1,23,2500000,0.6,'Salvezza',1,10,56],
        ['SV 07 Elversberg',1,20,2200000,0.6,'Salvezza',1,10,55],
        ['SV Wiesbadenia',1,18,2000000,0.5,'Salvezza',1,10,54],
        ['SpVgg Greuther Fürthen',1,16,1800000,0.5,'Salvezza',1,10,53],
        ['Fortuna Düsseldorfia',1,15,1600000,0.5,'Salvezza',1,10,53],
        ['FC St. Pauliana',1,14,1500000,0.4,'Salvezza',1,10,52],
        ['VfL Osnabrücken',1,12,1300000,0.4,'Salvezza',1,10,51],
        ['SV Sandhausenia',1,10,1100000,0.3,'Salvezza',1,10,50],
        ['Karlsruher SCC',1,9,1000000,0.3,'Salvezza',1,10,49],
        ['Holstein Kieler SV',1,8,900000,0.3,'Salvezza',1,10,49],
    ];

    $stmt = $pdo->prepare("INSERT INTO teams (nome,stelle,popolarita,budget,moltiplicatore_stipendio,obiettivo,probabilita_trofeo,lega_id,ovr) VALUES (?,?,?,?,?,?,?,?,?)");
    foreach ($teams as $t) $stmt->execute($t);
}

// ===================== HELPERS AUTH =====================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Auth-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

function _getCachedBody() {
    static $cached = null;
    if ($cached === null) {
        $raw = file_get_contents('php://input');
        $cached = ($raw && strlen($raw) > 0) ? (json_decode($raw, true) ?: []) : [];
    }
    return $cached;
}

function generateToken() { return bin2hex(random_bytes(32)); }

/**
 * Recupera il token di autenticazione dall'header HTTP_X_AUTH_TOKEN,
 * dalla query string o dal body JSON — in questo ordine di priorità.
 */
function getToken() {
    // Accesso diretto: $_SERVER normalizza i trattini in underscore
    if (!empty($_SERVER['HTTP_X_AUTH_TOKEN'])) return $_SERVER['HTTP_X_AUTH_TOKEN'];
    if (!empty($_GET['token']))                 return $_GET['token'];
    $body = _getCachedBody();
    return $body['token'] ?? null;
}

function getAuthAccountId() {
    $token = getToken();
    if (!$token) return null;
    $db   = getDB();
    $stmt = $db->prepare("SELECT account_id FROM account_tokens WHERE token=? AND expires_at > NOW()");
    $stmt->execute([$token]);
    $row  = $stmt->fetch();
    return $row ? (int)$row['account_id'] : null;
}

function getAuthPlayerId() {
    $token = getToken();
    if (!$token) return null;
    $db = getDB();

    $stmt = $db->prepare("SELECT account_id FROM account_tokens WHERE token=? AND expires_at > NOW()");
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) return null;

    // Recupera career_id dall'header, poi dalla query string, poi dal body
    $career_id = null;
    if (!empty($_SERVER['HTTP_X_CAREER_ID'])) {
        $career_id = intval($_SERVER['HTTP_X_CAREER_ID']);
    } elseif (!empty($_GET['career_id'])) {
        $career_id = intval($_GET['career_id']);
    } else {
        $body = _getCachedBody();
        if (!empty($body['career_id'])) $career_id = intval($body['career_id']);
    }

    if ($career_id) {
        $stmt2 = $db->prepare("SELECT id FROM players WHERE id=? AND account_id=?");
        $stmt2->execute([$career_id, $row['account_id']]);
        $p = $stmt2->fetch();
        return $p ? (int)$p['id'] : null;
    }
    return -(int)$row['account_id'];
}

/**
 * Recupera la lingua dalla request (header X-Lang, query string o body).
 */
function getLang(): string {
    $allowed = ['it','en','de','es'];
    if (!empty($_SERVER['HTTP_X_LANG']) && in_array($_SERVER['HTTP_X_LANG'], $allowed)) return $_SERVER['HTTP_X_LANG'];
    if (!empty($_GET['lang'])           && in_array($_GET['lang'], $allowed))           return $_GET['lang'];
    $body = _getCachedBody();
    if (!empty($body['lang'])           && in_array($body['lang'], $allowed))           return $body['lang'];
    return 'it';
}

function t(string $it, string $en, string $de = '', string $es = ''): string {
    $lang = getLang();
    if ($lang === 'en') return $en;
    if ($lang === 'de') return $de ?: $en;
    if ($lang === 'es') return $es ?: $en;
    return $it;
}
