import express from "express"
import { createServer } from "node:http"
import cors from "cors"
import { Server } from "socket.io"

const app = express()
const server = createServer(app)
app.use(cors())

const io = new Server(server, {
	cors: {
		origin: ["https://keypup.vercel.app", "http://localhost:3000"],
		methods: ["GET", "POST"],
	},
})

interface User {
	email: string
	finished: boolean
	id: string
	name: string
	mode: string
	subtype: string
	correctChars: number
	rawChars: number
}

interface Room {
	users: User[]
	mode: string
	subtype: string
}

// Rooms mapping: { roomCode: Room }
const rooms: Record<string, Room> = {}

io.on("connection", (socket) => {
	// Handle user joining a room
	socket.on("create_room", (roomCode: string, name: string, email: string) => {
		if (!rooms[roomCode]) {
			rooms[roomCode] = {
				users: [],
				mode: "",
				subtype: "",
			}
		}

		// Check if the user's socket ID is already in the room
		const userExists = rooms[roomCode].users.some((user) => user.id === socket.id)
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
			})
			socket.join(roomCode)
		} else {
			console.log(`User ${socket.id} is already in room ${roomCode}`)
		}
	})

	socket.on("check_room", (roomCode: string) => {
		if (rooms[roomCode]) {
			socket.emit("room_exists", true)
		} else {
			socket.emit("room_exists", false)
		}
	})

	socket.on("join_room", (roomCode: string, name: string, email: string) => {
		if (!rooms[roomCode]) {
			return
		}

		// Check if the user's socket ID is already in the room
		const userExists = rooms[roomCode].users.some((user) => user.id === socket.id)
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
			})
			socket.join(roomCode)
		} else {
			console.log(`User ${socket.id} is already in room ${roomCode}`)
		}

		io.to(roomCode).emit("room_users", rooms[roomCode].users)

		// Send the current mode and subtype to the new joiner
		socket.emit("changeNonHostMode", rooms[roomCode].mode, rooms[roomCode].subtype)

		socket.on("changeMode", (mode, selected) => {
			rooms[roomCode].mode = mode
			rooms[roomCode].subtype = selected
			io.to(roomCode).emit("changeNonHostMode", mode, selected)
		})

		socket.on("startGame", (initialWords: string[]) => {
			io.to(roomCode).emit("startNonHostGame", initialWords)
		})

		socket.on(
			"endGame",
			(
				mode: string,
				subtype: string,
				correctChars: number,
				rawChars: number,
				totalTime: number
			) => {
				if (rooms[roomCode]) {
					// Update the player's stats
					rooms[roomCode].users = rooms[roomCode].users.map((user) =>
						user.id === socket.id
							? {
									...user,
									mode,
									subtype,
									correctChars,
									rawChars,
									totalTime,
									finished: true,
							  }
							: user
					)

					// Check if all players have finished
					const allFinished = rooms[roomCode].users.every(
						(user) => user.finished
					)

					if (allFinished) {
						io.to(roomCode).emit(
							"gameResults",
							rooms[roomCode].users,
							roomCode
						)
					}
				}
			}
		)
	})

	// Handle user disconnection
	socket.on("disconnect", () => {
		// Remove user from all rooms they were part of
		for (const roomCode in rooms) {
			rooms[roomCode].users = rooms[roomCode].users.filter(
				(user) => user.id !== socket.id
			)

			// Notify other users in the room about the update
			io.to(roomCode).emit("room_users", rooms[roomCode].users)

			// Clean up empty rooms
			if (rooms[roomCode].users.length === 0) {
				delete rooms[roomCode]
			}
		}
	})
})

app.get("/", (req, res) => {
	res.send("Hello World")
})

server.listen(4000, () => {
	console.log("Server is running on port 4000")
})
