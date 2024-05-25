import Matter from "matter-js";
import { GameMaster } from "game-engine/src/gamemode/GameMaster.js";
import { PlayerEntity } from "game-engine/src/entity/PlayerEntity.js";
import { Asteroide } from "game-engine/src/entity/Asteroide.js";
import { Server } from "./api.js";
import { Projectil } from "game-engine/src/entity/Projectil.js";
import { LivingEntity } from "game-engine/src/entity/LivingEntity.js";

/**
 * Class representing the game master on the server side.
 * @extends GameMaster
 */
class BackGameMaster extends GameMaster {
    constructor() {
        super();

        /**
         * The server instance.
         * @type {Server}
         */
        this.server = new Server();

        // Création d'une instance de Asteroide avec des paramètres spécifiques et ajout à la scène
        for (let index = 0; index < 60; index++) {
            const asteroid = new Asteroide(this);
            const x = this.getRandomPosition(-100, 0);
            const y = this.getRandomPosition(-100, 0);
            Matter.Body.setPosition(asteroid.body, { x, y });
            this.addPool(asteroid);    
        }
        
        this.server.emitter.addEventListener('loginSuccess', (event) => {
            this.server.sendNewEntities(event.message.webSocket, this.pool);
            const newPlayer = new PlayerEntity(this, "base");

            newPlayer.connection = event.message;
            event.message.entity = newPlayer;
            this.addPool(newPlayer);
            this.server.players[event.message.username].id = newPlayer.id;

            this.server.callbackHandshake(event.message, newPlayer.id, newPlayer.body.position, newPlayer.body.angle);
        });

        this.server.emitter.addEventListener('clientPlayerMove', event => {
            const { message: { position, rotation, velocity }, connection: { entity } } = event.message;

            this.Body.setPosition(entity.body, position);
            this.Body.setAngle(entity.body, rotation);
            this.Body.setVelocity(entity.body, velocity);
            entity.dirty = true;
        });

        this.server.emitter.addEventListener('clientShot', event => {
            const player = this.getEntityById(event.message.connection.id);
            const newProjectil = new Projectil(this, "base", event.message.connection.id);
            const playerPosition = player.body.position;
            
            newProjectil.track = player.body.angle;
            const offset = this.Vector.rotate({x: 0, y: -30}, newProjectil.track);
            newProjectil.track -= Math.PI / 2;

            this.Body.setPosition(newProjectil.body, this.Vector.add(playerPosition, offset));

            this.addPool(newProjectil);
        });
    }

    /**
     * Generate a random position between two values.
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @returns {number} A random number between min and max.
     */
    getRandomPosition(min, max) {
        return Math.random() * (max - min) + min;
    }

    /**
     * Start the game master and server.
     * @returns {Promise<void>}
     */
    async start() {
        super.start();
        await this.server.start();
    }

    /**
     * Update the game state.
     * @param {number} delta - The time since the last update.
     */
    update(delta) {
        super.update(delta);

        // Gestion des entités à mettre à jour
        const entitiesToUpdate = this.pool.filter((e) => e.dirty);
        this.server.broadcastUpdates(entitiesToUpdate);
        entitiesToUpdate.forEach(e => e.dirty = false);

        // Gestion des entités à créer
        const newbornEntities = this.pool.filter((e) => e.newborn);
        if (newbornEntities.length !== 0) {
            this.server.broadcastNewEntities(newbornEntities);
            newbornEntities.forEach(e => e.newborn = false);
        }
    }

    /**
     * Remove an entity from the pool and broadcast its removal.
     * @param {LivingEntity} entity - The entity to remove.
     */
    removePool(entity) {
        this.server.broadcastRemovedEntity(entity);
        super.removePool(entity);
    }
}

export { BackGameMaster };