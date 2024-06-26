import { Entity } from "./Entity.js";

/**
 * Représente une entité vivante dans le jeu, héritant de la classe Entity.
 */
class LivingEntity extends Entity {
    /**
     * Crée une instance de LivingEntity.
     * @param {Object} game - L'instance du jeu.
     * @param {string} prototypeName - Le nom du prototype de l'entité.
     */
    constructor(game, prototypeName) {
        super(game, prototypeName);

        // Initialise les points de vie maximum, les points de vie actuels, la vitesse et la force de l'entité
        this.hpMax = this.prototype.hpMax;
        this.hp = this.hpMax;
        this.speed = this.prototype.speed;
        this.force = this.prototype.force;
    }

    /**
     * Inflige des dégâts à l'entité vivante.
     * @param {number} damage - Les dégâts à infliger.
     */
    damage(damage) {
        // Réduit les points de vie de l'entité par les dégâts infligés
        this.hp -= damage;

        // Vérifie si les points de vie sont tombés à zéro ou moins, déclenche l'événement de mort
        if (this.hp <= 0) {
            this.onDeath();
        }
    }

    /**
     * Gère l'événement de mort de l'entité vivante.
     */
    onDeath() {
        // Retire l'entité du pool du jeu et la détruit
        this.game.removePool(this);
        this.destroy();
    }

    /**
     * Déplace l'entité vivante dans une direction donnée par un vecteur.
     * @param {Object} vector - Le vecteur de direction du déplacement.
     */
    move(vector) {
        // Si le vecteur de direction est nul, ne fait rien
        if (vector.x === 0 && vector.y === 0) {
            return;
        }
    
        // Calcule l'angle en radians en fonction du vecteur de direction
        const radians = Math.atan2(vector.y, vector.x);
    
        // Calcule la magnitude de la force en fonction de la vitesse et de la masse de l'entité
        const forceMagnitude = this.speed / this.body.mass;
        
        // Crée un vecteur de vitesse en utilisant l'angle et la magnitude de la force
        const velocity = this.game.Vector.create(
            Math.cos(radians) / 20000 * forceMagnitude,
            Math.sin(radians) / 20000 * forceMagnitude
        );
    
        // Applique la force calculée au corps de l'entité
        this.game.Body.applyForce(this.body, this.body.position, velocity);
    }

    /**
     * Définit la vélocité angulaire de l'entité vivante.
     * @param {number} angle - L'angle de vélocité angulaire à définir.
     */
    setAngularVelocity(angle) {
        // Si l'angle est nul, ne fait rien
        if (angle === 0) {
            return;
        }

        // Définit la vélocité angulaire du corps de l'entité en fonction de l'angle
        this.game.Body.setAngularVelocity(this.body, angle / 50);
    }

    /**
     * Sérialise l'état de l'entité vivante.
     * @returns {Object} - L'état sérialisé de l'entité vivante.
     */
    serializeState() {
        return {
            livingEntity: {
                hp: this.hp,
                hpMax: this.hpMax,
                speed: this.speed,
                force: this.force,
            },

            ...super.serializeState(),
        };
    }

    /**
     * Désérialise l'état de l'entité vivante à partir d'un état sérialisé.
     * @param {Object} state - L'état sérialisé de l'entité vivante.
     */
    deserializeState(state) {
        // Désérialise l'état de l'entité de base
        super.deserializeState(state);
        
        // Désérialise les propriétés spécifiques à l'entité vivante
        this.hp = state.livingEntity.hp;
        this.hpMax = state.livingEntity.hpMax;
        this.speed = state.livingEntity.speed;
        this.force = state.livingEntity.force;
    }

    /**
     * Met à jour l'entité vivante.
     * @param {number} delta - Le temps écoulé depuis la dernière mise à jour.
     */
    update(delta) {
        // Appelle la méthode de mise à jour de l'entité de base
        super.update(delta);
    }
}

export { LivingEntity };
