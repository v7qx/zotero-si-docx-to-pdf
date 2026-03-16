import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { config } from "../package.json";

const basicTool = new BasicTool();

// @ts-expect-error - Plugin instance is not typed
if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  _globalThis.addon = new Addon();
  defineGlobal("ztoolkit", () => {
    return _globalThis.addon.data.ztoolkit;
  });
  // @ts-expect-error - Plugin instance is not typed
  Zotero[config.addonInstance] = addon;
}

const maybeDOM = globalThis as typeof globalThis & {
  window?: Window;
  document?: Document;
};

if (maybeDOM.window && maybeDOM.document) {
  const bindPreferencePane = () => {
    const browseButton = maybeDOM.document?.querySelector(
      `#zotero-prefpane-${config.addonRef}-browseLibreOffice`,
    );
    if (!browseButton) {
      return;
    }
    registerPrefsScripts(maybeDOM.window as Window);
  };

  if (maybeDOM.document.readyState === "loading") {
    maybeDOM.window.addEventListener("load", bindPreferencePane, { once: true });
  } else {
    maybeDOM.window.setTimeout(bindPreferencePane, 0);
  }
}

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => any): void;
function defineGlobal(name: string, getter?: () => any) {
  Object.defineProperty(_globalThis, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}
