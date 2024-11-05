let ws;
let username;
let mediaRecorder;
let audioChunks = [];

// Función para unirse al chat
function joinChat() {
    username = document.getElementById('username').value;
    if (!username) return alert('Por favor, ingresa tu nombre.');

    ws = new WebSocket('wss://a58c-181-209-185-138.ngrok-free.app');

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'connect', user: username }));
        document.getElementById('login-container').classList.add('d-none');
        document.getElementById('chat-container').classList.remove('d-none');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'history') {
            message.data.forEach(msg => displayMessage(msg)); // Mostrar todos los mensajes históricos
        } else if (message.type === 'message' || message.type === 'notification') {
            displayMessage(message.data); // Mostrar mensaje en tiempo real
        } else if (message.type === 'delete') {
            removeMessageFromUI(message.data.messageId);
        }
    };

    ws.onclose = () => {
        if (username) {
            displayMessage({ content: `${username} se ha desconectado.`, user: "Sistema" });
        }
    };
}

// Función para enviar un mensaje de texto
function sendMessage() {
    const input = document.getElementById('message-input');
    const message = { type: 'message', user: username, content: input.value };
    ws.send(JSON.stringify(message));
    input.value = '';
}

// Función para enviar un archivo
function sendFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        let fileType;
        if (file.type.startsWith('image')) {
            fileType = 'image';
        } else if (file.type.startsWith('audio')) {
            fileType = 'audio';
        } else if (file.type.startsWith('video')) {
            fileType = 'video';
        } else {
            alert("Solo se pueden enviar imágenes, audios o videos.");
            return;
        }

        const message = {
            type: 'file',
            user: username,
            fileType: fileType,
            fileData: reader.result.split(',')[1] // Extrae solo la parte base64
        };
        ws.send(JSON.stringify(message));
    };
    reader.readAsDataURL(file); // Lee el archivo como base64
}

// Función para iniciar la grabación de audio
function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Tu navegador no soporta grabación de audio");
        return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();
            audioChunks = [];

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Audio = reader.result.split(',')[1];
                    const audioMessage = {
                        type: 'file',
                        user: username,
                        fileType: 'audio',
                        fileData: base64Audio
                    };
                    ws.send(JSON.stringify(audioMessage));
                };
                reader.readAsDataURL(audioBlob); // Convierte el audio a base64
            };

            document.getElementById('stop-recording-btn').classList.remove('d-none');
        })
        .catch(error => {
            console.error("Error al acceder al micrófono:", error);
        });
}

// Función para detener la grabación de audio
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        document.getElementById('stop-recording-btn').classList.add('d-none');
    }
}

// Otras funciones de visualización y eliminación


// Función para eliminar un mensaje
function deleteMessage(messageId) {
    ws.send(JSON.stringify({ type: 'delete', user: username, messageId: messageId }));
}

// Función para mostrar mensajes en la interfaz
function displayMessage(message) {
    const messageContainer = document.getElementById('messages');
    const msgElement = document.createElement('div');

    // Verifica si el mensaje es del sistema y aplica la clase correspondiente
    if (message.user === "Sistema") {
        msgElement.classList.add('message-system'); // Aplica el estilo especial para mensajes del sistema
        msgElement.innerText = message.content;
    } else {
        // Aplica estilos para los mensajes normales
        msgElement.classList.add('message-container');
        msgElement.classList.add(message.user === username ? 'message-right' : 'message-left');
        msgElement.setAttribute('data-id', message._id);

        if (message.fileType === 'image') {
            msgElement.innerHTML = `<span class="message-user">${message.user}</span><img src="data:image/jpeg;base64,${message.fileData}" class="img-fluid" alt="Imagen enviada">`;
        } else if (message.fileType === 'audio') {
            msgElement.innerHTML = `<span class="message-user">${message.user}</span><audio controls src="data:audio/wav;base64,${message.fileData}"></audio>`;
        } else if (message.fileType === 'video') {
            msgElement.innerHTML = `<span class="message-user">${message.user}</span><video controls src="data:video/mp4;base64,${message.fileData}" class="img-fluid"></video>`;
        } else {
            msgElement.innerHTML = `<span class="message-user">${message.user}</span> ${message.content}`;
        }

        // Agrega el botón de opciones solo si el mensaje es del usuario actual
        if (message.user === username) {
            const optionsButton = document.createElement('button');
            optionsButton.className = 'options-button';
            optionsButton.innerHTML = '⋮';
            optionsButton.onclick = (e) => toggleOptionsMenu(e, msgElement);
            msgElement.appendChild(optionsButton);

            // Crear menú de opciones
            const optionsMenu = document.createElement('div');
            optionsMenu.className = 'options-menu';
            const deleteButton = document.createElement('button');
            deleteButton.innerText = 'Eliminar';
            deleteButton.onclick = () => deleteMessage(message._id);
            optionsMenu.appendChild(deleteButton);
            msgElement.appendChild(optionsMenu);
        }
    }

    messageContainer.appendChild(msgElement);
    messageContainer.scrollTop = messageContainer.scrollHeight; // Desplaza hacia abajo automáticamente
}


// Función para mostrar/ocultar el menú de opciones
function toggleOptionsMenu(event, msgElement) {
    event.stopPropagation();
    const optionsMenu = msgElement.querySelector('.options-menu');
    const isVisible = optionsMenu.style.display === 'block';
    document.querySelectorAll('.options-menu').forEach(menu => menu.style.display = 'none'); // Oculta otros menús
    optionsMenu.style.display = isVisible ? 'none' : 'block';
}

// Función para eliminar el mensaje de la interfaz
function removeMessageFromUI(messageId) {
    const messageContainer = document.getElementById('messages');
    const messageElement = messageContainer.querySelector(`[data-id='${messageId}']`);
    if (messageElement) {
        messageContainer.removeChild(messageElement);
    }
}

ws.onopen = () => {
    console.log("WebSocket conectado correctamente.");
    ws.send(JSON.stringify({ type: 'connect', user: username }));
};

ws.onmessage = (event) => {
    console.log("Mensaje recibido:", event.data);
    // Procesa el mensaje normalmente
};

ws.onerror = (error) => {
    console.error("Error en WebSocket:", error);
};

ws.onclose = () => {
    console.log("WebSocket desconectado.");
};



// Ocultar el menú cuando se hace clic fuera de él
document.addEventListener('click', () => {
    document.querySelectorAll('.options-menu').forEach(menu => menu.style.display = 'none');
});
