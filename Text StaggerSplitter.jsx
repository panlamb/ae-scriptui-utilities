{
    function buildAdvancedTextToolsUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Text Split & Rig Pro", undefined, {resizeable: true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 8;

        // --- SECTION 1: SPLIT TEXT & SHAPES ---
        var pnlSplit = win.add("panel", undefined, "Split Text / Shapes");
        pnlSplit.orientation = "column";
        pnlSplit.alignChildren = ["fill", "top"];
        pnlSplit.spacing = 4;

        var grpSplitMode = pnlSplit.add("group");
        grpSplitMode.orientation = "row";
        grpSplitMode.alignChildren = ["center", "center"];
        var rbLines = grpSplitMode.add("radiobutton", undefined, "Lines");
        var rbWords = grpSplitMode.add("radiobutton", undefined, "Words");
        var rbChars = grpSplitMode.add("radiobutton", undefined, "Chars");
        rbWords.value = true;

        var chkPrecomp = pnlSplit.add("checkbox", undefined, "Put split layers into a Pre-comp");
        chkPrecomp.value = true;

        var btnSplitText = pnlSplit.add("button", undefined, "Split to Text Layers (Exact Pos)");
        btnSplitText.preferredSize.height = 28;

        var btnSplitShapes = pnlSplit.add("button", undefined, "Split to Shapes (Exact Pos)");
        btnSplitShapes.preferredSize.height = 28;

        // --- SECTION 2: STAGGER ---
        var pnlStagger = win.add("panel", undefined, "Stagger Layers");
        pnlStagger.orientation = "column";
        pnlStagger.alignChildren = ["fill", "top"];
        pnlStagger.spacing = 4;

        var grpFrames = pnlStagger.add("group");
        grpFrames.orientation = "row";
        grpFrames.alignChildren = ["fill", "center"];
        grpFrames.spacing = 4;
        grpFrames.add("statictext", undefined, "Step:");
        var txtFrames = grpFrames.add("edittext", undefined, "2");
        txtFrames.characters = 3;
        grpFrames.add("statictext", undefined, "frames");

        var btnStagger = pnlStagger.add("button", undefined, "Stagger Selected");
        btnStagger.preferredSize.height = 26;

        // --- PARSER ---
        function getUnits(fullText, mode) {
            var units = [];
            if (mode === "lines") {
                var lines = fullText.split(/\r\n|\r|\n/);
                for (var l = 0; l < lines.length; l++) {
                    if (lines[l].replace(/\s+/g, "").length > 0) {
                        units.push({ text: lines[l], index: l });
                    }
                }
            } else if (mode === "words") {
                var re = /\S+/g;
                var match;
                var wIdx = 0;
                while ((match = re.exec(fullText)) !== null) {
                    units.push({ text: match[0], index: wIdx });
                    wIdx++;
                }
            } else {
                var cIdx = 0;
                for (var c = 0; c < fullText.length; c++) {
                    var ch = fullText.charAt(c);
                    if (ch.search(/\s/) === -1) {
                        units.push({ text: ch, index: cIdx });
                        cIdx++;
                    }
                }
            }
            return units;
        }

        // Maps each non-whitespace character (in reading order) to the index of the
        // word/line it belongs to. Used to cluster the per-character shape groups
        // that "Create Shapes from Text" produces back into words/lines.
        function getCharUnitMap(fullText, mode) {
            var map = [];
            if (mode === "lines") {
                var lines = fullText.split(/\r\n|\r|\n/);
                var lineIdx = 0;
                for (var l = 0; l < lines.length; l++) {
                    var hasContent = lines[l].replace(/\s+/g, "").length > 0;
                    for (var c = 0; c < lines[l].length; c++) {
                        if (lines[l].charAt(c).search(/\s/) === -1) {
                            map.push(lineIdx);
                        }
                    }
                    if (hasContent) lineIdx++;
                }
            } else if (mode === "words") {
                var re = /\S+/g;
                var match;
                var wIdx = 0;
                while ((match = re.exec(fullText)) !== null) {
                    for (var k = 0; k < match[0].length; k++) {
                        map.push(wIdx);
                    }
                    wIdx++;
                }
            }
            return map;
        }

        // --- SPLIT TO TEXT (Additive Animator: Base Opacity 0 -> Selected Unit 100%) ---
        function splitToTextExact(comp, srcLayer, mode, autoPrecomp) {
            var fullText = srcLayer.property("Source Text").value.text;
            var units = getUnits(fullText, mode);

            if (units.length <= 1) {
                alert("Δεν βρέθηκαν πολλαπλά τμήματα κειμένου προς διαχωρισμό.");
                return;
            }

            var createdLayers = [];
            var unitTypeVal = (mode === "lines") ? 4 : ((mode === "words") ? 3 : 2);

            for (var i = 0; i < units.length; i++) {
                var u = units[i];
                var dup = srcLayer.duplicate();
                dup.name = u.text.substring(0, 20);
                dup.enabled = true;

                // 1. Animator A: Κρύβει όλο το κείμενο (Opacity 0%)
                var anims = dup.property("Text").property("Animators");
                var baseHide = anims.addProperty("ADBE Text Animator");
                baseHide.name = "Hide All";
                var baseProps = baseHide.property("ADBE Text Animator Properties");
                baseProps.addProperty("ADBE Text Opacity").setValue(0);

                // 2. Animator B: Εμφανίζει μόνο το συγκεκριμένο unit (Opacity 100%)
                var showAnim = anims.addProperty("ADBE Text Animator");
                showAnim.name = "Show Unit";
                var showProps = showAnim.property("ADBE Text Animator Properties");
                showProps.addProperty("ADBE Text Opacity").setValue(100);

                var sel = showAnim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
                var adv = sel.property("ADBE Text Range Advanced");
                if (adv) {
                    if (adv.property("ADBE Text Range Units")) adv.property("ADBE Text Range Units").setValue(2); // Index
                    if (adv.property("ADBE Text Range Type2")) adv.property("ADBE Text Range Type2").setValue(unitTypeVal);
                }

                sel.property("ADBE Text Index Start").setValue(u.index);
                sel.property("ADBE Text Index End").setValue(u.index + 1);

                createdLayers.push(dup);
            }

            srcLayer.enabled = false;

            if (autoPrecomp && createdLayers.length > 0) {
                var indices = [];
                for (var cl = 0; cl < createdLayers.length; cl++) {
                    indices.push(createdLayers[cl].index);
                }
                var preCompName = srcLayer.name + "_Text_Splitted";
                var subComp = comp.layers.precompose(indices, preCompName, true);
                for (var s = 1; s <= subComp.layers.length; s++) {
                    subComp.layers[s].enabled = true;
                }
            }
        }

        // --- SPLIT TO SHAPES ---
        function splitToShapesExact(comp, srcLayer, mode, autoPrecomp) {
            var fullText = srcLayer.property("Source Text").value.text;

            comp.openInViewer();
            for (var d = 1; d <= comp.layers.length; d++) {
                comp.layers[d].selected = (comp.layers[d] === srcLayer);
            }

            var cmdId = app.findMenuCommandId("Create Shapes from Text");
            if (!cmdId || cmdId === 0) cmdId = 3781;
            app.executeCommand(cmdId);

            var masterShape = null;
            for (var k = 1; k <= comp.layers.length; k++) {
                if (comp.layers[k].selected && comp.layers[k] !== srcLayer) {
                    masterShape = comp.layers[k];
                    break;
                }
            }

            if (!masterShape) {
                alert("Δεν ήταν δυνατή η δημιουργία Shape Layer. Βεβαιωθείτε ότι το κείμενο είναι ορατό.");
                return;
            }

            var contents = masterShape.property("Contents");
            var totalGroups = contents.numProperties;
            var createdLayers = [];

            var charMap = getCharUnitMap(fullText, mode);
            var useGrouping = (mode !== "chars") && charMap.length === totalGroups;

            if (mode !== "chars" && charMap.length !== totalGroups) {
                alert("Προσοχή: ο αριθμός σχημάτων δεν ταιριάζει με τους χαρακτήρες του κειμένου, οπότε ο διαχωρισμός θα γίνει ανά χαρακτήρα.");
            }

            if (!useGrouping) {
                // Char mode (or a char-count mismatch we can't safely map): one layer per shape group.
                for (var g = 1; g <= totalGroups; g++) {
                    var single = masterShape.duplicate();
                    single.name = contents.property(g).name;
                    single.enabled = true;
                    var sCont = single.property("Contents");

                    for (var r = totalGroups; r >= 1; r--) {
                        if (r !== g) {
                            sCont.property(r).remove();
                        }
                    }
                    createdLayers.push(single);
                }
            } else {
                // Words/Lines mode: cluster the per-character shape groups into one layer per unit.
                var unitOrder = [];
                var unitIndices = {};
                for (var gi = 1; gi <= totalGroups; gi++) {
                    var uid = charMap[gi - 1];
                    if (!unitIndices[uid]) {
                        unitIndices[uid] = [];
                        unitOrder.push(uid);
                    }
                    unitIndices[uid].push(gi);
                }

                for (var oi = 0; oi < unitOrder.length; oi++) {
                    var keepIdx = unitIndices[unitOrder[oi]];
                    var unitLayer = masterShape.duplicate();
                    unitLayer.name = contents.property(keepIdx[0]).name + (keepIdx.length > 1 ? "…" : "");
                    unitLayer.enabled = true;
                    var uCont = unitLayer.property("Contents");

                    for (var r2 = totalGroups; r2 >= 1; r2--) {
                        var keep = false;
                        for (var kk = 0; kk < keepIdx.length; kk++) {
                            if (keepIdx[kk] === r2) { keep = true; break; }
                        }
                        if (!keep) uCont.property(r2).remove();
                    }
                    createdLayers.push(unitLayer);
                }
            }

            masterShape.remove();
            srcLayer.enabled = false;

            if (autoPrecomp && createdLayers.length > 0) {
                var sIndices = [];
                for (var sl = 0; sl < createdLayers.length; sl++) {
                    sIndices.push(createdLayers[sl].index);
                }
                var preCompName = srcLayer.name + "_Shapes_Splitted";
                var sComp = comp.layers.precompose(sIndices, preCompName, true);
                for (var s2 = 1; s2 <= sComp.layers.length; s2++) {
                    sComp.layers[s2].enabled = true;
                }
            }
        }

        // --- BUTTON EVENTS ---
        btnSplitText.onClick = function () {
            app.beginUndoGroup("Split Text Exact");
            try {
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    alert("Επιλέξτε μια ενεργή σύνθεση.");
                    return;
                }
                var sel = comp.selectedLayers;
                if (!sel || sel.length !== 1 || !(sel[0] instanceof TextLayer)) {
                    alert("Επιλέξτε ένα (1) Text Layer.");
                    return;
                }

                var mode = "words";
                if (rbLines.value) mode = "lines";
                if (rbChars.value) mode = "chars";

                splitToTextExact(comp, sel[0], mode, chkPrecomp.value);
            } catch (err) {
                alert("Σφάλμα: " + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        btnSplitShapes.onClick = function () {
            app.beginUndoGroup("Split to Shapes Exact");
            try {
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    alert("Επιλέξτε μια ενεργή σύνθεση.");
                    return;
                }
                var sel = comp.selectedLayers;
                if (!sel || sel.length !== 1 || !(sel[0] instanceof TextLayer)) {
                    alert("Επιλέξτε ένα (1) Text Layer.");
                    return;
                }

                var mode = "words";
                if (rbLines.value) mode = "lines";
                if (rbChars.value) mode = "chars";

                splitToShapesExact(comp, sel[0], mode, chkPrecomp.value);
            } catch (err) {
                alert("Σφάλμα: " + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        btnStagger.onClick = function () {
            app.beginUndoGroup("Stagger Layers");
            try {
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    alert("Επιλέξτε μια ενεργή σύνθεση.");
                    return;
                }

                var selLayers = comp.selectedLayers;
                if (!selLayers || selLayers.length < 2) {
                    alert("Επιλέξτε τουλάχιστον 2 layers.");
                    return;
                }

                var stepFrames = parseInt(txtFrames.text, 10);
                if (isNaN(stepFrames)) stepFrames = 2;
                var stepSec = stepFrames * comp.frameDuration;

                var sorted = [];
                for (var s = 0; s < selLayers.length; s++) {
                    sorted.push(selLayers[s]);
                }
                sorted.sort(function (a, b) { return a.index - b.index; });

                var baseIn = sorted[0].inPoint;
                for (var k = 0; k < sorted.length; k++) {
                    var targetIn = baseIn + (k * stepSec);
                    var curIn = sorted[k].inPoint;
                    sorted[k].startTime = sorted[k].startTime + (targetIn - curIn);
                }
            } catch (err) {
                alert("Σφάλμα: " + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        win.layout.layout(true);
        return win;
    }

    var myPanel = buildAdvancedTextToolsUI(this);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }
}