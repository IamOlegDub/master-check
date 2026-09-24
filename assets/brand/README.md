# Brand assets

- `original.png`: the artwork supplied by the project owner.
- `logo-master.png`: transparent logo prepared from that artwork with imagegen.
- `../../public/icons/logo.png`: transparent logo used in the interface.
- `../../public/icons/icon-{192,512,1024}.png`: opaque application icons.
- `../../public/icons/maskable-{192,512}.png`: icons with extra padding for Android masks.
- `../../public/icons/apple-touch-icon.png`: opaque 180 × 180 iOS icon.
- `../../src/app/favicon.ico`: browser favicon containing 16, 32 and 48 px images.

Regenerate the deployable assets from the project root with `node scripts/build-icons.cjs`.
The script uses Sharp bundled with Next.js; it does not invoke image generation.
