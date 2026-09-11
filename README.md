# Tin Can Radio

Tin Can Radio is a small, self-hosted internet radio application designed to be easy to deploy on almost any server. It lets a single broadcaster stream microphone input or local audio files from any supported device while multiple listeners tune in through their browsers.

The project consists of:

- a Go backend built with [Pion WebRTC](https://github.com/pion/webrtc);
- a React frontend for listening to the station and managing a live broadcast.

Tin Can Radio is intentionally lightweight and currently focuses on live, one-to-many audio broadcasting rather than media storage or automated playback.

## Requirements

- Go
- Node.js and npm
- A TLS certificate and private key

TLS is required in production because browser media capture and other Web Platform features used by the application require a secure context. `localhost` may be used over plain HTTP during local development.

## Prebuilt Release

[Linux 64](https://github.com/Tripod311/tin_can_radio/releases/download/1.0.0/tin_can_linux_64.zip)
[Windows 64](https://github.com/Tripod311/tin_can_radio/releases/download/1.0.0/tin_can_win_64.zip)

## Building from Source

Clone the repository:

```bash
git clone <repository-url>
cd tin-can-radio
```

Build the server:

```bash
cd server
go build -o ../tin-can .
cd ..
```

Install the frontend dependencies and create a production build:

```bash
npm install
npx vite build
```

The compiled frontend is written to the build output directory configured in `vite.config`.

## Configuration

Place your TLS certificate and private key somewhere accessible to the server, then create or edit the application configuration:

```json
{
    "port": 8080,
    "tls": {
        "cert": "path_to_cert",
        "key": "path_to_key"
    },
    "broadcastPassword": "tinpwd",
    "iceServers": [],
    "description": {
        "title": "Tin Can Test",
        "description": "Example Tin Can radio station"
    }
}
```

The configuration controls:

- the HTTPS port;
- the TLS certificate and private-key paths;
- the password required to enter the studio;
- optional STUN and TURN servers used by WebRTC;
- the station name and description displayed to listeners.

### Custom Logo

To customize the station page, place one of the following files next to the server binary:

```text
logo.png
logo.jpg
logo.webp
```

The server will discover the file and display it as the station logo.

### PWA Customization

The frontend can be installed as a Progressive Web App. After building the client, edit its web app manifest and replace the generated icons to customize the installed application name, colors, and branding.

## Running

Start the compiled server binary:

```bash
./tin-can
```

## Broadcasting

Tin Can Radio supports one active broadcaster and multiple concurrent listeners, subject to the available server and network capacity. Audio is available only while a broadcaster is connected and transmitting.

To start a broadcast:

1. Open the station page.
2. Select **Enter studio**.
3. Enter the broadcast password from the server configuration.
4. Capture microphone input or add local audio files such as songs and jingles.
5. Switch between live voice and local media as needed during the broadcast.

Media files selected in the studio remain on the broadcaster's device and are not uploaded to or persisted by the server.

## Current Limitations

- Only one broadcaster can be connected at a time.
- Broadcasting stops when the broadcaster disconnects.
- Uploaded media is not stored on the server.
- Automatic or shuffled media playback is not currently available.

## Roadmap

Possible future improvements include:

- server-side media persistence;
- shuffled playback while no broadcaster is connected;
- broadcast recording;
- a plugin system for extending the server and studio.

The roadmap is exploratory and does not represent a fixed release schedule.

## Project Status

Tin Can Radio is an experimental project developed primarily for personal use. It is provided without guarantees of continued development, production readiness, or long-term support. The codebase is open for anyone who wants to adapt it, extend it, or implement features that are not currently available.
