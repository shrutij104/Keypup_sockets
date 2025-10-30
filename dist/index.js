"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_http_1 = require("node:http");
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const app = (0, express_1.default)();
const server = (0, node_http_1.createServer)(app);
app.use((0, cors_1.default)());
const io = new socket_io_1.Server(server, {
    cors: {
        origin: ["https://keypup.vercel.app", "http://localhost:3000"],
        methods: ["GET", "POST"],
    },
});
// Rooms mapping: { roomCode: Room }
const rooms = {};
io.on("connection", (socket) => {
    // Handle user joining a room
    socket.on("create_room", (roomCode, name, email) => {
        if (!rooms[roomCode]) {
            rooms[roomCode] = {
                users: [],
                mode: "",
                subtype: "",
            };
        }
        // Check if the user's socket ID is already in the room
        const userExists = rooms[roomCode].users.some((user) => user.id === socket.id);
        if (!userExists) {
            rooms[roomCode].users.push({
                email,
                id: socket.id,
                name,
                finished: false,
                mode: "",
                subtype: "",
                correctChars: 0,
                rawChars: 0,
            });
            socket.join(roomCode);
        }
        else {
            console.log(`User ${socket.id} is already in room ${roomCode}`);
        }
    });
    socket.on("check_room", (roomCode) => {
        if (rooms[roomCode]) {
            socket.emit("room_exists", true);
        }
        else {
            socket.emit("room_exists", false);
        }
    });
    socket.on("join_room", (roomCode, name, email) => {
        if (!rooms[roomCode]) {
            return;
        }
        // Check if the user's socket ID is already in the room
        const userExists = rooms[roomCode].users.some((user) => user.id === socket.id);
        if (!userExists) {
            rooms[roomCode].users.push({
                email,
                id: socket.id,
                name,
                finished: false,
                mode: rooms[roomCode].mode,
                subtype: rooms[roomCode].subtype,
                correctChars: 0,
                rawChars: 0,
            });
            socket.join(roomCode);
        }
        else {
            console.log(`User ${socket.id} is already in room ${roomCode}`);
        }
        io.to(roomCode).emit("room_users", rooms[roomCode].users);
        // Send the current mode and subtype to the new joiner
        socket.emit("changeNonHostMode", rooms[roomCode].mode, rooms[roomCode].subtype);
        socket.on("changeMode", (mode, selected) => {
            rooms[roomCode].mode = mode;
            rooms[roomCode].subtype = selected;
            io.to(roomCode).emit("changeNonHostMode", mode, selected);
        });
        socket.on("startGame", (initialWords) => {
            io.to(roomCode).emit("startNonHostGame", initialWords);
        });
        socket.on("endGame", (mode, subtype, correctChars, rawChars, totalTime) => {
            if (rooms[roomCode]) {
                // Update the player's stats
                rooms[roomCode].users = rooms[roomCode].users.map((user) => user.id === socket.id
                    ? Object.assign(Object.assign({}, user), { mode,
                        subtype,
                        correctChars,
                        rawChars,
                        totalTime, finished: true }) : user);
                // Check if all players have finished
                const allFinished = rooms[roomCode].users.every((user) => user.finished);
                if (allFinished) {
                    io.to(roomCode).emit("gameResults", rooms[roomCode].users, roomCode);
                }
            }
        });
    });
    // Handle user disconnection
    socket.on("disconnect", () => {
        // Remove user from all rooms they were part of
        for (const roomCode in rooms) {
            rooms[roomCode].users = rooms[roomCode].users.filter((user) => user.id !== socket.id);
            // Notify other users in the room about the update
            io.to(roomCode).emit("room_users", rooms[roomCode].users);
            // Clean up empty rooms
            if (rooms[roomCode].users.length === 0) {
                delete rooms[roomCode];
            }
        }
    });
});
app.get("/", (req, res) => {
    res.send("Hello World");
});
server.listen(4000, () => {
    console.log("Server is running on port 4000");
});
