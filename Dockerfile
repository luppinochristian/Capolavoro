FROM php:8.2-cli

# Installa estensioni MySQL, GD (png/jpeg/webp) e dipendenze
RUN apt-get update && apt-get install -y \
    libpng-dev \
    libjpeg-dev \
    libwebp-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install pdo pdo_mysql mysqli gd \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

EXPOSE 8080

CMD ["php", "-S", "0.0.0.0:8080", "router.php"]
