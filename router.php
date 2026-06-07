<?php
/**
 * ============================================================
 * router.php — Router per il server PHP built-in
 * ============================================================
 * Utilizzato SOLO in sviluppo locale tramite:
 *   php -S localhost:8080 router.php
 *
 * Funzionamento:
 *  - Le richieste a file statici esistenti (CSS, JS, immagini)
 *    vengono servite direttamente dal filesystem
 *  - Le richieste alle API PHP vengono inoltrate ai file corretti
 *  - Tutte le altre richieste vengono reindirizzate a index.html
 *    per supportare il routing single-page
 *
 * In produzione (Apache/Nginx) questo file non viene usato:
 * la configurazione del web server gestisce il routing.
 * ============================================================
 */
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Richieste alle API PHP
if (strpos($uri, '/backend/') === 0) {
    $file = __DIR__ . $uri;
    if (file_exists($file) && pathinfo($file, PATHINFO_EXTENSION) === 'php') {
        // Cambia directory per far funzionare i require relativi
        chdir(dirname($file));
        require $file;
        return true;
    }
}

// File statici del frontend
if (strpos($uri, '/frontend/') === 0) {
    $file = __DIR__ . $uri;
    if (file_exists($file) && !is_dir($file)) {
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $mimes = [
            'html' => 'text/html; charset=utf-8',
            'css'  => 'text/css',
            'js'   => 'application/javascript',
            'json' => 'application/json',
            'png'  => 'image/png',
            'jpg'  => 'image/jpeg',
            'webp' => 'image/webp',
            'svg'  => 'image/svg+xml',
        ];
        if (isset($mimes[$ext])) header('Content-Type: ' . $mimes[$ext]);
        readfile($file);
        return true;
    }
}

// Root → index
if ($uri === '/' || $uri === '') {
    header('Location: /frontend/index.html');
    exit;
}

return false;
