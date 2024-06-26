import Matter from "matter-js";
import { Server } from "./api.js";
import { BackGameMaster } from "game-engine/src/gamemode/BackGameMaster.js";

import { Asteroide } from "game-engine/src/entity/Asteroide.js";
import { Lune } from "game-engine/src/entity/Lune.js";

import { LivingEntity } from "game-engine/src/entity/LivingEntity.js";
import { PlayerEntity } from "game-engine/src/entity/PlayerEntity.js";
import { Projectil } from "game-engine/src/entity/Projectil.js";

import { getRandomPosition } from "game-engine/src/utils/functions.js";
import { StaticEntity } from "game-engine/src/entity/StaticEntity.js";
import { AutoSave } from "game-engine/src/saver/AutoSave.js";
import entityNames from "game-engine/src/entity/EntityList.js";

/**
 * Class representing the game master on the server side.
 * @extends BackGameMaster
 */
class GameMaster extends BackGameMaster {
    constructor(db) {
        super();

        /**
         * The server instance.
         * @type {Server}
         */
        this.server = new Server(db);
        
        /**
         * The saver system.
         * @type {AutoSave}
         */
        this.auto_saver = new AutoSave(this, db);
        
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
            const { message: { rotation, velocity }, connection: { entity } } = event.message;

            this.Body.setAngle(entity.body, rotation);
            this.Body.setVelocity(entity.body, velocity);
            entity.dirty = true;
        });

        this.server.emitter.addEventListener('clientShot', event => {
            const player = this.getEntityById(event.message.connection.id);
            if (!player.canShot()) return;
            player.can_shot = false;
            player.tempo_delta = 0;
            const playerPosition = {...player.body.position};
            const newProjectil = new Projectil(this, "base", player.id, playerPosition);
            
            
            
            newProjectil.track = player.body.angle;
            const offset = this.Vector.rotate({x: 0, y: -30}, newProjectil.track);
            newProjectil.track -= Math.PI / 2;

            this.Body.setPosition(newProjectil.body, this.Vector.add(playerPosition, offset));

            this.addPool(newProjectil);
        });

        this.server.emitter.addEventListener('clientOrbit', event => {
            const player = this.getEntityById(event.message.connection.id);
            player.inOrbit = !player.inOrbit;
        });

        this.server.emitter.addEventListener('playerDisconnected', event => {
            const entity = this.getEntityById(event.message.id);
            if (entity) entity.onDeath();
        });
    }

    /**
     * Start the game master and server.
     * @returns {Promise<void>}
     */
    async start() {
        super.start();
        await this.server.start();
        const entities_saved = await this.auto_saver.load_entities();

        for (const entity of entities_saved) {
            const asteroid = new entityNames[entity.type](this,entity.prototype_name);
            Matter.Body.setPosition(asteroid.body, this.Vector.create(entity.state.position.x, entity.state.position.y));
            this.addPool(asteroid);
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


    /**
     * Update the game state.
     * @param {number} delta - The time since the last update.
     */
    update(delta) {
        super.update(delta);
        this.auto_saver.update(delta);

        // Gestion des entités à mettre à jour
        const entitiesToUpdate = this.pool.filter((e) => e.dirty);
        console.log(entitiesToUpdate);
        this.server.broadcastUpdates(entitiesToUpdate);
        entitiesToUpdate.forEach(e => e.dirty = false);

        // Gestion des entités à créer
        const newbornEntities = this.pool.filter((e) => e.newborn);
        this.server.broadcastNewEntities(newbornEntities);
        newbornEntities.forEach(e => e.newborn = false);
    }
}

export { GameMaster };