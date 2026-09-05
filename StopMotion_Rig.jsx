// StopMotion_Rig.jsx
// Builds an expression-driven stop-motion rig on a full-comp adjustment layer:
// Posterize Time, Turbulent Displace, Noise, a Position wiggle, and a chromatic
// aberration split (two extra helper layers), all keyed off Slider Controls on
// STOPMOTION_RIG (FPS, Displace Amount, Grain Amount, Wiggle Amount, Chromatic
// Aberration) so the whole look tunes from one place.

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

        var chromaticSlider = effects.addProperty("ADBE Slider Control");
        chromaticSlider.name = "Chromatic Aberration";
        chromaticSlider.property("Slider").setValue(2);

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

        // Looks up a property by name and fails loudly (naming which one) instead of
        // throwing an opaque "null is not an object" further down the call chain.
        function reqProp(container, name) {
            var p = container.property(name);
            if (!p) {
                throw new Error(
                    'Could not find property "' + name + '" on "' + container.name +
                    '" (' + container.matchName + '). Its name may differ in this After Effects ' +
                    'version/build — check the Effect Controls panel for the exact label.'
                );
            }
            return p;
        }

        // --- Chromatic aberration: two channel-isolated copies, offset in opposite
        // directions and screened back in, sitting directly below STOPMOTION_RIG so its
        // Posterize Time hold also freezes the split. Channel Mixer is used instead of
        // Levels/Shift Channels because its per-channel mix properties are plain numeric
        // sliders, not popups or grouped controls that can be named differently.
        function addChannelSplitLayer(name, keepChannel, offsetSign, afterLayer) {
            var lyr = comp.layers.addSolid([1, 1, 1], name, rigWidth, rigHeight, comp.pixelAspect, comp.duration);
            lyr.adjustmentLayer = true;
            lyr.startTime = 0;
            lyr.inPoint = 0;
            lyr.outPoint = comp.duration;
            lyr.moveAfter(afterLayer);
            lyr.blendingMode = BlendingMode.SCREEN;

            var lyrEffects = lyr.property("ADBE Effect Parade");
            var mixer = lyrEffects.addProperty("ADBE Channel Mixer");
            var channels = ["Red", "Green", "Blue"];
            for (var c = 0; c < channels.length; c++) {
                if (channels[c] === keepChannel) continue;
                reqProp(mixer, channels[c] + "-Red").setValue(0);
                reqProp(mixer, channels[c] + "-Green").setValue(0);
                reqProp(mixer, channels[c] + "-Blue").setValue(0);
                reqProp(mixer, channels[c] + "-Const").setValue(0);
            }

            var xform = lyrEffects.addProperty("ADBE Geometry2");
            reqProp(xform, "Position").expression =
                'value + [' + offsetSign + ' * thisComp.layer("STOPMOTION_RIG").effect("Chromatic Aberration")("Slider"), 0]';

            return lyr;
        }

        var caRed = addChannelSplitLayer("STOPMOTION_RIG_CA_RED", "Red", "1", rig);
        addChannelSplitLayer("STOPMOTION_RIG_CA_BLUE", "Blue", "-1", caRed);

        alert(
            "Stop-motion rig added.\n\n" +
            "STOPMOTION_RIG is now at the top of \"" + comp.name + "\", with two helper layers " +
            "(STOPMOTION_RIG_CA_RED / _CA_BLUE) directly beneath it for the chromatic aberration split. " +
            "All three are adjustment layers, so together they affect everything stacked below them " +
            "in the comp — move the group if you only want the look on some layers, and keep them " +
            "adjacent and in this order.\n\n" +
            "They're sized 1.5x the comp and centered, giving the Position wiggle room to move " +
            "without exposing raw edges. Don't scale them down to comp size or push Wiggle Amount " +
            "too high, or the padding margin can run out.\n\n" +
            "Don't rename STOPMOTION_RIG — the two helper layers reference it by name for their " +
            "Chromatic Aberration slider.\n\n" +
            "Tune FPS, Displace Amount, Grain Amount, Wiggle Amount and Chromatic Aberration on " +
            "STOPMOTION_RIG's effect controls."
        );

    } catch (err) {
        alert("Stop-Motion Rig error: " + err.toString());
    } finally {
        app.endUndoGroup();
    }

})();
