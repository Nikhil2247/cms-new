-- ============================================================================
-- PostgreSQL Initialization Script
-- Creates extensions and initial configuration for CMS database
-- Runs automatically when PostgreSQL container starts for the first time
-- ============================================================================

-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation (for id defaults)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Trigram similarity for text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";      -- GIN indexes for btree types
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- Remove accents for search

-- ============================================================================
-- Performance Configuration
-- ============================================================================

-- Set default configuration for new connections
ALTER DATABASE cms_db SET timezone TO 'UTC';
ALTER DATABASE cms_db SET statement_timeout TO '30s';
ALTER DATABASE cms_db SET lock_timeout TO '10s';

-- ============================================================================
-- Create application user (if needed for separate access)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cmsuser') THEN
        CREATE ROLE cmsuser WITH LOGIN PASSWORD 'changeme';
        GRANT ALL PRIVILEGES ON DATABASE cms_db TO cmsuser;
        RAISE NOTICE 'User "cmsuser" created successfully';
    ELSE
        RAISE NOTICE 'User "cmsuser" already exists, skipping creation';
    END IF;
END
$$;

-- ============================================================================
-- Grant permissions to public schema
-- ============================================================================
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO cmsuser;

-- ============================================================================
-- Output initialization status
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '=================================';
    RAISE NOTICE 'PostgreSQL initialization completed!';
    RAISE NOTICE 'Database: cms_db';
    RAISE NOTICE 'Extensions: uuid-ossp, pg_trgm, btree_gin, unaccent';
    RAISE NOTICE '=================================';
END
$$;
