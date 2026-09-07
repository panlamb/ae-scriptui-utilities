{
    function buildEasyEaseUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Easy Ease Keyframes", undefined, {resizeable: true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;

        // --- Presets ---
        var pnlPresets = win.add("panel", undefined, "Presets");
        pnlPresets.orientation = "column";
        pnlPresets.alignChildren = ["fill", "top"];
        pnlPresets.spacing = 4;
        pnlPresets.margins = 8;

        var rowPreset1 = pnlPresets.add("group");
        rowPreset1.orientation = "row";
        rowPreset1.alignChildren = ["fill", "top"];
        rowPreset1.spacing = 4;
        var btnPresetDefault = rowPreset1.add("button", undefined, "Default (33%)");
        var btnPresetSmooth  = rowPreset1.add("button", undefined, "Smooth (75%)");

        var rowPreset2 = pnlPresets.add("group");
        rowPreset2.orientation = "row";
        rowPreset2.alignChildren = ["fill", "top"];
        rowPreset2.spacing = 4;
        var btnPresetIn  = rowPreset2.add("button", undefined, "Ease In (Stop)");
        var btnPresetOut = rowPreset2.add("button", undefined, "Ease Out (Launch)");

        var btnPresetLinear = pnlPresets.add("button", undefined, "Linear (Remove Ease)");

        // --- Custom ---
        var pnlOpts = win.add("panel", undefined, "Custom");
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

        var btnApply = pnlOpts.add("button", undefined, "Apply Custom Ease");
        btnApply.preferredSize.height = 28;

        var chkOnlySelected = win.add("checkbox", undefined, "Only ease selected keyframes (per property)");
        chkOnlySelected.value = false;

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

        // Επαναφέρει σε Linear interpolation (χωρίς ease) σε ένα συγκεκριμένο keyframe
        function applyLinearAtKey(property, keyIndex, mode) {
            var curInType = property.keyInInterpolationType(keyIndex);
            var curOutType = property.keyOutInterpolationType(keyIndex);
            var newInType = (mode !== "out") ? KeyframeInterpolationType.LINEAR : curInType;
            var newOutType = (mode !== "in") ? KeyframeInterpolationType.LINEAR : curOutType;
            property.setInterpolationTypeAtKey(keyIndex, newInType, newOutType);
        }

        // Κοινή λογική εφαρμογής (χρησιμοποιείται και από τα presets και από το custom Apply)
        function runEasing(mode, influence, isLinear) {
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
                            if (isLinear) {
                                applyLinearAtKey(prop, indices[ki], mode);
                            } else {
                                applyEasingAtKey(prop, indices[ki], mode, influence);
                            }
                            affectedKeys++;
                        }
                    }
                }

                statusText.text = "Done. Properties: " + affectedProps + "  |  Keyframes affected: " + affectedKeys;
            } catch (err) {
                alert("Σφάλμα κατά την εφαρμογή: " + err.toString());
            } finally {
                app.endUndoGroup();
            }
        }

        // --- Preset buttons ---
        // Default: το κλασικό Easy Ease (F9), ισορροπημένο 33/33
        btnPresetDefault.onClick = function () { runEasing("both", 33.33, false); };
        // Smooth: πιο αργό, κινηματογραφικό ease και στις δύο πλευρές (75/75)
        btnPresetSmooth.onClick  = function () { runEasing("both", 75, false); };
        // Ease In: έντονη επιβράδυνση καθώς φτάνει στο keyframe (π.χ. camera settle)
        btnPresetIn.onClick      = function () { runEasing("in", 75, false); };
        // Ease Out: έντονη επιτάχυνση φεύγοντας από το keyframe (π.χ. snappy launch)
        btnPresetOut.onClick     = function () { runEasing("out", 75, false); };
        // Linear: αφαιρεί το ease, γραμμική/μηχανική κίνηση
        btnPresetLinear.onClick  = function () { runEasing("both", 0, true); };

        // --- Custom Apply ---
        btnApply.onClick = function () {
            var influence = parseFloat(txtInfluence.text);
            if (isNaN(influence) || influence <= 0) influence = 33.33;
            if (influence > 100) influence = 100;

            var mode = "both";
            if (rbIn.value) mode = "in";
            else if (rbOut.value) mode = "out";

            runEasing(mode, influence, false);
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
