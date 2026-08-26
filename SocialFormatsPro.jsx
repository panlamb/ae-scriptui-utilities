{
    function buildSocialUnfoldPanel(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Social Formats Deep", undefined, {resizeable: true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;

        // --- Options ---
        var grpScale = win.add("group");
        grpScale.orientation = "column";
        grpScale.alignChildren = ["left", "center"];
        grpScale.spacing = 4;

        var rbFitWidth = grpScale.add("radiobutton", undefined, "Scale elements to Fit Width");
        var rbKeepScale = grpScale.add("radiobutton", undefined, "Keep Original Scale (100%) & Re-center");
        rbFitWidth.value = true;

        var chkGuides = grpScale.add("checkbox", undefined, "Add UI Safe Zones (Guide Layer)");
        chkGuides.value = true;

        // --- Buttons ---
        var pnlBtns = win.add("panel", undefined, "Convert Master Comp");
        pnlBtns.orientation = "column";
        pnlBtns.alignChildren = ["fill", "top"];
        pnlBtns.spacing = 6;
        pnlBtns.margins = 8;

        var btn916 = pnlBtns.add("button", undefined, "To 9:16 Vertical (1080x1920)");
        var btn11  = pnlBtns.add("button", undefined, "To 1:1 Square (1080x1080)");
        var btn45  = pnlBtns.add("button", undefined, "To 4:5 Portrait (1080x1350)");

        btn916.preferredSize.height = 30;
        btn11.preferredSize.height  = 30;
        btn45.preferredSize.height  = 30;

        function getOrCreateFolder(folderName) {
            for (var i = 1; i <= app.project.numItems; i++) {
                var item = app.project.item(i);
                if (item instanceof FolderItem && item.name === folderName) {
                    return item;
                }
            }
            return app.project.items.addFolder(folderName);
        }

        function convertToFormat(targetW, targetH, suffix) {
            app.beginUndoGroup("Create Social Version - " + suffix);

            var masterComp = app.project.activeItem;
            if (!masterComp || !(masterComp instanceof CompItem)) {
                alert("Παρακαλώ επιλέξτε το Master Composition.");
                return;
            }

            var origW = masterComp.width;
            var origH = masterComp.height;

            // 1. True Duplicate της σύνθεσης (όχι nested pre-comp)
            var newComp = masterComp.duplicate();
            newComp.name = masterComp.name + "_" + suffix;
            newComp.parentFolder = getOrCreateFolder("_Social_Versions");

            // 2. Αλλαγή διαστάσεων του νέου comp
            newComp.width = targetW;
            newComp.height = targetH;

            // 3. Δημιουργία Master Controller Null για όλα τα επίπεδα
            var masterNull = newComp.layers.addNull();
            masterNull.name = "[SOCIAL_LAYOUT_MASTER]";
            masterNull.property("Transform").property("Anchor Point").setValue([50, 50]);
            masterNull.property("Transform").property("Position").setValue([origW / 2, origH / 2]);

            // 4. Parenting όλων των root layers (layer 2 και κάτω)
            for (var i = 2; i <= newComp.layers.length; i++) {
                var lyr = newComp.layers[i];
                if (lyr.parent === null && !lyr.locked) {
                    lyr.parent = masterNull;
                }
            }

            // 5. Μετακίνηση του Controller στο κέντρο του νέου κάδρου
            masterNull.property("Transform").property("Position").setValue([targetW / 2, targetH / 2]);

            // 6. Προσαρμογή Scale
            if (rbFitWidth.value) {
                var scaleRatio = (targetW / origW) * 100;
                masterNull.property("Transform").property("Scale").setValue([scaleRatio, scaleRatio]);
            }

            // 7. Προσθήκη UI Safe Zones (Guide Layer) αν είναι 9:16
            if (chkGuides.value && suffix === "9x16") {
                var guide = newComp.layers.addShape();
                guide.name = "[UI_Safe_Zones_Guide]";
                guide.guideLayer = true;
                guide.locked = true;

                var gRoot = guide.property("ADBE Root Vectors Group");

                function addGuideBlock(yPos, height) {
                    var grp = gRoot.addProperty("ADBE Vector Group");
                    var cnt = grp.property("ADBE Vectors Group");
                    var rect = cnt.addProperty("ADBE Vector Shape - Rect");
                    rect.property("ADBE Vector Rect Size").setValue([targetW, height]);
                    rect.property("ADBE Vector Rect Position").setValue([0, yPos]);

                    var fill = cnt.addProperty("ADBE Vector Graphic - Fill");
                    fill.property("ADBE Vector Fill Color").setValue([1.0, 0.2, 0.3]);
                    fill.property("ADBE Vector Fill Opacity").setValue(20);
                }

                guide.property("Transform").property("Position").setValue([targetW / 2, targetH / 2]);
                addGuideBlock(-(targetH / 2) + 125, 250); // Header bar
                addGuideBlock((targetH / 2) - 190, 380);  // Reels / TikTok UI
            }

            newComp.openInViewer();
            app.endUndoGroup();
        }

        btn916.onClick = function () { convertToFormat(1080, 1920, "9x16"); };
        btn11.onClick  = function () { convertToFormat(1080, 1080, "1x1"); };
        btn45.onClick  = function () { convertToFormat(1080, 1350, "4x5"); };

        win.layout.layout(true);
        return win;
    }

    var panel = buildSocialUnfoldPanel(this);
    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }
}