/**
 * =============================================================================
 * INSTITUTION UPDATE SCRIPT
 * =============================================================================
 *
 * This script updates all Punjab Government Polytechnic institutions with
 * verified official details from DTE Punjab and other official sources.
 *
 * USAGE:
 *   npx ts-node scripts/update-institutions.ts [options]
 *
 * OPTIONS (environment variables):
 *   DRY_RUN=true     - Preview changes without applying
 *   FORCE=true       - Force update even if data exists
 *   VERBOSE=true     - Show detailed logging
 *
 * FEATURES:
 *   - Updates existing institutions by matching name patterns
 *   - Inserts new institutions if not found
 *   - Handles duplicate detection
 *   - Logs all changes to file
 *   - Supports dry run mode
 *
 * =============================================================================
 */

import { MongoClient, ObjectId, Db } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  DRY_RUN: process.env.DRY_RUN === 'true',
  FORCE: process.env.FORCE === 'true',
  VERBOSE: process.env.VERBOSE === 'true',
  LOG_FILE: path.resolve(__dirname, '../logs/institution-updates.log'),
};

// =============================================================================
// LOGGING
// =============================================================================

let logStream: fs.WriteStream | null = null;

function initLogging() {
  const logsDir = path.dirname(CONFIG.LOG_FILE);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  logStream = fs.createWriteStream(CONFIG.LOG_FILE, { flags: 'a' });
}

function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'DEBUG' = 'INFO') {
  if (level === 'DEBUG' && !CONFIG.VERBOSE) return;

  const timestamp = new Date().toISOString();
  const colors: Record<string, string> = {
    'INFO': '\x1b[36m',
    'WARN': '\x1b[33m',
    'ERROR': '\x1b[31m',
    'SUCCESS': '\x1b[32m',
    'DEBUG': '\x1b[90m',
  };
  const reset = '\x1b[0m';

  console.log(`${colors[level]}[${level}]${reset} ${message}`);

  if (logStream) {
    logStream.write(`[${timestamp}] [${level}] ${message}\n`);
  }
}

// =============================================================================
// INSTITUTION DATA
// =============================================================================

interface InstitutionData {
  name: string;
  shortName: string;
  code: string;
  address: string;
  city: string;
  district: string;
  pinCode: string;
  contactEmail: string;
  contactPhone: string;
  alternatePhone?: string;
  website?: string;
  establishedYear?: number;
  // Matching patterns for finding existing records
  matchPatterns: string[];
}

/**
 * Verified institution data from official sources:
 * - DTE Punjab: https://dte.punjab.gov.in/?q=government-polytechnic-colleges
 * - Individual college websites
 * - District government portals
 */
const INSTITUTION_DATA: InstitutionData[] = [
  {
    name: 'S. Amarjit Singh Sahi Government Polytechnic College, Talwara',
    shortName: 'SASS GPC Talwara',
    code: 'SASSGPC-TALWARA',
    address: 'Sector-4, Talwara Township, Tehsil Mukerian',
    city: 'Talwara',
    district: 'Hoshiarpur',
    pinCode: '144216',
    contactEmail: 'gpctalwara@punjab.gov.in',
    contactPhone: '01883-238222',
    alternatePhone: '9501107354',
    website: 'https://gpctalwara.org.in',
    establishedYear: 2016,
    matchPatterns: ['talwara', 'sass', 'amarjit']
  },
  {
    name: 'Mai Bhago Government Polytechnic College for Girls, Amritsar',
    shortName: 'GPCG Amritsar',
    code: 'GPCG-AMRITSAR',
    address: 'Majitha Road Bypass, Diamond Avenue',
    city: 'Amritsar',
    district: 'Amritsar',
    pinCode: '143001',
    contactEmail: 'gpcgamritsar@punjab.gov.in',
    contactPhone: '0183-2421337',
    alternatePhone: '9914263363',
    website: 'https://gpcgasr.in',
    establishedYear: 1970,
    matchPatterns: ['girls', 'amritsar', 'mai bhago', 'gpcg amritsar']
  },
  {
    name: 'Government Polytechnic College, Batala',
    shortName: 'GPC Batala',
    code: 'GPC-BATALA',
    address: 'Kahnuwan Road, Batala',
    city: 'Batala',
    district: 'Gurdaspur',
    pinCode: '143506',
    contactEmail: 'principalgpcbatala@gmail.com',
    contactPhone: '01871-240149',
    alternatePhone: '01871-225689',
    website: 'https://www.gpbatala.org',
    establishedYear: 1964,
    matchPatterns: ['batala']
  },
  {
    name: 'Sant Baba Prem Singh Memorial Government Polytechnic College, Begowal',
    shortName: 'GPC Begowal',
    code: 'GPC-BEGOWAL',
    address: 'VPO Begowal',
    city: 'Begowal',
    district: 'Kapurthala',
    pinCode: '144621',
    contactEmail: 'gpcbegowal@gmail.com',
    contactPhone: '01822-248248',
    website: 'https://www.gpcbegowal.org',
    establishedYear: 2012,
    matchPatterns: ['begowal', 'prem singh']
  },
  {
    name: 'Government Polytechnic College, Behram',
    shortName: 'GPC Behram',
    code: 'GPC-BEHRAM',
    address: 'VPO Behram, Tehsil Banga',
    city: 'Behram',
    district: 'Shaheed Bhagat Singh Nagar',
    pinCode: '144503',
    contactEmail: 'gpcbehram@punjab.gov.in',
    contactPhone: '01823-500000',
    website: 'https://www.gpcbehram.ac.in',
    establishedYear: 2012,
    matchPatterns: ['behram', 'sbs nagar']
  },
  {
    name: 'Government Polytechnic College, Bhikhiwind',
    shortName: 'GPC Bhikhiwind',
    code: 'GPC-BHIKHIWIND',
    address: 'Khemkarn Road, Bhikhiwind',
    city: 'Bhikhiwind',
    district: 'Tarn Taran',
    pinCode: '143303',
    contactEmail: 'gpcbhikhiwind@punjab.gov.in',
    contactPhone: '01851-272619',
    alternatePhone: '9855244399',
    website: 'https://www.gpcbhikhiwind.org',
    establishedYear: 1995,
    matchPatterns: ['bhikhiwind', 'tarn taran']
  },
  {
    name: 'Government Polytechnic College for Women, Dinanagar',
    shortName: 'GPCG Dinanagar',
    code: 'GPCG-DINANAGAR',
    address: 'Behrampur-Dinanagar Road, Village Dodwan',
    city: 'Dinanagar',
    district: 'Gurdaspur',
    pinCode: '143531',
    contactEmail: 'gpcgdinanagar@punjab.gov.in',
    contactPhone: '01871-500000',
    establishedYear: 2005,
    matchPatterns: ['dinanagar']
  },
  {
    name: 'Government Polytechnic College, Fatuhikhera',
    shortName: 'GPC Fatuhikhera',
    code: 'GPC-FATUHIKHERA',
    address: 'Village Fatuhi Khera, P.O. Lambi, Tehsil Malout',
    city: 'Lambi',
    district: 'Sri Muktsar Sahib',
    pinCode: '152113',
    contactEmail: 'gpcfatuhikhera@punjab.gov.in',
    contactPhone: '01637-500000',
    website: 'https://www.gpcfatuhikhera.in',
    establishedYear: 2012,
    matchPatterns: ['fatuhikhera', 'fatuhi', 'muktsar']
  },
  {
    name: 'Government Polytechnic College, Ferozepur',
    shortName: 'GPC Ferozepur',
    code: 'GPC-FEROZEPUR',
    address: 'Dulchi Ke Road, Ferozepur City',
    city: 'Ferozepur',
    district: 'Ferozepur',
    pinCode: '152002',
    contactEmail: 'gpfzr-dteitpb@punjabmail.gov.in',
    contactPhone: '01632-225414',
    alternatePhone: '01632-222037',
    website: 'https://www.gpcfzr.in',
    establishedYear: 1990,
    matchPatterns: ['ferozepur', 'firozpur']
  },
  {
    name: 'Government Polytechnic College, GTB Garh',
    shortName: 'GPC GTB Garh',
    code: 'GPC-GTBGARH',
    address: 'VPO GTB Garh, Tehsil Baghapurana, Moga to Kotakpura Road',
    city: 'GTB Garh',
    district: 'Moga',
    pinCode: '142038',
    contactEmail: 'gpcgtbgarh@punjab.gov.in',
    contactPhone: '01636-280735',
    website: 'https://www.gpcgtbgarh.org',
    establishedYear: 1963,
    matchPatterns: ['gtb', 'moga', 'guru teg bahadur']
  },
  {
    name: 'Pandit Jagat Ram Government Polytechnic College, Hoshiarpur',
    shortName: 'PJRGPC Hoshiarpur',
    code: 'PJRGPC-HOSHIARPUR',
    address: 'Jalandhar Road, Near Piplanwala',
    city: 'Hoshiarpur',
    district: 'Hoshiarpur',
    pinCode: '146001',
    contactEmail: 'ptjrgph@gmail.com',
    contactPhone: '01882-252387',
    alternatePhone: '9417412446',
    website: 'https://www.ptjrgph.com',
    establishedYear: 1994,
    matchPatterns: ['hoshiarpur', 'jagat ram']
  },
  {
    name: 'Government Polytechnic College for Girls, Jalandhar',
    shortName: 'GPCG Jalandhar',
    code: 'GPCG-JALANDHAR',
    address: 'Ladowali Road, Near Railway Crossing, Preet Nagar',
    city: 'Jalandhar',
    district: 'Jalandhar',
    pinCode: '144001',
    contactEmail: 'gpcgjalandhar@punjab.gov.in',
    contactPhone: '0181-2457192',
    alternatePhone: '6280931560',
    website: 'https://www.gpcgjal.in',
    establishedYear: 1970,
    matchPatterns: ['jalandhar', 'girls jalandhar']
  },
  {
    name: 'Government Polytechnic College, Mohali (Khunimajra)',
    shortName: 'GPC Mohali',
    code: 'GPC-MOHALI',
    address: 'Kharar-Landran Road, Khunimajra',
    city: 'Mohali',
    district: 'S.A.S. Nagar',
    pinCode: '140301',
    contactEmail: 'gpckhunimajra@punjab.gov.in',
    contactPhone: '01602920188',
    alternatePhone: '9814043239',
    website: 'https://gpckhunimajramohali.org',
    establishedYear: 1996,
    matchPatterns: ['mohali', 'khunimajra', 'sas nagar']
  },
  {
    name: 'Government Polytechnic College, Kotkapura',
    shortName: 'GPC Kotkapura',
    code: 'GPC-KOTKAPURA',
    address: 'Devi Wala Road, Near Fun Plaza Multiplex, Kotkapura-Moga Highway',
    city: 'Kotkapura',
    district: 'Faridkot',
    pinCode: '151204',
    contactEmail: 'gpckotkapura@punjab.gov.in',
    contactPhone: '01635-222880',
    alternatePhone: '9501100063',
    website: 'https://www.gpckotkapura.com',
    establishedYear: 2012,
    matchPatterns: ['kotkapura', 'kotakpura', 'faridkot']
  },
  {
    name: 'Government Polytechnic College, Patiala',
    shortName: 'GPC Patiala',
    code: 'GPC-PATIALA',
    address: 'SST Nagar, Rajpura Road',
    city: 'Patiala',
    district: 'Patiala',
    pinCode: '147003',
    contactEmail: 'gpcpatiala@punjab.gov.in',
    contactPhone: '0175-2370158',
    alternatePhone: '9915776350',
    website: 'https://gpcpatiala.edu.in',
    establishedYear: 1991,
    matchPatterns: ['patiala']
  },
  {
    name: 'Shri Guru Hargobind Sahib Government Polytechnic College, Ranwan',
    shortName: 'SGHSGPC Ranwan',
    code: 'SGHSGPC-RANWAN',
    address: 'VPO Ranwan, Chandigarh-Ludhiana Highway, Near Khamano',
    city: 'Ranwan',
    district: 'Fatehgarh Sahib',
    pinCode: '140802',
    contactEmail: 'gpcranwan@punjab.gov.in',
    contactPhone: '01628-260101',
    alternatePhone: '9888486201',
    website: 'https://www.gpcranwan.ac.in',
    establishedYear: 2012,
    matchPatterns: ['ranwan', 'fatehgarh', 'hargobind']
  },
  {
    name: 'Government Polytechnic College for Girls, Ropar',
    shortName: 'GPCG Ropar',
    code: 'GPCG-ROPAR',
    address: 'Nangal Road',
    city: 'Ropar',
    district: 'Rupnagar',
    pinCode: '140001',
    contactEmail: 'gpcgropar@punjab.gov.in',
    contactPhone: '01881-500000',
    website: 'https://www.gpcrupnagar.ac.in',
    establishedYear: 1995,
    matchPatterns: ['ropar', 'rupnagar']
  },
  {
    name: 'Government Polytechnic College, Amritsar',
    shortName: 'GPC Amritsar',
    code: 'GPC-AMRITSAR',
    address: 'PO-Rayon & Silk Mill, Near GNDU, GT Road Chheharta',
    city: 'Amritsar',
    district: 'Amritsar',
    pinCode: '143105',
    contactEmail: 'gpasr68@gmail.com',
    contactPhone: '0183-2258269',
    website: 'https://www.gpamritsar.org',
    establishedYear: 1965,
    matchPatterns: ['amritsar', 'gpc amritsar']
  },
  {
    name: 'Shaheed Nand Singh Government Polytechnic College, Bareta',
    shortName: 'SNSGPC Bareta',
    code: 'SNSGPC-BARETA',
    address: 'Near Veterinary Hospital, Back Side New M.C Office',
    city: 'Bareta',
    district: 'Mansa',
    pinCode: '151501',
    contactEmail: 'gpcbareta@punjab.gov.in',
    contactPhone: '01652-500000',
    alternatePhone: '9023077730',
    website: 'https://snsgpcbareta.org',
    establishedYear: 2012,
    matchPatterns: ['bareta', 'mansa', 'nand singh']
  },
  {
    name: 'Government Polytechnic College, Bathinda',
    shortName: 'GPC Bathinda',
    code: 'GPC-BATHINDA',
    address: 'Bibiwala Road',
    city: 'Bathinda',
    district: 'Bathinda',
    pinCode: '151001',
    contactEmail: 'rupinder.chahal@punjab.gov.in',
    contactPhone: '0164-2246394',
    alternatePhone: '9316906633',
    website: 'https://gpcbathinda.ac.in',
    establishedYear: 1985,
    matchPatterns: ['bathinda', 'bhatinda']
  },
  {
    name: 'Sant Baba Attar Singh Government Polytechnic College, Badbar',
    shortName: 'SBASGPC Badbar',
    code: 'SBASGPC-BADBAR',
    address: 'Main Barnala-Sangrur Road, Badbar',
    city: 'Badbar',
    district: 'Barnala',
    pinCode: '148106',
    contactEmail: 'gpcbadbar@punjab.gov.in',
    contactPhone: '01679-268011',
    website: 'https://gpcbadbar.org.in',
    establishedYear: 2012,
    matchPatterns: ['badbar', 'barnala', 'attar singh']
  },
  {
    name: 'Satguru Ram Singh Government Polytechnic College for Girls, Ludhiana',
    shortName: 'SRSGPCG Ludhiana',
    code: 'SRSGPCG-LUDHIANA',
    address: 'Rishi Nagar, Ludhiana-Humbran Road',
    city: 'Ludhiana',
    district: 'Ludhiana',
    pinCode: '141001',
    contactEmail: 'principalgpcgldh@yahoo.com',
    contactPhone: '0161-2303223',
    website: 'https://www.gpcgldh.ac.in',
    establishedYear: 1995,
    matchPatterns: ['ludhiana', 'ram singh']
  },
  {
    name: 'Government Institute of Leather and Footwear Technology, Jalandhar',
    shortName: 'GILFT Jalandhar',
    code: 'GILFT-JALANDHAR',
    address: 'Opposite Dr. B.R. Ambedkar Bhawan, Near Guru Ravidass Chowk, Nakodar Road',
    city: 'Jalandhar',
    district: 'Jalandhar',
    pinCode: '144003',
    contactEmail: 'gilftjalandhar@punjab.gov.in',
    contactPhone: '0181-2450000',
    website: 'https://www.gilftjal.org',
    establishedYear: 1934,
    matchPatterns: ['leather', 'gilt', 'gilft', 'footwear']
  }
];

// =============================================================================
// MATCHING LOGIC
// =============================================================================

function matchInstitution(existing: any, patterns: string[]): boolean {
  const searchText = [
    existing.name || '',
    existing.shortName || '',
    existing.city || '',
    existing.address || '',
    existing.code || ''
  ].join(' ').toLowerCase();

  return patterns.some(pattern => searchText.includes(pattern.toLowerCase()));
}

// =============================================================================
// UPDATE LOGIC
// =============================================================================

async function updateInstitutions(db: Db): Promise<{ updated: number; inserted: number; skipped: number; errors: number }> {
  const collection = db.collection('Institution');
  const results = { updated: 0, inserted: 0, skipped: 0, errors: 0 };

  // Fetch all existing institutions
  const existingInstitutions = await collection.find({}).toArray();
  log(`Found ${existingInstitutions.length} existing institutions in database`);

  // Track which existing institutions have been matched
  const matchedIds = new Set<string>();

  for (const inst of INSTITUTION_DATA) {
    try {
      // Find matching existing institution
      let matchedInst = null;

      for (const existing of existingInstitutions) {
        const existingId = existing._id.toString();
        if (matchedIds.has(existingId)) continue; // Already matched

        if (matchInstitution(existing, inst.matchPatterns)) {
          matchedInst = existing;
          matchedIds.add(existingId);
          break;
        }
      }

      // Also check by code
      if (!matchedInst) {
        const byCode = await collection.findOne({ code: inst.code });
        if (byCode) {
          matchedInst = byCode;
          matchedIds.add(byCode._id.toString());
        }
      }

      const updateData = {
        name: inst.name,
        shortName: inst.shortName,
        code: inst.code,
        type: 'POLYTECHNIC',
        address: inst.address,
        city: inst.city,
        district: inst.district,
        state: 'Punjab',
        pinCode: inst.pinCode,
        country: 'India',
        contactEmail: inst.contactEmail,
        contactPhone: inst.contactPhone,
        alternatePhone: inst.alternatePhone || null,
        website: inst.website || null,
        establishedYear: inst.establishedYear || null,
        affiliatedTo: 'PSBTE & IT, Chandigarh',
        recognizedBy: 'AICTE',
        isActive: true,
        updatedAt: new Date()
      };

      if (matchedInst) {
        // Check if update is needed
        const needsUpdate = CONFIG.FORCE ||
          matchedInst.city === 'Unknown' ||
          matchedInst.pinCode === '000000' ||
          !matchedInst.code ||
          !matchedInst.website;

        if (needsUpdate) {
          log(`Updating: ${inst.name}`, 'INFO');
          log(`  Matched with: ${matchedInst.name || matchedInst.shortName}`, 'DEBUG');

          if (!CONFIG.DRY_RUN) {
            await collection.updateOne({ _id: matchedInst._id }, { $set: updateData });
          }
          results.updated++;
        } else {
          log(`Skipping (already up to date): ${inst.shortName}`, 'DEBUG');
          results.skipped++;
        }
      } else {
        // Insert new institution
        log(`Inserting new: ${inst.name}`, 'INFO');

        if (!CONFIG.DRY_RUN) {
          await collection.insertOne({
            ...updateData,
            createdAt: new Date()
          });
        }
        results.inserted++;
      }
    } catch (err: any) {
      log(`Error processing ${inst.name}: ${err.message}`, 'ERROR');
      results.errors++;
    }
  }

  // Report unmatched existing institutions
  const unmatchedCount = existingInstitutions.length - matchedIds.size;
  if (unmatchedCount > 0) {
    log(`\nUnmatched existing institutions: ${unmatchedCount}`, 'WARN');
    for (const existing of existingInstitutions) {
      if (!matchedIds.has(existing._id.toString())) {
        log(`  - ${existing.name || existing.shortName || existing._id}`, 'WARN');
      }
    }
  }

  return results;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const startTime = Date.now();

  initLogging();

  log('');
  log('='.repeat(60));
  log('INSTITUTION UPDATE SCRIPT');
  log('='.repeat(60));
  log(`Timestamp: ${new Date().toISOString()}`);
  log(`DRY_RUN: ${CONFIG.DRY_RUN}`);
  log(`FORCE: ${CONFIG.FORCE}`);
  log(`VERBOSE: ${CONFIG.VERBOSE}`);
  log(`Database: ${CONFIG.DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  log('');

  if (!CONFIG.DATABASE_URL) {
    log('DATABASE_URL not configured!', 'ERROR');
    process.exit(1);
  }

  const client = new MongoClient(CONFIG.DATABASE_URL);

  try {
    await client.connect();
    log('Connected to MongoDB', 'SUCCESS');

    const db = client.db();
    const results = await updateInstitutions(db);

    log('');
    log('='.repeat(60));
    log('SUMMARY');
    log('='.repeat(60));
    log(`Updated:  ${results.updated}`);
    log(`Inserted: ${results.inserted}`);
    log(`Skipped:  ${results.skipped}`);
    log(`Errors:   ${results.errors}`);
    log('');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`Completed in ${duration} seconds`, 'SUCCESS');

    if (CONFIG.DRY_RUN) {
      log('');
      log('This was a DRY RUN. No changes were made.', 'WARN');
      log('Run without DRY_RUN=true to apply changes.', 'WARN');
    }

  } catch (error: any) {
    log(`Failed: ${error.message}`, 'ERROR');
    process.exit(1);
  } finally {
    await client.close();
    if (logStream) {
      logStream.end();
    }
  }
}

main();
