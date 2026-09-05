// StopMotion_Rig.jsx
// Builds an expression-driven stop-motion rig on a full-comp adjustment layer:
// Posterize Time, Turbulent Displace and Noise, all keyed off three Slider Controls
// (FPS, Displace Amount, Grain Amount) so the whole look tunes from one place.

(function stopMotionRig() {

    app.beginUndoGroup("Build Stop-Motion Rig");

    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select (or open) an active composition first.");
            return;
        }

        // --- Adjustment layer, full comp duration, top of stack ---
        // Oversized 1.5x and centered so the Position wiggle below has room to move
        // without exposing raw comp edges outside the adjustment layer's footprint.
        var oversizePad = 1.5;
        var rigWidth = Math.round(comp.width * oversizePad);
        var rigHeight = Math.round(comp.height * oversizePad);
        var rig = comp.layers.addSolid([1, 1, 1], "STOPMOTION_RIG", rigWidth, rigHeight, comp.pixelAspect, comp.duration);
        rig.adjustmentLayer = true;
        rig.moveToBeginning();
        rig.startTime = 0;
        rig.inPoint = 0;
        rig.outPoint = comp.duration;

        var effects = rig.property("ADBE Effect Parade");

        // --- Slider Controls ---
        var fpsSlider = effects.addProperty("ADBE Slider Control");
        fpsSlider.name = "FPS";
        fpsSlider.property("Slider").setValue(12);

        var displaceSlider = effects.addProperty("ADBE Slider Control");
        displaceSlider.name = "Displace Amount";
        displaceSlider.property("Slider").setValue(3);

        var grainSlider = effects.addProperty("ADBE Slider Control");
        grainSlider.name = "Grain Amount";
        grainSlider.property("Slider").setValue(8);

        var wiggleSlider = effects.addProperty("ADBE Slider Control");
        wiggleSlider.name = "Wiggle Amount";
        wiggleSlider.property("Slider").setValue(4);

        // --- Posterize Time, Frame Rate linked to FPS slider ---
        var posterize = effects.addProperty("ADBE Posterize Time");
        posterize.property("Frame Rate").expression = 'effect("FPS")("Slider")';

        // --- Turbulent Displace, Amount linked to slider, Evolution stepped in sync with FPS ---
        var turbulentDisplace = effects.addProperty("ADBE Turbulent Displace");
        turbulentDisplace.property("Amount").expression = 'effect("Displace Amount")("Slider")';
        turbulentDisplace.property("Size").setValue(12);
        turbulentDisplace.property("Evolution").expression =
            'var fps = effect("FPS")("Slider");\n' +
            'Math.floor(time * fps) * 15;';

        // Offset (Turbulence) jump: re-randomizes once per held frame, independent of any
        // motion already present below, so the rig reads as stop-motion even on static footage.
        turbulentDisplace.property("Offset (Turbulence)").expression =
            'var fps = effect("FPS")("Slider");\n' +
            'var amt = effect("Displace Amount")("Slider");\n' +
            'seedRandom(Math.floor(time * fps), true);\n' +
            'value + [random(-1, 1) * amt * 15, random(-1, 1) * amt * 15];';

        // --- Noise, Amount of Noise linked to Grain slider ---
        var noise = effects.addProperty("ADBE Noise");
        noise.property("Amount of Noise").expression = 'effect("Grain Amount")("Slider")';

        // --- Position wiggle: held per FPS step, like a tripod bumped between shots ---
        var position = rig.property("Transform").property("Position");
        position.expression =
            'posterizeTime(effect("FPS")("Slider"));\n' +
            'wiggle(effect("FPS")("Slider"), effect("Wiggle Amount")("Slider"));';

        alert(
            "Stop-motion rig added.\n\n" +
            "STOPMOTION_RIG is now at the top of \"" + comp.name + "\".\n" +
            "Being an adjustment layer, it affects everything stacked below it in the comp " +
            "— move it if you only want the look on some layers.\n\n" +
            "It's sized 1.5x the comp and centered, giving the Position wiggle room to move " +
            "without exposing raw edges. Don't scale it down to comp size or push Wiggle Amount " +
            "too high, or the padding margin can run out.\n\n" +
            "Tune FPS, Displace Amount, Grain Amount and Wiggle Amount on the layer's effect controls."
        );

    } catch (err) {
        alert("Stop-Motion Rig error: " + err.toString());
    } finally {
        app.endUndoGroup();
    }

})();
