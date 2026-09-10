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

        var grpProtect = pnlOpts.add("group");
        grpProtect.orientation = "row";
        grpProtect.alignChildren = ["left", "center"];

        var chkProtectFolder = grpProtect.add("checkbox", undefined, "Keep this folder untouched:");
        chkProtectFolder.value = true;

        var txtProtectFolder = grpProtect.add("edittext", undefined, "Final Comps");
        txtProtectFolder.characters = 14;

        var chkPrefix   = pnlOpts.add("checkbox", undefined, "Number folders for a fixed sort order");
        chkPrefix.value = true;

        var chkFlatten  = pnlOpts.add("checkbox", undefined, "Reorganize items already inside folders");
        chkFlatten.value = true;

        var chkVector   = pnlOpts.add("checkbox", undefined, "Separate vector files (AI / EPS / PDF)");
        chkVector.value = true;

        var chkPsdAi = pnlOpts.add("checkbox", undefined, "Group PSD & AI files into their own folder");
        chkPsdAi.value = true;

        var chkDissolveLayers = pnlOpts.add("checkbox", undefined, "Dissolve auto-generated \"<file> Layers\" import folders");
        chkDissolveLayers.value = true;

        var chkGroupProjects = pnlOpts.add("checkbox", undefined, "Group imported .aep projects into a \"Projects\" folder");
        chkGroupProjects.value = true;

        var chkDuplicates = pnlOpts.add("checkbox", undefined, "Separate duplicate footage (same source file)");
        chkDuplicates.value = true;

        var chkUnused   = pnlOpts.add("checkbox", undefined, "Group unused footage into its own folder");
        chkUnused.value = true;

        var chkMissing  = pnlOpts.add("checkbox", undefined, "Flag missing/offline footage");
        chkMissing.value = true;

        var chkColorLabel = pnlOpts.add("checkbox", undefined, "Color-label items by category");
        chkColorLabel.value = true;

        var chkRenameItems = pnlOpts.add("checkbox", undefined, "Number item names within each folder");
        chkRenameItems.value = false;

        // --- Actions ---
        var btnCreateStructure = win.add("button", undefined, "Create Folder Structure");
        btnCreateStructure.preferredSize.height = 26;

        var btnOrganize = win.add("button", undefined, "Organize Materials");
        btnOrganize.preferredSize.height = 32;

        var grpReports = win.add("group");
        grpReports.orientation = "row";
        grpReports.alignChildren = ["fill", "top"];
        grpReports.spacing = 6;

        var btnReport = grpReports.add("button", undefined, "Project Report");
        var btnAudit  = grpReports.add("button", undefined, "Font & Effects Audit");

        var statusText = win.add("statictext", undefined, "", {multiline: true});
        statusText.preferredSize.height = 40;

        // Βασικές κατηγορίες υλικού -> σειρά ταξινόμησης & χρώμα label (1-based, ίδιος αριθμός για φάκελο & label)
        var FOLDER_ORDER = [
            "Compositions",
            "Video Footage",
            "Images",
            "Audio",
            "Solids",
            "Vector Files",
            "Placeholders",
            "Duplicate Footage",
            "Unused Footage",
            "Missing Footage",
            "PSD & AI Files",
            "Projects"
        ];

        function categoryIndex(baseName) {
            for (var i = 0; i < FOLDER_ORDER.length; i++) {
                if (FOLDER_ORDER[i] === baseName) return i + 1;
            }
            return 0;
        }

        function folderDisplayName(baseName) {
            if (!chkPrefix.value) return baseName;
            var idx = categoryIndex(baseName);
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

        // Βασική ταξινόμηση σε τύπο υλικού (χωρίς duplicate/unused overrides)
        function categorizeBase(item, includeVector, includeMissing, includePsdAi) {
            if (item instanceof CompItem) return "Compositions";

            if (item instanceof FootageItem) {
                if (includeMissing) {
                    var missing = false;
                    try { missing = item.footageMissing; } catch (e) {}
                    if (missing) return "Missing Footage";
                }

                var src = item.mainSource;
                if (src) {
                    if (src instanceof SolidSource) return "Solids";
                    if (src instanceof PlaceholderSource) return "Placeholders";

                    if ((src instanceof FileSource) && item.file) {
                        var ext = item.file.name.split(".").pop().toLowerCase();
                        if (includePsdAi && (ext === "psd" || ext === "ai")) return "PSD & AI Files";
                        if (includeVector && (ext === "ai" || ext === "eps" || ext === "pdf")) return "Vector Files";
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

        // Πλήρης ταξινόμηση: εφαρμόζει duplicate/unused overrides πάνω στη βασική κατηγορία
        function categorizeFull(item, dupMap, includeVector, includeMissing, includeDuplicate, includeUnused, includePsdAi) {
            var base = categorizeBase(item, includeVector, includeMissing, includePsdAi);
            if (!base) return null;
            if (base === "Missing Footage") return base;

            if (includeDuplicate && item instanceof FootageItem && item.file) {
                var grp = dupMap[item.file.fsName];
                if (grp && grp.length > 1) return "Duplicate Footage";
            }

            if (includeUnused && item instanceof FootageItem && item.usedIn.length === 0) {
                return "Unused Footage";
            }

            return base;
        }

        // Εντοπισμός υπάρχοντος φακέλου (οπουδήποτε στο project) με το ζητούμενο όνομα, προς εξαίρεση
        function findExistingFolderByName(name) {
            var wanted = name.replace(/^\s+|\s+$/g, "").toLowerCase();
            if (!wanted) return null;
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof FolderItem && it.name.toLowerCase() === wanted) return it;
            }
            return null;
        }

        // Ελέγχει αν το item βρίσκεται (σε οποιοδήποτε βάθος) μέσα στον δοσμένο φάκελο
        function isInsideFolder(item, folder) {
            var p = item.parentFolder;
            while (p) {
                if (p === folder) return true;
                if (p === app.project.rootFolder) break;
                p = p.parentFolder;
            }
            return false;
        }

        // Διαλύει τους φακέλους "<αρχείο> Layers" που φτιάχνει αυτόματα το AE σε layered import PSD/AI:
        // ανεβάζει όλα τα περιεχόμενά τους στη ρίζα (θα ταξινομηθούν κανονικά στη συνέχεια) και διαγράφει τον άδειο φάκελο.
        function dissolveImportLayerFolders() {
            var count = 0;
            var candidates = [];

            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof FolderItem && /\sLayers$/.test(it.name)) candidates.push(it);
            }

            for (var c = 0; c < candidates.length; c++) {
                var folder = candidates[c];
                var kids = [];
                for (var j = 1; j <= app.project.numItems; j++) {
                    var kid = app.project.item(j);
                    if (kid.parentFolder === folder) kids.push(kid);
                }
                for (var k = 0; k < kids.length; k++) {
                    kids[k].parentFolder = app.project.rootFolder;
                }
                try { folder.remove(); count++; } catch (eRemove) {}
            }

            return count;
        }

        // Εντοπίζει φακέλους από imported .aep projects (το AE τους ονομάζει ακριβώς σαν το αρχείο, π.χ. "Client.aep")
        // και τους μετακινεί (άθικτους, με όλο το περιεχόμενό τους) μέσα σε έναν φάκελο "Projects".
        function groupImportedProjectFolders() {
            var moved = 0;
            var folders = [];
            var candidates = [];

            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof FolderItem && /\.aep$/i.test(it.name)) candidates.push(it);
            }

            if (candidates.length === 0) return { moved: moved, folders: folders };

            var projectsFolder = getOrCreateFolder("Projects");
            for (var c = 0; c < candidates.length; c++) {
                var folder = candidates[c];
                if (folder !== projectsFolder && folder.parentFolder !== projectsFolder) {
                    folder.parentFolder = projectsFolder;
                    moved++;
                }
                folders.push(folder);
            }

            return { moved: moved, folders: folders };
        }

        // Χαρτογράφηση απόλυτου path αρχείου -> λίστα FootageItems που το χρησιμοποιούν (εντοπισμός duplicates)
        function buildDuplicateMap() {
            var map = {};
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof FootageItem && it.file) {
                    var key = it.file.fsName;
                    if (!map[key]) map[key] = [];
                    map[key].push(it);
                }
            }
            return map;
        }

        function stripNumberPrefix(name) {
            return name.replace(/^\d{2,4}\s*-\s*/, "");
        }

        function padNumber(n, groupLength) {
            var width = (groupLength >= 100) ? 3 : 2;
            var s = "" + n;
            while (s.length < width) s = "0" + s;
            return s;
        }

        function formatBytes(bytes) {
            if (!bytes || bytes <= 0) return "0 MB";
            var mb = bytes / 1048576;
            if (mb > 1024) return (mb / 1024).toFixed(2) + " GB";
            return mb.toFixed(2) + " MB";
        }

        function showReportWindow(title, text) {
            var w = new Window("dialog", title, undefined, {resizeable: true});
            w.orientation = "column";
            w.alignChildren = ["fill", "fill"];
            w.preferredSize = [440, 480];

            var et = w.add("edittext", undefined, text, {multiline: true, scrollable: true, readonly: true});
            et.preferredSize = [420, 420];

            var btnClose = w.add("button", undefined, "Close");
            btnClose.onClick = function () { w.close(); };

            w.show();
        }

        // Φάκελοι που δημιουργούνται εξ αρχής σε ένα καινούριο/άδειο project
        var STARTER_FOLDERS = [
            "Compositions",
            "Video Footage",
            "Images",
            "Audio",
            "Solids",
            "Vector Files",
            "Placeholders",
            "PSD & AI Files",
            "Projects"
        ];

        // --- Create Folder Structure (για νέο project) ---
        btnCreateStructure.onClick = function () {
            app.beginUndoGroup("Create Material Folder Structure");
            folderCache = {};
            var created = 0;

            try {
                for (var i = 0; i < STARTER_FOLDERS.length; i++) {
                    var before = app.project.numItems;
                    getOrCreateFolder(STARTER_FOLDERS[i]);
                    if (app.project.numItems > before) created++;
                }

                if (chkProtectFolder.value) {
                    var wanted = txtProtectFolder.text.replace(/^\s+|\s+$/g, "");
                    if (wanted && !findExistingFolderByName(wanted)) {
                        app.project.items.addFolder(wanted);
                        created++;
                    }
                }

                statusText.text = "Folder structure ready. Created: " + created + " new folder(s).";
            } catch (err) {
                alert("Σφάλμα κατά τη δημιουργία φακέλων: " + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        // --- Organize Materials ---
        btnOrganize.onClick = function () {
            app.beginUndoGroup("Organize Project Materials");
            folderCache = {};

            var moved = 0, renamed = 0, labeled = 0, skipped = 0, dissolved = 0, projectsGrouped = 0;

            try {
                var protectedFolder = chkProtectFolder.value ? findExistingFolderByName(txtProtectFolder.text) : null;

                if (chkDissolveLayers.value) dissolved = dissolveImportLayerFolders();

                var excludedFolders = [];
                if (protectedFolder) excludedFolders.push(protectedFolder);
                if (chkGroupProjects.value) {
                    var projectGroupResult = groupImportedProjectFolders();
                    projectsGrouped = projectGroupResult.moved;
                    for (var pf = 0; pf < projectGroupResult.folders.length; pf++) {
                        excludedFolders.push(projectGroupResult.folders[pf]);
                    }
                }

                var dupMap = buildDuplicateMap();
                var total = app.project.numItems;
                var targets = [];
                var byCategory = {};

                for (var i = 1; i <= total; i++) {
                    var item = app.project.item(i);
                    if (item instanceof FolderItem) continue;

                    var isExcluded = false;
                    for (var ef = 0; ef < excludedFolders.length; ef++) {
                        if (isInsideFolder(item, excludedFolders[ef])) { isExcluded = true; break; }
                    }
                    if (isExcluded) {
                        skipped++;
                        continue;
                    }

                    if (!chkFlatten.value && item.parentFolder !== app.project.rootFolder) {
                        skipped++;
                        continue;
                    }

                    var category = categorizeFull(item, dupMap, chkVector.value, chkMissing.value, chkDuplicates.value, chkUnused.value, chkPsdAi.value);
                    if (!category) { skipped++; continue; }

                    targets.push({ item: item, category: category });
                    if (!byCategory[category]) byCategory[category] = [];
                    byCategory[category].push(item);
                }

                // Αρίθμηση ονομάτων εντός κάθε κατηγορίας (αλφαβητικά, με βάση το "καθαρό" όνομα)
                if (chkRenameItems.value) {
                    for (var cat in byCategory) {
                        if (!byCategory.hasOwnProperty(cat)) continue;
                        var group = byCategory[cat];
                        group.sort(function (a, b) {
                            var an = stripNumberPrefix(a.name).toLowerCase();
                            var bn = stripNumberPrefix(b.name).toLowerCase();
                            if (an < bn) return -1;
                            if (an > bn) return 1;
                            return 0;
                        });
                        for (var g = 0; g < group.length; g++) {
                            var clean = stripNumberPrefix(group[g].name);
                            var newName = padNumber(g + 1, group.length) + " - " + clean;
                            if (group[g].name !== newName) {
                                group[g].name = newName;
                                renamed++;
                            }
                        }
                    }
                }

                for (var j = 0; j < targets.length; j++) {
                    var t = targets[j];
                    var folder = getOrCreateFolder(t.category);
                    if (t.item.parentFolder !== folder) {
                        t.item.parentFolder = folder;
                        moved++;
                    }
                    if (chkColorLabel.value) {
                        var lbl = categoryIndex(t.category);
                        if (lbl > 0 && lbl <= 16 && t.item.label !== lbl) {
                            t.item.label = lbl;
                            labeled++;
                        }
                    }
                }

                statusText.text = "Done. Moved: " + moved + "  |  Renamed: " + renamed + "  |  Labeled: " + labeled +
                    "  |  Left as is: " + skipped + "  |  Import folders dissolved: " + dissolved + "  |  Projects grouped: " + projectsGrouped;
            } catch (err) {
                alert("Σφάλμα κατά την οργάνωση: " + err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        // --- Project Report ---
        btnReport.onClick = function () {
            try {
                var dupMap = buildDuplicateMap();
                var counts = {};
                for (var f = 0; f < FOLDER_ORDER.length; f++) counts[FOLDER_ORDER[f]] = 0;

                var totalItems = 0, folderCount = 0, totalSize = 0;

                for (var i = 1; i <= app.project.numItems; i++) {
                    var item = app.project.item(i);
                    if (item instanceof FolderItem) { folderCount++; continue; }

                    totalItems++;
                    var category = categorizeFull(item, dupMap, true, true, true, true, true);
                    if (category) counts[category] = (counts[category] || 0) + 1;

                    if (item instanceof FootageItem && item.file) {
                        try { totalSize += item.file.length; } catch (e) {}
                    }
                }

                var dupGroups = 0, dupItems = 0;
                for (var key in dupMap) {
                    if (!dupMap.hasOwnProperty(key)) continue;
                    if (dupMap[key].length > 1) { dupGroups++; dupItems += dupMap[key].length; }
                }

                var lines = [];
                lines.push("PROJECT REPORT");
                lines.push("Project: " + (app.project.file ? app.project.file.name : "(unsaved)"));
                lines.push("");
                lines.push("Total items: " + totalItems + "   Folders: " + folderCount);
                lines.push("Total footage size on disk: " + formatBytes(totalSize));
                lines.push("");
                lines.push("--- By category ---");
                for (var c = 0; c < FOLDER_ORDER.length; c++) {
                    var name = FOLDER_ORDER[c];
                    lines.push(name + ": " + counts[name]);
                }
                lines.push("");
                lines.push("--- Duplicates ---");
                lines.push("Duplicate source files: " + dupGroups + " group(s), " + dupItems + " item(s) total");

                showReportWindow("Project Report", lines.join("\n"));
            } catch (err) {
                alert("Σφάλμα κατά τη δημιουργία report: " + err.toString());
            }
        };

        // --- Font & Effects Audit ---
        btnAudit.onClick = function () {
            try {
                var fonts = {};   // key -> count
                var effects = {}; // matchName -> {name, count}
                var usedFontsFromApi = false;

                try {
                    if (app.project.usedFonts) {
                        var uf = app.project.usedFonts;
                        for (var u = 0; u < uf.length; u++) {
                            var fi = uf[u];
                            var key = fi.fontName + (fi.fontStyle ? (" (" + fi.fontStyle + ")") : "");
                            fonts[key] = (fonts[key] || 0) + 1;
                            usedFontsFromApi = true;
                        }
                    }
                } catch (eApi) {}

                for (var i = 1; i <= app.project.numItems; i++) {
                    var comp = app.project.item(i);
                    if (!(comp instanceof CompItem)) continue;

                    for (var li = 1; li <= comp.numLayers; li++) {
                        var layer = comp.layer(li);

                        if (!usedFontsFromApi) {
                            try {
                                var textProp = layer.property("Source Text");
                                if (textProp) {
                                    var doc = textProp.value;
                                    var fkey = doc.font + (doc.fontStyle ? (" (" + doc.fontStyle + ")") : "");
                                    fonts[fkey] = (fonts[fkey] || 0) + 1;
                                }
                            } catch (eFont) {}
                        }

                        try {
                            var fxParade = layer.property("ADBE Effect Parade");
                            if (fxParade) {
                                for (var e = 1; e <= fxParade.numProperties; e++) {
                                    var eff = fxParade.property(e);
                                    var mk = eff.matchName;
                                    if (!effects[mk]) effects[mk] = { name: eff.name, count: 0 };
                                    effects[mk].count++;
                                }
                            }
                        } catch (eFx) {}
                    }
                }

                var lines = [];
                lines.push("FONT & EFFECTS AUDIT");
                lines.push("Project: " + (app.project.file ? app.project.file.name : "(unsaved)"));
                lines.push("");
                lines.push("--- Fonts used ---");
                var fontKeys = [];
                for (var fk in fonts) { if (fonts.hasOwnProperty(fk)) fontKeys.push(fk); }
                fontKeys.sort();
                if (fontKeys.length === 0) lines.push("(none found)");
                for (var fx2 = 0; fx2 < fontKeys.length; fx2++) {
                    lines.push(fontKeys[fx2] + "  x" + fonts[fontKeys[fx2]]);
                }

                lines.push("");
                lines.push("--- Effects / plugins used ---");
                var effKeys = [];
                for (var ek in effects) { if (effects.hasOwnProperty(ek)) effKeys.push(ek); }
                effKeys.sort(function (a, b) { return effects[b].count - effects[a].count; });
                if (effKeys.length === 0) lines.push("(none found)");
                for (var ex = 0; ex < effKeys.length; ex++) {
                    var mkey = effKeys[ex];
                    var isNative = (mkey.indexOf("ADBE") === 0);
                    lines.push(effects[mkey].name + "  x" + effects[mkey].count + (isNative ? "" : "   [non-native]"));
                }

                showReportWindow("Font & Effects Audit", lines.join("\n"));
            } catch (err) {
                alert("Σφάλμα κατά το audit: " + err.toString());
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
