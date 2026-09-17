# Toskana 2027

Eigene Reisefotos, mit der integrierten Codex-Bildgenerierung im Stil historischer Gemälde neu interpretiert.

Website: https://lutzkohl.github.io/Toskana-Impessionismus-2027/

Sechs Orte: Lucca, Pisa, Casale Marittimo, Bolgheri, Populonia und Cecina Mare. Im Gestaltungsatelier unter `atelier/` lassen sich vier Blattlayouts vergleichen. Populonia zeigt exemplarisch vier Ausgangsfotos mit jeweils drei Malervarianten: Signac, Monet und Cézanne – zwölf Bilder im direkten Vergleich. Cecina Mare ergänzt zwei Küstenmotive mit jeweils Monet, Signac und Giovanni Fattori. Jede Monatsauswahl merkt sich Bild und Layout. Zu jedem gemalten Bild gibt es eine eigene Begleitseite mit Ausgangsfoto, Stilvorbild, Malertext und Quellen. Die stabilen URLs unter `bilder/` werden für die QR-Codes des Kalenders verwendet.

Die Auswahl auf der Website wird nur im jeweiligen Browser gespeichert. Export/Import über JSON erlaubt die Übergabe an die lokale Werkstatt. Die Website selbst hat keinen Serverdienst und keine Bildgenerierungs-API.

Unter `bestellen/` ist eine Vorschau der Bestellseite mit 10 € je Kalender und einmalig 5 € Versand zu sehen. In der Vorschau werden keine Bestellungen, Adressen oder Zahlungen übermittelt. Die private Google-Bestellablage, Zahlungslinks, Verkäuferangaben und Liefertermin müssen vor dem Verkaufsstart eingerichtet werden. Der vorbereitete Ablauf erfasst zunächst unbezahlte Anfragen; Zahlungseingänge werden beim Zahlungsanbieter abgeglichen.

Die PDFs sind A3-Gestaltungsentwürfe für 2027. Das Layout berücksichtigt die SAXOPRINT-Vorlage mit 20 mm Bindungsabstand. Lokal liegt zusätzlich eine Formatprobe mit 2 mm Beschnitt. Die endgültige Bildauflösung, Farbumwandlung und PDF/X-Ausgabe folgen nach der Bildauswahl. Die beispielhaften Monate sind noch keine finale Belegung.

## Veröffentlichung

GitHub Pages liefert den Branch `main`, Ordner `/`, aus. Die Dateien werden aus dem lokalen Kalender-Toskana-Projekt mit `tools/export_kalender.py` erzeugt. Veröffentlicht werden ausgewählte Bilder, EXIF-freie Fotokopien (für die Beispielstadt Populonia alle vier) und Begleittexte; keine unbearbeiteten Quellen, Schlüssel oder privaten Bewertungen.

## Bildnachweise

Historische Vorbilder und Werkquellen sind auf der jeweiligen Begleitseite angegeben. Die KI-Interpretationen sind neue Bilder und keine Werke der genannten Maler. Eigene Reiseaufnahmen stammen aus dem Kalenderprojekt. Für die eigenen Fotos wird hier keine allgemeine Nachnutzungslizenz erteilt.
