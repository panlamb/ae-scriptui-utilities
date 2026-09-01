{
    function buildArtboardExporterUI(thisObj) {
        // Illustrator scripts run via File > Scripts execute in a transient engine session
        // (unlike After Effects' persistent ScriptUI Panels), so a non-modal "palette" window
        // gets created and torn down before it can render. A modal "dialog" keeps it alive.
        var win = new Window("dialog", "Artboard Exporter for AE", undefined, {resizeable: true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;

        var info = win.add("statictext", undefined,
            "Αποθηκεύει κάθε artboard ως ξεχωριστό .ai αρχείο\nκαι κάνει Release to Layers σε κάθε group,\nέτοιμο για import στο After Effects.",
            { multiline: true });
        info.preferredSize.height = 48;

        var optReleaseLayers = win.add("checkbox", undefined, "Release to Layers (Sequence) σε κάθε group");
        optReleaseLayers.value = true;

        var optCloseAfter = win.add("checkbox", undefined, "Κλείσιμο νέων αρχείων μετά την αποθήκευση");
        optCloseAfter.value = true;

        var btnRun = win.add("button", undefined, "Επιλογή φακέλου & Εξαγωγή Artboards");
        btnRun.preferredSize.height = 32;

        function sanitizeName(name) {
            return (name || "").replace(/[\\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
        }

        // Ελέγχει αν δύο ορθογώνια [left, top, right, bottom] επικαλύπτονται
        function boundsOverlap(a, b) {
            return !(a[2] < b[0] || a[0] > b[2] || a[1] < b[3] || a[3] > b[1]);
        }

        // Επιστρέφει όλα τα top-level αντικείμενα του εγγράφου, σε σειρά μπροστά-προς-πίσω
        function collectTopLevelItemsFrontToBack(doc) {
            var result = [];
            for (var i = 0; i < doc.layers.length; i++) {
                var lyr = doc.layers[i];
                if (lyr.locked || !lyr.visible) continue;
                for (var j = 0; j < lyr.pageItems.length; j++) {
                    var it = lyr.pageItems[j];
                    if (it.parent !== lyr) continue; // παράβλεψη αντικειμένων μέσα σε groups
                    if (it.locked || it.hidden) continue;
                    result.push(it);
                }
            }
            return result;
        }

        // Σπάει τα top-level αντικείμενα ενός layer σε ξεχωριστά layers (Release to Layers - Sequence)
        function releaseLayerToSequence(doc, sourceLayer) {
            var items = [];
            for (var j = 0; j < sourceLayer.pageItems.length; j++) {
                var it = sourceLayer.pageItems[j];
                if (it.parent === sourceLayer) items.push(it);
            }
            if (items.length <= 1) return;

            var baseName = sourceLayer.name;
            for (var idx = items.length - 1; idx >= 0; idx--) {
                var newLayer = doc.layers.add();
                newLayer.name = baseName + "_" + (idx + 1);
                items[idx].move(newLayer, ElementPlacement.PLACEATBEGINNING);
            }

            if (sourceLayer.pageItems.length === 0 && sourceLayer.layers.length === 0) {
                try { sourceLayer.remove(); } catch (e) {}
            }
        }

        function exportArtboard(srcDoc, abIndex, allItems, destFolder, baseDocName, releaseToLayers, closeAfter) {
            var ab = srcDoc.artboards[abIndex];
            var abRect = ab.artboardRect; // [left, top, right, bottom]

            var matching = [];
            for (var i = 0; i < allItems.length; i++) {
                var b;
                try { b = allItems[i].geometricBounds; } catch (e) { continue; }
                if (boundsOverlap(b, abRect)) matching.push(allItems[i]);
            }

            if (matching.length === 0) {
                return { skipped: true, name: ab.name };
            }

            var width = abRect[2] - abRect[0];
            var height = abRect[1] - abRect[3];

            var newDoc = app.documents.add(srcDoc.documentColorSpace, width, height);
            newDoc.artboards[0].artboardRect = abRect;

            var targetLayer = newDoc.layers[0];
            targetLayer.name = "Artwork";

            for (var k = matching.length - 1; k >= 0; k--) {
                matching[k].duplicate(targetLayer, ElementPlacement.PLACEATBEGINNING);
            }

            if (releaseToLayers) {
                releaseLayerToSequence(newDoc, targetLayer);
            }

            var safeAbName = sanitizeName(ab.name) || ("Artboard_" + (abIndex + 1));
            var fileName = baseDocName + "_" + safeAbName + ".ai";
            var saveFile = new File(destFolder.fsName + "/" + fileName);

            var saveOpts = new IllustratorSaveOptions();
            saveOpts.pdfCompatible = true;
            newDoc.saveAs(saveFile, saveOpts);

            if (closeAfter) {
                newDoc.close(SaveOptions.DONOTSAVECHANGES);
            }

            app.activeDocument = srcDoc;
            return { skipped: false, name: ab.name, file: fileName };
        }

        btnRun.onClick = function () {
            if (app.documents.length === 0) {
                alert("Δεν υπάρχει ανοιχτό έγγραφο.");
                return;
            }

            var srcDoc = app.activeDocument;

            var suggestedFolder = null;
            try { suggestedFolder = srcDoc.path; } catch (e) {}
            var destFolder = Folder.selectDialog("Επιλέξτε φάκελο αποθήκευσης για τα artboards", suggestedFolder);
            if (!destFolder) return;

            var baseDocName = sanitizeName(srcDoc.name.replace(/\.[^\.]+$/, ""));
            var releaseToLayers = optReleaseLayers.value;
            var closeAfter = optCloseAfter.value;

            var created = [];
            var skipped = [];
            var failed = [];

            try {
                var allItems = collectTopLevelItemsFrontToBack(srcDoc);

                for (var i = 0; i < srcDoc.artboards.length; i++) {
                    try {
                        var res = exportArtboard(srcDoc, i, allItems, destFolder, baseDocName, releaseToLayers, closeAfter);
                        if (res.skipped) {
                            skipped.push(res.name);
                        } else {
                            created.push(res.file);
                        }
                    } catch (errAb) {
                        failed.push(srcDoc.artboards[i].name + ": " + errAb.toString());
                    }
                    app.activeDocument = srcDoc;
                }
            } catch (err) {
                alert("Σφάλμα: " + err.toString());
                return;
            }

            var msg = "Δημιουργήθηκαν " + created.length + " αρχεία.";
            if (skipped.length > 0) msg += "\nΠαραλείφθηκαν (χωρίς περιεχόμενο): " + skipped.join(", ");
            if (failed.length > 0) msg += "\nΑπέτυχαν: " + failed.join("; ");
            alert(msg);
        };

        win.layout.layout(true);
        return win;
    }

    var myPanel = buildArtboardExporterUI(this);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }
}
