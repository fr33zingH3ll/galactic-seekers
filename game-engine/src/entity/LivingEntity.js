import { Entity } from "./Entity";

class LivingEntity extends Entity {
    constructor(game, options) {
        super(game, options);
        this.hp = 1;
        this.max_hp = 1;
        this.speed = 1500;
        this.force = 1;
    }

    setPosition(vector) {
        if (vector.x === 0 && vector.y === 0) {
            return
        }
        const radians = Math.atan2(vector.x, vector.y);
        const velocity = this.game.Vector.create(Math.sin(radians) / this.speed, Math.cos(radians) / this.speed);
        console.log(velocity);
        this.game.Body.applyForce(this.body, this.body.position, velocity);
    }

    setAngle(angle) {
        this.game.Body.setAngularSpeed(this.body, angle / 100);
    }
}
 
export { LivingEntity };