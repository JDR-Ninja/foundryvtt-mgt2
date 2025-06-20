export class VehiculeActorSheet extends ActorSheet {
    static get defaultOptions() {
        const options = super.defaultOptions;
    
        //if (game.user.isGM || options.editable)
        //  options.dragDrop.push({ dragSelector: ".drag-item-list", dropSelector: ".drop-item-list" });
    
        return foundry.utils.mergeObject(options, {
          classes: ["mgt2", game.settings.get("mgt2", "theme"), "actor", "vehicule", "nopad"],
          template: "systems/mgt2/templates/actors/vehicule-sheet.html",
          width: 780,
          //height: 600,
          tabs: [
            { navSelector: ".sheet-sidebar", contentSelector: "form" }
          ]
        });
      }
}