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
    const {
        state,
        saveCreds
    } = await useMultiFileAuthState("auth");
    const sock = makeWASocket({
        printQRInTerminal: !pairingCode,
        browser: pairingCode ? ["Firefox (Linux)", "", ""] : ["DryashzBot", "Firefox", "1.0.0"],
        auth: state,
        logger: Pino({
            level: "silent"
        }),
        shouldReconnect: (reason) => {
            if (reason === DisconnectReason.loggedOut) {
                console.log(`${R}${bl}Device logged out, please clear 'auth' folder and restart.${d}`);
                return false;
            }
            return true;
        },
    });

    sock.ev.process(
        async (events) => {
            if (events['connection.update']) {
                const update = events['connection.update'];
                const {
                    connection,
                    lastDisconnect
                } = update;
                if (connection === 'close') {
                    if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                        console.log(`${R}${bl}Connection closed unexpectedly, trying to reconnect...${d}`);
                        connectToWhatsapp();
                    }
                }
                console.log('Connection Update:', update);
            }

            if (events['creds.update']) {
                await saveCreds();
            }

            if (pairingCode && !sock.authState.creds.registered && events['connection.update']?.connection === 'open') {
                setTimeout(() => {
                    rl.question("Enter Number Target: +", async (phoneNumber) => {
                        const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
                        const fullNumber = formattedNumber.includes('@') ? formattedNumber : `${formattedNumber}@s.whatsapp.net`;

                        const successMessages = [`[ ${bl}${G}+${d} ]${G}${bl} Success Sending Pairing Code to${d} ${bl}${BGre} ${phoneNumber} ${d} `, `[ ${bl}${Y}+${d} ]${Y}${bl} Success Sending Pairing Code to${d} ${bl}${BCya} ${phoneNumber} ${d} `];
                        const failureMessages = [`[ ${bl}${R}!${d} ]${R}${bl} Failed to send pairing code to${d} ${bl}${BRed} ${phoneNumber}. Please check the number and try again.${d}`];

                        const randomMessage = (arr) => arr[Math.floor(Math.random() * arr.length)];

                        const sendCodeInterval = setInterval(async () => {
                            try {
                                const code = await sock.requestPairingCode(fullNumber);
                                console.log(randomMessage(successMessages));
                                console.log(`${C}${bl}Pairing Code sent (check WhatsApp on ${phoneNumber}): ${bl}${Y}${code}${d}`);
                                clearInterval(sendCodeInterval); // Stop after successful send
                                rl.close();
                            } catch (error) {
                                console.error(`${R}${bl}Error requesting pairing code for ${phoneNumber}:${d}`, error);
                                console.log(randomMessage(failureMessages));
                                // Optionally, you might want to limit the number of retries or ask for a new number
                            }
                        }, 3000);
                    });
                }, 1000);
            }
        }
    );
}

connectToWhatsapp();
