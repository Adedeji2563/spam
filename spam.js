const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const Pino = require("pino");
const {
    icon
} = require("./logo.js");
const clear = require("clear-console");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const G = "[32m";
const C = "[36m";
const R = "[31m";
const Y = "[33m";
const B = "[30m";
const M = "[35m";
const d = "[0m";
const bl = "[1m";
const BRed = "[41m";
const BGre = "[42m";
const BYel = "[43m";
const BCya = "[46m";

clear();
console.log(icon);

const pairingCode = process.argv.includes("--spamcode");

async function connectToWhatsapp() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: !pairingCode,
        browser: pairingCode ? ["Firefox (Linux)", "", ""] : ["Spambot", "Firefox", "1.0.0"],
        logger: Pino({ level: "silent" }),
        shouldReconnect: (reason) => {
            if (reason === DisconnectReason.loggedOut) {
                console.log(`${R}${bl}Device logged out, please clear 'auth' folder and restart.${d}`);
                return false;
            }
            return true;
        },
    });

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
            const code = lastDisconnect?.error?.output?.statusCode;
            const reasonText = DisconnectReason[code] || "Unknown";

            console.log(`${R}${bl}Connection closed [${reasonText}]${d}`);
            if (code !== DisconnectReason.loggedOut) {
                console.log(`${Y}${bl}Attempting to reconnect...${d}`);
                await connectToWhatsapp(); // retry
            }
        }

        if (connection === "open") {
            console.log(`${G}${bl}Successfully connected!${d}`);
        }

        if (update.qr) {
            console.log(`${Y}${bl}QR Code updated. Scan again if not yet scanned.${d}`);
        }

        console.log("Connection Update:", update);
    });

    sock.ev.on("creds.update", saveCreds);

    // Pairing code logic (only runs if --spamcode is used)
    if (pairingCode && !sock.authState.creds.registered) {
        setTimeout(() => {
            rl.question("Enter Number Target: +", async (phoneNumber) => {
                const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
                const fullNumber = formattedNumber.includes('@') ? formattedNumber : `${formattedNumber}@s.whatsapp.net`;

                const successMessages = [
                    `[ ${bl}${G}+${d} ]${G}${bl} Success Sending Pairing Code to${d} ${bl}${BGre} ${phoneNumber} ${d} `,
                    `[ ${bl}${Y}+${d} ]${Y}${bl} Success Sending Pairing Code to${d} ${bl}${BCya} ${phoneNumber} ${d} `
                ];
                const failureMessages = [
                    `[ ${bl}${R}!${d} ]${R}${bl} Failed to send pairing code to${d} ${bl}${BRed} ${phoneNumber}. Please check the number and try again.${d}`
                ];
                const randomMessage = (arr) => arr[Math.floor(Math.random() * arr.length)];

                try {
                    const code = await sock.requestPairingCode(fullNumber);
                    console.log(randomMessage(successMessages));
                    console.log(`${C}${bl}Pairing Code sent (check WhatsApp on ${phoneNumber}): ${bl}${Y}${code}${d}`);
                } catch (error) {
                    console.error(`${R}${bl}Error requesting pairing code for ${phoneNumber}:${d}`, error);
                    console.log(randomMessage(failureMessages));
                }

                rl.close();
            });
        }, 1000);
    }
}
