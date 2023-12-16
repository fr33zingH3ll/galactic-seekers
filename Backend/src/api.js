import Express from 'express';
import http from 'http'; // Module http inclus avec Node.js
import WebSocket, { WebSocketServer } from 'ws';

class Server {
    constructor() {
        this.app = Express();
        // Middleware pour ajouter l'en-tête CSP
        this.app.use((req, res, next) => {
            res.append('Access-Control-Allow-Origin', "http://localhost:5174");
            next();
        });
        this.server = http.createServer(this.app); // Créez un serveur HTTP
        this.wss = new WebSocketServer({ server: this.server }); // Créez un serveur WebSocket

        this.port = 3001;

        // Middleware pour traiter le corps des requêtes en JSON
        this.app.use(Express.json());

        // Définir les routes ici
        this.app.get('/api/hello', this.handleHelloRequest.bind(this));

        // Gérez les connexions WebSocket
        this.wss.on('connection', this.handleWebSocketConnection.bind(this));

        // Lance le serveur
        this.server.listen(this.port, () => {
            console.log(`Server is running at http://localhost:${this.port}`);
        });
    }

    handleHelloRequest(req, res) {
        res.json({ message: 'Hello from your API!' });
    }

    handleWebSocketConnection(ws) {
        console.log('WebSocket connected');

        // Écoutez les messages WebSocket
        ws.on('message', (message) => {
            console.log(`Received message: ${message}`);

            // Envoyez un message de retour au client WebSocket
            ws.send(`Server received: ${message}`);
        });

        // Gérez la fermeture de la connexion WebSocket
        ws.on('close', () => {
            console.log('WebSocket disconnected');
        });
    }
}

// Créez une instance de la classe pour lancer le serveur
const server = new Server();
export { server };