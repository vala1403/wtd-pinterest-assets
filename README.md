# WTD Pinterest Assets

This is an independent static asset host for AV Slices' Weekly Tarot Digest Pinterest publishing workflow.

The project stores finished zodiac artwork under `public/decks/` so deployment can expose stable public image URLs for Pinterest bulk publishing. It is separate from the Weekly Tarot Digest website and should not access, modify, deploy, or change that website or its repository.

## Master Artwork

The master zodiac artwork is stored locally at:

```text
C:\tarot-digest-images
```

Master artwork must only ever be copied from that location. Do not move, rename, resize, recompress, edit, or delete the original files.

## Weekly Folder Convention

Each weekly Pinterest deck should be added as:

```text
public/decks/YYYY-MM-DD/
```

The date should be the Monday/start date for that Weekly Tarot Digest issue.

Each dated folder should contain exactly these 12 PNG files:

```text
aries.png
taurus.png
gemini.png
cancer.png
leo.png
virgo.png
libra.png
scorpio.png
sagittarius.png
capricorn.png
aquarius.png
pisces.png
```

## Public URL Convention

After deployment, files should be available at predictable paths:

```text
/decks/YYYY-MM-DD/aries.png
/decks/YYYY-MM-DD/taurus.png
```

For example:

```text
/decks/2026-10-05/aries.png
```

## Adding Future Weekly Decks

1. Confirm the completed source folder exists under `C:\tarot-digest-images`.
2. Confirm it contains the 12 expected zodiac PNGs.
3. Create a dated folder under `public/decks/YYYY-MM-DD/`.
4. Copy the PNGs into the dated folder.
5. Verify the copied files match the expected names and that the master artwork remains unchanged.
6. Deploy only after local verification is complete.

## Hosting Approach

This project uses a minimal Node build script for Vercel. The build copies `public/` to `dist/`, and Vercel serves `dist/` as the static output directory. This keeps the project framework-free while preserving the desired URL convention.
