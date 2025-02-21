const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');

const app = express();
const port = process.env.PORT || 3000;

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
// // const uri = `mongodb+srv://tasks-management:p6jL0shQqdNY9N9c@tariqul-islam.mchvj.mongodb.net/?retryWrites=true&w=majority&appName=TARIQUL-ISLAM`

// const uri = `mongodb+srv://tasks-management:p6jL0shQqdNY9N9c@tariqul-islam.mchvj.mongodb.net/?retryWrites=true&w=majority&appName=TARIQUL-ISLAM`

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
                res.send(result);
            } catch (error) {
                console.error('Post Task:', error.message);
                res.status(500).send({ error: 'Failed to post task' });
            }
        });

        app.get('/tasks/:email', async (req, res) => {
            try {
                const email = req.params.email;
                const tasks = await tasksCollection.find({ user: email }).toArray();
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

app.listen(port, () => {
    console.log(`☘️  You successfully connected to Server: ${port}`);
});