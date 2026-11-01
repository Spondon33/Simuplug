import { openuiLibrary } from "@openuidev/react-ui";
import { createLibrary } from "@openuidev/react-lang";
import { SimCanvasComponent } from "./sim-components";

// Standard OpenUI components + the SimCanvas simulation component.
export const appLibrary = createLibrary({
  components: [...Object.values(openuiLibrary.components), SimCanvasComponent],
  root: "Stack",
});
