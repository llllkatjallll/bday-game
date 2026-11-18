// ============================================================
//  Hier alles anpassen – Namen, Gutschein-Text, Schwierigkeit
// ============================================================
window.GAME_CONFIG = {
  // Name der beschenkten Person
  recipientName: "Geburtstagskind",

  // Von wem ist das Geschenk?
  fromName: "Katja",

  // Text auf dem Gewinn-Bildschirm
  winTitle: "Herzlichen Glückwunsch zum Geburtstag!",
  winText:
    "Du hast nicht nur den Beat getroffen, sondern dir auch dein Geschenk erspielt. " +
    "Alles Liebe zum Geburtstag! 🎂",

  // Der Gutschein
  voucher: {
    heading: "GUTSCHEIN",
    title: "Ein Arcade-Spiele-Tag",
    details: "Inklusive Spielguthaben, Snacks und jeder Menge Highscores. Termin suchst du dir aus! 🕹️",
    code: "ARCADE-2026",
  },

  // Standard-Schwierigkeit: "easy", "normal" oder "hard"
  difficulty: "normal",

  // Wie viele Punkte (von 1.000.000) braucht man zum Gewinnen?
  passScore: {
    easy: 600000,
    normal: 700000,
    hard: 750000,
  },

  // Tempo des Songs (Beats pro Minute)
  bpm: 124,

  // Falls Taps sich systematisch zu früh/spät anfühlen (z.B. Bluetooth-Kopfhörer):
  // positiver Wert = Noten kommen später. In Millisekunden.
  audioOffsetMs: 0,

  // Zufalls-Seed für das Notenmuster (anderer Wert = anderes Muster)
  seed: 1118,
};
