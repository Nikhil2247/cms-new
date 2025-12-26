#!/bin/bash

# ===========================================
# CMS VPS Setup Script
# ===========================================
# Automated setup for Ubuntu/Debian VPS
#
# Usage:
#   chmod +x scripts/setup-vps.sh
#   sudo ./scripts/setup-vps.sh [your-domain.com] [your-email@example.com]
#
# Example:
#   sudo ./scripts/setup-vps.sh cms.example.com admin@example.com

set -e

# ===========================================
# Configuration
# ===========================================
DOMAIN="${1:-localhost}"
EMAIL="${2:-admin@localhost}"
INSTALL_DIR="/opt/cms"
REPO_URL="${3:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ===========================================
# Helper Functions
# ===========================================
log_header() {
    echo ""
    echo -e "${CYAN}══════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}══════════════════════════════════════════${NC}"
    echo ""
}

log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_info() { echo -e "${YELLOW}→ $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; }
log_step() { echo -e "${BLUE}▶ $1${NC}"; }

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root (sudo)"
        exit 1
    fi
}

# ===========================================
# System Update
# ===========================================
update_system() {
    log_header "Updating System"

    apt-get update -y
    apt-get upgrade -y
    apt-get install -y \
        curl \
        wget \
        git \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        ufw \
        fail2ban

    log_success "System updated"
}

# ===========================================
# Install Docker
# ===========================================
install_docker() {
    log_header "Installing Docker"

    if command -v docker &> /dev/null; then
        log_info "Docker already installed"
        docker --version
    else
        log_step "Installing Docker..."

        # Remove old versions
        apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

        # Add Docker's official GPG key
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg

        # Add repository
        echo \
            "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
            $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
            tee /etc/apt/sources.list.d/docker.list > /dev/null

        # Install Docker
        apt-get update -y
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

        # Start and enable Docker
        systemctl start docker
        systemctl enable docker

        log_success "Docker installed"
    fi
}

# ===========================================
# Configure Firewall
# ===========================================
configure_firewall() {
    log_header "Configuring Firewall"

    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp

    # Enable firewall
    echo "y" | ufw enable

    log_success "Firewall configured"
    ufw status
}

# ===========================================
# Configure Fail2Ban
# ===========================================
configure_fail2ban() {
    log_header "Configuring Fail2Ban"

    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
EOF

    systemctl restart fail2ban
    systemctl enable fail2ban

    log_success "Fail2Ban configured"
}

# ===========================================
# Setup Application
# ===========================================
setup_application() {
    log_header "Setting Up Application"

    # Create directory
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"

    # Clone or copy repository
    if [ -n "$REPO_URL" ]; then
        log_step "Cloning repository..."
        git clone "$REPO_URL" .
    elif [ -d "/tmp/cms-source" ]; then
        log_step "Copying from /tmp/cms-source..."
        cp -r /tmp/cms-source/* .
    else
        log_error "No source found. Please provide REPO_URL or copy files to /tmp/cms-source"
        exit 1
    fi

    # Make scripts executable
    chmod +x scripts/*.sh 2>/dev/null || true

    log_success "Application files ready"
}

# ===========================================
# Generate Secrets
# ===========================================
generate_secrets() {
    log_header "Generating Secure Secrets"

    JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
    MONGO_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
    MINIO_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)

    log_success "Secrets generated"
}

# ===========================================
# Create Environment File
# ===========================================
create_env_file() {
    log_header "Creating Environment Configuration"

    cat > "$INSTALL_DIR/.env" << EOF
# ===========================================
# CMS Production Environment
# Generated: $(date)
# Domain: ${DOMAIN}
# ===========================================

# Application
NODE_ENV=production
LOG_LEVEL=warn
VERSION=latest

# Domain Configuration
DOMAIN=${DOMAIN}
FRONTEND_URL=https://${DOMAIN}
CORS_ORIGIN=https://${DOMAIN}
ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}

# API URL (relative for same-domain setup)
VITE_API_BASE_URL=/api
VITE_APP_NAME=CMS Portal
VITE_APP_ENV=production

# Database
DATABASE_URL=mongodb://cmsuser:cmspassword123@mongodb:27017/cms?authSource=cms
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=${MONGO_PASSWORD}
MONGO_DATABASE=cms

# Cache
REDIS_URL=redis://dragonfly:6379

# JWT (SECURE - DO NOT SHARE)
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRATION=30m
JWT_REFRESH_EXPIRATION=7d

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# File Upload
MAX_FILE_SIZE=10485760

# MinIO Storage
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
AWS_S3_BUCKET=cms-uploads
AWS_REGION=us-east-1

# PM2 Instances
PM2_INSTANCES=max

# ===========================================
# Optional Services (configure as needed)
# ===========================================

# Email (Gmail example)
MAIL_USER=
MAIL_PASS=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://${DOMAIN}/api/auth/google/callback

# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_STORAGE_BUCKET=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
EOF

    chmod 600 "$INSTALL_DIR/.env"

    log_success "Environment file created"
    log_info "Location: $INSTALL_DIR/.env"
}

# ===========================================
# Configure Nginx for Domain
# ===========================================
configure_nginx_domain() {
    log_header "Configuring Nginx for ${DOMAIN}"

    # Update nginx config with domain
    sed -i "s/YOUR_DOMAIN/${DOMAIN}/g" "$INSTALL_DIR/nginx/conf.d/default.conf"

    log_success "Nginx configured for ${DOMAIN}"
}

# ===========================================
# Start Application
# ===========================================
start_application() {
    log_header "Starting Application"

    cd "$INSTALL_DIR"

    log_step "Building and starting containers..."
    docker compose -f docker-compose.prod.yml up -d --build

    log_step "Waiting for services to start..."
    sleep 30

    # Check health
    if curl -sf http://localhost/health > /dev/null 2>&1; then
        log_success "Application is running!"
    else
        log_info "Application is starting up (may take a minute)..."
    fi
}

# ===========================================
# Setup SSL Certificate
# ===========================================
setup_ssl() {
    log_header "Setting Up SSL Certificate"

    if [ "$DOMAIN" = "localhost" ]; then
        log_info "Skipping SSL for localhost"
        return
    fi

    cd "$INSTALL_DIR"

    log_step "Obtaining SSL certificate for ${DOMAIN}..."

    # Get certificate
    docker compose -f docker-compose.prod.yml run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" || {
            log_info "SSL certificate request failed. You can retry later with:"
            log_info "  cd $INSTALL_DIR && ./scripts/setup-ssl.sh $DOMAIN $EMAIL"
            return
        }

    # Enable HTTPS in nginx config
    log_step "Enabling HTTPS configuration..."

    cat > "$INSTALL_DIR/nginx/conf.d/default.conf" << EOF
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/${DOMAIN}/chain.pem;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    include /etc/nginx/snippets/locations.conf;
}
EOF

    # Reload nginx
    docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

    log_success "SSL certificate installed!"
    log_info "Your site is now available at: https://${DOMAIN}"
}

# ===========================================
# Create Maintenance Scripts
# ===========================================
create_maintenance_scripts() {
    log_header "Creating Maintenance Scripts"

    # Backup script
    cat > "$INSTALL_DIR/scripts/backup.sh" << 'EOF'
#!/bin/bash
# CMS Backup Script

BACKUP_DIR="/opt/cms/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "Creating backup..."

# MongoDB backup
docker exec cms-mongodb mongodump --out /data/backup --authenticationDatabase admin -u admin -p "$MONGO_ROOT_PASSWORD"
docker cp cms-mongodb:/data/backup "$BACKUP_DIR/mongodb_$DATE"

# Compress
cd "$BACKUP_DIR"
tar -czf "backup_$DATE.tar.gz" "mongodb_$DATE"
rm -rf "mongodb_$DATE"

# Keep last 7 days
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/backup_$DATE.tar.gz"
EOF

    # Update script
    cat > "$INSTALL_DIR/scripts/update.sh" << 'EOF'
#!/bin/bash
# CMS Update Script

cd /opt/cms

echo "Pulling latest changes..."
git pull origin main

echo "Rebuilding containers..."
docker compose -f docker-compose.prod.yml build --no-cache

echo "Restarting services..."
docker compose -f docker-compose.prod.yml up -d

echo "Cleaning up..."
docker image prune -f

echo "Update completed!"
EOF

    chmod +x "$INSTALL_DIR/scripts/backup.sh"
    chmod +x "$INSTALL_DIR/scripts/update.sh"

    # Add backup cron job (daily at 2 AM)
    (crontab -l 2>/dev/null; echo "0 2 * * * /opt/cms/scripts/backup.sh >> /var/log/cms-backup.log 2>&1") | crontab -

    log_success "Maintenance scripts created"
}

# ===========================================
# Print Summary
# ===========================================
print_summary() {
    log_header "Setup Complete!"

    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo -e "${GREEN}  CMS has been successfully deployed!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}Domain:${NC}     ${DOMAIN}"
    echo -e "  ${CYAN}Directory:${NC}  ${INSTALL_DIR}"
    echo ""
    echo -e "  ${YELLOW}URLs:${NC}"
    if [ "$DOMAIN" = "localhost" ]; then
        echo "    Frontend:     http://localhost"
        echo "    API:          http://localhost/api"
        echo "    Health:       http://localhost/health"
    else
        echo "    Frontend:     https://${DOMAIN}"
        echo "    API:          https://${DOMAIN}/api"
        echo "    Health:       https://${DOMAIN}/health"
    fi
    echo ""
    echo -e "  ${YELLOW}Commands:${NC}"
    echo "    View logs:    cd $INSTALL_DIR && docker compose -f docker-compose.prod.yml logs -f"
    echo "    Restart:      cd $INSTALL_DIR && docker compose -f docker-compose.prod.yml restart"
    echo "    Stop:         cd $INSTALL_DIR && docker compose -f docker-compose.prod.yml down"
    echo "    Backup:       $INSTALL_DIR/scripts/backup.sh"
    echo "    Update:       $INSTALL_DIR/scripts/update.sh"
    echo ""
    echo -e "  ${RED}Important:${NC}"
    echo "    - Review and update: $INSTALL_DIR/.env"
    echo "    - Secrets are stored in .env (keep secure!)"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
}

# ===========================================
# Main
# ===========================================
main() {
    log_header "CMS VPS Setup"
    echo "Domain: ${DOMAIN}"
    echo "Email:  ${EMAIL}"
    echo ""

    check_root
    update_system
    install_docker
    configure_firewall
    configure_fail2ban
    setup_application
    generate_secrets
    create_env_file
    configure_nginx_domain
    start_application
    create_maintenance_scripts

    if [ "$DOMAIN" != "localhost" ]; then
        setup_ssl
    fi

    print_summary
}

# Run
main "$@"
