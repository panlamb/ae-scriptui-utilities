{
    function buildMaterialOrganizerUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Material Organizer", undefined, {resizeable: true});
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

        var chkPrefix   = pnlOpts.add("checkbox", undefined, "Number folders for a fixed sort order");
        chkPrefix.value = true;

        var chkFlatten  = pnlOpts.add("checkbox", undefined, "Reorganize items already inside folders");
        chkFlatten.value = true;

        var chkVector   = pnlOpts.add("checkbox", undefined, "Separate vector files (AI / EPS / PDF)");
        chkVector.value = true;

        var chkUnused   = pnlOpts.add("checkbox", undefined, "Group unused footage into its own folder");
        chkUnused.value = true;

        var chkMissing  = pnlOpts.add("checkbox", undefined, "Flag missing/offline footage");
        chkMissing.value = true;

        // --- Action ---
        var btnOrganize = win.add("button", undefined, "Organize Materials");
        btnOrganize.preferredSize.height = 32;

        var statusText = win.add("statictext", undefined, "", {multiline: true});
        statusText.preferredSize.height = 40;

        // Βασικά ονόματα φακέλων -> σειρά ταξινόμησης
        var FOLDER_ORDER = [
            "Compositions",
            "Video Footage",
            "Images",
            "Audio",
            "Solids",
            "Vector Files",
            "Placeholders",
            "Unused Footage",
            "Missing Footage"
        ];

        function folderDisplayName(baseName) {
            if (!chkPrefix.value) return baseName;
            var idx = 0;
            for (var i = 0; i < FOLDER_ORDER.length; i++) {
                if (FOLDER_ORDER[i] === baseName) { idx = i + 1; break; }
            }
            var num = (idx < 10) ? "0" + idx : "" + idx;
            return num + "_" + baseName;
        }

        // Εντοπισμός (ή δημιουργία) φακέλου στη ρίζα του project με το ζητούμενο base name
        var folderCache = {};
        function getOrCreateFolder(baseName) {
            if (folderCache[baseName]) return folderCache[baseName];

            var wanted = folderDisplayName(baseName);
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof FolderItem && it.parentFolder === app.project.rootFolder && it.name === wanted) {
                    folderCache[baseName] = it;
                    return it;
                }
            }
            var newFolder = app.project.items.addFolder(wanted);
            folderCache[baseName] = newFolder;
            return newFolder;
        }

        // Ταξινόμηση ενός item σε βασική κατηγορία υλικού
        function categorize(item) {
            if (item instanceof CompItem) return "Compositions";

            if (item instanceof FootageItem) {
                if (chkMissing.value) {
                    var missing = false;
                    try { missing = item.footageMissing; } catch (e) {}
                    if (missing) return "Missing Footage";
                }

                var src = item.mainSource;
                if (src) {
                    if (src instanceof SolidSource) return "Solids";
                    if (src instanceof PlaceholderSource) return "Placeholders";

                    if (chkVector.value && (src instanceof FileSource) && item.file) {
                        var ext = item.file.name.split(".").pop().toLowerCase();
                        if (ext === "ai" || ext === "eps" || ext === "pdf") return "Vector Files";
                    }
                }

                if (item.hasAudio && !item.hasVideo) return "Audio";

                if (item.hasVideo) {
                    var isStill = false;
                    try { isStill = src && src.isStill; } catch (e2) {}
                    return isStill ? "Images" : "Video Footage";
                }
            }

            return null; // FolderItem ή μη αναγνωρίσιμος τύπος -> δεν μετακινείται
        }

        btnOrganize.onClick = function () {
            app.beginUndoGroup("Organize Project Materials");
            folderCache = {};

            var moved = 0, skipped = 0;

            try {
                var total = app.project.numItems;
                var targets = [];

                for (var i = 1; i <= total; i++) {
                    var item = app.project.item(i);
                    if (item instanceof FolderItem) continue;

                    if (!chkFlatten.value && item.parentFolder !== app.project.rootFolder) {
                        skipped++;
                        continue;
                    }

                    var category = categorize(item);
                    if (!category) { skipped++; continue; }

                    if (chkUnused.value && item instanceof FootageItem && category !== "Missing Footage") {
                        if (item.usedIn.length === 0) category = "Unused Footage";
                    }

                    targets.push({ item: item, category: category });
                }

                for (var j = 0; j < targets.length; j++) {
                    var t = targets[j];
                    var folder = getOrCreateFolder(t.category);
                    if (t.item.parentFolder !== folder) {
                        t.item.parentFolder = folder;
                        moved++;
                    }
                }

                statusText.text = "Done. Moved: " + moved + "  |  Left as is: " + skipped;
            } catch (err) {
                alert("Σφάλμα κατά την οργάνωση: " + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        win.layout.layout(true);
        return win;
    }

    var myPanel = buildMaterialOrganizerUI(this);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }
}
