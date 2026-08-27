# After Effects ScriptUI Utilities

A collection of lightweight, dockable ScriptUI utility panels for Adobe After Effects to automate daily repetitive tasks.

---

### Included Tools

#### 1. Smart Pre-compose (`SmartPrecompose.jsx`)
Automatically calculates the exact visual bounding box of your selected layers, creates the pre-comp cropped precisely to that size, and positions it seamlessly in your main composition without shifting any elements.

#### 2. Reverse Layer Order (`ReverseLayerOrder.jsx`)
Instantly inverts the timeline stacking order of any selected layers with a single click. Ideal for fixing reversed vector import hierarchies and typography stacks.

#### 3. Social Formats Pro (`SocialFormatsPro.jsx`)
One-click multi-format generation from an active master comp. Instantly generates auto-centered and scaled compositions for:
* **9:16 Vertical** (1080x1920)
* **1:1 Square** (1080x1080)
* **4:5 Portrait** (1080x1350)
* **Batch All Formats**

#### 4. Text Stagger Splitter (`TextStaggerSplitter.jsx`)
Splits a text layer into per-line, per-word, or per-character layers (or shape layers via "Create Shapes from Text") while preserving exact original position, then staggers the in-points of any selected layers by a configurable frame step. Can optionally auto-precompose the split result.

#### 5. StopMotionify Framerate Controller (`StopMotionifyFramerateController.jsx`)
Applies a Posterize Time effect to selected layers to simulate stop-motion frame rates (12/8/15 fps), with an optional handcrafted "tactile jitter" wiggle expression on Position/Rotation. Includes a one-click removal of both the effect and the jitter expressions.

---

### Installation

1. Download the `.jsx` files from this repo.
2. Place the `.jsx` files in your After Effects **ScriptUI Panels** directory:
   * **Windows:** `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\`
   * **macOS:** `/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/`
3. Restart Adobe After Effects (or refresh scripts).
4. Launch them from the top menu under **Window > [Script Name].jsx** and dock them anywhere in your workspace.

---

### License & Support
Free to use in personal and commercial projects. If you find these useful and wish to support future updates, tips are appreciated via Gumroad.
