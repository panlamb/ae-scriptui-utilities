# After Effects ScriptUI Utilities

A collection of lightweight, dockable ScriptUI utility panels for Adobe After Effects to automate daily repetitive tasks.

---

### Included Tools

#### 1. Smart Pre-compose (`SmartPrecompose.jsx`)
Automatically calculates the exact visual bounding box of your selected layers, creates the pre-comp cropped precisely to that size, and positions it seamlessly in your main composition without shifting any elements.

![Smart Pre-compose panel](images/smart-precompose.png)

#### 2. Reverse Layer Order (`ReverseLayerOrder.jsx`)
Instantly inverts the timeline stacking order of any selected layers with a single click. Ideal for fixing reversed vector import hierarchies and typography stacks.

![Reverse Layer Order panel](images/reverse-layer-order.png)

#### 3. Social Formats Pro (`SocialFormatsPro.jsx`)
One-click multi-format generation from an active master comp. Instantly generates auto-centered and scaled compositions for:
* **9:16 Vertical** (1080x1920)
* **1:1 Square** (1080x1080)
* **4:5 Portrait** (1080x1350)
* **Batch All Formats**

![Social Formats Pro panel](images/social-formats-pro.png)

#### 4. Text Stagger Splitter (`TextStaggerSplitter.jsx`)
Splits a text layer into per-line, per-word, or per-character layers (or shape layers via "Create Shapes from Text") while preserving exact original position, then staggers the in-points of any selected layers by a configurable frame step. Can optionally auto-precompose the split result.

![Text Stagger Splitter panel](images/text-stagger-splitter.png)

#### 5. StopMotionify Framerate Controller (`StopMotionifyFramerateController.jsx`)
Applies a Posterize Time effect to selected layers to simulate stop-motion frame rates (12/8/15 fps), with an optional handcrafted "tactile jitter" wiggle expression on Position/Rotation. Includes a one-click removal of both the effect and the jitter expressions.

![StopMotionify Framerate Controller panel](images/stopmotionify.png)

---

### Installation

1. Download the `.jsx` files from this repo.
2. Place the `.jsx` files in your After Effects **ScriptUI Panels** directory:
   * **Windows:** `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\`
   * **macOS:** `/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/`
3. Restart Adobe After Effects (or refresh scripts).
4. Launch them from the top menu under **Window > [Script Name].jsx** and dock them anywhere in your workspace.

---

### Illustrator Companion Tool

#### Artboard Exporter for AE (`IllustratorArtboardExporter.jsx`)
Prepares a multi-artboard Illustrator file for animation in After Effects, in one click:
1. Saves each artboard out as its own `.ai` file (leaving the original document untouched).
2. Releases every top-level group in each new file to its own layer (`Release to Layers - Sequence`), so After Effects picks up each element as a separate, animatable layer on import.

**Installation:**
1. Place `IllustratorArtboardExporter.jsx` in your Illustrator **Scripts** directory:
   * **Windows:** `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\en_US\Scripts\`
   * **macOS:** `/Applications/Adobe Illustrator <version>/Presets/en_US/Scripts/`
2. Restart Illustrator.
3. Open your multi-artboard file, run it from **File > Scripts > IllustratorArtboardExporter**, pick an output folder, and confirm.

> Tip: you can also skip splitting into files altogether by importing the original multi-artboard `.ai` into After Effects and using **Interpret Footage > Choose Artboard**, but a separate file per artboard is often cleaner for organizing project bins and handoffs.

---

### License & Support
Free to use in personal and commercial projects. If you find these useful and wish to support future updates, tips are appreciated via [Gumroad](https://8604769003016.gumroad.com/).
