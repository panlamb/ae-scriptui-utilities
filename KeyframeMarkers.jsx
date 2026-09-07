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

        pnlOpts.add("statictext", undefined, "Marker target:");
        var grpTarget = pnlOpts.add("group");
        grpTarget.orientation = "column";
        grpTarget.alignChildren = ["left", "center"];
        grpTarget.spacing = 2;
        var rbLayerMarkers = grpTarget.add("radiobutton", undefined, "On each layer (layer markers)");
        var rbCompMarkers  = grpTarget.add("radiobutton", undefined, "On the composition (comp markers)");
        rbLayerMarkers.value = true;

        var grpScope = pnlOpts.add("group");
        grpScope.orientation = "column";
        grpScope.alignChildren = ["left", "center"];
        grpScope.spacing = 2;
        var rbActive   = grpScope.add("radiobutton", undefined, "Active composition only");
        var rbAllComps = grpScope.add("radiobutton", undefined, "All compositions in project (incl. pre-comps)");
        rbActive.value = true;

        var chkSurfaceNested = pnlOpts.add("checkbox", undefined, "Surface keyframes from inside pre-comps (no need to open them)");
        chkSurfaceNested.value = true;

        var chkSelectedLayersOnly = pnlOpts.add("checkbox", undefined, "Only selected layers (active comp only)");
        chkSelectedLayersOnly.value = true;

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

        // Σαρώνει ένα layer (και προαιρετικά μέσα σε pre-comps που χρησιμοποιεί, αναδρομικά), μετατρέπει
        // τις τοπικές ώρες keyframe στη χρονική βάση του "ριζικού" comp/layer, και ομαδοποιεί ανά frame.
        // groups: frameIndex -> { time, entries: { label: { propName: true } } }  ("" label = ίδιες οι ιδιότητες του root layer)
        function collectGroupsForLayer(rootLayer, includeNested, onlySelectedKeys, fr) {
            var groups = {};
            var pathStack = []; // comp ids στο τρέχον μονοπάτι αναδρομής, για αποφυγή κυκλικών αναφορών

            function recurse(layer, convertToTop, isRoot, pathPrefix) {
                var properties = [];
                collectKeyframedProperties(layer, properties);

                var ownLabel = isRoot ? "" : (pathPrefix ? pathPrefix + " > " + layer.name : layer.name);

                for (var p = 0; p < properties.length; p++) {
                    var prop = properties[p];
                    var indices;

                    if (onlySelectedKeys) {
                        if (!prop.selectedKeys || prop.selectedKeys.length === 0) continue;
                        indices = prop.selectedKeys;
                    } else {
                        indices = [];
                        for (var k = 1; k <= prop.numKeys; k++) indices.push(k);
                    }

                    for (var ki = 0; ki < indices.length; ki++) {
                        var tLocal = prop.keyTime(indices[ki]);
                        var tTop = convertToTop(tLocal);
                        var fIdx = Math.round(tTop / fr);

                        if (!groups[fIdx]) groups[fIdx] = { time: fIdx * fr, entries: {} };
                        if (!groups[fIdx].entries[ownLabel]) groups[fIdx].entries[ownLabel] = {};
                        groups[fIdx].entries[ownLabel][prop.name] = true;
                    }
                }

                if (!includeNested) return;

                var src;
                try { src = layer.source; } catch (eSrc) { src = null; }
                var remap = false;
                try { remap = layer.timeRemapEnabled; } catch (eRemap) {}

                if (src && (src instanceof CompItem) && !remap) {
                    var cid = src.id;
                    var onStack = false;
                    for (var si = 0; si < pathStack.length; si++) {
                        if (pathStack[si] === cid) { onStack = true; break; }
                    }
                    if (!onStack) {
                        pathStack.push(cid);

                        var startT = layer.startTime;
                        var stretch = layer.stretch;
                        var newConvert = function (tY) { return convertToTop(startT + tY * stretch / 100); };
                        var newPathPrefix = isRoot ? "" : ownLabel;

                        for (var li = 1; li <= src.numLayers; li++) {
                            recurse(src.layer(li), newConvert, false, newPathPrefix);
                        }

                        pathStack.pop();
                    }
                }
            }

            recurse(rootLayer, function (t) { return t; }, true, "");
            return groups;
        }

        // Μετατρέπει ένα σύνολο entries { label: {propName:true} } σε κείμενο marker
        function describeEntries(entries, includeProps) {
            var parts = [];
            for (var label in entries) {
                if (!entries.hasOwnProperty(label)) continue;

                var pnames = [];
                for (var pn in entries[label]) {
                    if (entries[label].hasOwnProperty(pn)) pnames.push(pn);
                }

                if (label === "") {
                    parts.push(includeProps ? pnames.join(", ") : "Keyframe");
                } else {
                    parts.push(includeProps ? (label + " (" + pnames.join(", ") + ")") : label);
                }
            }
            return parts.join(" | ");
        }

        // Προσθέτει/ενημερώνει ένα marker σε δοσμένη Property (comp.markerProperty ή layer.marker) στη δοσμένη ώρα
        function upsertMarker(markerProp, fr, targetFrame, exactTimeIfNew, desc) {
            var existingIdx = -1;
            for (var m = 1; m <= markerProp.numKeys; m++) {
                if (Math.round(markerProp.keyTime(m) / fr) === targetFrame) { existingIdx = m; break; }
            }

            if (existingIdx > 0) {
                var exactTime = markerProp.keyTime(existingIdx);
                var existing = markerProp.keyValue(existingIdx);
                var comment = existing.comment || "";

                if (comment.indexOf(desc) !== -1) return "unchanged";

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
                markerProp.setValueAtTime(exactTime, updatedVal);
                return "updated";
            }

            markerProp.setValueAtTime(exactTimeIfNew, new MarkerValue(desc));
            return "added";
        }

        // Layer markers: ένα marker ανά frame πάνω στο ίδιο το layer (και ό,τι "ανέβηκε" από μέσα σε pre-comps του)
        function markKeyframesOnLayer(layer, includeProps, onlySelectedKeys, includeNested) {
            var comp = layer.containingComp;
            var fr = comp.frameDuration;
            var groups = collectGroupsForLayer(layer, includeNested, onlySelectedKeys, fr);

            var mp;
            try { mp = layer.marker; } catch (eMarker) { return { added: 0, updated: 0 }; }
            if (!mp) return { added: 0, updated: 0 };

            var added = 0, updated = 0;

            for (var key in groups) {
                if (!groups.hasOwnProperty(key)) continue;
                var g = groups[key];
                var desc = describeEntries(g.entries, includeProps);
                if (!desc) continue;

                var res = upsertMarker(mp, fr, parseInt(key, 10), g.time, desc);
                if (res === "added") added++;
                else if (res === "updated") updated++;
            }

            return { added: added, updated: updated };
        }

        // Comp markers: ένα marker ανά frame στη σύνθεση, με layer name (+ προαιρετικά pre-comp path / properties)
        function markKeyframesInComp(comp, layers, includeProps, onlySelectedKeys, includeNested) {
            var fr = comp.frameDuration;
            var combined = {}; // frameIndex -> { time, chunks: [string, ...] }

            for (var l = 0; l < layers.length; l++) {
                var layer = layers[l];
                var groups = collectGroupsForLayer(layer, includeNested, onlySelectedKeys, fr);

                for (var key in groups) {
                    if (!groups.hasOwnProperty(key)) continue;
                    var g = groups[key];

                    for (var label in g.entries) {
                        if (!g.entries.hasOwnProperty(label)) continue;

                        var fullLabel = label === "" ? layer.name : (layer.name + " > " + label);
                        var chunk;

                        if (includeProps) {
                            var pnames = [];
                            for (var pn in g.entries[label]) {
                                if (g.entries[label].hasOwnProperty(pn)) pnames.push(pn);
                            }
                            chunk = fullLabel + " (" + pnames.join(", ") + ")";
                        } else {
                            chunk = fullLabel;
                        }

                        if (!combined[key]) combined[key] = { time: g.time, chunks: [] };
                        combined[key].chunks.push(chunk);
                    }
                }
            }

            var added = 0, updated = 0;
            var mp = comp.markerProperty;

            for (var ckey in combined) {
                if (!combined.hasOwnProperty(ckey)) continue;
                var cg = combined[ckey];
                var desc = cg.chunks.join(" | ");
                if (!desc) continue;

                var res = upsertMarker(mp, fr, parseInt(ckey, 10), cg.time, desc);
                if (res === "added") added++;
                else if (res === "updated") updated++;
            }

            return { added: added, updated: updated };
        }

        btnAdd.onClick = function () {
            app.beginUndoGroup("Add Keyframe Markers");

            var affectedCount = 0, markersAdded = 0, markersUpdated = 0;

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

                // Στο "All compositions" mode κάθε pre-comp επεξεργάζεται ήδη ξεχωριστά ως δικός του στόχος,
                // οπότε το "surface nested" απενεργοποιείται εκεί για να μην διπλασιάζονται τα markers.
                var includeNested = chkSurfaceNested.value && !rbAllComps.value;

                for (var c = 0; c < targetComps.length; c++) {
                    var targetComp = targetComps[c];
                    var layers;

                    if (!rbAllComps.value && chkSelectedLayersOnly.value && targetComp.selectedLayers.length > 0) {
                        layers = targetComp.selectedLayers;
                    } else {
                        layers = [];
                        for (var li = 1; li <= targetComp.numLayers; li++) layers.push(targetComp.layer(li));
                    }

                    if (layers.length === 0) continue;

                    if (rbLayerMarkers.value) {
                        for (var l = 0; l < layers.length; l++) {
                            var result = markKeyframesOnLayer(layers[l], chkIncludeProps.value, chkOnlySelectedKeys.value, includeNested);
                            markersAdded += result.added;
                            markersUpdated += result.updated;
                            if (result.added > 0 || result.updated > 0) affectedCount++;
                        }
                    } else {
                        var result2 = markKeyframesInComp(targetComp, layers, chkIncludeProps.value, chkOnlySelectedKeys.value, includeNested);
                        markersAdded += result2.added;
                        markersUpdated += result2.updated;
                        if (result2.added > 0 || result2.updated > 0) affectedCount++;
                    }
                }

                var unit = rbLayerMarkers.value ? "Layers" : "Comps";
                statusText.text = "Done. " + unit + " affected: " + affectedCount + "  |  Markers added: " + markersAdded + "  |  Updated: " + markersUpdated;
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
