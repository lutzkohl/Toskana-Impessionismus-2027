# Toskana 2027

Eigene Reisefotos, mit der integrierten Codex-Bildgenerierung im Stil historischer Gemälde neu interpretiert.

Website: https://lutzkohl.github.io/Toskana-Impessionismus-2027/

Sieben Orte: Lucca, Pisa, Casale Marittimo, Bolgheri, Populonia, Cecina Mare und Castagneto Carducci. Im Gestaltungsatelier unter `atelier/` lassen sich vier Blattlayouts vergleichen. Die Vorauswahl konzentriert sich auf zwei unterschiedliche Maler je Monatsort: Pisa (Sisley/Seurat), Casale (Cézanne/Gauguin), Bolgheri (van Gogh/Bonnard), Populonia (Signac/Liebermann), Cecina Mare (Monet/Fattori) und Castagneto (Pissarro/Caillebotte). Lucca/Renoir ist für den Titel reserviert. Jeder Ort und jeder Maler darf nur einmal im Kalender vorkommen; Speichern und Import prüfen diese Regel. Frühere Varianten bleiben über den Archivschalter erreichbar. Insgesamt stehen 35 Bilder von 13 Malern bereit; weitere Orte ergänzen später den Jahresplan. Populonia zeigt exemplarisch vier Ausgangsfotos mit jeweils drei Malervarianten: Signac, Monet und Cézanne – zwölf Bilder im direkten Vergleich. Cecina Mare ergänzt zwei Küstenmotive mit jeweils Monet, Signac und Giovanni Fattori. Castagneto Carducci zeigt eine Abendgasse und das Orts-Panorama mit Pinienpark, jeweils nach Monet, Signac und Cézanne. Jede Monatsauswahl merkt sich Bild und Layout. Zu jedem gemalten Bild gibt es eine eigene Begleitseite mit Ausgangsfoto, Stilvorbild, Malertext und Quellen. Die stabilen URLs unter `bilder/` werden für die QR-Codes des Kalenders verwendet.

Die Auswahl auf der Website wird nur im jeweiligen Browser gespeichert. Export/Import über JSON erlaubt die Übergabe an die lokale Werkstatt. Die Website selbst hat keinen Serverdienst und keine Bildgenerierungs-API.

Unter `bestellen/` ist eine Vorschau der Bestellseite mit 10 € je Kalender und einmalig 5 € Versand zu sehen. In der Vorschau werden keine Bestellungen, Adressen oder Zahlungen übermittelt. Die private Google-Bestellablage, Zahlungslinks, Verkäuferangaben und Liefertermin müssen vor dem Verkaufsstart eingerichtet werden. Der vorbereitete Ablauf erfasst zunächst unbezahlte Anfragen; Zahlungseingänge werden beim Zahlungsanbieter abgeglichen.

Unter `titelseite/` eröffnet das vollständige Lucca-Panorama den Kalender, mit „Impressionismus in der Toskana 2027“ darüber. Unter `rueckseite/` liegt das Schlussblatt mit Toskana-Karte, Lucca oben mittig und sechs weiteren Bildminiaturen darunter sowie vier kommenden Reisezielen. Der Namenszug lautet „Idee & Bilder: Chris Meyer und Lutz Kohl“. Das offizielle Logo und ein QR-Code zur Spendenseite von Dentists for Africa ergänzen den Unterstützungstext. Die Karte basiert auf Natural Earth (Public Domain). Beide Blätter stehen als A3- und SAXOPRINT-Formatprobe als PDF bereit. Ein noch unklarer Reisestopp wird erst nach Klärung verortet.

Die PDFs sind A3-Gestaltungsentwürfe für 2027. Das Layout berücksichtigt die SAXOPRINT-Vorlage mit 20 mm Bindungsabstand. Lokal liegt zusätzlich eine Formatprobe mit 2 mm Beschnitt. Die endgültige Bildauflösung, Farbumwandlung und PDF/X-Ausgabe folgen nach der Bildauswahl. Die beispielhaften Monate sind noch keine finale Belegung.

## Veröffentlichung

GitHub Pages liefert den Branch `main`, Ordner `/`, aus. Die Dateien werden aus dem lokalen Kalender-Toskana-Projekt mit `tools/export_kalender.py` erzeugt. Veröffentlicht werden ausgewählte Bilder, EXIF-freie Fotokopien (für die Beispielstadt Populonia alle vier) und Begleittexte; keine unbearbeiteten Quellen, Schlüssel oder privaten Bewertungen.

## Bildnachweise

Historische Vorbilder und Werkquellen sind auf der jeweiligen Begleitseite angegeben. Die KI-Interpretationen sind neue Bilder und keine Werke der genannten Maler. Eigene Reiseaufnahmen stammen aus dem Kalenderprojekt. Für die eigenen Fotos wird hier keine allgemeine Nachnutzungslizenz erteilt.
