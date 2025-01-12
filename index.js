const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const nodemailer = require("nodemailer");

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

// Send mail using node mailer
const sendEmail = (emailAddress, emailData) => {
    // create email transporter
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: process.env.NODEMAILER_USER,
            pass: process.env.NODEMAILER_PASS,
        }
    })

    // Verify connection
    transporter.verify((error, success) => {
        if (error) {
            return console.error(error)
        } else {
            console.log('Transporter is ready to emails.', success)
        };
    })

    // transporter.sendMail()
    const mailBody = {
        form: process.env.NODEMAILER_USER,
        to: emailAddress,
        subject: emailData?.subject,
        html: `<div>${emailData?.message}</div>`,
    }

    // send email
    transporter.sendMail(mailBody, (error, info) => {
        if (error) {
            return console.error(error)
        } else {
            console.log('Email Sent: ' + info?.response)
        }
    })
}

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
        const db = client.db('DatabaseName')
        const usersCollection = db.collection('Users')


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

        // verify Admin
        const verifyAdmin = async (req, res, next) => {
            const email = req?.user?.email
            const query = { email };
            const user = await usersCollection.findOne(query)
            const isAdmin = user?.role === 'admin';
            if (!user || !isAdmin) {
                return res.status(403).send({ message: 'forbidden access. || only access admin!' });
            }
            next()
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

                // send email when first login
                if (result?.insertedId) {
                    sendEmail(user?.email, {
                        subject: "Welcome to [Your Website Name]!",
                        message: `
                          <p>Hi ${user.name},</p>
                          <p>Thank you for joining our community. We're thrilled to have you on board!</p>
                          <p>Here are a few things you can do to get started:</p>
                          <ul>
                            <li><strong>Explore:</strong> Discover features and services tailored to your needs.</li>
                            <li><strong>Update your profile:</strong> Personalize your experience by updating your profile <a href="[Profile Link]">here</a>.</li>
                            <li><strong>Get support:</strong> Need help? Visit our <a href="[Support Link]">Support Center</a>.</li>
                          </ul>
                          <p>If you have any questions, feel free to reply to this email or contact us directly at [Support Email].</p>
                          <p>Happy exploring!</p>
                          <p>Best regards,</p>
                          <p>The [Your Website Name] Team</p>
                          <hr>
                          <p style="font-size: 12px; color: #888;">If you did not sign up for this account, please ignore this email or contact us immediately at [Support Email].</p>
                        `
                    })
                }

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

    } catch (err) {
        console.error('Mongodb', err.message)
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello Programmer. How Are You? This Server For No-Name Website ❤️')
})

app.listen(port, () => {
    console.log(`☘️  You successfully connected to Server: ${port}`);
})