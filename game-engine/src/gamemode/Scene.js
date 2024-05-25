import { Entity } from "../entity/Entity.js";
import { EventDispatcher } from "../utils/EventDispatcher.js";


/**
 * Classe représentant un mode de jeu générique utilisant Matter.js et PIXI.js.
 */
class Scene {
    /**
     * Crée une instance de GameMode.
     */
    constructor() {
        this.pool = [];
        this.emitter = new EventDispatcher();
        this.debug = false;
    }

    /**
     * Démarre le mode de jeu en ajoutant une fonction de mise à jour à la boucle de rendu.
     */
    start() { }

    /**
     * Ajoute une entité au pool et son corps physique à la liste des corps.
     * @param {Entity} entity - Entité à ajouter au pool.
     */
    addPool(entity) {
        this.pool.push(entity);
    }

    getEntityById(id) {
        const entities = this.pool.filter(e => e.id);
        return entities.length ? entities[0] : null;
    }

    removePool(entity) {
        const indexEntity = this.pool.indexOf(entity);

        if (indexEntity !== -1) {
            this.pool.splice(indexEntity, 1);
        }
    }

    destroy() {
        for (const entity of this.pool) {
            this.removePool(entity);
        }
    }

    update(delta) {
        for (const entity of this.pool) {
            entity.update(delta);
        }
    }
}

export { Scene };