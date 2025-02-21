const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const { WebSocketServer } = require('ws'); // Import WebSocketServer from 'ws'

const app = express();
const port = process.env.PORT || 8080;

// Middleware
const corsOptions = {
    origin: ["http://localhost:5173"],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        await client.connect();
        console.log("☘️  You successfully connected to MongoDB!");

        // Database Collection Name
        const db = client.db('task-management');
        const usersCollection = db.collection('Users');
        const tasksCollection = db.collection('Tasks');

        // Verify Jwt Token
        const verifyToken = async (req, res, next) => {
            const token = req.cookies.task_management_token;
            if (!token) return res.status(401).send({ error: 'unauthorized access' });

            // Verify Token
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
                if (error) return res.status(401).send({ error: 'unauthorized access' });

                req.user = decoded;
                next();
            });
        };

        // Create Jwt Token
        app.post('/jwt', async (req, res) => {
            try {
                const userInfo = req.body;
                const token = jwt.sign(userInfo, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
                res.cookie('task_management_token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                }).send({ success: true });
            } catch (err) {
                console.error('JWT:', err.message);
                res.status(500).send({ error: 'Failed to create jwt token' });
            }
        });

        // Logout
        app.post('/logout', async (req, res) => {
            try {
                res.clearCookie('task_management_token', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                }).send({ success: true });
            } catch (error) {
                console.error('Logout:', error.message);
                res.status(500).send({ error: 'Failed to logout' });
            }
        });

        // Post Single User
        app.post('/users', async (req, res) => {
            try {
                const user = req.body;

                const isExist = await usersCollection.findOne({ email: user?.email });

                if (isExist) {
                    return res.send(isExist);
                }

                const result = await usersCollection.insertOne(user);
                res.send(result);
            } catch (error) {
                console.error('Post User:', error.message);
                res.status(500).send({ error: 'Failed to post user' });
            }
        });

        // Task Related APIs
        app.post('/tasks', async (req, res) => {
            try {
                const task = req.body;
                const result = await tasksCollection.insertOne(task);

                const insertedTask = await tasksCollection.findOne({ _id: result.insertedId });

                if (!insertedTask) {
                    throw new Error('Failed to fetch inserted task');
                }

                broadcastUpdate('taskCreated', insertedTask);

                res.send(insertedTask);
            } catch (error) {
                console.error('Post Task:', error.message);
                res.status(500).send({ error: 'Failed to post task' });
            }
        });

        app.get('/tasks/email', async (req, res) => {
            try {
                const tasks = await tasksCollection.find({}).toArray();
                res.send(tasks);
            } catch (error) {
                console.error('Get Tasks:', error.message);
                res.status(500).send({ error: 'Failed to get tasks' });
            }
        });

        app.put('/tasks/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const task = req.body;

                const result = await tasksCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: task }
                );

                // Fetch the updated document
                const updatedTask = await tasksCollection.findOne({ _id: new ObjectId(id) });

                if (!updatedTask) {
                    throw new Error('Failed to fetch updated task');
                }

                // Broadcast the updated task to all clients
                broadcastUpdate('taskUpdated', updatedTask);

                res.send(result);
            } catch (error) {
                console.error('Patch Task:', error.message);
                res.status(500).send({ error: 'Failed to patch task' });
            }
        });

        app.delete('/tasks/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await tasksCollection.deleteOne({ _id: new ObjectId(id) });

                // Broadcast the deleted task ID to all clients
                broadcastUpdate('taskDeleted', { _id: new ObjectId(id) });

                res.send(result);
            } catch (error) {
                console.error('Delete Task:', error.message);
                res.status(500).send({ error: 'Failed to delete task' });
            }
        });
    } catch (err) {
        console.error('MongoDB:', err.message);
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello Programmer. How Are You? This Server For My-Todos ❤️');
});

const server = app.listen(port, () => {
    console.log(`☘️  You successfully connected to Server: ${port}`);
});

const wss = new WebSocketServer({ server });

// Function to broadcast updates to all connected clients
const broadcastUpdate = (type, data) => {
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) { // Use client.OPEN instead of WebSocket.OPEN
            client.send(JSON.stringify({ type, data }));
        }
    });
};

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    // Send a welcome message to the client
    ws.send(JSON.stringify({ type: 'message', data: 'Connected to WebSocket server' }));

    // Handle WebSocket errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    // Handle WebSocket close
    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
});