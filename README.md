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
