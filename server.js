const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


// Configuración de CORS para permitir conexiones desde cualquier origen
app.use(cors());

// Conectar a MongoDB Atlas usando mongoose
mongoose.connect('mongodb+srv://bryan:bryan@cluster0.7gwki.mongodb.net/Chat', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Definir el esquema y modelo de MongoDB
const messageSchema = new mongoose.Schema({
    user: String,
    content: String,
    fileType: String,
    fileData: String, 
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Mensajes', messageSchema);

app.use(express.static('public'));

// Manejar conexiones WebSocket
wss.on('connection', (ws) => {
    let userName;

    // Enviar mensajes históricos al nuevo cliente desde MongoDB
    Message.find().sort({ timestamp: 1 }).then(messages => {
        ws.send(JSON.stringify({ type: 'history', data: messages }));
    });

    ws.on('message', async (message) => {
        const data = JSON.parse(message);

        if (data.type === 'connect') {
            userName = data.user;
            const notification = { user: "Sistema", content: `${userName} se ha unido al chat.` };
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'notification', data: notification }));
                }
            });
        } else if (data.type === 'message') {
            const chatMessage = new Message({ user: data.user, content: data.content });
            await chatMessage.save();
            console.log('Mensaje guardado en MongoDB');

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'message', data: chatMessage }));
                }
            });
        } else if (data.type === 'file') {
            const fileMessage = new Message({ user: data.user, fileType: data.fileType, fileData: data.fileData });
            await fileMessage.save();
            console.log('Archivo guardado en MongoDB');

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'message', data: fileMessage }));
                }
            });
        } else if (data.type === 'delete' && data.user === userName) {
            try {
                await Message.findByIdAndDelete(data.messageId);
                console.log('Mensaje eliminado de MongoDB');

                // Notificar a todos los clientes para que eliminen el mensaje de la interfaz
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'delete', data: { messageId: data.messageId } }));
                    }
                });
            } catch (err) {
                console.error('Error al eliminar el mensaje:', err);
            }
        }
    });

    ws.on('close', () => {
        if (userName) {
            const notification = { user: "Sistema", content: `${userName} se ha desconectado.` };
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'notification', data: notification }));
                }
            });
        }
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
