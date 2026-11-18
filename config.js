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

  // ----------------------------------------------------------
  //  Eigener Song (optional)
  //  Datei z.B. in den Ordner "music/" legen und hier eintragen.
  //  Tempo und Beats werden automatisch erkannt. Ohne Datei
  //  (file: "") läuft die eingebaute Musik.
  // ----------------------------------------------------------
  song: {
    file: "music/hungarian_dance.mp3",                // z.B. "music/mein-lied.mp3"
    title: "",               // wird auf dem Startbildschirm angezeigt
    startAt: 0,              // ab Sekunde X im Lied starten
    duration: 90,            // so viele Sekunden lang spielen
    volume: 1,
    // Wie die Noten gesetzt werden:
    //  "auto"  = selbst erkennen (Standard)
    //  "beat"  = festes Beat-Raster – für Lieder mit gleichmäßigem Takt (Lofi, Pop, Elektro)
    //  "onset" = auf die hörbaren Einsätze – für Lieder mit Tempowechseln (Klassik, Live-Musik)
    mode: "auto",
    // Nur falls die automatische Erkennung danebenliegt
    // (Startseite mit ?debug zeigt die erkannten Werte):
    bpm: null,               // z.B. 85
    firstBeat: null,         // Sekunde des ersten Beats im Lied, z.B. 0.42
  },

  // Klick-Geräusch beim Treffen
  hitSounds: true,

  // Tempo der eingebauten Musik (Beats pro Minute)
  bpm: 124,

  // Falls Taps sich systematisch zu früh/spät anfühlen (z.B. Bluetooth-Kopfhörer):
  // positiver Wert = Noten kommen später. In Millisekunden.
  audioOffsetMs: 0,

  // Zufalls-Seed für das Notenmuster (anderer Wert = anderes Muster)
  seed: 1118,
};
