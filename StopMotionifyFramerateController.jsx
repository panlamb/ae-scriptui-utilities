{
    function buildStopMotionifyUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "StopMotionify", undefined, {resizeable: true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 8;

        // FPS Selection Group
        var grpFPS = win.add("panel", undefined, "Frame Rate (Posterize Time)");
        grpFPS.orientation = "row";
        grpFPS.alignChildren = ["center", "center"];
        grpFPS.spacing = 4;

        var rb12 = grpFPS.add("radiobutton", undefined, "12 fps (Twos)");
        var rb8  = grpFPS.add("radiobutton", undefined, "8 fps (Threes)");
        var rb15 = grpFPS.add("radiobutton", undefined, "15 fps");
        rb12.value = true;

        // Jitter / Handcrafted Style
        var chkJitter = win.add("checkbox", undefined, "Add Tactile Jitter (Pos/Rot)");
        chkJitter.value = true;

        // Intensity Controls
        var grpJitterSettings = win.add("group");
        grpJitterSettings.orientation = "row";
        grpJitterSettings.alignChildren = ["fill", "center"];
        grpJitterSettings.spacing = 4;

        grpJitterSettings.add("statictext", undefined, "Jitter Amount:");
        var txtAmount = grpJitterSettings.add("edittext", undefined, "3");
        txtAmount.characters = 3;
        grpJitterSettings.add("statictext", undefined, "px / deg");

        // Action Buttons
        var btnApply = win.add("button", undefined, "Apply Stop-Motion Look");
        btnApply.preferredSize.height = 32;

        var btnRemove = win.add("button", undefined, "Remove from Selected");
        btnRemove.preferredSize.height = 24;

        function getSelectedFPS() {
            if (rb12.value) return 12;
            if (rb8.value) return 8;
            if (rb15.value) return 15;
            return 12;
        }

        btnApply.onClick = function () {
            app.beginUndoGroup("Apply StopMotionify");
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

                var targetFPS = getSelectedFPS();
                var addJitter = chkJitter.value;
                var jitterAmt = parseFloat(txtAmount.text);
                if (isNaN(jitterAmt)) jitterAmt = 3;

                for (var i = 0; i < selLayers.length; i++) {
                    var lyr = selLayers[i];
                    if (!(lyr instanceof AVLayer)) continue;

                    // 1. Posterize Time Effect
                    var fx = lyr.property("Effects").property("Posterize Time");
                    if (!fx) {
                        fx = lyr.property("Effects").addProperty("ADBE Posterize Time");
                    }
                    if (fx) {
                        fx.property(1).setValue(targetFPS);
                    }

                    // 2. Tactile Jitter Expressions
                    if (addJitter) {
                        var tr = lyr.property("Transform");
                        var posProp = tr.property("Position");
                        var rotProp = tr.property("Rotation");

                        if (posProp && posProp.canSetExpression) {
                            var curPosExpr = posProp.expression;
                            var posCode = "posterizeTime(" + targetFPS + ");\n" +
                                          "var j = wiggle(" + targetFPS + ", " + jitterAmt + ");\n" +
                                          "value + (j - value);";
                            posProp.expression = posCode;
                        }

                        if (rotProp && rotProp.canSetExpression) {
                            var rotAmt = Math.min(jitterAmt * 0.8, 5);
                            var rotCode = "posterizeTime(" + targetFPS + ");\n" +
                                          "var r = wiggle(" + targetFPS + ", " + rotAmt + ");\n" +
                                          "value + (r - value);";
                            rotProp.expression = rotCode;
                        }
                    }
                }
            } catch (err) {
                alert("Σφάλμα: " + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        btnRemove.onClick = function () {
            app.beginUndoGroup("Remove StopMotionify");
            try {
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    alert("Επιλέξτε μια ενεργή σύνθεση.");
                    return;
                }

                var selLayers = comp.selectedLayers;
                for (var i = 0; i < selLayers.length; i++) {
                    var lyr = selLayers[i];
                    if (!(lyr instanceof AVLayer)) continue;

                    // Αφαίρεση του Posterize Time effect
                    var fx = lyr.property("Effects").property("Posterize Time");
                    if (fx) {
                        fx.remove();
                    }

                    // Καθαρισμός των Expressions από Transform
                    var tr = lyr.property("Transform");
                    var posProp = tr.property("Position");
                    var rotProp = tr.property("Rotation");

                    if (posProp && posProp.expression.indexOf("posterizeTime") !== -1) {
                        posProp.expression = "";
                    }
                    if (rotProp && rotProp.expression.indexOf("posterizeTime") !== -1) {
                        rotProp.expression = "";
                    }
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

    var myPanel = buildStopMotionifyUI(this);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }
}