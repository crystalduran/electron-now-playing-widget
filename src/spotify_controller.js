const { ipcRenderer } = require('electron');
require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const REDIRECT_URI = 'spotify-desktop-controller://callback';
const SCOPES = ['user-read-playback-state', 'user-modify-playback-state'];
// generate a random state for validation
const state = Math.random().toString(36).substring(2, 15);

let accessToken = localStorage.getItem('spotify_access_token');
let tokenExpiration = localStorage.getItem('spotify_token_expiration');
let isPlaying = false;

// check if the token exists and is still valid
if (!accessToken || !tokenExpiration || Date.now() >= tokenExpiration) {
    accessToken = null;
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expiration');
}


function login() {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}&state=${state}&show_dialog=true`;
    require('electron').shell.openExternal(authUrl);
}


// handle the callback from main process
ipcRenderer.on('auth-callback', (event, params) => {
    console.log('Auth callback received:', params);
    accessToken = params.access_token;

    if (accessToken) {
        const expiresIn = params.expires_in * 1000; // convert seconds to milliseconds
        const expirationTime = Date.now() + expiresIn;

        // sve token and expiration time
        localStorage.setItem('spotify_access_token', accessToken);
        localStorage.setItem('spotify_token_expiration', expirationTime);

        showPlayer();
        fetchPlayerStatus();
    } else {
        console.error('Access token missing from params');
    }
});

function showPlayer() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('player-section').style.display = 'block';
}

let pollingInterval;

async function fetchPlayerStatus() {
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch('https://api.spotify.com/v1/me/player', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (response.status === 401) {
                console.warn('Token expired. Please log in again.');
                clearInterval(pollingInterval);
                document.getElementById('login-section').style.display = 'block';
                document.getElementById('player-section').style.display = 'none';
                localStorage.removeItem('spotify_access_token');
                localStorage.removeItem('spotify_token_expiration');
                return;
            }

            const data = await response.json();
            if (!data || !data.item) return;

            // actualizar el estado de isPlaying basado en la respuesta
            isPlaying = data.is_playing;

            // actualizar UI con los detalles de la canción actual
            updateTrackInfo('track-name', data.item.name);
            document.getElementById('artist-name').textContent = data.item.artists[0].name;
            document.getElementById('album-art').src = data.item.album.images[0].url;

            // obtener progreso si está disponible
            const progressMs = data.progress_ms || 0;
            const durationMs = data.item.duration_ms || 1; 

            // calcular el progreso como porcentaje
            const progress = (progressMs / durationMs) * 100;
            console.log('Progress:', progress);
            // actualizar la barra de progreso
            const progressBar = document.getElementById('progress');
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }

            document.getElementById('play-button-image').src = isPlaying ? 'assets/pause-svgrepo-com.svg' : 'assets/play-svgrepo-com.svg';
        } catch (error) {
            console.error('Error fetching player status:', error);
        }
    }, 5000);  
}

function updateTrackInfo(elementId, text, maxLength = 17) {
    const element = document.getElementById(elementId);
    element.innerHTML = ""; 

    let span = document.createElement("span");
    span.textContent = text;

    if (text.length > maxLength) {
        element.appendChild(span);
    } else {
        element.textContent = text;
    }
}

async function togglePlay() {
    const endpoint = isPlaying ? 'pause' : 'play';

    const response = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (response.ok) {
        // toggle el estado de isPlaying
        isPlaying = !isPlaying;
        document.getElementById('play-button-image').src = isPlaying ? "pause-svgrepo-com.svg" : "play-svgrepo-com.svg";
    } else {
        console.error('Error toggling play:', response.statusText);
    }
}

async function next() {
    await fetch('https://api.spotify.com/v1/me/player/next', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
}

async function previous() {
    await fetch('https://api.spotify.com/v1/me/player/previous', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
}

document.getElementById('login-button').addEventListener('click', login);
document.getElementById('play-button').addEventListener('click', togglePlay);
document.getElementById('previous-button').addEventListener('click', previous);
document.getElementById('next-button').addEventListener('click', next);


document.getElementById('close-btn').addEventListener('click', () => {
  ipcRenderer.send('close-app'); // envía el evento al proceso principal
});

