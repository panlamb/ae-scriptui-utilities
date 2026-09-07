{
    function buildKeyframeMarkersUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Keyframe Markers", undefined, {resizeable: true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;

        // --- Options ---
        var pnlOpts = win.add("panel", undefined, "Options");
        pnlOpts.orientation = "column";
        pnlOpts.alignChildren = ["left", "top"];
        pnlOpts.spacing = 4;
        pnlOpts.margins = 8;

        var grpScope = pnlOpts.add("group");
        grpScope.orientation = "column";
        grpScope.alignChildren = ["left", "center"];
        grpScope.spacing = 2;
        var rbActive   = grpScope.add("radiobutton", undefined, "Active composition only");
        var rbAllComps = grpScope.add("radiobutton", undefined, "All compositions in project (incl. pre-comps)");
        rbActive.value = true;

        var chkSelectedLayersOnly = pnlOpts.add("checkbox", undefined, "Only selected layers (active comp only)");
        chkSelectedLayersOnly.value = false;

        var chkOnlySelectedKeys = pnlOpts.add("checkbox", undefined, "Only selected keyframes (per property)");
        chkOnlySelectedKeys.value = false;

        var chkIncludeProps = pnlOpts.add("checkbox", undefined, "Include property names in marker text");
        chkIncludeProps.value = true;

        // --- Action ---
        var btnAdd = win.add("button", undefined, "Add Keyframe Markers");
        btnAdd.preferredSize.height = 32;

        var statusText = win.add("statictext", undefined, "", {multiline: true});
        statusText.preferredSize.height = 40;

        // Εντοπισμός όλων των keyframed properties ενός layer (αναδρομικά μέσα σε groups)
        function collectKeyframedProperties(propGroup, results) {
            var n;
            try { n = propGroup.numProperties; } catch (e) { return; }
            if (n === undefined) return;

            for (var i = 1; i <= n; i++) {
                var prop;
                try { prop = propGroup.property(i); } catch (e2) { continue; }
                if (!prop) continue;

                if (prop.propertyType === PropertyType.PROPERTY) {
                    try {
                        if (prop.canVaryOverTime && prop.numKeys > 0) results.push(prop);
                    } catch (e3) {}
                } else {
                    collectKeyframedProperties(prop, results);
                }
            }
        }

        // Σαρώνει τα layers ενός comp, ομαδοποιεί τα keyframes ανά frame και προσθέτει/ενημερώνει comp markers
        function markKeyframesInComp(comp, layers, includeProps, onlySelectedKeys) {
            var fr = comp.frameDuration;
            var groups = {}; // frameIndex -> { time: number, layers: { layerName: { propName: true } } }

            for (var l = 0; l < layers.length; l++) {
                var layer = layers[l];
                var properties = [];
                collectKeyframedProperties(layer, properties);

                for (var p = 0; p < properties.length; p++) {
                    var prop = properties[p];
                    var indices = [];

                    if (onlySelectedKeys) {
                        if (!prop.selectedKeys || prop.selectedKeys.length === 0) continue;
                        indices = prop.selectedKeys;
                    } else {
                        for (var k = 1; k <= prop.numKeys; k++) indices.push(k);
                    }

                    for (var ki = 0; ki < indices.length; ki++) {
                        var t = prop.keyTime(indices[ki]);
                        var fIdx = Math.round(t / fr);

                        if (!groups[fIdx]) groups[fIdx] = { time: fIdx * fr, layers: {} };
                        if (!groups[fIdx].layers[layer.name]) groups[fIdx].layers[layer.name] = {};
                        groups[fIdx].layers[layer.name][prop.name] = true;
                    }
                }
            }

            var added = 0, updated = 0;
            var mp = comp.markerProperty;

            for (var key in groups) {
                if (!groups.hasOwnProperty(key)) continue;
                var g = groups[key];

                var parts = [];
                for (var lname in g.layers) {
                    if (!g.layers.hasOwnProperty(lname)) continue;

                    if (includeProps) {
                        var pnames = [];
                        for (var pname in g.layers[lname]) {
                            if (g.layers[lname].hasOwnProperty(pname)) pnames.push(pname);
                        }
                        parts.push(lname + " (" + pnames.join(", ") + ")");
                    } else {
                        parts.push(lname);
                    }
                }
                var desc = parts.join(" | ");
                if (!desc) continue;

                var targetFrame = parseInt(key, 10);
                var existingIdx = -1;
                for (var m = 1; m <= mp.numKeys; m++) {
                    if (Math.round(mp.keyTime(m) / fr) === targetFrame) { existingIdx = m; break; }
                }

                if (existingIdx > 0) {
                    var exactTime = mp.keyTime(existingIdx);
                    var existing = mp.keyValue(existingIdx);
                    var comment = existing.comment || "";

                    if (comment.indexOf(desc) === -1) {
                        var newComment = comment ? (comment + " | " + desc) : desc;
                        var updatedVal = new MarkerValue(newComment);
                        try {
                            updatedVal.duration = existing.duration;
                            updatedVal.chapter = existing.chapter;
                            updatedVal.url = existing.url;
                            updatedVal.frameTarget = existing.frameTarget;
                            updatedVal.cuePointName = existing.cuePointName;
                            updatedVal.eventCuePoint = existing.eventCuePoint;
                        } catch (eCopy) {}
                        mp.setValueAtTime(exactTime, updatedVal);
                        updated++;
                    }
                } else {
                    mp.setValueAtTime(g.time, new MarkerValue(desc));
                    added++;
                }
            }

            return { added: added, updated: updated };
        }

        btnAdd.onClick = function () {
            app.beginUndoGroup("Add Keyframe Markers");

            var compsAffected = 0, markersAdded = 0, markersUpdated = 0;

            try {
                var targetComps = [];

                if (rbAllComps.value) {
                    for (var i = 1; i <= app.project.numItems; i++) {
                        var it = app.project.item(i);
                        if (it instanceof CompItem) targetComps.push(it);
                    }
                    if (targetComps.length === 0) {
                        alert("Δεν βρέθηκαν compositions στο project.");
                        return;
                    }
                } else {
                    var comp = app.project.activeItem;
                    if (!comp || !(comp instanceof CompItem)) {
                        alert("Επιλέξτε μια ενεργή σύνθεση.");
                        return;
                    }
                    targetComps.push(comp);
                }

                for (var c = 0; c < targetComps.length; c++) {
                    var targetComp = targetComps[c];
                    var layers;

                    if (!rbAllComps.value && chkSelectedLayersOnly.value && targetComp.selectedLayers.length > 0) {
                        layers = targetComp.selectedLayers;
                    } else {
                        layers = [];
                        for (var li = 1; li <= targetComp.numLayers; li++) layers.push(targetComp.layer(li));
                    }

                    var result = markKeyframesInComp(targetComp, layers, chkIncludeProps.value, chkOnlySelectedKeys.value);
                    markersAdded += result.added;
                    markersUpdated += result.updated;
                    if (result.added > 0 || result.updated > 0) compsAffected++;
                }

                statusText.text = "Done. Comps affected: " + compsAffected + "  |  Markers added: " + markersAdded + "  |  Updated: " + markersUpdated;
            } catch (err) {
                alert("Σφάλμα κατά την προσθήκη markers: " + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        win.layout.layout(true);
        return win;
    }

    var myPanel = buildKeyframeMarkersUI(this);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }
}
