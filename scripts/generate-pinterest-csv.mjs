import { readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ASSET_DOMAIN = "https://wtd-pinterest-assets.vercel.app";
const BOARD_NAME = "Weekly Tarot Digest";
const DIGEST_DOMAIN = "https://weekly-tarot-digest.vercel.app";

const signs = [
  ["aries", "Aries"],
  ["taurus", "Taurus"],
  ["gemini", "Gemini"],
  ["cancer", "Cancer"],
  ["leo", "Leo"],
  ["virgo", "Virgo"],
  ["libra", "Libra"],
  ["scorpio", "Scorpio"],
  ["sagittarius", "Sagittarius"],
  ["capricorn", "Capricorn"],
  ["aquarius", "Aquarius"],
  ["pisces", "Pisces"]
];

const headers = [
  "Title",
  "Media URL",
  "Pinterest board",
  "Description",
  "Link"
];

const root = resolve(import.meta.dirname, "..");
const decksRoot = resolve(root, "public", "decks");
const videosRoot = resolve(root, "public", "videos");
const exportsRoot = resolve(root, "exports");

function usage() {
  console.error("Usage: npm run generate:pinterest -- YYYY-MM-DD [YYYY-MM-DD ...] [--media image|video] [--skip sign[,sign]] [--suffix name] [--output file.csv]");
  console.error("       npm run generate:pinterest -- --all [--media image|video] [--skip sign[,sign]] [--suffix name]");
}

function parseDeckDate(deckDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deckDate)) {
    throw new Error(`Invalid deck date "${deckDate}". Expected YYYY-MM-DD.`);
  }

  const [year, month, day] = deckDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date "${deckDate}".`);
  }

  return date;
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function monthName(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC"
  }).format(date);
}

function formatWeekRange(deckDate) {
  const start = parseDeckDate(deckDate);
  const end = addUtcDays(start, 6);
  const startMonth = monthName(start);
  const endMonth = monthName(end);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const year = end.getUTCFullYear();

  if (start.getUTCFullYear() === end.getUTCFullYear() && startMonth === endMonth) {
    return `${startMonth} ${startDay}–${endDay}, ${year}`;
  }

  return `${startMonth} ${startDay}–${endMonth} ${endDay}, ${year}`;
}

function csvCell(value) {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function csvLine(values) {
  return values.map(csvCell).join(",");
}

async function listDeckDatesFromDisk() {
  const entries = await readdir(decksRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function validateDeckFiles(deckDate) {
  const deckPath = resolve(decksRoot, deckDate);
  if (!existsSync(deckPath)) {
    throw new Error(`Deck folder not found: ${deckPath}`);
  }

  const files = (await readdir(deckPath, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const expected = signs.map(([slug]) => `${slug}.png`).sort();
  const missing = expected.filter((name) => !files.includes(name));
  const extra = files.filter((name) => !expected.includes(name));

  if (missing.length || extra.length) {
    throw new Error(
      `Deck ${deckDate} must contain exactly the 12 zodiac PNGs. ` +
        `Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`
    );
  }
}

function parseArgs(args) {
  const options = {
    deckDates: [],
    all: false,
    media: "image",
    output: "",
    skipSigns: new Set(),
    suffix: ""
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--all") {
      options.all = true;
    } else if (arg === "--media") {
      const value = args[index + 1];
      if (!["image", "video"].includes(value)) {
        throw new Error("--media must be image or video.");
      }
      options.media = value;
      index += 1;
    } else if (arg === "--output") {
      const value = args[index + 1];
      if (!value || !/^[a-z0-9._-]+$/i.test(value)) {
        throw new Error("--output requires a simple CSV filename.");
      }
      options.output = value;
      index += 1;
    } else if (arg === "--skip") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--skip requires a comma-separated sign list.");
      }
      for (const sign of value.split(",")) {
        options.skipSigns.add(sign.trim().toLowerCase());
      }
      index += 1;
    } else if (arg === "--suffix") {
      const value = args[index + 1];
      if (!value || !/^[a-z0-9-]+$/i.test(value)) {
        throw new Error("--suffix requires a simple file suffix, such as retry.");
      }
      options.suffix = value;
      index += 1;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option "${arg}".`);
    } else {
      options.deckDates.push(arg);
    }
  }

  const validSigns = new Set(signs.map(([slug]) => slug));
  for (const sign of options.skipSigns) {
    if (!validSigns.has(sign)) {
      throw new Error(`Unknown sign in --skip: ${sign}`);
    }
  }

  return options;
}

function destinationLink(slug) {
  return `${DIGEST_DOMAIN}/digest-${slug}.html`;
}

function mediaUrl(deckDate, slug, media) {
  if (media === "video") {
    return `${ASSET_DOMAIN}/videos/${deckDate}/${slug}.mp4`;
  }

  return `${ASSET_DOMAIN}/decks/${deckDate}/${slug}.png`;
}

async function validateMediaFiles(deckDate, media) {
  const mediaRoot = media === "video" ? videosRoot : decksRoot;
  const extension = media === "video" ? "mp4" : "png";
  const folderPath = resolve(mediaRoot, deckDate);
  if (!existsSync(folderPath)) {
    throw new Error(`${media} folder not found: ${folderPath}`);
  }

  const files = (await readdir(folderPath, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const expected = signs.map(([slug]) => `${slug}.${extension}`).sort();
  const missing = expected.filter((name) => !files.includes(name));
  const extra = files.filter((name) => !expected.includes(name));

  if (missing.length || extra.length) {
    throw new Error(
      `${media} deck ${deckDate} must contain exactly the 12 zodiac ${extension.toUpperCase()} files. ` +
        `Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`
    );
  }
}

function buildRows(deckDate, options = {}) {
  const weekRange = formatWeekRange(deckDate);
  const skipSigns = options.skipSigns || new Set();
  const media = options.media || "image";

  return signs.filter(([slug]) => !skipSigns.has(slug)).map(([slug, label]) => {
    const title = `${label} Weekly Tarot Digest | ${weekRange}`;
    const pinMediaUrl = mediaUrl(deckDate, slug, media);
    const description =
      media === "video"
        ? `Weekly Tarot Digest compares 5 independent ${label} tarot readings for ${weekRange} and identifies the recurring themes.`
        : `Five independent ${label} tarot readings compared for ${weekRange}. ` +
          `See what themes echoed across the readings in this week's Weekly Tarot Digest.`;

    return {
      Title: title,
      "Media URL": pinMediaUrl,
      "Pinterest board": BOARD_NAME,
      Description: description,
      Link: destinationLink(slug)
    };
  });
}

function validateRows(deckDate, rows, options = {}) {
  const weekRange = formatWeekRange(deckDate);
  const skipSigns = options.skipSigns || new Set();
  const media = options.media || "image";
  const seenSigns = new Map();
  const expectedSigns = signs.map(([slug]) => slug).filter((slug) => !skipSigns.has(slug));

  if (rows.length !== expectedSigns.length) {
    throw new Error(`Deck ${deckDate} generated ${rows.length} rows, expected ${expectedSigns.length}.`);
  }

  for (const row of rows) {
    const sign = signs.find(([, label]) => row.Title.startsWith(`${label} `));
    if (!sign) {
      throw new Error(`Deck ${deckDate} has a row without a recognized zodiac title.`);
    }

    const [slug, label] = sign;
    seenSigns.set(slug, (seenSigns.get(slug) || 0) + 1);

    const expectedMediaUrl = mediaUrl(deckDate, slug, media);
    if (row["Media URL"] !== expectedMediaUrl) {
      throw new Error(`Deck ${deckDate} has incorrect media URL for ${label}.`);
    }

    if (row.Link !== destinationLink(slug)) {
      throw new Error(`Deck ${deckDate} has incorrect destination link for ${label}.`);
    }

    if (!row.Title.includes(weekRange)) {
      throw new Error(`Deck ${deckDate} title for ${label} is missing ${weekRange}.`);
    }

    if (!row.Description.includes(weekRange)) {
      throw new Error(`Deck ${deckDate} description for ${label} is missing ${weekRange}.`);
    }
  }

  const links = rows.map((row) => row.Link);
  const duplicateLinks = links.filter((link, index) => links.indexOf(link) !== index);
  if (duplicateLinks.length) {
    throw new Error(`Deck ${deckDate} has duplicate destination links: ${duplicateLinks.join(", ")}`);
  }

  const duplicates = [...seenSigns.entries()].filter(([, count]) => count !== 1);
  const missing = expectedSigns.filter((slug) => !seenSigns.has(slug));
  if (duplicates.length || missing.length) {
    throw new Error(
      `Deck ${deckDate} sign validation failed. ` +
        `Missing: ${missing.join(", ") || "none"}. ` +
        `Duplicate counts: ${
          duplicates.map(([slug, count]) => `${slug}=${count}`).join(", ") || "none"
        }.`
    );
  }
}

async function writeCsv(deckDate, options = {}) {
  const skipSigns = options.skipSigns || new Set();
  await validateMediaFiles(deckDate, options.media || "image");
  const rows = buildRows(deckDate, options);
  validateRows(deckDate, rows, options);

  const csv = [
    csvLine(headers),
    ...rows.map((row) => csvLine(headers.map((header) => row[header])))
  ].join("\r\n") + "\r\n";

  const suffix = options.suffix ? `-${options.suffix}` : "";
  const outputPath = options.output
    ? resolve(root, options.output)
    : resolve(exportsRoot, `pinterest-${deckDate}${suffix}.csv`);
  await writeFile(outputPath, csv, { encoding: "utf8" });

  return {
    deckDate,
    outputPath,
    rowCount: rows.length,
    weekRange: formatWeekRange(deckDate),
    skipped: [...skipSigns].join(", ") || "none"
  };
}

const args = process.argv.slice(2);
if (args.length === 0) {
  usage();
  process.exit(1);
}

const options = parseArgs(args);
const deckDates = options.all ? await listDeckDatesFromDisk() : options.deckDates;
const results = [];

for (const deckDate of deckDates) {
  results.push(await writeCsv(deckDate, options));
}

console.table(results);
