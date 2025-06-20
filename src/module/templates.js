/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function() {

    const templatePaths = [
      "systems/mgt2/templates/items/parts/sheet-configuration.html",
      "systems/mgt2/templates/items/parts/sheet-physical-item.html",
      "systems/mgt2/templates/roll-prompt.html",
      "systems/mgt2/templates/chat/roll.html",
      //"systems/mgt2/templates/chat/roll-characteristic.html",
      "systems/mgt2/templates/actors/actor-config-sheet.html",
      "systems/mgt2/templates/actors/actor-config-characteristic-sheet.html",
      "systems/mgt2/templates/actors/trait-sheet.html",
      "systems/mgt2/templates/editor-fullview.html"
      //"systems/mgt2/templates/actors/parts/actor-characteristic.html"
    ];
  
    return loadTemplates(templatePaths);
  };