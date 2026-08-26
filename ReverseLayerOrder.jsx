{
    function buildReverseLayerPanel(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Reverse Layers", undefined, {resizeable: true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 8;

        var btnReverse = win.add("button", undefined, "Reverse Selected Layers");
        btnReverse.preferredSize.height = 32;

        btnReverse.onClick = function () {
            app.beginUndoGroup("Reverse Selected Layers");

            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Επιλέξτε μια ενεργή σύνθεση.");
                return;
            }

            var sel = comp.selectedLayers;
            if (sel.length < 2) {
                alert("Επιλέξτε τουλάχιστον 2 layers για αντιστροφή.");
                return;
            }

            // 1. Συλλογή και ταξινόμηση των επιλεγμένων layers κατά index (από πάνω προς τα κάτω)
            var sortedLayers = [];
            for (var i = 0; i < sel.length; i++) {
                sortedLayers.push(sel[i]);
            }
            sortedLayers.sort(function (a, b) {
                return a.index - b.index;
            });

            // 2. Αντιστροφή: Τοποθετούμε διαδοχικά κάθε επόμενο layer ΠΑΝΩ από το προηγούμενο top
            var topLayer = sortedLayers[0];
            for (var j = 1; j < sortedLayers.length; j++) {
                sortedLayers[j].moveBefore(topLayer);
                topLayer = sortedLayers[j];
            }

            app.endUndoGroup();
        };

        win.layout.layout(true);
        return win;
    }

    var myPanel = buildReverseLayerPanel(this);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }
}