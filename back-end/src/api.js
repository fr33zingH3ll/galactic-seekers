import Express from 'express';
import http from 'http'; // Module http inclus avec Node.js
import WebSocket, { WebSocketServer } from 'ws';
import protobuf from 'protobufjs';
import { Event } from 'game-engine/src/utils/Event.js';

class Server {
    constructor(game_master) {
        this.game = game_master;
        this.players = {};
        this.message_queues = [];

        this.app = Express();
        // Middleware pour ajouter l'en-tête CSP
        this.app.use((req, res, next) => {
            res.append('Access-Control-Allow-Origin', "http://192.168.1.82:5174");
            next();
        });
        this.server = http.createServer(this.app); // Créez un serveur HTTP
        this.wss = new WebSocketServer({ server: this.server }); // Créez un serveur WebSocket

        this.port = 3000;

        // Middleware pour traiter le corps des requêtes en JSON
        this.app.use(Express.json());

        // Définir les routes ici
        this.app.get('/api/hello', this.handleHelloRequest.bind(this));

        // Gérez les connexions WebSocket
        this.wss.on('connection', this.handleWebSocketConnection.bind(this));
    }

    async start() {
        this.proto = await protobuf.load('../proto/game.proto');

        this.server.listen(this.port, () => {
            console.log(`Server is running at http://localhost:${this.port}`);
        });
    }

    handleHelloRequest(req, res) {
        res.json({ message: 'Hello from your API!' });
    }

    /**
     * @param {WebSocket} ws 
     */
    handleWebSocketConnection(ws) {
        console.log('WebSocket connected');
        const wrap = this.proto.lookupType('MessageWrapper');

        let connection;

        // Écoutez les messages WebSocket
        ws.on('message', (message) => {
            try {
                const msg = wrap.decode(message);
                console.debug('Got message', msg);
                const keys = Object.keys(msg);
                const firstKey = keys[0];

                if (firstKey === 'handshakeRequest') {
                    connection = {
                        username: msg[firstKey].token,
                        webSocket: ws,
                    };

                    // FIXME id in jwt as key
                    this.players[connection.username] = connection;

                    const res = this.proto.lookupType('HandshakeResponse');
                    this.sendMessage(ws, {handshakeResponse: res.create({
                        username: connection.username,
                        userId: 69,
                        initialPosition: {x: 0, y: 0},
                        initialRotation: 0,
                    })});
                }

                if (connection) {
                    this.game.emitter.dispatchEvent(new Event(firstKey, msg[firstKey]));
                } else {
                    console.warn("Closing connection for invalid handshake");
                    const error = this.proto.lookupType('Error');
                    this.sendMessage(ws, { error }, () => {
                        ws.close();
                    });
                }
            } catch (e) {
                console.error(e);
                ws.close();
            }
        });

        // Gérez la fermeture de la connexion WebSocket
        ws.on('close', () => {
            console.log('WebSocket disconnected');
        });
    }

    sendMessage(ws, msg, cb) {
        const wrap = this.proto.lookupType('MessageWrapper');

        ws.send(wrap.encode(wrap.create(msg)).finish(), cb);
    }
}

export { Server };