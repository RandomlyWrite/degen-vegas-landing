# Reference-Matched Landing Page Verification

## Desktop viewport — 1280 × 720

The portrait poster is centered on a charcoal-black field, preserving the uploaded 2:3 composition. The top leaderboard, marquee, smoky casino doorway, neon side signs, framed corners, bottom action buttons, preview hint, and footer copy all remain legible. The overall silhouette matches the reference image rather than the previous generic centered hero.

## Mobile viewport — 375 × 812

The poster scales proportionally inside the viewport with safe margins. The title, entrance, action buttons, card corners, sound control, preview hint, and disclaimer remain visible without horizontal overflow. The sound control collapses to icon-only on narrow screens to preserve the reference composition.

## Interaction coverage

The HTML overlay exposes accessible buttons for sound, Verify Fairness, and Enter the Lounge. Both CTA hotspots open a lightweight dialog state; Escape and the close control dismiss it. The visual artwork remains the source of truth while interactive behavior stays in HTML rather than baked into the image.

## Asset

Reference artwork is served from `/manus-storage/degen-vegas-reference_3873d095.png` and is used with `object-fit: cover` inside the 2:3 poster frame.

## Browser interaction verification

The live preview rendered the reference poster and exposed the sound toggle plus both CTA hotspots. Clicking Verify Fairness opened the expected modal dialog with the title "VERIFY THE HOUSE." and a dismiss action. The preview remains visually intact behind the modal with the intended backdrop blur.

The Enter the Lounge hotspot also opens its expected modal state with the title "THE LOUNGE IS WAITING." and the dismiss action "KEEP ME OUTSIDE." Both primary actions are therefore wired and visually tested in the live preview.
