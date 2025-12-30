#!/bin/bash

#===============================================================================
# MongoDB to PostgreSQL Server Migration Script
#
# This script helps run the migration on a Linux/Unix server.
#
# Prerequisites:
#   1. Node.js (v18+) and npm installed
#   2. Project dependencies installed (npm install)
#   3. Prisma migrations applied on target PostgreSQL
#   4. Network access to both MongoDB and PostgreSQL servers
#
# Usage:
#   chmod +x run-server-migration.sh
#   ./run-server-migration.sh
#
# Or with arguments:
#   ./run-server-migration.sh \
#     --mongodb-url "mongodb://user:pass@source:27017/db" \
#     --postgres-url "postgresql://user:pass@target:5432/db"
#===============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values (can be overridden by environment variables or CLI args)
MONGODB_URL="${SOURCE_MONGODB_URL:-}"
POSTGRES_URL="${TARGET_DATABASE_URL:-}"
DRY_RUN=""
VERBOSE=""
SKIP_CLEAR=""

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

print_header() {
    echo -e "${BLUE}"
    echo "============================================================"
    echo "  MongoDB to PostgreSQL Server Migration"
    echo "============================================================"
    echo -e "${NC}"
}

print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -m, --mongodb-url <url>     MongoDB connection URL (source server)"
    echo "  -p, --postgres-url <url>    PostgreSQL connection URL (target server)"
    echo "  -d, --dry-run               Test connections without migrating data"
    echo "  -s, --skip-clear            Skip clearing PostgreSQL tables"
    echo "  -v, --verbose               Enable verbose logging"
    echo "  -h, --help                  Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  SOURCE_MONGODB_URL          MongoDB connection URL (alternative to -m)"
    echo "  TARGET_DATABASE_URL         PostgreSQL connection URL (alternative to -p)"
    echo ""
    echo "Examples:"
    echo "  # Interactive mode (prompts for URLs)"
    echo "  $0"
    echo ""
    echo "  # With command line arguments"
    echo "  $0 -m 'mongodb://admin:pass@source-vps:27017/cms_db?authSource=admin' \\"
    echo "     -p 'postgresql://user:pass@target-vps:5432/cms_db'"
    echo ""
    echo "  # Dry run to test connections"
    echo "  $0 -m '...' -p '...' --dry-run"
    echo ""
    echo "  # Using environment variables"
    echo "  export SOURCE_MONGODB_URL='mongodb://...'"
    echo "  export TARGET_DATABASE_URL='postgresql://...'"
    echo "  $0"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mongodb-url)
            MONGODB_URL="$2"
            shift 2
            ;;
        -p|--postgres-url)
            POSTGRES_URL="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN="--dry-run"
            shift
            ;;
        -s|--skip-clear)
            SKIP_CLEAR="--skip-clear"
            shift
            ;;
        -v|--verbose)
            VERBOSE="--verbose"
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            print_usage
            exit 1
            ;;
    esac
done

print_header

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js v18+ and try again"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js version is ${NODE_VERSION}. Version 18+ is recommended.${NC}"
fi

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx is not available${NC}"
    exit 1
fi

# Change to project directory
cd "$PROJECT_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Check for Prisma client
if [ ! -d "node_modules/.prisma" ]; then
    echo -e "${YELLOW}Generating Prisma client...${NC}"
    npx prisma generate
fi

# Prompt for MongoDB URL if not provided
if [ -z "$MONGODB_URL" ]; then
    echo -e "${YELLOW}MongoDB URL not provided.${NC}"
    echo -n "Enter MongoDB URL (source server): "
    read -r MONGODB_URL
    if [ -z "$MONGODB_URL" ]; then
        echo -e "${RED}Error: MongoDB URL is required${NC}"
        exit 1
    fi
fi

# Prompt for PostgreSQL URL if not provided
if [ -z "$POSTGRES_URL" ]; then
    echo -e "${YELLOW}PostgreSQL URL not provided.${NC}"
    echo -n "Enter PostgreSQL URL (target server): "
    read -r POSTGRES_URL
    if [ -z "$POSTGRES_URL" ]; then
        echo -e "${RED}Error: PostgreSQL URL is required${NC}"
        exit 1
    fi
fi

# Mask passwords in URLs for display
mask_url() {
    echo "$1" | sed 's/\/\/[^:]*:[^@]*@/\/\/***:***@/g'
}

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  MongoDB (Source): $(mask_url "$MONGODB_URL")"
echo "  PostgreSQL (Target): $(mask_url "$POSTGRES_URL")"
if [ -n "$DRY_RUN" ]; then
    echo -e "  ${YELLOW}Mode: DRY RUN (no data will be migrated)${NC}"
fi
echo ""

# Confirm before proceeding (skip in dry-run mode)
if [ -z "$DRY_RUN" ]; then
    echo -e "${YELLOW}WARNING: This will migrate data from MongoDB to PostgreSQL.${NC}"
    echo -e "${YELLOW}The target PostgreSQL database tables will be CLEARED before migration.${NC}"
    echo ""
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Migration cancelled."
        exit 0
    fi
fi

echo ""
echo -e "${GREEN}Starting migration...${NC}"
echo ""

# Build the command
CMD="npx ts-node prisma/server-migrate-mongo-to-postgres.ts"
CMD="$CMD --mongodb-url '$MONGODB_URL'"
CMD="$CMD --postgres-url '$POSTGRES_URL'"
[ -n "$DRY_RUN" ] && CMD="$CMD $DRY_RUN"
[ -n "$VERBOSE" ] && CMD="$CMD $VERBOSE"
[ -n "$SKIP_CLEAR" ] && CMD="$CMD $SKIP_CLEAR"

# Run the migration
eval "$CMD"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}  Migration completed successfully!${NC}"
    echo -e "${GREEN}============================================================${NC}"
else
    echo ""
    echo -e "${RED}============================================================${NC}"
    echo -e "${RED}  Migration failed with exit code: $EXIT_CODE${NC}"
    echo -e "${RED}============================================================${NC}"
    exit $EXIT_CODE
fi
