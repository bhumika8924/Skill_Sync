// server.js — SkillSync Real-time Backend (Socket.io + Express)
// Run with: node server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors({ origin: ["http://localhost:3000", "http://localhost:3001"], credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: ["http://localhost:3000", "http://localhost:3001"], methods: ["GET", "POST"] },
});

const USERS = {
    "bhumika@ncuindia.edu": {
        id: "u0", name: "Bhumika Sharma", password: "bhumika123", email: "bhumika@ncuindia.edu",
        avatar: "B", avatarColor: "#6C63FF", role: "Software Engineer", course: "B.Tech CSE",
        location: "Gurugram, India", github: "github.com/bhumika", about: "Passionate about building scalable web applications. Open to learning and sharing knowledge.",
        status: "Professional", experience: "4 Years",
        skillsOffered: ["React", "JavaScript", "CSS"], skillsWanted: ["Python", "Machine Learning"],
        stats: { swaps: 12, rating: 4.8, reviews: 24 },
    },
    "nikhil@ncuindia.edu": {
        id: "u1", name: "Nikhil Mehta", password: "nikhil123", email: "nikhil@ncuindia.edu",
        avatar: "N", avatarColor: "#FF6B6B", role: "Frontend Dev", course: "B.Tech CSE",
        location: "Delhi, India", github: "github.com/nikhilm", about: "Full-stack enthusiast focusing on performant architectures.",
        status: "Student", experience: "2 Years",
        skillsOffered: ["React", "TypeScript", "Node.js"], skillsWanted: ["Python", "ML", "AWS"],
        stats: { swaps: 8, rating: 4.7, reviews: 16 },
    },
    "priya@ncuindia.edu": {
        id: "u2", name: "Priya Agarwal", password: "priya123", email: "priya@ncuindia.edu",
        avatar: "P", avatarColor: "#00c6ff", role: "Data Scientist", course: "B.Tech AI",
        location: "Noida, India", github: "github.com/priya-ai", about: "Data science and AI researcher building smart models.",
        status: "Student", experience: "3 Years",
        skillsOffered: ["Python", "Machine Learning", "Pandas"], skillsWanted: ["React", "Node.js", "Flutter"],
        stats: { swaps: 15, rating: 4.9, reviews: 30 },
    },
    "simran@ncuindia.edu": {
        id: "u3", name: "Simran Kaur", password: "simran123", email: "simran@ncuindia.edu",
        avatar: "S", avatarColor: "#2ecc71", role: "UI/UX Designer", course: "B.Des",
        location: "Chandigarh, India", github: "dribbble.com/simran", about: "UI/UX designer obsessed with pixel-perfect and accessible interfaces.",
        status: "Professional", experience: "1.5 Years",
        skillsOffered: ["Figma", "UI/UX Design", "CSS"], skillsWanted: ["JavaScript", "React"],
        stats: { swaps: 5, rating: 4.6, reviews: 10 },
    },
    "aryan@ncuindia.edu": {
        id: "u4", name: "Aryan Singh", password: "aryan123", email: "aryan@ncuindia.edu",
        avatar: "A", avatarColor: "#f5c518", role: "DevOps Engineer", course: "B.Tech ECE",
        location: "Gurugram, India", github: "github.com/aryan-ops", about: "DevOps specialist focused on CI/CD, Docker, and AWS.",
        status: "Student", experience: "2 Years",
        skillsOffered: ["DevOps", "Docker", "AWS", "Linux"], skillsWanted: ["React", "Python"],
        stats: { swaps: 6, rating: 4.5, reviews: 12 },
    },
};

// userId → socketId
const onlineUsers = {};

// Default connections
const connections = {
    u0: new Set(["u1", "u2", "u3"]),
    u1: new Set(["u0", "u2"]),
    u2: new Set(["u0", "u1"]),
    u3: new Set(["u0"]),
    u4: new Set([]),
};

function convId(a, b) {
    return [a, b].sort().join("_");
}

// Seed messages
const messages = {
    [convId("u0", "u1")]: [
        { id: "m1", from: "u1", to: "u0", text: "Hey Bhumika! Want to swap React for Python?", time: "10:30 AM", createdAt: Date.now() - 3600000 },
        { id: "m2", from: "u0", to: "u1", text: "Absolutely! I've been wanting to learn Python for a while.", time: "10:32 AM", createdAt: Date.now() - 3500000 },
        { id: "m3", from: "u1", to: "u0", text: "Let's schedule a session this weekend 🙌", time: "10:35 AM", createdAt: Date.now() - 3400000 },
    ],
    [convId("u0", "u2")]: [
        { id: "m4", from: "u2", to: "u0", text: "Hi! I saw your profile. Your React skills are exactly what I need.", time: "2:00 PM", createdAt: Date.now() - 86400000 },
        { id: "m5", from: "u0", to: "u2", text: "And your ML expertise is perfect for me! Let's swap 🎯", time: "2:05 PM", createdAt: Date.now() - 86300000 },
    ],
};

// Meetings
const meetings = [];

// Requests (swap / message)
const requests = [];

/* ── REST API ── */
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = USERS[email];
    if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid email or password" });
    }
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, token: Buffer.from(email).toString("base64") });
});

app.get("/api/users", (req, res) => {
    const allUsers = Object.values(USERS).map(({ password: _, ...u }) => ({
        ...u, online: !!onlineUsers[u.id],
    }));
    res.json(allUsers);
});

app.get("/api/connections/:userId", (req, res) => {
    const set = connections[req.params.userId] || new Set();
    res.json([...set]);
});

app.post("/api/connections/:userId/add/:targetId", (req, res) => {
    const { userId, targetId } = req.params;
    if (!connections[userId]) connections[userId] = new Set();
    if (!connections[targetId]) connections[targetId] = new Set();
    connections[userId].add(targetId);
    connections[targetId].add(userId);
    io.emit("connection_updated", { userId, targetId, connected: true });
    res.json({ ok: true });
});

app.delete("/api/connections/:userId/remove/:targetId", (req, res) => {
    const { userId, targetId } = req.params;
    connections[userId]?.delete(targetId);
    connections[targetId]?.delete(userId);
    io.emit("connection_updated", { userId, targetId, connected: false });
    res.json({ ok: true });
});

app.get("/api/messages/:aId/:bId", (req, res) => {
    const id = convId(req.params.aId, req.params.bId);
    res.json(messages[id] || []);
});

app.get("/api/conversations/:userId", (req, res) => {
    const { userId } = req.params;
    const userConvs = [];
    Object.keys(messages).forEach(cid => {
        if (cid.includes(userId)) {
            const msgs = messages[cid];
            if (msgs.length > 0) {
                const partnerId = cid.replace(userId, "").replace("_", "");
                userConvs.push({
                    userId: partnerId,
                    messages: msgs,
                    lastMsg: msgs.at(-1)?.text,
                    time: msgs.at(-1)?.time
                });
            }
        }
    });
    // Sort by latest message
    userConvs.sort((a, b) => (b.messages.at(-1)?.createdAt || 0) - (a.messages.at(-1)?.createdAt || 0));
    res.json(userConvs);
});

app.get("/api/meetings/:userId", (req, res) => {
    const uid = req.params.userId;
    res.json(meetings.filter((m) => m.from === uid || m.to === uid));
});

app.post("/api/meetings", (req, res) => {
    const mtg = { id: `mtg_${Date.now()}`, ...req.body, createdAt: Date.now() };
    meetings.push(mtg);
    // Notify both participants
    [mtg.from, mtg.to].forEach((uid) => {
        const sid = onlineUsers[uid];
        if (sid) io.to(sid).emit("meeting_created", mtg);
    });
    res.json(mtg);
});

app.get("/api/requests/:userId", (req, res) => {
    res.json(requests.filter((r) => r.to === req.params.userId && r.status === "pending"));
});

/* ── SOCKET.IO ── */
io.on("connection", (socket) => {
    socket.on("authenticate", ({ userId }) => {
        if (!userId) return;
        socket.userId = userId;
        onlineUsers[userId] = socket.id;
        io.emit("user_status", { userId, online: true });
        socket.emit("online_users", Object.keys(onlineUsers));
    });

    socket.on("send_message", ({ from, to, text }) => {
        // Block messaging if users are not connected
        const fromConns = connections[from] || new Set();
        const toConns = connections[to] || new Set();
        if (!fromConns.has(to) || !toConns.has(from)) {
            const sid = onlineUsers[from];
            if (sid) io.to(sid).emit("message_blocked", { from, to, reason: "User has removed you from connection" });
            return;
        }

        const cid = convId(from, to);
        if (!messages[cid]) messages[cid] = [];
        const now = new Date();
        const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        const msg = { id: `m_${Date.now()}`, from, to, text, time, createdAt: Date.now() };
        messages[cid].push(msg);
        // Deliver to both users
        [from, to].forEach((uid) => {
            const sid = onlineUsers[uid];
            if (sid) io.to(sid).emit("new_message", { convId: cid, message: msg });
        });
    });

    socket.on("typing", ({ from, to }) => {
        const sid = onlineUsers[to];
        if (sid) io.to(sid).emit("user_typing", { from });
    });

    socket.on("swap_request", ({ from, to, offer, want }) => {
        const fromUser = Object.values(USERS).find(u => u.id === from);
        const fromName = fromUser ? fromUser.name : from;
        const req = { id: `req_${Date.now()}`, from, to, fromName, offer, want, type: "swap", status: "pending", createdAt: Date.now() };
        requests.push(req);
        const sid = onlineUsers[to];
        if (sid) io.to(sid).emit("incoming_request", req);
    });

    socket.on("message_request", ({ from, to }) => {
        // Look up sender's name from USERS
        const fromUser = Object.values(USERS).find(u => u.id === from);
        const fromName = fromUser ? fromUser.name : from;
        const req = { id: `req_${Date.now()}`, from, to, fromName, type: "message", status: "pending", createdAt: Date.now() };
        requests.push(req);
        const sid = onlineUsers[to];
        if (sid) io.to(sid).emit("incoming_request", req);
    });

    socket.on("accept_request", ({ requestId, userId }) => {
        const req = requests.find((r) => r.id === requestId);
        if (req) {
            req.status = "accepted";
            // Add as connection if swap request
            if (req.type === "swap" || req.type === "message") {
                if (!connections[req.from]) connections[req.from] = new Set();
                if (!connections[req.to]) connections[req.to] = new Set();
                connections[req.from].add(req.to);
                connections[req.to].add(req.from);
                io.emit("connection_updated", { userId: req.from, targetId: req.to, connected: true });
            }
            const sid = onlineUsers[req.from];
            if (sid) io.to(sid).emit("request_accepted", req);
        }
    });

    socket.on("disconnect", () => {
        if (socket.userId) {
            delete onlineUsers[socket.userId];
            io.emit("user_status", { userId: socket.userId, online: false });
        }
    });
});

const PORT = 3002;
server.listen(PORT, () => {
    console.log(`\n🚀 SkillSync backend running on http://localhost:${PORT}`);
    console.log("\n📋 User Credentials:");
    Object.entries(USERS).forEach(([email, u]) => {
        console.log(`   ${u.name}: ${email} / ${u.password}`);
    });
});
