{
    function buildEasyEaseUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Easy Ease Keyframes", undefined, {resizeable: true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;

        // --- Options ---
        var pnlOpts = win.add("panel", undefined, "Options");
        pnlOpts.orientation = "column";
        pnlOpts.alignChildren = ["left", "top"];
        pnlOpts.spacing = 6;
        pnlOpts.margins = 8;

        var grpInfluence = pnlOpts.add("group");
        grpInfluence.orientation = "row";
        grpInfluence.alignChildren = ["left", "center"];
        grpInfluence.add("statictext", undefined, "Influence %:");
        var txtInfluence = grpInfluence.add("edittext", undefined, "33.33");
        txtInfluence.characters = 6;

        var grpMode = pnlOpts.add("group");
        grpMode.orientation = "column";
        grpMode.alignChildren = ["left", "center"];
        grpMode.spacing = 2;
        var rbBoth = grpMode.add("radiobutton", undefined, "Easy Ease (In + Out)");
        var rbIn   = grpMode.add("radiobutton", undefined, "Easy Ease In only");
        var rbOut  = grpMode.add("radiobutton", undefined, "Easy Ease Out only");
        rbBoth.value = true;

        var chkOnlySelected = pnlOpts.add("checkbox", undefined, "Only ease selected keyframes (per property)");
        chkOnlySelected.value = false;

        // --- Action ---
        var btnApply = win.add("button", undefined, "Apply Easy Ease");
        btnApply.preferredSize.height = 32;

        var statusText = win.add("statictext", undefined, "", {multiline: true});
        statusText.preferredSize.height = 30;

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

        // Εφαρμόζει easy ease (ease + Bezier interpolation) σε ένα συγκεκριμένο keyframe
        function applyEasingAtKey(property, keyIndex, mode, influence) {
            var curIn = property.keyInTemporalEase(keyIndex);
            var curOut = property.keyOutTemporalEase(keyIndex);
            var dim = curIn.length;

            var newIn = curIn, newOut = curOut;

            if (mode !== "out") {
                newIn = [];
                for (var d1 = 0; d1 < dim; d1++) newIn.push(new KeyframeEase(0, influence));
            }
            if (mode !== "in") {
                newOut = [];
                for (var d2 = 0; d2 < dim; d2++) newOut.push(new KeyframeEase(0, influence));
            }
            property.setTemporalEaseAtKey(keyIndex, newIn, newOut);

            var curInType = property.keyInInterpolationType(keyIndex);
            var curOutType = property.keyOutInterpolationType(keyIndex);
            var newInType = (mode !== "out") ? KeyframeInterpolationType.BEZIER : curInType;
            var newOutType = (mode !== "in") ? KeyframeInterpolationType.BEZIER : curOutType;
            property.setInterpolationTypeAtKey(keyIndex, newInType, newOutType);
        }

        btnApply.onClick = function () {
            app.beginUndoGroup("Easy Ease Keyframes");

            var affectedProps = 0, affectedKeys = 0;

            try {
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    alert("Επιλέξτε μια ενεργή σύνθεση.");
                    return;
                }

                var layers = comp.selectedLayers;
                if (!layers || layers.length === 0) {
                    alert("Επιλέξτε τουλάχιστον ένα layer.");
                    return;
                }

                var influence = parseFloat(txtInfluence.text);
                if (isNaN(influence) || influence <= 0) influence = 33.33;
                if (influence > 100) influence = 100;

                var mode = "both";
                if (rbIn.value) mode = "in";
                else if (rbOut.value) mode = "out";

                for (var l = 0; l < layers.length; l++) {
                    var properties = [];
                    collectKeyframedProperties(layers[l], properties);

                    for (var p = 0; p < properties.length; p++) {
                        var prop = properties[p];
                        var indices = [];

                        if (chkOnlySelected.value) {
                            if (prop.selectedKeys && prop.selectedKeys.length > 0) {
                                indices = prop.selectedKeys;
                            } else {
                                continue;
                            }
                        } else {
                            for (var k = 1; k <= prop.numKeys; k++) indices.push(k);
                        }

                        if (indices.length === 0) continue;
                        affectedProps++;

                        for (var ki = 0; ki < indices.length; ki++) {
                            applyEasingAtKey(prop, indices[ki], mode, influence);
                            affectedKeys++;
                        }
                    }
                }

                statusText.text = "Done. Properties: " + affectedProps + "  |  Keyframes eased: " + affectedKeys;
            } catch (err) {
                alert("Σφάλμα κατά την εφαρμογή Easy Ease: " + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        win.layout.layout(true);
        return win;
    }

    var myPanel = buildEasyEaseUI(this);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }
}
