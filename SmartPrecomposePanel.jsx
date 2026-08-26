{
    function buildSmartPrecomposeUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Smart Pre-compose", undefined, {resizeable: true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 8;

        var btnPrecomp = win.add("button", undefined, "Smart Pre-compose");
        btnPrecomp.preferredSize.height = 32;

        // Συνάρτηση μετατροπής Layer Point σε Composition Coordinates (ExtendScript Math)
        function layerPointToComp(layer, pt, time) {
            var tr = layer.property("Transform");
            var anchor = tr.property("Anchor Point").valueAtTime(time, false);
            var pos = tr.property("Position").valueAtTime(time, false);
            var scale = tr.property("Scale").valueAtTime(time, false);
            var rot = (tr.property("Rotation")) ? tr.property("Rotation").valueAtTime(time, false) : 0;

            // 1. Offset από Anchor Point
            var dx = (pt[0] - anchor[0]) * (scale[0] / 100);
            var dy = (pt[1] - anchor[1]) * (scale[1] / 100);

            // 2. Περιστροφή (σε radians)
            var rad = rot * (Math.PI / 180);
            var rx = dx * Math.cos(rad) - dy * Math.sin(rad);
            var ry = dx * Math.sin(rad) + dy * Math.cos(rad);

            // 3. Προσθήκη Position
            return [pos[0] + rx, pos[1] + ry];
        }

        btnPrecomp.onClick = function () {
            app.beginUndoGroup("Smart Pre-compose to Bounds");

            try {
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    alert("Επιλέξτε μια ενεργή σύνθεση.");
                    return;
                }

                var selLayers = comp.selectedLayers;
                if (!selLayers || selLayers.length === 0) {
                    alert("Επιλέξτε τουλάχιστον ένα layer.");
                    return;
                }

                var padding = 20;
                var curTime = comp.time;

                var minX = Infinity, minY = Infinity;
                var maxX = -Infinity, maxY = -Infinity;

                // 1. Υπολογισμός Bounding Box
                for (var i = 0; i < selLayers.length; i++) {
                    var lyr = selLayers[i];
                    var r;
                    try {
                        r = lyr.sourceRectAtTime(curTime, false);
                    } catch (e) {
                        r = { left: 0, top: 0, width: lyr.width || 100, height: lyr.height || 100 };
                    }

                    if (r.width === 0) r.width = 100;
                    if (r.height === 0) r.height = 100;

                    var corners = [
                        [r.left, r.top],
                        [r.left + r.width, r.top],
                        [r.left, r.top + r.height],
                        [r.left + r.width, r.top + r.height]
                    ];

                    for (var c = 0; c < corners.length; c++) {
                        var pt = layerPointToComp(lyr, corners[c], curTime);
                        if (pt[0] < minX) minX = pt[0];
                        if (pt[0] > maxX) maxX = pt[0];
                        if (pt[1] < minY) minY = pt[1];
                        if (pt[1] > maxY) maxY = pt[1];
                    }
                }

                minX -= padding;
                minY -= padding;
                maxX += padding;
                maxY += padding;

                var cropWidth = Math.max(10, Math.round(maxX - minX));
                var cropHeight = Math.max(10, Math.round(maxY - minY));

                // 2. Συλλογή Layer Indices
                var layerIndices = [];
                for (var j = 0; j < selLayers.length; j++) {
                    layerIndices.push(selLayers[j].index);
                }

                var baseName = selLayers[0].name.replace(/[^a-zA-Z0-9_\-]/g, "_");
                var preCompName = "PreComp_" + baseName;

                // 3. Pre-compose
                var preCompItem = comp.layers.precompose(layerIndices, preCompName, true);
                if (!preCompItem) return;

                // Εντοπισμός του νέου Pre-comp Layer
                var newLayer = null;
                for (var l = 1; l <= comp.layers.length; l++) {
                    if (comp.layers[l].source === preCompItem) {
                        newLayer = comp.layers[l];
                        break;
                    }
                }

                // 4. Μετατόπιση των εσωτερικών Layers
                var shiftX = -minX;
                var shiftY = -minY;

                for (var k = 1; k <= preCompItem.layers.length; k++) {
                    var inner = preCompItem.layers[k];
                    if (inner.parent === null) {
                        var pos = inner.property("Transform").property("Position");
                        if (pos.isTimeVarying) {
                            for (var keyIdx = 1; keyIdx <= pos.numKeys; keyIdx++) {
                                var v = pos.keyValue(keyIdx);
                                if (v.length === 2) {
                                    pos.setValueAtKey(keyIdx, [v[0] + shiftX, v[1] + shiftY]);
                                } else if (v.length === 3) {
                                    pos.setValueAtKey(keyIdx, [v[0] + shiftX, v[1] + shiftY, v[2]]);
                                }
                            }
                        } else {
                            var curV = pos.value;
                            if (curV.length === 2) {
                                pos.setValue([curV[0] + shiftX, curV[1] + shiftY]);
                            } else if (curV.length === 3) {
                                pos.setValue([curV[0] + shiftX, curV[1] + shiftY, curV[2]]);
                            }
                        }
                    }
                }

                // 5. Αλλαγή μεγέθους σύνθεσης
                preCompItem.width = cropWidth;
                preCompItem.height = cropHeight;

                // 6. Τοποθέτηση Pre-comp Layer στη σωστή θέση στο Main Comp
                if (newLayer) {
                    newLayer.property("Transform").property("Scale").setValue([100, 100]);
                    newLayer.property("Transform").property("Anchor Point").setValue([0, 0]);
                    newLayer.property("Transform").property("Position").setValue([minX, minY]);
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

    var myPanel = buildSmartPrecomposeUI(this);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }
}