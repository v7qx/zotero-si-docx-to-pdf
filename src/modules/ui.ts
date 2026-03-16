import { getString } from "../utils/locale";

export class PluginUI {
  static registerPrefs() {
    Zotero.PreferencePanes.register({
      pluginID: addon.data.config.addonID,
      src: rootURI + "content/preferences.xhtml",
      scripts: [rootURI + "content/scripts/siwordpdf.js"],
      label: getString("prefs-title"),
    });
  }
}
