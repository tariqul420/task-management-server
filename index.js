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
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

const uri = `mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@tariqul-islam.mchvj.mongodb.net/?retryWrites=true&w=majority&appName=TARIQUL-ISLAM`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // await client.connect();
        // await client.db("admin").command({ ping: 1 });
        console.log("☘️  You successfully connected to MongoDB!");

        // Database Collection Name
        const db = client.db('task-manager')
        const usersCollection = db.collection('Users')
        const tasksCollection = db.collection('Tasks')

        // Verify Jwt Token
        const verifyToken = async (req, res, next) => {
            const token = req.cookies.TokenName
            if (!token) return res.status(401).send({ error: 'unauthorized access' })

            // Verify Token
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
                if (error) return res.status(401).send({ error: 'unauthorized access' })

                req.user = decoded
                next()
            })
        }

        // Create Jwt Token
        app.post('/jwt', async (req, res) => {
            try {
                const userInfo = req.body
                const token = jwt.sign(userInfo, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
                res.cookie('TokenName', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                }).send({ success: true })
            } catch (err) {
                console.error('JWT:', err.message)
                res.status(500).send({ error: 'Failed to create jwt token' })
            }
        })

        //logout when not access jwt token
        app.post('/logout', async (req, res) => {
            try {
                res.clearCookie('ServiceOrbit_Token', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                }).send({ success: true })
            } catch (error) {
                console.error('Logout:', err.message)
                res.status(500).send({ error: 'Failed to logout when not access jwt token' })
            }
        })

        // post single user in the database
        app.post('/users', async (req, res) => {
            try {
                const user = req.body

                const isExist = await usersCollection.findOne({ email: user?.email })

                if (isExist) {
                    return res.send(isExist)
                }

                const result = await usersCollection.insertOne(user)
                res.send(result)
            } catch (error) {
                console.error('Post User:', error.message)
                res.status(500).send({ error: 'Failed to post user' })
            }
        })

        // get user role
        app.get('/users/role/:email', verifyToken, async (req, res) => {
            try {
                const email = req.params.email

                if (req?.user?.email !== email) {
                    return res.status(403).send({ message: 'forbidden access' });
                }

                const result = await usersCollection.findOne({ email })

                res.send({ role: result?.role })
            } catch (error) {
                console.error('Check Role:', error.message)
                res.status(500).send({ error: 'Failed to check role' })
            }
        })

        // ---------------------- task related api ----------------------


    } catch (err) {
        console.error('Mongodb', err.message)
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello Programmer. How Are You? This Server For My-Todos ❤️')
})

app.listen(port, () => {
    console.log(`☘️  You successfully connected to Server: ${port}`);
})