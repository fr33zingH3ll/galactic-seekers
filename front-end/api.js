import protobuf from 'protobufjs';
import { EventDispatcher } from 'game-engine/src/utils/EventDispatcher';
import { Event } from 'game-engine/src/utils/Event';

class Socket {
    constructor(url) {
        this.url = url;
        this.emitter = new EventDispatcher();
    }

    async init() {
        this.proto = await (new protobuf.Root().load("/game.proto"));
        this.socket = new WebSocket(this.url);
        this.socket.binaryType = 'arraybuffer';
        await this.awaitOpen();
        this.socket.addEventListener("message", (event) => {
            try {
                const wrap = this.proto.lookupType('MessageWrapper');
                const msg = wrap.decode(new Uint8Array(event.data));
                const type = Object.keys(msg)[0];
                const message = msg[type];
                this.emitter.dispatchEvent(new Event(type, message));
            } catch (e) {
                console.error(e);
                window.location.replace("/home.html");
                this.socket.close();
            }
        });
        
        this.socket.addEventListener('close', () => {
            logout();
        });
    }

    sendClientShot() {
        const shot = this.proto.lookupType("ClientShot");
        this.sendMessage({ clientShot: shot.create({ inutile: true }) });
    }

    sendPlayerMove(position, rotation, velocity) {
        const move = this.proto.lookupType("ClientPlayerMove");

        this.sendMessage({ clientPlayerMove: move.create({ position, rotation, velocity }) });
    }

    sendHandshake(token) {
        const hs = this.proto.lookupType("HandshakeRequest");

        this.sendMessage({ handshakeRequest: hs.create({ token }) });
    }

    /**
     * @param {protobuf.Message} msg 
     * @param {protobuf.Type} type
     */
    sendMessage(msg) {
        const wrap = this.proto.lookupType('MessageWrapper');

        this.socket.send(wrap.encode(wrap.create(msg)).finish());
    }

    awaitOpen() {
        return new Promise((resolve, reject) => {
            if (this.socket.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            this.socket.addEventListener("open", () => {
                resolve();
            });
        });
    }
}

export { Socket };

export const logout = async () => {
    localStorage.removeItem("token");
    window.location.replace("/");
};

export const login = async (username, password) => {
    const result = await request("/auth/login", {
        body: JSON.stringify({ username, password }),
        method: "POST",
    });

    const body = await result.json();

    if (!result.ok) {
        throw new Error(body.error);
    }

    if (body.erreur) {
        throw new Error(body.erreur);
    }

    localStorage.setItem("token", body.token);
}

export const register = async (username, password, confirm_password) => {

    if (password != confirm_password) {
        throw new Error("Les mots de passes doivent être identiques.");
    }

	const result = await request("/auth/register", {
		body: JSON.stringify({ username, password }),
		method: "POST",
	});

	const body = await result.json();

	if (!result.ok) {
		throw new Error(body.error);
	}

    login(username, password);
};

export const report = async (type, description) => {
    const result = await request("/report", {
        body: JSON.stringify({ type, description }),
        method: "POST"
    });

    const body = await result.json();

    if (!result.ok) {
        throw new Error(body.error);
    }
};

const request = async (url, parameters) => {
	return await fetch(import.meta.env.VITE_API_URI + url, {
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			...(localStorage.getItem("token") ? { Authorization: "Bearer " + localStorage.getItem("token") } : {})
		}, ...(parameters ? parameters : {})
	});
};