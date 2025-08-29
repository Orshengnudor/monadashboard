// src/gameData.js
// Auto-generate gameData from files in src/logos/
// - Put your .jpg/.jpeg/.png logos in src/logos/
// - Filenames will be used as the display/answer text (e.g., "Mozi.jpg" -> "Mozi")
// - Options are randomized every time this module is imported

// NOTE: Uses Vite's import.meta.glob with { eager: true }.
// If you use a different bundler, you may need to adapt.
const modules = import.meta.glob('./logos/*.{jpg,jpeg,png}', { eager: true });

/**
 * Helper: simple random shuffle (Fisher–Yates)
 */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Parse modules into an array of { filename, name, url }
const items = Object.keys(modules).map((p) => {
  const parts = p.split('/');
  const filename = parts[parts.length - 1]; // e.g., "Mozi.jpg"
  const name = filename.replace(/\.(jpg|jpeg|png)$/i, ''); // e.g., "Mozi"
  const url = modules[p]?.default || modules[p]; // module default export is the URL
  return { filename, name, url };
});

// Pool of all names for distractors
const allNames = items.map((it) => it.name);

// Build gameData: pick 3 random distractors + correct answer, then shuffle options
const gameData = items.map((it) => {
  // get 3 random distractors
  const pool = allNames.filter((n) => n !== it.name);
  const distractors = shuffleArray(pool).slice(0, 3);

  // combine with correct answer and shuffle
  const options = shuffleArray([...distractors, it.name]);

  return {
    logo: it.url,
    options,
    answer: it.name,
  };
});

// Shuffle the order of logos so each play displays images in random order
export default shuffleArray(gameData);
