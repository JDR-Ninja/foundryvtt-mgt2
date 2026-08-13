/**
 * Preload the templates rendered through `renderTemplate` rather than by an Application.
 * Templates referenced from a PARTS entry are loaded by ApplicationV2 itself.
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function() {

  const templatePaths = [
    "systems/mgt2/templates/roll-prompt.html",
    "systems/mgt2/templates/chat/roll.html",
    "systems/mgt2/templates/actors/actor-config-sheet.html",
    "systems/mgt2/templates/actors/actor-config-characteristic-sheet.html",
    "systems/mgt2/templates/combat/side.html"
  ];

  return foundry.applications.handlebars.loadTemplates(templatePaths);
};
