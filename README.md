# Beat Tap 🎂🕹️

Ein kleines Rhythmus-Spiel für Handy & Tablet als Geburtstags-Überraschung:
Auf einem 4×4-Raster füllen sich Felder im Takt der Musik – im richtigen Moment antippen
(Multitouch, also auch zwei Felder gleichzeitig). Wer genug Punkte holt, bekommt am Ende den
**Gutschein für einen Arcade-Spiele-Tag** angezeigt.

Kein Build, keine Abhängigkeiten – nur `index.html`, `style.css`, `game.js`, `config.js`.
Die Musik wird live im Browser per Web Audio erzeugt, es gibt keine Audiodateien.

## Anpassen

Alles Persönliche steht in [`config.js`](config.js):

- `recipientName`, `fromName` – Namen
- `winTitle`, `winText` – Glückwünsche
- `voucher` – Gutschein-Text und Code
- `difficulty`, `passScore` – Schwierigkeit und benötigte Punkte
- `audioOffsetMs` – falls sich das Timing (z. B. mit Bluetooth-Kopfhörern) verschoben anfühlt

**Vorschau des Gutscheins** ohne zu spielen: `index.html?win` aufrufen.

## Eigenen Song verwenden

1. Audiodatei (MP3, M4A, OGG oder WAV) in den Ordner `music/` legen.
2. In `config.js` unter `song` eintragen:
   ```js
   song: { file: "music/mein-lied.mp3", title: "Mein Lied", startAt: 0, duration: 90 },
   ```
3. Fertig – die Musik wird beim Laden analysiert und die Noten passend gesetzt. Dafür gibt es
   zwei Modi, die automatisch gewählt werden:
   - **Beat-Raster** für Lieder mit gleichmäßigem Takt (Lofi, Pop, Elektro): Noten auf den
     Schlägen, inkl. geswingter Offbeats.
   - **Einsätze** für Lieder mit Tempowechseln (z. B. Klassik): Noten genau dort, wo hörbar ein
     Ton/Schlag einsetzt.

Kontrolle: Startseite mit `?debug` öffnen, dann wird z. B. „Song erkannt: 85.00 BPM, …,
Raster-Treffer 62 % → Modus „Beat-Raster““ angezeigt. Passt der Modus nicht, in der Config
`mode: "beat"` oder `mode: "onset"` erzwingen. Liegt im Beat-Modus das Tempo daneben
(typisch: halbes/doppeltes Tempo), `bpm` und ggf. `firstBeat` von Hand setzen. Zum schnellen Ausprobieren geht auch
`index.html?song=music/mein-lied.mp3&debug`.

Hinweis: Wird das Spiel öffentlich gehostet (z. B. GitHub Pages), ist auch die Audiodatei
öffentlich abrufbar.

## Lokal testen

```bash
python -m http.server 8173
```

Dann `http://localhost:8173` öffnen. Auf dem Handy im selben WLAN: `http://<IP-des-PCs>:8173`.

## Online stellen (z. B. GitHub Pages)

Repo auf GitHub pushen → *Settings → Pages → Deploy from branch → `main` / root*.
Den Link dann verschenken (oder als QR-Code auf eine Karte drucken).

## Hinweise

- Ton muss an sein. Auf dem iPhone spielt Safari ab iOS 16.4 auch bei Stummschalter.
- Wechselt man während einer Runde die App, pausiert das Spiel automatisch.
- Nach zwei verlorenen Runden wird „Etwas leichter probieren“ angeboten – damit das
  Geburtstagskind auf jeden Fall an sein Geschenk kommt.
