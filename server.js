const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ethers } = require("ethers");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const WSS_URL = "wss://ethereum-rpc.publicnode.com";
const provider = new ethers.WebSocketProvider(WSS_URL);

const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const erc20Abi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];

const usdtContract = new ethers.Contract(USDT_ADDRESS, erc20Abi, provider);
const usdcContract = new ethers.Contract(USDC_ADDRESS, erc20Abi, provider);

const WHALE_THRESHOLD = 1000000;

// === FITUR BARU: IN-MEMORY CACHE ===
const txHistory = [];
const MAX_HISTORY = 10; // Simpan 10 paus terakhir di RAM server

// Saat browser direfresh / dibuka
io.on("connection", (socket) => {
    // Langsung kirimkan riwayat data ke browser tersebut
    socket.emit("history", txHistory);
});

function startSniper(contract, symbol) {
    console.log(`Radar ${symbol} aktif...`);
    contract.on("Transfer", (from, to, value, event) => {
        const formattedValue = Number(ethers.formatUnits(value, 6));

        if (formattedValue >= WHALE_THRESHOLD) {
            const txHash = event.log.transactionHash;
            const whaleData = { symbol, amount: formattedValue, from, to, txHash };
            
            // === SIMPAN KE MEMORI SERVER SEBELUM DIKIRIM ===
            txHistory.unshift(whaleData); // Masukkan ke urutan paling atas (terbaru)
            if (txHistory.length > MAX_HISTORY) {
                txHistory.pop(); // Buang data paling bawah/lama agar RAM tidak penuh
            }

            // Tembakkan data baru ke semua browser yang sedang buka
            io.emit("whale_alert", whaleData);
            console.log(`Paus ${symbol} tertangkap: $${formattedValue.toLocaleString()}`);
        }
    });
}

startSniper(usdtContract, "USDT");
startSniper(usdcContract, "USDC");

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server Whale Tracker berjalan di port ${PORT}`);
});
