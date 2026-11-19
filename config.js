// ============================================================
//  Hier alles anpassen – Namen, Gutschein-Text, Schwierigkeit
// ============================================================
window.GAME_CONFIG = {
  // Name der beschenkten Person
  recipientName: "Malte",

  // Von wem ist das Geschenk?
  fromName: "Katja",

  // Text auf dem Gewinn-Bildschirm
  winTitle: "Herzlichen Glückwunsch zum Geburtstag!",
  winText:
    "Das war fast genauso beeindruckend wie ein Pistaccio-Eclaire! " +
    "Alles Liebe zum Geburtstag! 🎂",

  // Der Gutschein
  voucher: {
    heading: "GUTSCHEIN",
    title: "Ein Arcade-Spiele-Tag",
    details: "In Berlin",
    code: "BIBER34",
    // Vorderseite der Karte: Logo (wird schwarz eingefärbt) auf farbigem Grund
    logo: "logo/es-webdev-vorlage-02.png",
    cardColor: "#ff4413",
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
  //  Lieder zur Auswahl
  //  Datei in den Ordner "music/" legen und hier einen Eintrag
  //  hinzufügen – jeder Eintrag erscheint auf dem Auswahl-Bildschirm.
  //  Tempo und Beats werden automatisch erkannt.
  //  Ein Eintrag mit file: "" spielt die eingebaute Musik.
  //
  //  Mögliche Felder pro Lied:
  //    file      Pfad zur Datei (MP3, M4A, OGG, WAV)
  //    title     Anzeigename (leer = Dateiname)
  //    artist    kleine Zeile unter dem Titel (optional)
  //    startAt   ab Sekunde X im Lied starten
  //    duration  so viele Sekunden lang spielen
  //    volume    Lautstärke, 1 = normal
  //    mode      Wie die Noten gesetzt werden:
  //                "auto"  = selbst erkennen (Standard)
  //                "beat"  = festes Beat-Raster – für gleichmäßigen Takt (Lofi, Pop, Elektro)
  //                "onset" = auf hörbare Einsätze – für Tempowechsel (Klassik, Live-Musik)
  //    bpm, firstBeat   nur falls die Erkennung danebenliegt
  //                     (Seite mit ?debug öffnen zeigt die erkannten Werte)
  // ----------------------------------------------------------
  songs: [
    { file: "music/hungarian_dance.mp3", title: "Hungarian Dance", artist: "Johannes Brahms", startAt: 0, duration: 90, mode: "auto" },
     { file: "music/fairy.mp3", title: "Fairy Fountain", artist: "", startAt: 0, duration: 52 },
     { file: "music/Song.mp3", title: "Song Of Storms", artist: "", startAt: 0, duration: 64 }
    // { file: "music/lied-4.mp3", title: "Lied 4", artist: "", startAt: 0, duration: 90 },
    // { file: "", title: "Eingebauter Beat" },
  ],

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
