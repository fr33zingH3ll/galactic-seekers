import Express from 'express';
import http from 'http'; // Module http inclus avec Node.js
import cors from 'cors';
import protobuf from 'protobufjs';
import * as argon2 from "argon2";
import r from 'rethinkdb';
import WebSocket, { WebSocketServer } from 'ws';
import 'dotenv/config';

import { EventDispatcher } from 'game-engine/src/utils/EventDispatcher.js';
import { Event } from 'game-engine/src/utils/Event.js';
import { JsonWebTokenAuth } from './jwt.js';
import DBManager from './DB.js';

import { api_request } from '../messages_api.js';
import { postsRouter } from './subrouters/postsRouter.js';
import { messagesRouter } from './subrouters/messagesRouter.js';
import { reportsRouter } from './subrouters/reportsRouter.js';
import { usersRouter } from './subrouters/usersRouter.js';

const API_PATH = "/api/v1";
const API_MESSAGE = API_PATH+"/message";
const API_POST = API_PATH+"/post";
const API_USER = API_PATH+"/user";
const API_REPORT = API_PATH+"/report";
const API_AUTH = API_PATH + "/auth";

/**
 * Class representing the server.
 */
class Server {
    constructor(db) {
        /**
         * Event dispatcher instance.
         * @type {EventDispatcher}
         */
        this.emitter = new EventDispatcher();
        /**
         * Database manager instance.
         * @type {DBManager}
         */
        this.db = db;
        /**
         * Object to hold player connections.
         * @type {Object<string, Object>}
         */
        this.players = {};
        /**
         * Array to hold message queues.
         * @type {Array}
         */
        this.message_queues = [];

        this.app = Express();
        this.server = http.createServer(this.app); // Créez un serveur HTTP
        this.wss = new WebSocketServer({ server: this.server }); // Créez un serveur WebSocket
        this.jwtService = new JsonWebTokenAuth(this.db);

        this.port = 3000;
        this.app.use(cors());
        // Middleware pour traiter le corps des requêtes en JSON
        this.app.use(Express.json());

        // Définir les routes ici
        this.app.get('/api/hello', this.handleHelloRequest.bind(this));

        this.app.post(API_AUTH + '/token', api_request.token.bind(this));
        this.app.post(API_AUTH + '/login', api_request.login.bind(this));
        this.app.post(API_AUTH + '/register', api_request.register.bind(this));

        this.app.use(API_PATH+'/post', postsRouter);
        this.app.use(API_PATH+'/message', messagesRouter);
        this.app.use(API_PATH+'/report', reportsRouter);
        this.app.use(API_PATH+'/user', usersRouter);

        // Gérez les connexions WebSocket
        this.wss.on('connection', this.handleWebSocketConnection.bind(this));
    }

    /**
     * Start the server.
     */
    async start() {
        this.proto = await protobuf.load('../proto/game.proto');

        this.server.listen(this.port, '127.0.0.1', () => {
            console.log(`Server is running at http://localhost:${this.port}`);
        });
    }

    /**
     * Handle a hello request.
     * @param {Express.Request} req - The request object.
     * @param {Express.Response} res - The response object.
     */
    handleHelloRequest(req, res) {
        res.json({ message: 'Hello from your API!' });
    }

    /**
     * Handle a WebSocket connection.
     * @param {WebSocket} ws - The WebSocket connection.
     */
    handleWebSocketConnection(ws) {
        console.log('WebSocket connected');
        const wrap = this.proto.lookupType('MessageWrapper');

        let connection;

        // Écoutez les messages WebSocket
        ws.on('message', async (message) => {
            try {
                const msg = wrap.decode(message);
                const keys = Object.keys(msg);
                const firstKey = keys[0];
                if (firstKey === 'handshakeRequest') {
                    const result = await this.jwtService.jwtVerify(msg[firstKey].token);
                    if (result.error) {
                        console.warn("Closing connection for invalid token.");
                        const error = this.proto.lookupType('Error');
                        this.sendMessage(ws, { error: error.create({ error: result.error }) }, () => {
                            ws.close();
                        });
                        return;
                    }
                    connection = {
                        username: result.sub.username,
                        webSocket: ws,
                    };
                    // FIXME id in jwt as key
                    this.players[connection.username] = connection;

                    this.emitter.dispatchEvent(new Event('loginSuccess', connection));
                }

                if (connection) {
                    this.emitter.dispatchEvent(new Event(firstKey, { message: msg[firstKey], connection }));
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

            if (connection) {
                this.emitter.dispatchEvent(new Event('playerDisconnected', { id: connection.id }));
                delete this.players[connection.username];
            }
        });
    }

    /**
     * Send handshake response to a client.
     * @param {Object} connection - The client connection object.
     * @param {string} userId - The user ID.
     * @param {Object} initialPosition - The initial position.
     * @param {Object} initialRotation - The initial rotation.
     */
    callbackHandshake(connection, userId, initialPosition, initialRotation) {
        const res = this.proto.lookupType('HandshakeResponse');
        console.log(connection.username)

        this.sendMessage(connection.webSocket, {
            handshakeResponse: res.create({
                username: connection.username,
                userId,
                initialPosition,
                initialRotation,
            })
        });
    }

    /**
     * Broadcast the removal of an entity.
     * @param {Object} entity - The entity to remove.
     */
    broadcastRemovedEntity(entity) {
        const del = this.proto.lookupType('ServerEntityDelete');
        this.broadcastMessage({ serverEntityDelete: del.create({ entityId: entity.id }) });
    }

    /**
     * Broadcast new entities to all connected clients.
     * @param {Array<Object>} entities - The entities to broadcast.
     */
    broadcastNewEntities(entities) {
        for (const player of Object.values(this.players)) {
            this.sendNewEntities(player.webSocket, entities);
        }
    }

    /**
     * Send new entities to a specific client.
     * @param {WebSocket} ws - The WebSocket connection.
     * @param {Array<Object>} entities - The entities to send.
     */
    sendNewEntities(ws, entities) {
        const toSend = [];
        const datum = this.proto.lookupType('ServerEntityCreateDatum');
        const data = this.proto.lookupType('ServerEntityCreate');

        for (const entity of entities) {
            toSend.push(datum.create({
                entityId: entity.id,
                type: entity.constructor.name,
                prototype: entity.prototypeName,
                state: entity.serializeState(),
            }));
        }

        this.sendMessage(ws, { serverEntityCreate: data.create({ data: toSend }) });
    }

    /**
     * Broadcast updates of entities to all connected clients.
     * @param {Array<Object>} entities - The entities to update.
     */
    broadcastUpdates(entities) {
        const toSend = [];
        const datum = this.proto.lookupType('ServerEntityUpdateDatum');
        const data = this.proto.lookupType('ServerEntityUpdate');
        for (const entity of entities) {
            toSend.push(datum.create({
                entityId: entity.id,
                state: entity.serializeState(),
            }));
        }

        this.broadcastMessage({ serverEntityUpdate: data.create({ data: toSend }) });
    }

    /**
     * Broadcast a message to all connected clients.
     * @param {Object} msg - The message to broadcast.
     */
    broadcastMessage(msg) {
        for (const player of Object.values(this.players)) {
            this.sendMessage(player.webSocket, msg);
        }
    }

    /**
     * Send a message to a specific client.
     * @param {WebSocket} ws - The WebSocket connection.
     * @param {Object} msg - The message to send.
     * @param {Function} [cb] - Optional callback to execute after sending the message.
     */
    sendMessage(ws, msg, cb) {
        const wrap = this.proto.lookupType('MessageWrapper');

        ws.send(wrap.encode(wrap.create(msg)).finish(), cb);
    }
}

export { Server };
